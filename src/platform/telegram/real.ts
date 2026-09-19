import { init, off, on, postEvent, retrieveLaunchParams } from '@tma.js/sdk'
import { readStartParamFromUrl } from './mock.js'
import type { TelegramAdapter, TelegramShareResult, TelegramUser } from './types.js'

interface WebAppLike {
  version?: string
  ready?: () => void
  expand?: () => void
  shareMessage?: (id: string, cb?: (payload?: unknown) => void) => void
  onEvent?: (type: string, cb: (payload?: unknown) => void) => void
  offEvent?: (type: string, cb: (payload?: unknown) => void) => void
  openTelegramLink?: (url: string) => void
  HapticFeedback?: {
    impactOccurred?: (style: string) => void
    notificationOccurred?: (type: string) => void
    selectionChanged?: () => void
  }
}

function getWebApp(): WebAppLike | undefined {
  return (globalThis as { Telegram?: { WebApp?: WebAppLike } }).Telegram?.WebApp
}

function parseUserFromInitData(raw: string): TelegramUser | null {
  if (!raw) return null
  try {
    const params = new URLSearchParams(raw)
    const userJson = params.get('user')
    if (!userJson) return null
    const parsed = JSON.parse(userJson) as {
      id?: number
      first_name?: string
      username?: string
    }
    if (typeof parsed.id !== 'number') return null
    return {
      id: parsed.id,
      firstName: parsed.first_name ?? 'друг',
      username: parsed.username,
    }
  } catch {
    return null
  }
}

export const SHARE_TIMEOUT_MS = 20_000
export const SHARE_CALLBACK_GRACE_MS = 400

type DocumentedShareFailedError =
  | 'UNSUPPORTED'
  | 'MESSAGE_EXPIRED'
  | 'MESSAGE_SEND_FAILED'
  | 'USER_DECLINED'
  | 'UNKNOWN_ERROR'

const DOCUMENTED_SHARE_ERRORS: ReadonlySet<string> = new Set([
  'UNSUPPORTED',
  'MESSAGE_EXPIRED',
  'MESSAGE_SEND_FAILED',
  'USER_DECLINED',
  'UNKNOWN_ERROR',
])

/** Extract only documented Telegram shareMessageFailed error values. */
function normalizeShareFailedError(payload: unknown): DocumentedShareFailedError | undefined {
  if (typeof payload === 'string') {
    return DOCUMENTED_SHARE_ERRORS.has(payload) ? (payload as DocumentedShareFailedError) : undefined
  }
  if (payload !== null && typeof payload === 'object' && 'error' in payload) {
    const err = (payload as { error?: unknown }).error
    if (typeof err === 'string' && DOCUMENTED_SHARE_ERRORS.has(err)) {
      return err as DocumentedShareFailedError
    }
  }
  return undefined
}

/**
 * Fallback initData extraction. retrieveLaunchParams() may fail or return an
 * empty payload on some Telegram clients (iOS WebView quirks, cached shells),
 * so we probe every official source directly:
 * 1. window.Telegram.WebApp.initData — the bridge object clients inject,
 * 2. ?tgWebAppData=... query parameter,
 * 3. #tgWebAppData=... hash parameter (Telegram iOS style deep links).
 */
