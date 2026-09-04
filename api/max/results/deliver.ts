import type { VercelRequest, VercelResponse } from '@vercel/node'
import { resolveAttribution } from '../../_lib/attribution.js'
import { buildMaxDeepLink } from '../../_lib/deeplink.js'
import { resolveQuizRequest } from '../../_lib/quizRequest.js'
import { validateMaxInitData } from '../../_lib/maxInitData.js'
import { maxSendMessage } from '../../_lib/maxApi.js'
import { buildMaxAttachments, createMaxImageAttachment } from '../../_lib/maxMedia.js'
import { RESULT_ID_REGEX } from '../../../src/features/quiz/schema.js'
import {
  resolveBandResultId,
  resolveShareCardAsset,
  resolveShareCardVersion,
  shareCardImageUrl,
} from '../../../src/features/quiz/scoring.js'

// Serverless dedup — platform namespaced + attempt-aware.
// Key when completionId present: max:<userId>:<quizId>:<completionId>
// Fallback (legacy clients without completionId): max:<userId>:<quizId>:<resultId>
// We store the successful mid per key for idempotent reuse.
const deliveredSelfCache = new Map<string, string>()
const deliveredSharerSet = new Set<string>()

function requireEnv(name: string): string | null {
  const v = process.env[name]
  return v && v.trim().length > 0 ? v.trim() : null
}

async function sendMaxPhoto(
  token: string,
  chatId: number,
  imageUrl: string,
  caption: string,
  deepLink: string,
  cardAsset: string,
  opts?: { quizId?: string; resultId?: string },
): Promise<{ ok: boolean; mid?: string; via?: string; errorCode?: string }> {
  // Unified media: create attachment via token or URL with preflight
  let imageAttachment: Awaited<ReturnType<typeof createMaxImageAttachment>> | null = null
  try {
    imageAttachment = await createMaxImageAttachment({ token, imageUrl, assetKey: cardAsset })
  } catch (e) {
    console.warn(`[max-media] deliver_create_failed asset=${cardAsset} error=${e instanceof Error ? e.message.slice(0, 80) : String(e).slice(0, 80)}`)
  }
  const host = (() => {
    try {
      return new URL(imageUrl).host
    } catch {
      return 'invalid_url'
    }
  })()
  const attachments = imageAttachment?.attachment
    ? buildMaxAttachments(imageAttachment.attachment, deepLink)
    : [
        {
          type: 'inline_keyboard',
          payload: { buttons: [[{ type: 'link', text: 'Пройти тест', url: deepLink }]] },
        },
      ]
  const payload: Record<string, unknown> = {
    user_id: chatId,
    text: `${caption}\n\n${deepLink}`,
    attachments,
  }
  let r = await maxSendMessage(token, payload as never, {
    quizId: opts?.quizId,
    resultId: opts?.resultId,
  })
  // Controlled retry: if token attachment failed due to attachment error, retry with URL
  const isAttachmentError =
    !r.ok &&
    ((r.errorCode && /attachment/i.test(r.errorCode)) ||
      (r.errorMessage && /attachment|image|payload/i.test(r.errorMessage)) ||
      r.status === 400)
  if (isAttachmentError && imageAttachment?.via === 'token') {
    console.info(`[max-media] deliver_retry_with_url asset=${cardAsset} host=${host} chatId=${chatId}`)
    const fallbackPayload: Record<string, unknown> = {
      user_id: chatId,
      text: `${caption}\n\n${deepLink}`,
      attachments: [
        { type: 'image', payload: { url: imageUrl } },
        { type: 'inline_keyboard', payload: { buttons: [[{ type: 'link', text: 'Пройти тест', url: deepLink }]] } },
      ],
    }
    r = await maxSendMessage(token, fallbackPayload as never, {
      quizId: opts?.quizId,
      resultId: opts?.resultId,
    })
    const hasMid = typeof r.mid === 'string' && r.mid.length > 0
    return { ok: Boolean(r.ok && hasMid), mid: r.mid, via: 'url-retry', errorCode: hasMid ? r.errorCode : (r.errorCode ?? 'max_mid_missing') }
  }
  const hasMid = typeof r.mid === 'string' && r.mid.length > 0
  return { ok: Boolean(r.ok && hasMid), mid: r.mid, via: imageAttachment?.via, errorCode: hasMid ? r.errorCode : (r.errorCode ?? 'max_mid_missing') }
}

