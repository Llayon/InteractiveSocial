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
  ready?: () => void
  expand?: () => void
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
    shareMessage(preparedId: string): Promise<'sent' | 'failed' | 'unsupported'> {
      // web_app_share_message arrived in Bot API 9.2. Older clients silently
      // ignore the call, which used to hang until timeout — probe the reported
      // WebApp version first and degrade to fallback immediately instead.
      const version = (getWebApp() as { version?: string } | undefined)?.version
      if (version) {
        const parsed = Number.parseFloat(version)
        if (!Number.isNaN(parsed) && parsed < 9.2) {
          return Promise.resolve('unsupported')
        }
      }

      // Confirmed success only via share_message_sent event; anything else —
      // including the user closing the sheet — resolves 'failed'.
      //
      // NOTE: web_app_share_message / share_message_sent / share_message_failed
      // are Bot API 9.x methods that are not yet present in @tma.js/bridge
      // typings. The untyped shims below are confined to this adapter.
      type UntypedOn = (type: string, handler: () => void) => void
      const onEvent = on as unknown as UntypedOn
      const offEvent = off as unknown as UntypedOn
      const post = postEvent as unknown as (method: string, params?: unknown) => void

      return new Promise<'sent' | 'failed'>((resolve) => {
        let settled = false
        const finish = (outcome: 'sent' | 'failed') => {
          if (settled) return
          settled = true
          clearTimeout(timer)
          offEvent('share_message_sent', onSent)
          offEvent('share_message_failed', onFailed)
          resolve(outcome)
        }
        const onSent = () => finish('sent')
        const onFailed = () => finish('failed')
        const timer = setTimeout(() => finish('failed'), SHARE_TIMEOUT_MS)

        onEvent('share_message_sent', onSent)
        onEvent('share_message_failed', onFailed)

        try {
          post('web_app_share_message', { msg_id: preparedId })
        } catch {
          finish('failed')
        }
      })
    },
  }
}
