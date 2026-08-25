import type { VercelRequest, VercelResponse } from '@vercel/node'
import { quizzes } from '../../src/content/quizzes/index.js'
import { validateInitData } from '../_lib/initData.js'

const activeQuiz = quizzes[0]

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
 *    ${APP_BASE_URL}/share-cards/<asset>.png and t.me deep link with
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

  const body = req.body as { resultId?: unknown; initDataRaw?: unknown } | undefined
  const resultId = typeof body?.resultId === 'string' ? body.resultId : ''
  const initDataRaw = typeof body?.initDataRaw === 'string' ? body.initDataRaw : ''

  if (!/^[a-z]+$/.test(resultId)) {
    fail(res, 400, 'invalid_request')
    return
  }
  const result = activeQuiz.results.find((r) => r.id === resultId)
  if (!result) {
    fail(res, 400, 'missing_result')
    return
  }
  if (!initDataRaw) {
    fail(res, 401, 'invalid_init_data')
    return
  }

  let userId: number
  try {
    ;({ userId } = validateInitData(initDataRaw, token))
  } catch (error) {
    void error
    fail(res, 401, 'invalid_init_data')
    return
  }

  const deepLink = `https://t.me/${botUsername}/${appShortName}?startapp=share_${result.id}`
  const imageUrl = `${appBaseUrl.replace(/\/$/, '')}/share-cards/${result.shareImage}.png`
  const messageText = [
    `${result.title} — ${result.subtitle}`,
    '',
    `«${result.shareQuote}»`,
    '',
    'Какой интерьерный характер у тебя? Пройди тест:',
  ].join('\n')

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 8_000)

  try {
    const apiResponse = await fetch(`https://api.telegram.org/bot${token}/savePreparedInlineMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        user_id: userId,
        allow_user_chats: true,
        result: {
          type: 'article',
          id: `share_${result.id}`,
          title: result.title,
          description: result.shareQuote,
          thumbnail_url: imageUrl,
          reply_markup: {
            inline_keyboard: [[{ text: 'Пройти тест', url: deepLink }]],
          },
          input_message_content: { message_text: messageText },
        },
      }),
      signal: controller.signal,
    })

    const json = (await apiResponse.json().catch(() => null)) as TelegramApiResponse | null

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
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      fail(res, 504, 'timeout')
      return
    }
    fail(res, 502, 'telegram_failure')
  } finally {
    clearTimeout(timeout)
  }
}
