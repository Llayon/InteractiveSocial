import type { VercelRequest, VercelResponse } from '@vercel/node'
import { resolveAttribution } from '../_lib/attribution.js'
import { resolveQuizRequest } from '../_lib/quizRequest.js'
import { validateInitData } from '../_lib/initData.js'

interface TelegramApiResponse {
  ok?: boolean
  error_code?: number
  description?: string
}

const SEND_TIMEOUT_MS = 8_000

// Best-effort dedup: serverless instances are ephemeral, so this only guards
// against double-sends within one warm instance. The client fires the call
// once per quiz completion anyway.
const delivered = new Set<string>()

function requireEnv(name: string): string | null {
  const value = process.env[name]
  return value && value.trim().length > 0 ? value.trim() : null
}

async function callTelegram(
  token: string,
  method: string,
  payload: Record<string, unknown>,
): Promise<TelegramApiResponse> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), SEND_TIMEOUT_MS)
  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })
    const json = (await response.json().catch(() => null)) as TelegramApiResponse | null
    // Log every Bot API call (one line, no secrets) so a missing-image
    // regression on /api/results/deliver is diagnosable from `vercel logs`.
    console.info(
      `[deliver] ${method} status=${response.status} ok=${json?.ok ?? 'parse_err'} ` +
        `desc=${json?.description ?? 'n/a'}`,
    )
    return json ?? {}
  } catch {
    console.warn(`[deliver] ${method} network_error`)
    return {}
  } finally {
    clearTimeout(timeout)
  }
}

/**
 * POST /api/results/deliver
 *
 * Body: { resultId: string, initDataRaw: string }
 *
 * Called by the client right after a user completes the quiz. Two sends:
 * 1. To the completer — their own result photo card (the bot gained write
 *    access when they launched the Mini App from a link).
 * 2. To the original sharer (parsed from the SIGNED initData start_param,
 *    never from the request body) — "your friend finished, here is their
 *    result" with a deep link to take the test themselves.
 */
export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'method_not_allowed' })
    return
  }

  const token = requireEnv('TELEGRAM_BOT_TOKEN')
  const appBaseUrl = requireEnv('APP_BASE_URL')
  const botUsername = requireEnv('TELEGRAM_BOT_USERNAME')
  if (!token || !appBaseUrl || !botUsername) {
    res.status(503).json({ ok: false, error: 'share_not_configured' })
    return
  }
  const appShortName = requireEnv('TELEGRAM_APP_SHORT_NAME') ?? 'app'
  const promoChannelUrl =
    process.env.PROMO_CHANNEL_URL && process.env.PROMO_CHANNEL_URL.trim().length > 0
      ? process.env.PROMO_CHANNEL_URL.trim()
      : 'https://t.me/takeiteasybefore'
  const baseUrl = appBaseUrl.replace(/\/$/, '')

  const body = req.body as
    | { quizId?: unknown; resultId?: unknown; initDataRaw?: unknown }
    | undefined
  const quizId = typeof body?.quizId === 'string' && body.quizId ? body.quizId : undefined
  const resultId = typeof body?.resultId === 'string' ? body.resultId : ''
  const initDataRaw = typeof body?.initDataRaw === 'string' ? body.initDataRaw : ''

  if (!/^[a-z]+$/.test(resultId)) {
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

  let userId: number
  let firstName: string | undefined
  let startParam: string | undefined
  try {
    ;({ userId, firstName, startParam } = validateInitData(initDataRaw, token))
  } catch {
    res.status(401).json({ ok: false, error: 'invalid_init_data' })
    return
  }

  const imageUrl = `${baseUrl}/share-cards/${result.shareImage}.jpg`
  // Play-again deep links carry the quiz identity, not attribution — the
  // quiz resolver routes `quiz_<id>` launches without any user binding.
  const deepLink = `https://t.me/${botUsername}/${appShortName}?startapp=quiz_${quiz.id}`
  const promoRow = [{ text: '✨ Бюро историй', url: promoChannelUrl }]
  const playAgainRow = [{ text: 'Пройти тест', url: deepLink }]

  // 1. The completer's own card into their chat with the bot.
  const selfKey = `${userId}:${result.id}`
  let deliveredSelf = false
  if (!delivered.has(selfKey)) {
    const caption = [
      `${result.title} — ${result.subtitle}`,
      '',
      `«${result.shareQuote}»`,
      '',
      'Это твой интерьерный характер ✨',
    ].join('\n')
    const response = await callTelegram(token, 'sendPhoto', {
      chat_id: userId,
      photo: imageUrl,
      caption,
      reply_markup: { inline_keyboard: [playAgainRow, promoRow] },
    })
    deliveredSelf = Boolean(response.ok)
    if (deliveredSelf) delivered.add(selfKey)
  } else {
    deliveredSelf = true
  }

  // 2. Notify the sharer — attribution comes from the signed start_param.
  let deliveredSharer = false
  const attribution = resolveAttribution(startParam)
  let sharerUserId = attribution?.sharerUserId ?? null

  // Hardening: a v2 attribution must reference the SAME quiz being completed.
  // The completed quiz comes from the request body (client), the link's quiz
  // from the signed start_param — on disagreement we still deliver the user's
  // own card but suppress the sharer notification. This guards against a
  // stale client, a mis-deep-linked message, or any cross-quiz state: the
  // sharer must never get notified about another quiz's result.
  if (attribution?.version === 2 && attribution.quizId !== quiz.id) {
    console.warn(
      `[deliver] attribution quiz mismatch: link=${attribution.quizId} ` +
        `completed=${quiz.id}; sharer notification suppressed`,
    )
    sharerUserId = null
  }
  if (sharerUserId !== null && sharerUserId !== userId && !delivered.has(`sharer:${selfKey}`)) {
    const who = firstName || 'Твой друг'
    const sharerCaption = [
      `${who} прошёл(а) тест по твоей открытке! 🎉`,
      '',
      `Результат — «${result.title}»`,
      '',
      'Хочешь узнать свой?',
    ].join('\n')
    const response = await callTelegram(token, 'sendPhoto', {
      chat_id: sharerUserId,
      photo: imageUrl,
      caption: sharerCaption,
      reply_markup: { inline_keyboard: [playAgainRow, promoRow] },
    })
    deliveredSharer = Boolean(response.ok)
    if (deliveredSharer) delivered.add(`sharer:${selfKey}`)
  }

  res.status(200).json({ ok: true, deliveredSelf, deliveredSharer })
}