/**
 * POST /api/max/results/deliver
 *
 * Body: { quizId, resultId, score?, initDataRaw, completionId? }
 *
 * Mirrors Telegram deliver but for MAX transport.
 * 1. validate MAX initData → userId
 * 2. resolve quiz/result + score
 * 3. send own card
 * 4. inspect startParam from signed payload → attribution
 * 5. if same-quiz attribution → notify sharer (platform-scoped, no cross-post to Telegram)
 * 6. attempt-aware idempotency via completionId
 *
 * Response: { ok:true, deliveredSelf, deliveredSharer, selfMid: string|null }
 */
export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'method_not_allowed' })
    return
  }

  const token = requireEnv('MAX_BOT_TOKEN')
  const appBaseUrl = requireEnv('APP_BASE_URL')
  const maxBotUsername = requireEnv('MAX_BOT_USERNAME')
  if (!token || !appBaseUrl || !maxBotUsername) {
    res.status(503).json({ ok: false, error: 'share_not_configured' })
    return
  }
  const baseUrl = appBaseUrl.replace(/\/$/, '')

  const body = req.body as
    | { quizId?: unknown; resultId?: unknown; score?: unknown; initDataRaw?: unknown; completionId?: unknown }
    | undefined
  const quizId = typeof body?.quizId === 'string' && body.quizId ? body.quizId : undefined
  const resultId = typeof body?.resultId === 'string' ? body.resultId : ''
  const initDataRaw = typeof body?.initDataRaw === 'string' ? body.initDataRaw : ''
  const rawScore = typeof body?.score === 'number' ? body.score : undefined
  const rawCompletionId = typeof body?.completionId === 'string' ? body.completionId.trim() : undefined
  // completionId is for idempotency only, never for auth. Validate loosely as UUID or 8-128 alnum/_/-
  const completionId =
    rawCompletionId && rawCompletionId.length >= 8 && rawCompletionId.length <= 128 && /^[A-Za-z0-9_-]{8,128}$/.test(rawCompletionId)
      ? rawCompletionId
      : rawCompletionId && /^[0-9a-fA-F-]{36}$/.test(rawCompletionId) // also allow hyphenated UUID (already covered but explicit)
        ? rawCompletionId
        : undefined

  if (!RESULT_ID_REGEX.test(resultId)) {
    res.status(400).json({ ok: false, error: 'invalid_request' })
    return
  }
  const selection = resolveQuizRequest(quizId, resultId)
  if (!selection.ok) {
    res.status(400).json({ ok: false, error: selection.error })
    return
  }
  const { quiz, result } = selection.selection
  if (!initDataRaw) {
    res.status(400).json({ ok: false, error: 'invalid_request' })
    return
  }

  let score: number | undefined
  if (quiz.scoring.kind === 'correct-count') {
    const total = quiz.questions.length
    if (
      typeof rawScore !== 'number' ||
      !Number.isInteger(rawScore) ||
      rawScore < 0 ||
      rawScore > total
    ) {
      res.status(400).json({ ok: false, error: 'invalid_score' })
      return
    }
    if (resolveBandResultId(quiz, rawScore) !== result.id) {
      res.status(400).json({ ok: false, error: 'invalid_score' })
      return
    }
    score = rawScore
  }

  let userId: number
  let firstName: string | undefined
  let startParam: string | undefined
  try {
    ;({ userId, firstName, startParam } = validateMaxInitData(initDataRaw, token))
  } catch {
    res.status(401).json({ ok: false, error: 'invalid_init_data' })
    return
  }

  const cardAsset = resolveShareCardAsset(quiz, result, score)
  const imageUrl = shareCardImageUrl(quiz, cardAsset, baseUrl)
  const deepLink = buildMaxDeepLink(maxBotUsername, `quiz_${quiz.id}`)

  // 1. Self card — attempt-aware idempotency
  const selfKey = completionId ? `max:${userId}:${quiz.id}:${completionId}` : `max:${userId}:${quiz.id}:${result.id}`
  let deliveredSelf = false
  let selfMid: string | null = null
  let selfVia: string | undefined
  let selfError: string | undefined
  if (deliveredSelfCache.has(selfKey)) {
    const cachedMid = deliveredSelfCache.get(selfKey) ?? null
    if (cachedMid) {
      deliveredSelf = true
      selfMid = cachedMid
      console.info(`[max-deliver] target=self user=${userId} quiz=${quiz.id} result=${result.id} ok=true deliveredSelf=true dedup=hit mid=present completionId=${completionId ?? 'none'}`)
    } else {
      deliveredSelf = false
      console.info(`[max-deliver] target=self user=${userId} quiz=${quiz.id} result=${result.id} ok=true deliveredSelf=false dedup=hit-no-mid`)
    }
  } else {
    const headline =
      score === undefined ? `${result.title} — ${result.presentation.subtitle}` : `Твой счёт: ${score} из ${quiz.questions.length}`
    const caption = [headline, '', `«${result.presentation.shareQuote}»`, '', quiz.copy.deliverOwnLine].join('\n')
    const host = (() => {
      try {
        return new URL(imageUrl).host
      } catch {
        return 'invalid_url'
      }
    })()
    const version = resolveShareCardVersion(quiz, imageUrl)
    const resultSend = await sendMaxPhoto(token, userId, imageUrl, caption, deepLink, cardAsset, {
      quizId: quiz.id,
      resultId: result.id,
    })
    deliveredSelf = Boolean(resultSend.ok && resultSend.mid)
    selfMid = resultSend.mid ?? null
    selfVia = resultSend.via
    selfError = resultSend.errorCode
    if (deliveredSelf && selfMid) deliveredSelfCache.set(selfKey, selfMid)
    if (deliveredSelf) {
      console.info(`[max-deliver] target=self user=${userId} quiz=${quiz.id} result=${result.id} asset=${cardAsset} host=${host} version=${version} media=${selfVia ?? 'none'} ok=true deliveredSelf=true mid=present completionId=${completionId ?? 'none'}`)
    } else {
      console.warn(`[max-deliver] target=self user=${userId} quiz=${quiz.id} result=${result.id} asset=${cardAsset} host=${host} version=${version} media=${selfVia ?? 'none'} ok=false reason=${selfError ?? 'n/a'} deliveredSelf=false mid=none completionId=${completionId ?? 'none'}`)
    }
  }

  // 2. Sharer notification — platform-scoped (never via Telegram API)
  let deliveredSharer = false
  const attribution = resolveAttribution(startParam)
  let sharerUserId = attribution?.sharerUserId ?? null

  if (attribution?.version === 2 && attribution.quizId !== quiz.id) {
    console.warn(`[max-deliver] attribution quiz mismatch: link=${attribution.quizId} completed=${quiz.id}; suppressed`)
    sharerUserId = null
  }
  const sharerKey = `sharer:${selfKey}`
  if (sharerUserId !== null && sharerUserId !== userId && !deliveredSharerSet.has(sharerKey)) {
    const who = firstName || 'Твой друг'
    const sharerCaption = [
      `${who} прошёл(а) тест по твоей открытке! 🎉`,
      '',
      `Результат — «${result.title}»`,
      '',
      'Хочешь узнать свой?',
    ].join('\n')
    const host = (() => {
      try {
        return new URL(imageUrl).host
      } catch {
        return 'invalid_url'
      }
    })()
    const version = resolveShareCardVersion(quiz, imageUrl)
    const resultSend = await sendMaxPhoto(token, sharerUserId, imageUrl, sharerCaption, deepLink, cardAsset, {
      quizId: quiz.id,
      resultId: result.id,
    })
    deliveredSharer = Boolean(resultSend.ok && resultSend.mid)
    if (deliveredSharer) deliveredSharerSet.add(sharerKey)
    if (deliveredSharer) {
      console.info(`[max-deliver] target=sharer user=${sharerUserId} quiz=${quiz.id} result=${result.id} asset=${cardAsset} host=${host} version=${version} media=${resultSend.via ?? 'none'} ok=true deliveredSharer=true by=${userId} completionId=${completionId ?? 'none'}`)
    } else {
      console.warn(`[max-deliver] target=sharer user=${sharerUserId} quiz=${quiz.id} result=${result.id} asset=${cardAsset} host=${host} version=${version} media=${resultSend.via ?? 'none'} ok=false reason=${resultSend.errorCode ?? 'n/a'} deliveredSharer=false by=${userId}`)
    }
  } else if (sharerUserId !== null && sharerUserId !== userId) {
    // dedup hit
    console.info(`[max-deliver] target=sharer user=${sharerUserId} ok=true dedup=hit completionId=${completionId ?? 'none'}`)
    // if we already delivered sharer for this completion, consider deliveredSharer true via dedup? But we don't have cached flag.
    // For idempotent duplicates, report as true if previously delivered
    if (deliveredSharerSet.has(sharerKey)) {
      deliveredSharer = true
    }
  }

  res.status(200).json({ ok: true, deliveredSelf, deliveredSharer, selfMid })
}
