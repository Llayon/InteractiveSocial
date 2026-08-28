import type { Analytics } from '@/analytics/analytics'
import type { Result } from '@/features/quiz/schema'
import type { TelegramAdapter } from '@/platform/telegram'

export interface PrepareShareOk {
  ok: true
  preparedId: string
}

export interface PrepareShareError {
  ok: false
  code: string
}

export type PrepareShareResult = PrepareShareOk | PrepareShareError

const PREPARE_TIMEOUT_MS = 10_000

/**
 * Asks the backend to validate initData and create a prepared inline message.
 * The bot token never touches the client; failures are structured, not thrown.
 */
export async function prepareShareMessage(
  quizId: string,
  resultId: string,
  initDataRaw: string,
  score?: number,
): Promise<PrepareShareResult> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), PREPARE_TIMEOUT_MS)
  try {
    const response = await fetch('/api/share/prepare', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(
        score === undefined ? { quizId, resultId, initDataRaw } : { quizId, resultId, score, initDataRaw },
      ),
      signal: controller.signal,
    })
    const json: unknown = await response.json().catch(() => null)
    if (
      response.ok &&
      json !== null &&
      typeof json === 'object' &&
      'ok' in json &&
      (json as { ok?: unknown }).ok === true
    ) {
      const id = (json as { id?: unknown }).id
      if (typeof id === 'string' && id.length > 0) {
        return { ok: true, preparedId: id }
      }
    }
    const code =
      json !== null && typeof json === 'object' && 'error' in json
        ? String((json as { error?: unknown }).error)
        : `http_${response.status}`
    return { ok: false, code }
  } catch {
    return { ok: false, code: 'network_error' }
  } finally {
    clearTimeout(timeout)
  }
}

/** Web fallback link preserving share attribution via startapp param. */
export function buildFallbackShareUrl(resultId: string): string {
  const { origin, pathname } = window.location
  return `${origin}${pathname}?startapp=share_${encodeURIComponent(resultId)}`
}

async function fallbackShare(
  quizTitle: string | undefined,
  total: number | undefined,
  result: Result,
  score?: number,
): Promise<'fallback'> {
  const url = buildFallbackShareUrl(result.id)
  // Quiz-aware copy: correct-count quizzes share the exact score with a
  // challenge CTA; personality quizzes keep the approved result quote.
  const text =
    score === undefined || total === undefined || !quizTitle
      ? `«${result.title}» — ${result.presentation.shareQuote}`
      : `Я набрала ${score}/${total} в тесте «${quizTitle}».\n${result.presentation.shareQuote}`
  if (typeof navigator.share === 'function') {
    try {
      await navigator.share({ title: result.title, text, url })
      return 'fallback'
    } catch {
      /* user cancelled or unsupported — fall through to clipboard */
    }
  }
  try {
    await navigator.clipboard.writeText(`${text}\n${url}`)
  } catch {
    /* clipboard unavailable — nothing else we can do gracefully */
  }
  return 'fallback'
}

export type ShareOutcome = 'native' | 'fallback' | 'failed'

/**
 * Full share pipeline:
 *   share_click → POST /api/share/prepare → telegram.shareMessage(id)
 *   → share_success only on confirmed Telegram sent event.
 * Any failure degrades gracefully — it never crashes the app.
 */
export async function shareResult(options: {
  telegram: TelegramAdapter
  analytics: Analytics
  quizId: string
  resultId: string
  result: Result
  /** Exact score for correct-count quizzes (drives the score-card asset). */
  score?: number
  /** Total questions, used only for the fallback share text. */
  total?: number
  /** Quiz title, used only for the fallback share text. */
  quizTitle?: string
}): Promise<ShareOutcome> {
  const { telegram, analytics, quizId, resultId, result, score, total, quizTitle } = options

  analytics.track('share_click', {
    quiz_id: quizId,
    result_id: resultId,
    ...(score === undefined ? {} : { score }),
  })

  // Plain-web fallback has no native share support at all.
  if (telegram.mode === 'browser') {
    const outcome = await fallbackShare(quizTitle, total, result, score)
    analytics.track('share_failed', {
      quiz_id: quizId,
      result_id: resultId,
      reason: 'native_unsupported',
    })
    return outcome
  }

  const prepared = await prepareShareMessage(quizId, resultId, telegram.getInitDataRaw(), score)
  if (!prepared.ok) {
    analytics.track('share_failed', {
      quiz_id: quizId,
      result_id: resultId,
      reason: `prepare_${prepared.code}`,
    })
    return fallbackShare(quizTitle, total, result, score)
  }

  const outcome = await telegram.shareMessage(prepared.preparedId)
  if (outcome === 'sent') {
    analytics.track('share_success', {
      quiz_id: quizId,
      result_id: resultId,
      ...(score === undefined ? {} : { score }),
    })
    return 'native'
  }

  if (outcome === 'unsupported') {
    // Client cannot open the native sheet at all — degrade to web share.
    analytics.track('share_failed', {
      quiz_id: quizId,
      result_id: resultId,
      reason: 'share_unsupported_client',
    })
    return fallbackShare(quizTitle, total, result, score)
  }

  analytics.track('share_failed', {
    quiz_id: quizId,
    result_id: resultId,
    reason: 'share_message_failed',
  })
  return 'failed'
}
