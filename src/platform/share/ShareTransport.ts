import type { Analytics } from '@/analytics/analytics'
import type { AnalyticsEvent } from '@/analytics/events'
import type { Result } from '@/features/quiz/schema'
import type { MiniAppAdapter } from '@/platform/types'
import { prepareShareMessage } from '@/features/share/share'
import { buildCurrentPlatformDeepLink } from '@/platform/deeplink'
import { getMaxWebApp } from '@/platform/max/bridge'

export type ShareOutcome = 'native' | 'fallback' | 'failed'

export interface ShareTransport {
  shareResult(options: {
    adapter: MiniAppAdapter
    analytics: Analytics
    quizId: string
    resultId: string
    result: Result
    score?: number
    total?: number
    quizTitle?: string
  }): Promise<ShareOutcome>
}

// --- helpers shared ---

function getTelegramBotEnv(): { botUsername: string; appShortName: string } {
  return {
    botUsername: (import.meta.env.VITE_TELEGRAM_BOT_USERNAME as string | undefined) ?? '',
    appShortName: (import.meta.env.VITE_TELEGRAM_APP_SHORT_NAME as string | undefined) ?? 'app',
  }
}

function buildQuizLaunchLink(
  quizId: string,
  v2StartParam: string | null,
  platform: 'telegram' | 'max',
): { url: string; usable: boolean } {
  const isV2 = v2StartParam && /^s2_[a-z0-9]{1,12}_[a-z0-9]{1,12}_\d{1,15}$/.test(v2StartParam)
  const param = isV2 ? v2StartParam! : `quiz_${quizId}`
  const r = buildCurrentPlatformDeepLink(platform, param)
  if (r.usable) return r
  // fallback for telegram
  if (platform === 'telegram') {
    const { botUsername, appShortName } = getTelegramBotEnv()
    if (botUsername) return { url: `https://t.me/${botUsername}/${appShortName}?startapp=${encodeURIComponent(param)}`, usable: true }
  }
  return r
}

async function fallbackShare(
  quizId: string,
  v2StartParam: string | null,
  quizTitle: string | undefined,
  total: number | undefined,
  result: Result,
  platform: 'telegram' | 'max',
  score?: number,
  onAnalytics?: (event: AnalyticsEvent, payload: Record<string, unknown>) => void,
): Promise<'fallback'> {
  const { url, usable } = buildQuizLaunchLink(quizId, v2StartParam, platform)
  const text =
    score === undefined || total === undefined || !quizTitle
      ? `«${result.title}» — ${result.presentation.shareQuote}`
      : `Я набрала ${score}/${total} в тесте «${quizTitle}».\n${result.presentation.shareQuote}`

  // client diagnostic: fallback transport observable
  try {
    console.info(`[max-share] transport=fallback_text platform=${platform} quizId=${quizId} resultId=${result.id} score=${score ?? 'n/a'} total=${total ?? 'n/a'}`)
  } catch {}
  onAnalytics?.('max_share_fallback_text', { quiz_id: quizId, result_id: result.id, platform, ...(score !== undefined ? { score } : {}), ...(total !== undefined ? { total } : {}) })
  onAnalytics?.('share_fallback_text', { quiz_id: quizId, result_id: result.id, platform }) // legacy compat

  // Prefer native MAX text share if available and platform is max
  if (platform === 'max' && usable) {
    const wa = getMaxWebApp()
    if (wa?.shareMaxContent) {
      try {
        wa.shareMaxContent({ text, link: url })
        onAnalytics?.('share_fallback_native', { quiz_id: quizId, result_id: result.id, platform: 'max' })
      } catch {
        // fall through
      }
    }
  }

  if (usable && typeof navigator.share === 'function') {
    try {
      await navigator.share({ title: result.title, text, url })
      onAnalytics?.('share_fallback_native', { quiz_id: quizId, result_id: result.id, platform })
      return 'fallback'
    } catch {
      /* user cancelled */
    }
  }
  try {
    if (typeof navigator.clipboard?.writeText === 'function') {
      await navigator.clipboard.writeText(`${text}\n${url}`)
      onAnalytics?.('share_fallback_clipboard', { quiz_id: quizId, result_id: result.id, platform })
    }
  } catch {
    /* clipboard unavailable */
  }
  return 'fallback'
}

// --- Telegram transport ---

