import type { VercelRequest, VercelResponse } from '@vercel/node'
import { buildShareStartParam, buildLegacyShareStartParam } from '../../_lib/attribution.js'
import { buildMaxDeepLink } from '../../_lib/deeplink.js'
import { resolveQuizRequest } from '../../_lib/quizRequest.js'
import { quizCodeFor, resultCodeFor } from '../../../src/content/quizzes/codes.js'
import { validateMaxInitData } from '../../_lib/maxInitData.js'
import { maxSendMessage } from '../../_lib/maxApi.js'
import { buildMaxAttachments, createMaxImageAttachment } from '../../_lib/maxMedia.js'
import { RESULT_ID_REGEX } from '../../../src/features/quiz/schema.js'
import {
  resolveBandResultId,
  resolveShareCardAsset,
  shareCardImageUrl,
  shareCardThumbUrl,
} from '../../../src/features/quiz/scoring.js'

function fail(res: VercelResponse, status: number, error: string): void {
  res.status(status).json({ ok: false, error })
}

function requireEnv(name: string): string | null {
  const v = process.env[name]
  return v && v.trim().length > 0 ? v.trim() : null
}

/**
 * POST /api/max/share/prepare
 *
 * Body: { quizId, resultId, score?, initDataRaw }
 *
 * Flow (security):
 * 1. validate MAX initData (HMAC) — userId only from signed payload
 * 2. resolve quiz/result, validate score band
 * 3. resolve card asset server-side (never client URL)
 * 4. build MAX deep link with attribution s2_<code>_<code>_<uid>
 * 5. POST /messages to MAX Bot API (user_id = validated id) — get mid
 * 6. return { ok:true, mid }
 *
 * Client then calls window.WebApp.shareMaxContent({mid, chatType:'DIALOG'})
 * Requires user click (MAX enforces).
 */
