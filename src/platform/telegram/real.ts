import {
  init,
  off,
  on,
  postEvent,
  retrieveLaunchParams,
} from '@tma.js/sdk'
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

const SHARE_TIMEOUT_MS = 60_000

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
  } catch {
    /* launch params unavailable — treated as empty */
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
    shareMessage(preparedId: string) {
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