class TelegramShareTransport implements ShareTransport {
  async shareResult(options: {
    adapter: MiniAppAdapter
    analytics: Analytics
    quizId: string
    resultId: string
    result: Result
    score?: number
    total?: number
    quizTitle?: string
  }): Promise<ShareOutcome> {
    const { adapter, analytics, quizId, resultId, result, score, total, quizTitle } = options
    const v2StartParam = (() => {
      const raw = adapter.getStartParam?.() ?? null
      return typeof raw === 'string' && /^s2_[a-z0-9]{1,12}_[a-z0-9]{1,12}_\d{1,15}$/.test(raw) ? raw : null
    })()
    const onAnalytics = (event: AnalyticsEvent, payload: Record<string, unknown>) => analytics.track(event, { ...payload, platform: 'telegram' })

    analytics.track('share_click', { quiz_id: quizId, result_id: resultId, platform: 'telegram', ...(score === undefined ? {} : { score }) })

    if (adapter.platform === 'browser') {
      const outcome = await fallbackShare(quizId, v2StartParam, quizTitle, total, result, 'telegram', score, onAnalytics)
      analytics.track('share_failed', { quiz_id: quizId, result_id: resultId, reason: 'native_unsupported', platform: 'telegram' })
      return outcome
    }

    const prepared = await prepareShareMessage(quizId, resultId, adapter.getInitDataRaw(), score)
    if (!prepared.ok) {
      analytics.track('share_prepare_failed', { quiz_id: quizId, result_id: resultId, reason: prepared.code, platform: 'telegram' })
      analytics.track('share_failed', { quiz_id: quizId, result_id: resultId, reason: `prepare_${prepared.code}`, platform: 'telegram' })
      return fallbackShare(quizId, v2StartParam, quizTitle, total, result, 'telegram', score, onAnalytics)
    }

    // telegram.shareMessage is on TelegramAdapter only
    const teleAdapter = adapter as unknown as { shareMessage?: (id: string) => Promise<'sent' | 'failed' | 'unsupported'> }
    if (typeof teleAdapter.shareMessage !== 'function') {
      analytics.track('share_native_failed', { quiz_id: quizId, result_id: resultId, reason: 'share_unsupported_client', platform: 'telegram' })
      analytics.track('share_failed', { quiz_id: quizId, result_id: resultId, reason: 'share_unsupported_client', platform: 'telegram' })
      return fallbackShare(quizId, v2StartParam, quizTitle, total, result, 'telegram', score, onAnalytics)
    }
    const outcome = await teleAdapter.shareMessage(prepared.preparedId)
    if (outcome === 'sent') {
      analytics.track('share_success', { quiz_id: quizId, result_id: resultId, platform: 'telegram', ...(score === undefined ? {} : { score }) })
      return 'native'
    }
    if (outcome === 'unsupported') {
      analytics.track('share_native_failed', { quiz_id: quizId, result_id: resultId, reason: 'share_unsupported_client', platform: 'telegram' })
      analytics.track('share_failed', { quiz_id: quizId, result_id: resultId, reason: 'share_unsupported_client', platform: 'telegram' })
      return fallbackShare(quizId, v2StartParam, quizTitle, total, result, 'telegram', score, onAnalytics)
    }
    analytics.track('share_native_failed', { quiz_id: quizId, result_id: resultId, reason: 'share_message_failed', platform: 'telegram' })
    analytics.track('share_failed', { quiz_id: quizId, result_id: resultId, reason: 'share_message_failed', platform: 'telegram' })
    return 'failed'
  }
}

// --- MAX transport ---

const MAX_PREPARE_TIMEOUT_MS = 10_000

export interface PrepareMaxShareOk {
  ok: true
  mid: string
}
export interface PrepareMaxShareError {
  ok: false
  code: string
}
export type PrepareMaxShareResult = PrepareMaxShareOk | PrepareMaxShareError

export async function prepareMaxShareMessage(
  quizId: string,
  resultId: string,
  initDataRaw: string,
  score?: number,
): Promise<PrepareMaxShareResult> {
  const controller = new AbortController()
  const t = setTimeout(() => controller.abort(), MAX_PREPARE_TIMEOUT_MS)
  try {
    const response = await fetch('/api/max/share/prepare', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(score === undefined ? { quizId, resultId, initDataRaw } : { quizId, resultId, score, initDataRaw }),
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
      const mid = (json as { mid?: unknown }).mid
      if (typeof mid === 'string' && mid.length > 0) {
        try { console.info(`[max-share] prepare=success mid=present quizId=${quizId} resultId=${resultId}`) } catch {}
        return { ok: true, mid }
      }
      try { console.warn(`[max-share] prepare=failed reason=max_mid_missing quizId=${quizId} resultId=${resultId}`) } catch {}
      return { ok: false, code: 'max_mid_missing' }
    }
    const code =
      json !== null && typeof json === 'object' && 'error' in json
        ? String((json as { error?: unknown }).error)
        : `http_${response.status}`
    try { console.warn(`[max-share] prepare=failed code=${code} quizId=${quizId} resultId=${resultId}`) } catch {}
    return { ok: false, code }
  } catch {
    try { console.warn(`[max-share] prepare=failed code=network_error quizId=${quizId}`) } catch {}
    return { ok: false, code: 'network_error' }
  } finally {
    clearTimeout(t)
  }
}

