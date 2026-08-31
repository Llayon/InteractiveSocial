import type { Analytics } from '@/analytics/analytics'
import type { AnalyticsEvent } from '@/analytics/events'
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

function getTelegramBotEnv(): { botUsername: string; appShortName: string } {
  // Read at call time so vi.stubEnv in tests can flip these without
  // re-importing the module. Vite inlines VITE_* at build, so the runtime
  // path here only matters in jsdom/test and during Vercel SSR (where
  // VITE_* are public envs).
  // Vite injects import.meta.env at build time.
  return {
    botUsername: (import.meta.env.VITE_TELEGRAM_BOT_USERNAME as string | undefined) ?? '',
  // Vite injects import.meta.env at build time.
    appShortName: (import.meta.env.VITE_TELEGRAM_APP_SHORT_NAME as string | undefined) ?? 'app',
  }
}

/** Build a Telegram Mini App deep link, never a raw Vercel URL. */
function buildTelegramDeeplink(
  startParam: string,
): { url: string; usable: boolean } {
  const { botUsername, appShortName } = getTelegramBotEnv()
  if (!botUsername) return { url: '', usable: false }
  const safe = encodeURIComponent(startParam)
  return {
    url: `https://t.me/${botUsername}/${appShortName}?startapp=${safe}`,
    usable: true,
  }
}

/** Web fallback link preserving share attribution via startapp param.
 *  Returns a t.me Mini App deep link (NEVER a raw Vercel URL). For a raw
 *  browser-share fallback we still fall back to the current origin URL
 *  (only because some platforms reject non-HTTPS links in their native
 *  share sheet), but the platform's PRIMARY share path is the deep link. */
export function buildFallbackShareUrl(resultId: string): { url: string; usable: boolean } {
  const startParam = `share_${encodeURIComponent(resultId)}`
  const deeplink = buildTelegramDeeplink(startParam)
  if (deeplink.usable) return deeplink
  // Last-resort: if VITE_TELEGRAM_BOT_USERNAME is not configured (e.g. local
  // dev) we fall back to the current origin so the user can at least copy
  // a working URL, but this is never the path Telegram iOS takes.
  const { origin, pathname } = window.location
  return {
    url: `${origin}${pathname}?startapp=${startParam}`,
    usable: false,
  }
}

/**
 * Quiz-context deep link used by the fallback when prepare succeeds but
 * native share does not (or for plain-web browsers). When the v2
 * attribution is safely available (we are inside Telegram and the
 * originally received startParam is a v2 code), it is preserved so the
 * recipient keeps attribution credit. Otherwise we route by quiz id.
 */
function buildQuizLaunchLink(
  quizId: string,
  v2StartParam: string | null,
): { url: string; usable: boolean } {
  if (v2StartParam && /^s2_[a-z0-9]{1,12}_[a-z0-9]{1,12}_\d{1,15}$/.test(v2StartParam)) {
    return buildTelegramDeeplink(v2StartParam)
  }
  return buildTelegramDeeplink(`quiz_${encodeURIComponent(quizId)}`)
}

async function fallbackShare(
  quizId: string,
  v2StartParam: string | null,
  quizTitle: string | undefined,
  total: number | undefined,
  result: Result,
  score?: number,
  onAnalytics?: (event: AnalyticsEvent, payload: Record<string, unknown>) => void,
): Promise<'fallback'> {
  const { url, usable } = buildQuizLaunchLink(quizId, v2StartParam)
  // Quiz-aware copy: correct-count quizzes share the exact score with a
  // challenge CTA; personality quizzes keep the approved result quote.
  const text =
    score === undefined || total === undefined || !quizTitle
      ? `«${result.title}» — ${result.presentation.shareQuote}`
      : `Я набрала ${score}/${total} в тесте «${quizTitle}».\n${result.presentation.shareQuote}`
  if (usable && typeof navigator.share === 'function') {
    try {
      await navigator.share({ title: result.title, text, url })
      onAnalytics?.('share_fallback_native', { quiz_id: quizId, result_id: result.id })
      return 'fallback'
    } catch {
      /* user cancelled or unsupported — fall through to clipboard */
    }
  }
  try {
    if (typeof navigator.clipboard?.writeText === 'function') {
      await navigator.clipboard.writeText(`${text}\n${url}`)
      onAnalytics?.('share_fallback_clipboard', { quiz_id: quizId, result_id: result.id })
    }
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
 *
 * Diagnostics: every fallback path emits a dedicated analytics event
 * (share_prepare_failed / share_native_failed) so a future regression
 * is visible in the metrics stream. Native share that fails is NOT
 * silently downgraded to a successful "fallback" — the user-visible
 * status in ShareButton still reflects fallback vs native vs failed.
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

  // Capture the current attribution so the fallback can preserve it.
  const v2StartParam = (() => {
    const raw = telegram.getStartParam?.() ?? null
    if (typeof raw !== 'string') return null
    return /^s2_[a-z0-9]{1,12}_[a-z0-9]{1,12}_\d{1,15}$/.test(raw) ? raw : null
  })()

  const onAnalytics = (event: AnalyticsEvent, payload: Record<string, unknown>) => {
    analytics.track(event, payload)
  }

  analytics.track('share_click', {
    quiz_id: quizId,
    result_id: resultId,
    ...(score === undefined ? {} : { score }),
  })

  // Plain-web fallback has no native share support at all.
  if (telegram.mode === 'browser') {
    const outcome = await fallbackShare(
      quizId,
      v2StartParam,
      quizTitle,
      total,
      result,
      score,
      onAnalytics,
    )
    analytics.track('share_failed', {
      quiz_id: quizId,
      result_id: resultId,
      reason: 'native_unsupported',
    })
    return outcome
  }

  const prepared = await prepareShareMessage(quizId, resultId, telegram.getInitDataRaw(), score)
  if (!prepared.ok) {
    analytics.track('share_prepare_failed', {
      quiz_id: quizId,
      result_id: resultId,
      reason: prepared.code,
    })
    analytics.track('share_failed', {
      quiz_id: quizId,
      result_id: resultId,
      reason: `prepare_${prepared.code}`,
    })
    return fallbackShare(
      quizId,
      v2StartParam,
      quizTitle,
      total,
      result,
      score,
      onAnalytics,
    )
  }

  if (typeof telegram.shareMessage !== 'function') {
    analytics.track('share_native_failed', {
      quiz_id: quizId,
      result_id: resultId,
      reason: 'share_unsupported_client',
    })
    analytics.track('share_failed', {
      quiz_id: quizId,
      result_id: resultId,
      reason: 'share_unsupported_client',
    })
    return fallbackShare(quizId, v2StartParam, quizTitle, total, result, score, onAnalytics)
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
    analytics.track('share_native_failed', {
      quiz_id: quizId,
      result_id: resultId,
      reason: 'share_unsupported_client',
    })
    analytics.track('share_failed', {
      quiz_id: quizId,
      result_id: resultId,
      reason: 'share_unsupported_client',
    })
    return fallbackShare(
      quizId,
      v2StartParam,
      quizTitle,
      total,
      result,
      score,
      onAnalytics,
    )
  }

  analytics.track('share_native_failed', {
    quiz_id: quizId,
    result_id: resultId,
    reason: 'share_message_failed',
  })
  analytics.track('share_failed', {
    quiz_id: quizId,
    result_id: resultId,
    reason: 'share_message_failed',
  })
  return 'failed'
}
