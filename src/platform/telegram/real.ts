import {
  init,
  off,
  on,
  postEvent,
  retrieveLaunchParams,
} from '@tma.js/sdk'
import { readStartParamFromUrl } from './mock.js'
import type { TelegramAdapter, TelegramUser } from './types.js'

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
     *  - The bridge has two flavours, sometimes both:
     *    (a) CALLBACK with a single boolean argument (modern, callback-first):
     *        shareMessage(id, (ok: boolean) => void). true means the
     *        native share sheet was opened successfully; false means the
     *        user dismissed or the sheet was rejected.
     *    (b) EVENT-based: shareMessageSent / shareMessageFailed (older docs);
     *        share_message_sent / share_message_failed also seen on some clients;
     *        prepared_message_sent / prepared_message_failed is the newest alias.
     *    The callback argument is NOT a { ok: boolean } object — it is a raw
     *    boolean. We must not assume an object shape. Older clients that do not
     *    support callback-first fall back to events only.
     *  - Either signal (true callback OR shareMessageSent event) settles the
     *    promise as sent. A false callback OR shareMessageFailed event settles
     *    as failed. A timeout also settles as failed.
     *  - unsupported is reserved for clients that explicitly do not implement
     *    shareMessage at all (no function, or version < 8).
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

      type UntypedOn = (type: string, handler: () => void) => void
      const onEvent = on as unknown as UntypedOn
      const offEvent = off as unknown as UntypedOn

      // Hoist finish/listeners so the raw-bridge fallback (no shareMessage fn)
      // and the main path share the same settle logic.
      let settleResolve: (v: 'sent' | 'failed') => void = () => undefined
      let settled = false
      let timer: ReturnType<typeof setTimeout> | null = null
      let listeners: Array<{ off: () => void }> = []
      const finish = (outcome: 'sent' | 'failed') => {
        if (settled) return
        settled = true
        if (timer !== null) clearTimeout(timer)
        for (const { off } of listeners) {
          try { off() } catch { /* non-critical */ }
        }
        settleResolve(outcome)
      }

      const registerListeners = (): Array<{ off: () => void }> => {
        const ls: Array<{ off: () => void }> = []
        const onSent = () => finish('sent')
        const onFailed = () => finish('failed')
        for (const name of [
          'shareMessageSent',
          'shareMessageFailed',
          'share_message_sent',
          'share_message_failed',
          'prepared_message_sent',
          'prepared_message_failed',
        ]) {
          const handler =
            name === 'shareMessageSent' ||
            name === 'share_message_sent' ||
            name === 'prepared_message_sent'
              ? onSent
              : onFailed
          try {
            onEvent(name, handler)
            ls.push({ off: () => offEvent(name, handler) })
          } catch {
            /* event type unknown to this bridge version — skip */
          }
        }
        return ls
      }

      const promise = new Promise<'sent' | 'failed'>((resolve) => {
        settleResolve = resolve
        timer = setTimeout(() => finish('failed'), SHARE_TIMEOUT_MS)
      })

      if (typeof webApp?.shareMessage !== 'function') {
        // Official script unavailable — raw bridge call as a last resort.
        try {
          const post = postEvent as unknown as (method: string, params?: unknown) => void
          post('web_app_share_message', { msg_id: preparedId })
        } catch {
          finish('failed')
        }
        listeners = registerListeners()
        return promise
      }

      listeners = registerListeners()
      try {
        const fn = webApp.shareMessage
        if (fn.length >= 2) {
          // Callback-first (Bot API 8+): the callback argument is a raw
          // boolean — NOT a { ok: boolean } object. A callback fired with
          // no arguments (some iOS Telegram versions) is treated as
          // ambiguous and resolved via the event listener or timeout,
          // not optimistically marked sent.
          fn.call(webApp, preparedId, (ok: unknown) => {
            if (ok === true) finish('sent')
            else if (ok === false) finish('failed')
            // ok === undefined: let the event listener or timeout decide.
          })
        } else {
          // Single-arg legacy signature: no callback, rely on events.
          fn.call(webApp, preparedId)
        }
      } catch {
        finish('failed')
      }
      return promise
    },
  }
}
