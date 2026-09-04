import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  buildShareStartParam,
  buildLegacyShareStartParam,
} from '../_lib/attribution.js'
import { resolveQuizRequest } from '../_lib/quizRequest.js'
import { quizCodeFor, resultCodeFor } from '../../src/content/quizzes/codes.js'
import { validateInitData } from '../_lib/initData.js'
import { RESULT_ID_REGEX } from '../../src/features/quiz/schema.js'
import {
  preparedShareId,
  resolveBandResultId,
  resolveShareCardAsset,
  shareCardBasePath,
  shareCardImageUrl,
  shareCardThumbUrl,
} from '../../src/features/quiz/scoring.js'

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
    | { quizId?: unknown; resultId?: unknown; score?: unknown; initDataRaw?: unknown }
    | undefined
  const quizId = typeof body?.quizId === 'string' && body.quizId ? body.quizId : undefined
  const resultId = typeof body?.resultId === 'string' ? body.resultId : ''
  const initDataRaw = typeof body?.initDataRaw === 'string' ? body.initDataRaw : ''
  const rawScore = typeof body?.score === 'number' ? body.score : undefined

  // Canonical result-id grammar (namespaced ids are legal; legacy [a-z]+ too).
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

  /**
   * Correct-count quizzes must carry the exact score so the share card can
   * show it. Server-side validation: integer, inside 0..total, and the
   * computed band for that score MUST equal the supplied resultId (an
   * impossible score/result pair is rejected, never guessed around).
   *
   * SECURITY NOTE: the score is client-authoritative in this playful
   * result/share MVP and can technically be forged. It must NEVER be trusted
   * for leaderboards, competition, rewards, ranking or prizes — a future
   * competitive mode requires server-trusted session/state.
   */
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
    ;({ userId } = validateInitData(initDataRaw, token))
  } catch {
    fail(res, 401, 'invalid_init_data')
    return
  }

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
  // Correct-count quizzes resolve the EXACT-SCORE card (score_08 …); the
  // asset name is always server-computed, never a client-supplied URL.
  // Versioned path (e.g. /share-cards/v2/m90_score_10.jpg) busts Telegram cache.
  const cardAsset = resolveShareCardAsset(quiz, result, score)
  const imageUrl = shareCardImageUrl(quiz, cardAsset, appBaseUrl)
  const thumbUrl = shareCardThumbUrl(quiz, cardAsset, appBaseUrl)
  const headline = score === undefined ? `${result.title} — ${result.presentation.subtitle}` : score
  const messageText = [
    typeof headline === 'string'
      ? headline
      : `Я набрала ${score}/${quiz.questions.length} в тесте «${quiz.title}»`,
    '',
    `«${result.presentation.shareQuote}»`,
    '',
    quiz.copy.shareHeadline,
  ].join('\n')

  // Telegram's media proxy downloads photo_url asynchronously; a transient
  // failure there leaves the prepared message without an image. A single
  // retry of savePreparedInlineMessage covers the flaky-network case.
  // Telegram prepared-message contract (Bot API 8.0+):
  //   • type=photo (required — 'article' sends text only)
  //   • id is a per-quiz unique slug (Telegram rejects id collisions
  //     within the bot's inline cache)
  //   • photo_url + thumbnail_url both HTTPS, both reachable;
  //     Telegram proxies them asynchronously
  //   • caption within 1024 chars
  //   • inline_keyboard markup supported
  //   • user_id is the validated initData user (never a client field)
  //   • allow_user_chats / allow_group_chats / allow_channel_chats
  //     control where the user can route the message
  // Diagnostics: safe, no secrets/PII — proves caption reaches Telegram
  // Compatibility pass: testing caption BELOW image (false) so artwork is first visual hit.
  // If real device hides caption with false, must revert to true (visible wins over position).
  const versionTag = shareCardBasePath(quiz) || 'v1'
  console.info(
    `[share-caption] quizId=${quiz.id} resultId=${result.id} score=${score ?? 'none'} ` +
      `captionLength=${messageText.length} captionPresent=${messageText.length > 0} ` +
      `showCaptionAboveMedia=false asset=${cardAsset} version=${versionTag}`,
  )

  const payload = JSON.stringify({
    user_id: userId,
    allow_user_chats: true,
    allow_group_chats: true,
    allow_channel_chats: true,
    result: {
      // 'photo' (not 'article') so the image is attached to the message
      // the recipient actually receives; article results send text only
      // and show the thumbnail solely in the inline picker.
      type: 'photo',
      id: preparedShareId(quiz, result, score),
      title: result.title,
      description: result.presentation.shareQuote,
      photo_url: imageUrl,
      photo_width: 1080,
      photo_height: 1350,
      thumbnail_url: thumbUrl,
      // Caption carries the message text (1024-char limit is ample here).
      // show_caption_above_media=false requests caption BELOW the photo so the
      // share-card artwork is the first visual hit: [IMAGE] → [TEXT] → [BUTTON].
      // Previous pass used true ([TEXT]→[IMAGE]→[BUTTON]) because without this field
      // some Telegram clients hid the caption entirely. If false again hides it,
      // revert to true — visible caption wins over position.
      caption: messageText,
      show_caption_above_media: false,
      reply_markup: {
        inline_keyboard: [[{ text: 'Пройти тест', url: deepLink }]],
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
    // in person. Captures the actual error_description returned by Bot API,
    // the prepared-id on success, the asset name, the image host (so we
    // can spot Vercel origin / wrong host), and the quizId.
    const imageHost = (() => {
      try {
        return new URL(imageUrl).host
      } catch {
        return 'invalid_url'
      }
    })()
    console.info(
      `[share] telegram status=${apiResponse.status} ok=${json?.ok ?? 'parse_err'} ` +
        `desc=${json?.description ?? 'n/a'} resultId=${result.id} ` +
        `asset=${cardAsset} host=${imageHost} quizId=${quiz.id} ` +
        `preparedId=${json && json.result && typeof json.result.id === 'string' ? json.result.id : 'none'}`,
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