function extractInitDataRawFallback(): string {
  const bridge = (
    globalThis as { Telegram?: { WebApp?: { initData?: unknown } } }
  ).Telegram?.WebApp
  if (bridge && typeof bridge.initData === 'string' && bridge.initData.length > 0) {
    return bridge.initData
  }
  const fromQuery = new URLSearchParams(window.location.search).get('tgWebAppData')
  if (fromQuery) return fromQuery
  const hash = window.location.hash.replace(/^#/, '')
  const fromHash = new URLSearchParams(hash).get('tgWebAppData')
  if (fromHash) return fromHash
  return ''
}

/**
 * Real Telegram Mini App implementation built on @tma.js/sdk.
 * All Telegram-specific calls live here and nowhere else.
 */
export function createRealTelegram(): TelegramAdapter {
  let startParam: string | null = null
  let initDataRaw = ''

  try {
    init()
  } catch {
    /* already initialized or non-critical */
  }

  try {
    const launchParams = retrieveLaunchParams()
    startParam = launchParams.startParam ? String(launchParams.startParam) : null
    initDataRaw = launchParams.initDataRaw ? String(launchParams.initDataRaw) : ''
  } catch (error) {
    console.warn(
      '[tma] retrieveLaunchParams failed:',
      error instanceof Error ? `${error.name}: ${error.message}` : String(error),
    )
  }

  if (!initDataRaw) {
    const before = initDataRaw
    initDataRaw = extractInitDataRawFallback()
    console.warn(
      `[tma] sdk initData empty (${before.length === 0 ? 'absent' : 'present'}), ` +
        `fallback extraction ${initDataRaw ? `succeeded (len=${initDataRaw.length})` : 'failed too'}`,
    )
  }

  if (!startParam) {
    try {
      startParam = readStartParamFromUrl()
    } catch {
      /* non-critical */
    }
  }

  return {
    platform: 'telegram',
    mode: 'telegram' as const,
    ready() {
      try {
        postEvent('web_app_ready')
      } catch {
        getWebApp()?.ready?.()
      }
    },
    expand() {
      try {
        postEvent('web_app_expand')
      } catch {
        getWebApp()?.expand?.()
      }
    },
    getStartParam() {
      return startParam
    },
    getUser() {
      return parseUserFromInitData(initDataRaw)
    },
    getInitDataRaw() {
      return initDataRaw
    },
    haptic(style = 'light') {
      try {
        postEvent('web_app_trigger_haptic_feedback', {
          type: 'impact',
          impact_style: style,
        })
      } catch {
        getWebApp()?.HapticFeedback?.impactOccurred?.(style)
      }
    },
    /**
     * Bot API 8.0: Telegram.WebApp.shareMessage(id) opens the native share
     * sheet for a message prepared via savePreparedInlineMessage; the outcome
     * arrives as shareMessageSent / shareMessageFailed events. We subscribe
     * via both the official bridge and @tma.js (event delivery differs between
     * platforms), and fall back to the raw web_app_share_message call when the
     * official script is unavailable.
     */
    /**
     * Telegram WebApp.shareMessage(preparedId) contract (Bot API 8.0+):
     * Official events are authoritative:
     *  - shareMessageSent → sent
     *  - shareMessageFailed {error} → cancelled (USER_DECLINED),
     *    unsupported (UNSUPPORTED) or failed (MESSAGE_EXPIRED,
     *    MESSAGE_SEND_FAILED, UNKNOWN_ERROR).
     * Callback boolean means successful send when true; false carries no
     * reason — we hold a short grace window for a failure event before
     * settling as callback_false. Never guess USER_DECLINED from false.
     */
    shareMessage(preparedId: string): Promise<TelegramShareResult> {
      const webApp = getWebApp()

      const version = webApp?.version
      if (version) {
        const parsed = Number.parseFloat(version)
        if (!Number.isNaN(parsed) && parsed < 8) {
          return Promise.resolve({ status: 'unsupported', reason: 'client_version', signal: 'version' })
        }
      }

      let settleResolve: (v: TelegramShareResult) => void = () => undefined
      let settled = false
      let timer: ReturnType<typeof setTimeout> | null = null
      let graceTimer: ReturnType<typeof setTimeout> | null = null
      let listeners: Array<{ off: () => void }> = []
      let cleaned = false

      const cleanup = () => {
        if (cleaned) return
        cleaned = true
        if (timer !== null) clearTimeout(timer)
        if (graceTimer !== null) clearTimeout(graceTimer)
        for (const { off } of listeners) {
          try { off() } catch { /* non-critical */ }
        }
        listeners = []
      }

      const finish = (outcome: TelegramShareResult) => {
        if (settled) return
        settled = true
        cleanup()
        settleResolve(outcome)
      }

      const handleSent = () => finish({ status: 'sent', signal: 'event' })

      const handleFailed = (payload?: unknown) => {
        const err = normalizeShareFailedError(payload)
        if (err === 'USER_DECLINED') {
          finish({ status: 'cancelled', reason: 'USER_DECLINED', signal: 'event' })
        } else if (err === 'UNSUPPORTED') {
          finish({ status: 'unsupported', reason: 'UNSUPPORTED', signal: 'event' })
        } else if (err === 'MESSAGE_EXPIRED' || err === 'MESSAGE_SEND_FAILED' || err === 'UNKNOWN_ERROR') {
          finish({ status: 'failed', reason: err, signal: 'event' })
        } else {
          finish({ status: 'failed', reason: 'UNKNOWN_ERROR', signal: 'event' })
        }
      }

      const registerListeners = (): Array<{ off: () => void }> => {
        const ls: Array<{ off: () => void }> = []
        // Primary: official WebApp bridge events (authoritative).
        try {
          const wa = getWebApp()
          if (wa && typeof wa.onEvent === 'function' && typeof wa.offEvent === 'function') {
            const onSent: (payload?: unknown) => void = () => handleSent()
            const onFailed: (payload?: unknown) => void = (p) => handleFailed(p)
            wa.onEvent('shareMessageSent', onSent)
            ls.push({ off: () => wa.offEvent?.('shareMessageSent', onSent) })
            wa.onEvent('shareMessageFailed', onFailed)
            ls.push({ off: () => wa.offEvent?.('shareMessageFailed', onFailed) })
          }
        } catch { /* bridge without onEvent — fall through to compat */ }
        // Best-effort compat: low-level @tma.js aliases (some clients only).
        try {
          type UntypedOn = (type: string, handler: (p?: unknown) => void) => void
          const tmaOn = on as unknown as UntypedOn
          const tmaOff = off as unknown as UntypedOn
          const aliases: Array<{ name: string; sent: boolean }> = [
            { name: 'share_message_sent', sent: true },
            { name: 'share_message_failed', sent: false },
            { name: 'prepared_message_sent', sent: true },
            { name: 'prepared_message_failed', sent: false },
          ]
          for (const { name, sent } of aliases) {
            const handler = sent
              ? (_p?: unknown) => handleSent()
              : (p?: unknown) => handleFailed(p)
            try {
              tmaOn(name, handler)
              ls.push({ off: () => tmaOff(name, handler) })
            } catch { /* unknown event — skip */ }
          }
        } catch { /* tma bridge unavailable */ }
        return ls
      }

      const promise = new Promise<TelegramShareResult>((resolve) => {
        settleResolve = resolve
        timer = setTimeout(() => finish({ status: 'failed', reason: 'timeout', signal: 'timeout' }), SHARE_TIMEOUT_MS)
      })

      if (typeof webApp?.shareMessage !== 'function') {
        try {
          const post = postEvent as unknown as (method: string, params?: unknown) => void
          post('web_app_share_message', { msg_id: preparedId })
        } catch {
          finish({ status: 'failed', reason: 'exception', signal: 'exception' })
        }
        listeners = registerListeners()
        return promise
      }

      listeners = registerListeners()
      try {
        const fn = webApp.shareMessage
        if (fn.length >= 2) {
          fn.call(webApp, preparedId, (ok: unknown) => {
            if (settled) return
            if (ok === true) {
              finish({ status: 'sent', signal: 'callback' })
            } else if (ok === false) {
              // No reason attached — hold a grace window for a failure event.
              if (graceTimer !== null) clearTimeout(graceTimer)
              graceTimer = setTimeout(() => {
                finish({ status: 'failed', reason: 'callback_false', signal: 'callback' })
              }, SHARE_CALLBACK_GRACE_MS)
            }
            // ok === undefined: let the event listener or timeout decide.
          })
        } else {
          fn.call(webApp, preparedId)
        }
      } catch {
        finish({ status: 'failed', reason: 'exception', signal: 'exception' })
      }
      return promise
    },
    openTelegramLink(url: string): boolean {
      try {
        const wa = getWebApp()
        if (wa && typeof wa.openTelegramLink === 'function') {
          wa.openTelegramLink(url)
          return true
        }
        try {
          const post = postEvent as unknown as (method: string, params?: unknown) => void
          post('web_app_open_tg_link', { path_full: url })
          return true
        } catch {
          return false
        }
      } catch {
        return false
      }
    },
    getTelegramVersion(): string | undefined {
      try {
        return getWebApp()?.version
      } catch {
        return undefined
      }
    },
  }
}
