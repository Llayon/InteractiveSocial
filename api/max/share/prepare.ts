import type { VercelRequest, VercelResponse } from '@vercel/node'
import { buildShareStartParam, buildLegacyShareStartParam } from '../../_lib/attribution.js'
import { buildMaxDeepLink } from '../../_lib/deeplink.js'
import { resolveQuizRequest } from '../../_lib/quizRequest.js'
import { quizCodeFor, resultCodeFor } from '../../../src/content/quizzes/codes.js'
import { validateMaxInitData } from '../../_lib/maxInitData.js'
import { maxSendMessage } from '../../_lib/maxApi.js'
import { RESULT_ID_REGEX } from '../../../src/features/quiz/schema.js'
import { resolveBandResultId, resolveShareCardAsset } from '../../../src/features/quiz/scoring.js'

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
  const imageUrl = `${appBaseUrl.replace(/\/$/, '')}/share-cards/${cardAsset}.jpg`
  const thumbUrl = `${appBaseUrl.replace(/\/$/, '')}/share-cards/${cardAsset}_thumb.jpg`
  const headline = score === undefined ? `${result.title} — ${result.presentation.subtitle}` : score
  const messageText = [
    typeof headline === 'string' ? headline : `Я набрала ${score}/${quiz.questions.length} в тесте «${quiz.title}»`,
    '',
    `«${result.presentation.shareQuote}»`,
    '',
    quiz.copy.shareHeadline,
  ].join('\n')

  // MAX Bot API: send message with image attachment if supported, else text+link
  // We try remote URL first (official contract says remote URL may be accepted).
  // If MAX requires upload token, this will be rejected and we fallback to text link in future iteration.
  // For now we send text + link and attempt attachments field — if MAX ignores unknown fields, text still delivers.
  const payload: Record<string, unknown> = {
    user_id: userId,
    text: `${messageText}\n\n${deepLink}\n${imageUrl}`,
    // Attempt to attach image — MAX may accept URL or require upload token.
    // We include both photo_url style and attachments array for compatibility probing.
    // Structured logging will show status.
    link: deepLink,
    attachments: [
      {
        type: 'image',
        url: imageUrl,
        // some versions expect payload.url, some payload.photo_url
        photo_url: imageUrl,
        thumbnail_url: thumbUrl,
      },
    ],
    // Inline keyboard: try both telegram-style and max-style; MAX will ignore unknown
    inline_keyboard: [[{ text: 'Пройти тест', url: deepLink }]],
    keyboard: { inline_keyboard: [[{ text: 'Пройти тест', url: deepLink }]] },
  }

  // Wrap with timeout via maxSendMessage
  try {
    const resultSend = await maxSendMessage(token, payload as never, {
      quizId: quiz.id,
      resultId: result.id,
    })

    // Log asset info for diagnostics (no secrets)
    const imageHost = (() => {
      try {
        return new URL(imageUrl).host
      } catch {
        return 'invalid_url'
      }
    })()
    console.info(
      `[max-share] status=${resultSend.status} ok=${resultSend.ok} mid=${resultSend.mid ? 'present' : 'none'} ` +
        `resultId=${result.id} asset=${cardAsset} host=${imageHost} quizId=${quiz.id}`,
    )

    if (resultSend.ok && resultSend.mid) {
      res.status(200).json({ ok: true, mid: resultSend.mid })
      return
    }

    // If MAX returned ok but no mid (variations), try to extract from raw
    if (resultSend.ok) {
      // Still return success with whatever mid we have, or fallback to text link sharing
      // If no mid at all, we treat as fallback path — client will use text/link share
      res.status(200).json({ ok: false, error: 'max_mid_missing' })
      return
    }

    fail(res, 502, 'max_failure')
  } catch {
    fail(res, 502, 'max_failure')
  }
}
