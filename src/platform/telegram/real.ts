import {
  init,
  off,
  on,
  postEvent,
  retrieveLaunchParams,
} from '@tma.js/sdk'
import { readStartParamFromUrl } from './mock'
import type { TelegramAdapter, TelegramUser } from './types'

interface WebAppLike {
  version?: string
  ready?: () => void
  expand?: () => void
  shareMessage?: (id: string, cb?: (payload?: unknown) => void) => void
  onEvent?: (type: string, cb: () => void) => void
  offEvent?: (type: string, cb: () => void) => void
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

const SHARE_TIMEOUT_MS = 20_000

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
    mode: 'telegram',
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
    shareMessage(preparedId: string): Promise<'sent' | 'failed' | 'unsupported'> {
      const webApp = getWebApp()

      const version = webApp?.version
      if (version) {
        const parsed = Number.parseFloat(version)
        if (!Number.isNaN(parsed) && parsed < 8) {
          return Promise.resolve('unsupported')
        }
      }

      return new Promise<'sent' | 'failed'>((resolve) => {
        let settled = false
        const listeners: Array<{ off: () => void }> = []
        const finish = (outcome: 'sent' | 'failed') => {
          if (settled) return
          settled = true
          clearTimeout(timer)
          for (const { off } of listeners) {
            try {
              off()
            } catch {
              /* non-critical */
            }
          }
          resolve(outcome)
        }
        const onSent = () => finish('sent')
        const onFailed = () => finish('failed')
        const timer = setTimeout(() => finish('failed'), SHARE_TIMEOUT_MS)

        // Official bridge events (camelCase, Bot API 8.0+).
        if (typeof webApp?.onEvent === 'function') {
          webApp.onEvent('shareMessageSent', onSent)
          webApp.onEvent('shareMessageFailed', onFailed)
          listeners.push({
            off: () => {
              webApp.offEvent?.('shareMessageSent', onSent)
              webApp.offEvent?.('shareMessageFailed', onFailed)
            },
          })
        }

        // @tma.js bridge events — both naming conventions for safety.
        type UntypedOn = (type: string, handler: () => void) => void
        const onEvent = on as unknown as UntypedOn
        const offEvent = off as unknown as UntypedOn
        for (const name of ['shareMessageSent', 'shareMessageFailed', 'share_message_sent', 'share_message_failed']) {
          const handler = name === 'shareMessageSent' || name === 'share_message_sent' ? onSent : onFailed
          try {
            onEvent(name, handler)
            listeners.push({ off: () => offEvent(name, handler) })
          } catch {
            /* event type unknown to this bridge version — skip */
          }
        }

        try {
          if (typeof webApp?.shareMessage === 'function') {
            const fn = webApp.shareMessage
            if (fn.length >= 2) {
              // Callback-first (Bot API 8+ two-arg signature): the callback
              // resolves before the event round-trip on clients that support
              // it. The event listeners above remain armed as a safety net —
              // finish() is idempotent, so the first signal wins.
              fn.call(webApp, preparedId, (payload) => {
                const ok = (payload as { ok?: boolean } | undefined)?.ok
                finish(ok === false ? 'failed' : 'sent')
              })
            } else {
              fn.call(webApp, preparedId)
            }
          } else {
            // Official script unavailable — raw bridge call (legacy path).
            const post = postEvent as unknown as (method: string, params?: unknown) => void
            post('web_app_share_message', { msg_id: preparedId })
          }
        } catch {
          finish('failed')
        }
      })
    },
  }
}