export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') {
    fail(res, 405, 'method_not_allowed')
    return
  }

  const token = requireEnv('MAX_BOT_TOKEN')
  const appBaseUrl = requireEnv('APP_BASE_URL')
  const maxBotUsername = requireEnv('MAX_BOT_USERNAME')
  if (!token || !appBaseUrl || !maxBotUsername) {
    fail(res, 503, 'share_not_configured')
    return
  }

  const body = req.body as
    | { quizId?: unknown; resultId?: unknown; score?: unknown; initDataRaw?: unknown }
    | undefined
  const quizId = typeof body?.quizId === 'string' && body.quizId ? body.quizId : undefined
  const resultId = typeof body?.resultId === 'string' ? body.resultId : ''
  const initDataRaw = typeof body?.initDataRaw === 'string' ? body.initDataRaw : ''
  const rawScore = typeof body?.score === 'number' ? body.score : undefined

  if (!RESULT_ID_REGEX.test(resultId)) {
    fail(res, 400, 'invalid_request')
    return
  }
  const selection = resolveQuizRequest(quizId, resultId)
  if (!selection.ok) {
    fail(res, 400, selection.error)
    return
  }
  const { quiz, result } = selection.selection
  if (!initDataRaw) {
    fail(res, 401, 'invalid_init_data')
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
      fail(res, 400, 'invalid_score')
      return
    }
    if (resolveBandResultId(quiz, rawScore) !== result.id) {
      fail(res, 400, 'invalid_score')
      return
    }
    score = rawScore
  }

  let userId: number
  try {
    ;({ userId } = validateMaxInitData(initDataRaw, token))
  } catch {
    fail(res, 401, 'invalid_init_data')
    return
  }

  let startParam: string
  try {
    startParam = buildShareStartParam(quizCodeFor(quiz.id), resultCodeFor(quiz.id, result.id), userId)
  } catch {
    startParam = buildLegacyShareStartParam(result.id, userId)
  }

  const deepLink = buildMaxDeepLink(maxBotUsername, startParam)
  const cardAsset = resolveShareCardAsset(quiz, result, score)
  const imageUrl = shareCardImageUrl(quiz, cardAsset, appBaseUrl)
  const thumbUrl = shareCardThumbUrl(quiz, cardAsset, appBaseUrl)
  void thumbUrl
  const headline = score === undefined ? `${result.title} — ${result.presentation.subtitle}` : score
  const messageText = [
    typeof headline === 'string' ? headline : `Я набрала ${score}/${quiz.questions.length} в тесте «${quiz.title}»`,
    '',
    `«${result.presentation.shareQuote}»`,
    '',
    quiz.copy.shareHeadline,
  ].join('\n')

  // Unified media transport: preflight + upload-token with URL fallback
  const imageHost = (() => {
    try {
      return new URL(imageUrl).host
    } catch {
      return 'invalid_url'
    }
  })()
  const version = (() => {
    try {
      const p = new URL(imageUrl).pathname
      if (p.includes('/v3/')) return 'v3'
      if (p.includes('/v2/')) return 'v2'
      return 'v1'
    } catch {
      return 'unknown'
    }
  })()

  let imageAttachment: Awaited<ReturnType<typeof createMaxImageAttachment>>
  try {
    imageAttachment = await createMaxImageAttachment({ token, imageUrl, assetKey: cardAsset })
  } catch (e) {
    console.warn(`[max-media] prepare_create_failed asset=${cardAsset} host=${imageHost} error=${e instanceof Error ? e.message.slice(0, 80) : String(e).slice(0, 80)}`)
    imageAttachment = { attachment: null, via: 'none' }
  }

  const attachments = imageAttachment.attachment
    ? buildMaxAttachments(imageAttachment.attachment, deepLink)
    : [
        {
          type: 'inline_keyboard',
          payload: { buttons: [[{ type: 'link', text: 'Пройти тест', url: deepLink }]] },
        },
      ]

  if (!imageAttachment.attachment) {
    console.warn(`[max-media] no_image_attachment asset=${cardAsset} host=${imageHost} quizId=${quiz.id}`)
  }

  const payload: Record<string, unknown> = {
    user_id: userId,
    text: `${messageText}\n\n${deepLink}`,
    attachments,
  }

  try {
    let resultSend = await maxSendMessage(token, payload as never, {
      quizId: quiz.id,
      resultId: result.id,
    })

    console.info(
      `[max-share] status=${resultSend.status} ok=${resultSend.ok} mid=${resultSend.mid ? 'present' : 'none'} ` +
        `resultId=${result.id} asset=${cardAsset} host=${imageHost} version=${version} via=${imageAttachment.via} quizId=${quiz.id} ` +
        `transport=${resultSend.ok && resultSend.mid ? 'prepared_mid' : 'fallback_text'} ` +
        `code=${(resultSend as unknown as { errorCode?: string }).errorCode ?? 'n/a'}`,
    )

    // Controlled retry: if attachment was via token and MAX complained about attachment, retry once with URL
    const isAttachmentError =
      !resultSend.ok &&
      ((resultSend.errorCode && /attachment/i.test(resultSend.errorCode)) ||
        (resultSend.errorMessage && /attachment|image|payload/i.test(resultSend.errorMessage)) ||
        resultSend.status === 400)

    if (isAttachmentError && imageAttachment.via === 'token') {
      console.info(`[max-share] retry_with_url asset=${cardAsset} host=${imageHost} quizId=${quiz.id}`)
      const fallbackPayload: Record<string, unknown> = {
        user_id: userId,
        text: `${messageText}\n\n${deepLink}`,
        attachments: [
          { type: 'image', payload: { url: imageUrl } },
          { type: 'inline_keyboard', payload: { buttons: [[{ type: 'link', text: 'Пройти тест', url: deepLink }]] } },
        ],
      }
      const retry = await maxSendMessage(token, fallbackPayload as never, {
        quizId: quiz.id,
        resultId: result.id,
      })
      console.info(
        `[max-share] retry_status=${retry.status} ok=${retry.ok} mid=${retry.mid ? 'present' : 'none'} asset=${cardAsset} host=${imageHost} quizId=${quiz.id}`,
      )
      if (retry.ok && retry.mid) {
        res.status(200).json({ ok: true, mid: retry.mid })
        return
      }
      // if retry also fails, fall through to failure handling
      resultSend = retry
    }

    if (resultSend.ok && resultSend.mid) {
      console.info(`[max-share] prepare=success mid=present transport=prepared_mid asset=${cardAsset} host=${imageHost} quizId=${quiz.id}`)
      res.status(200).json({ ok: true, mid: resultSend.mid })
      return
    }

    if (resultSend.ok) {
      console.warn(`[max-share] prepare=failed reason=max_mid_missing asset=${cardAsset} host=${imageHost} quizId=${quiz.id} transport=fallback_text`)
      res.status(200).json({ ok: false, error: 'max_mid_missing' })
      return
    }

    console.warn(`[max-share] prepare=failed status=${resultSend.status} asset=${cardAsset} host=${imageHost} quizId=${quiz.id} transport=fallback_text code=${resultSend.errorCode ?? 'n/a'}`)
    fail(res, 502, 'max_failure')
  } catch (e) {
    console.warn(`[max-share] prepare=failed exception asset=${cardAsset} host=${imageHost} quizId=${quiz.id} error=${e instanceof Error ? e.message.slice(0, 80) : String(e).slice(0, 80)}`)
    fail(res, 502, 'max_failure')
  }
}
