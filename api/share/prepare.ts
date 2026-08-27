import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  buildShareStartParam,
  buildLegacyShareStartParam,
} from '../_lib/attribution.js'
import { resolveQuizRequest } from '../_lib/quizRequest.js'
import { quizCodeFor, resultCodeFor } from '../../src/content/quizzes/codes.js'
import { validateInitData } from '../_lib/initData.js'

function fail(res: VercelResponse, status: number, error: string): void {
  res.status(status).json({ ok: false, error })
}

function requireEnv(name: string): string | null {
  const value = process.env[name]
  return value && value.trim().length > 0 ? value.trim() : null
}

interface TelegramApiResponse {
  ok?: boolean
  result?: { id?: unknown }
  error_code?: number
  description?: string
}

/**
 * POST /api/share/prepare
 *
 * Body: { resultId: string, initDataRaw: string }
 *
 * Flow (security notes):
 * 1. initData signature + freshness validated server-side; user_id is taken
 *    ONLY from the validated payload — never from a client body field.
 * 2. resultId checked against the content allowlist.
 * 3. Image URL and deep link are built exclusively from server-side config:
 *    ${APP_BASE_URL}/share-cards/<asset>.jpg and t.me deep link with
 *    startapp=share_<resultId>.
 * 4. Bot token stays server-only.
 */
export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') {
    fail(res, 405, 'method_not_allowed')
    return
  }

  const token = requireEnv('TELEGRAM_BOT_TOKEN')
  const appBaseUrl = requireEnv('APP_BASE_URL')
  const botUsername = requireEnv('TELEGRAM_BOT_USERNAME')
  if (!token || !appBaseUrl || !botUsername) {
    fail(res, 503, 'share_not_configured')
    return
  }
  const appShortName = requireEnv('TELEGRAM_APP_SHORT_NAME') ?? 'app'

  const body = req.body as
    | { quizId?: unknown; resultId?: unknown; initDataRaw?: unknown }
    | undefined
  const quizId = typeof body?.quizId === 'string' && body.quizId ? body.quizId : undefined
  const resultId = typeof body?.resultId === 'string' ? body.resultId : ''
  const initDataRaw = typeof body?.initDataRaw === 'string' ? body.initDataRaw : ''

  if (!/^[a-z]+$/.test(resultId)) {
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

  let userId: number
  try {
    ;({ userId } = validateInitData(initDataRaw, token))
  } catch {
    fail(res, 401, 'invalid_init_data')
    return
  }

  // Promo channel appended as a second button row on every shared message
  // (configurable, falls back to the Бюро историй channel).
  const promoChannelUrl =
    process.env.PROMO_CHANNEL_URL && process.env.PROMO_CHANNEL_URL.trim().length > 0
      ? process.env.PROMO_CHANNEL_URL.trim()
      : 'https://t.me/takeiteasybefore'

  // Attribution: the sharer's validated id rides in the startapp parameter
  // (v2 wire codes), so /api/results/deliver can notify them when a friend
  // completes the quiz. Codes failing to resolve degrade to the legacy
  // format rather than producing an unopenable link.
  let startParam: string
  try {
    startParam = buildShareStartParam(
      quizCodeFor(quiz.id),
      resultCodeFor(quiz.id, result.id),
      userId,
    )
  } catch {
    startParam = buildLegacyShareStartParam(result.id, userId)
  }
  const deepLink = `https://t.me/${botUsername}/${appShortName}?startapp=${startParam}`
  // InlineQueryResultPhoto requires JPEG URLs (PNG is not accepted by
  // Telegram for photo results), so the shared card uses .jpg assets.
  // thumbnail_url is a REQUIRED field of InlineQueryResultPhoto — omitting
  // it fails with 400 PHOTO_THUMB_URL_EMPTY (verified in production logs).
  const imageUrl = `${appBaseUrl.replace(/\/$/, '')}/share-cards/${result.shareImage}.jpg`
  const thumbUrl = `${appBaseUrl.replace(/\/$/, '')}/share-cards/${result.shareImage}_thumb.jpg`
  const messageText = [
    `${result.title} — ${result.subtitle}`,
    '',
    `«${result.shareQuote}»`,
    '',
    'Какой интерьерный характер у тебя? Пройди тест:',
  ].join('\n')

  // Telegram's media proxy downloads photo_url asynchronously; a transient
  // failure there leaves the prepared message without an image. A single
  // retry of savePreparedInlineMessage covers the flaky-network case.
  const payload = JSON.stringify({
    user_id: userId,
    allow_user_chats: true,
    result: {
      // 'photo' (not 'article') so the image is attached to the message
      // the recipient actually receives; article results send text only
      // and show the thumbnail solely in the inline picker.
      type: 'photo',
      id: `share_${result.id}`,
      title: result.title,
      description: result.shareQuote,
      photo_url: imageUrl,
      photo_width: 1080,
      photo_height: 1350,
      thumbnail_url: thumbUrl,
      // Caption carries the message text (1024-char limit is ample here).
      caption: messageText,
      reply_markup: {
        inline_keyboard: [
          [{ text: 'Пройти тест', url: deepLink }],
          [{ text: '✨ Бюро историй', url: promoChannelUrl }],
        ],
      },
    },
  })

  const callApi = async (): Promise<Response> => {
    const attemptController = new AbortController()
    const attemptTimeout = setTimeout(() => attemptController.abort(), 8_000)
    try {
      return await fetch('https://api.telegram.org/bot' + token + '/savePreparedInlineMessage', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: payload,
        signal: attemptController.signal,
      })
    } finally {
      clearTimeout(attemptTimeout)
    }
  }

  try {
    let apiResponse: Response
    try {
      apiResponse = await callApi()
    } catch {
      apiResponse = await callApi()
    }

    const json = (await apiResponse.json().catch(() => null)) as TelegramApiResponse | null

    // Log every Telegram response (one line, no secrets) so a missing-image
    // regression can be diagnosed from `vercel logs` without reproducing it
    // in person. Captures the actual error_description returned by Bot API.
    console.info(
      `[share] telegram status=${apiResponse.status} ok=${json?.ok ?? 'parse_err'} ` +
        `desc=${json?.description ?? 'n/a'} resultId=${result.id}`,
    )

    if (json && json.ok && json.result && typeof json.result.id === 'string') {
      res.status(200).json({ ok: true, id: json.result.id })
      return
    }

    const description = json?.description ?? ''
    if (json?.error_code === 404 || /method is not found|not supported/i.test(description)) {
      // Telegram client or bot does not support prepared messages yet —
      // the frontend will degrade to the fallback share path.
      res.status(200).json({ ok: false, error: 'share_unsupported' })
      return
    }

    fail(res, 502, 'telegram_failure')
  } catch {
    fail(res, 502, 'telegram_failure')
  }
}