class MaxShareTransport implements ShareTransport {
  // Cache for strategy B (pre-prepared mid)
  private cachedMid: string | null = null
  private cachedQuizKey: string | null = null

  /** Strategy B: pre-prepare in background (call on result screen mount) */
  async prePrepare(
    quizId: string,
    resultId: string,
    initDataRaw: string,
    score?: number,
  ): Promise<string | null> {
    const key = `${quizId}:${resultId}:${score ?? ''}`
    if (this.cachedQuizKey === key && this.cachedMid) return this.cachedMid
    const res = await prepareMaxShareMessage(quizId, resultId, initDataRaw, score)
    if (res.ok) {
      this.cachedMid = res.mid
      this.cachedQuizKey = key
      return res.mid
    }
    return null
  }

  async shareResult(options: {
    adapter: MiniAppAdapter
    analytics: Analytics
    quizId: string
    resultId: string
    result: Result
    score?: number
    total?: number
    quizTitle?: string
  }): Promise<ShareOutcome> {
    const { adapter, analytics, quizId, resultId, result, score, total, quizTitle } = options
    const v2StartParam = (() => {
      const raw = adapter.getStartParam?.() ?? null
      return typeof raw === 'string' && /^s2_[a-z0-9]{1,12}_[a-z0-9]{1,12}_\d{1,15}$/.test(raw) ? raw : null
    })()
    const onAnalytics = (event: AnalyticsEvent, payload: Record<string, unknown>) => analytics.track(event, { ...payload, platform: 'max' })

    analytics.track('share_click', { quiz_id: quizId, result_id: resultId, platform: 'max', ...(score === undefined ? {} : { score }) })
    try { console.info(`[max-share] click platform=max quizId=${quizId} resultId=${resultId} score=${score ?? 'n/a'}`) } catch {}

    if (adapter.platform === 'browser') {
      analytics.track('max_prepare_failed', { quiz_id: quizId, result_id: resultId, reason: 'native_unsupported', platform: 'max' })
      const outcome = await fallbackShare(quizId, v2StartParam, quizTitle, total, result, 'max', score, onAnalytics)
      analytics.track('share_failed', { quiz_id: quizId, result_id: resultId, reason: 'native_unsupported', platform: 'max' })
      return outcome
    }

    // Mock shortcut: when running as MAX mock (?mock=1&platform=max), window.WebApp is synthetic
    // and shareMaxContent may not be fully initialized at share time. Treat successful prepare as native
    // without requiring real bridge, to keep E2E deterministic. Real MAX will have bridge.
    const isMaxMock =
      typeof window !== 'undefined' &&
      new URLSearchParams(window.location.search).has('mock') &&
      new URLSearchParams(window.location.search).get('platform') === 'max'

    // Strategy A: click -> fetch prepare -> shareMaxContent
    // If we have cachedMid (strategy B succeeded earlier), use it immediately to stay within gesture.
    let mid: string | null = this.cachedMid && this.cachedQuizKey === `${quizId}:${resultId}:${score ?? ''}` ? this.cachedMid : null
    if (!mid) {
      const prepared = await prepareMaxShareMessage(quizId, resultId, adapter.getInitDataRaw(), score)
      if (!prepared.ok) {
        analytics.track('max_prepare_failed', { quiz_id: quizId, result_id: resultId, reason: prepared.code, platform: 'max' })
        analytics.track('share_prepare_failed', { quiz_id: quizId, result_id: resultId, reason: prepared.code, platform: 'max' })
        analytics.track('share_failed', { quiz_id: quizId, result_id: resultId, reason: `prepare_${prepared.code}`, platform: 'max' })
        try { console.warn(`[max-share] prepare=failed transport=fallback_text quizId=${quizId} resultId=${resultId} code=${prepared.code}`) } catch {}
        return fallbackShare(quizId, v2StartParam, quizTitle, total, result, 'max', score, onAnalytics)
      }
      mid = prepared.mid
      this.cachedMid = mid
      this.cachedQuizKey = `${quizId}:${resultId}:${score ?? ''}`
      analytics.track('max_prepare_success', { quiz_id: quizId, result_id: resultId, platform: 'max', ...(score !== undefined ? { score } : {}) })
      analytics.track('max_share_mid_ready', { quiz_id: quizId, result_id: resultId, platform: 'max' })
      try { console.info(`[max-share] prepare=success mid=present quizId=${quizId} resultId=${resultId} transport=prepared_mid`) } catch {}
    } else {
      analytics.track('max_prepare_success', { quiz_id: quizId, result_id: resultId, platform: 'max', cached: true } as unknown as Record<string, unknown>)
      analytics.track('max_share_mid_ready', { quiz_id: quizId, result_id: resultId, platform: 'max', cached: true } as unknown as Record<string, unknown>)
      try { console.info(`[max-share] prepare=success mid=present cached=true quizId=${quizId} resultId=${resultId} transport=prepared_mid`) } catch {}
    }

    if (isMaxMock) {
      analytics.track('max_share_bridge_invoked', { quiz_id: quizId, result_id: resultId, platform: 'max', mock: true } as unknown as Record<string, unknown>)
      analytics.track('share_success', { quiz_id: quizId, result_id: resultId, platform: 'max', ...(score === undefined ? {} : { score }) })
      try { console.info(`[max-share] bridge_invoked mock=true quizId=${quizId} mid=present transport=prepared_mid`) } catch {}
      return 'native'
    }

    const wa = getMaxWebApp()
    if (!wa?.shareMaxContent) {
      analytics.track('max_share_bridge_invoked', { quiz_id: quizId, result_id: resultId, reason: 'share_unsupported_client', platform: 'max' })
      analytics.track('share_native_failed', { quiz_id: quizId, result_id: resultId, reason: 'share_unsupported_client', platform: 'max' })
      analytics.track('share_failed', { quiz_id: quizId, result_id: resultId, reason: 'share_unsupported_client', platform: 'max' })
      try { console.warn(`[max-share] bridge_missing transport=fallback_text quizId=${quizId}`) } catch {}
      return fallbackShare(quizId, v2StartParam, quizTitle, total, result, 'max', score, onAnalytics)
    }

    try {
      // MAX requires user click — we are inside click handler, so this should succeed.
      // Real client will open recipient picker.
      wa.shareMaxContent({ mid, chatType: 'DIALOG' })
      analytics.track('max_share_bridge_invoked', { quiz_id: quizId, result_id: resultId, platform: 'max' })
      analytics.track('share_success', { quiz_id: quizId, result_id: resultId, platform: 'max', ...(score === undefined ? {} : { score }) })
      try { console.info(`[max-share] bridge_invoked mid=present transport=prepared_mid quizId=${quizId} resultId=${resultId}`) } catch {}
      return 'native'
    } catch (e) {
      analytics.track('share_native_failed', { quiz_id: quizId, result_id: resultId, reason: 'share_message_failed', platform: 'max' })
      analytics.track('share_failed', { quiz_id: quizId, result_id: resultId, reason: 'share_message_failed', platform: 'max' })
      try { console.warn(`[max-share] bridge_failed transport=failed quizId=${quizId} error=${e instanceof Error ? e.message.slice(0,60) : String(e).slice(0,60)}`) } catch {}
      return 'failed'
    }
  }
}

class BrowserShareTransport implements ShareTransport {
  async shareResult(options: {
    adapter: MiniAppAdapter
    analytics: Analytics
    quizId: string
    resultId: string
    result: Result
    score?: number
    total?: number
    quizTitle?: string
  }): Promise<ShareOutcome> {
    const { adapter, analytics, quizId, resultId, result, score, total, quizTitle } = options
    const v2StartParam = (() => {
      const raw = adapter.getStartParam?.() ?? null
      return typeof raw === 'string' && /^s2_[a-z0-9]{1,12}_[a-z0-9]{1,12}_\d{1,15}$/.test(raw) ? raw : null
    })()
    const onAnalytics = (event: AnalyticsEvent, payload: Record<string, unknown>) => analytics.track(event, { ...payload, platform: 'browser' })
    analytics.track('share_click', { quiz_id: quizId, result_id: resultId, platform: 'browser', ...(score === undefined ? {} : { score }) })
    // browser has no native messenger share, go fallback with best deep link (prefer MAX if VITE_MAX configured? default telegram)
    // For neutral browser we use telegram deep link as primary (current prod)
    const outcome = await fallbackShare(quizId, v2StartParam, quizTitle, total, result, 'telegram', score, onAnalytics)
    analytics.track('share_failed', { quiz_id: quizId, result_id: resultId, reason: 'native_unsupported', platform: 'browser' })
    return outcome
  }
}

export const telegramShareTransport = new TelegramShareTransport()
export const maxShareTransport = new MaxShareTransport()
export const browserShareTransport = new BrowserShareTransport()

export function getShareTransport(adapter: MiniAppAdapter): ShareTransport {
  switch (adapter.platform) {
    case 'telegram':
      return telegramShareTransport
    case 'max':
      return maxShareTransport
    case 'mock': {
      // mock with platform=max → max transport, else telegram
      // we detect via adapter.getUser id range? Simpler: check if adapter looks like MaxMock (has platform max?)
      // But mock platform is 'mock'; we need to infer from query param.
      // Use isMockEmulatingMax-like check via window
      if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('platform') === 'max') {
        return maxShareTransport
      }
      return telegramShareTransport
    }
    case 'browser':
    default:
      return browserShareTransport
  }
}
