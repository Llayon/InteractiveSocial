import type { HapticStyle } from '../types.js'
import type { TelegramAdapter, TelegramUser } from './types.js'

/** Reads a Telegram start parameter from plain URL query params. */
export function readStartParamFromUrl(search?: string): string | null {
  const params = new URLSearchParams(search ?? window.location.search)
  return params.get('tgWebAppStartParam') ?? params.get('startapp') ?? params.get('start_param')
}

export interface MockTelegramOptions {
  /** Start parameter to simulate attribution, e.g. "share_quiet". */
  startParam?: string | null
  /** When true, shareMessage resolves 'failed' (for testing failure paths). */
  failShare?: boolean
  /** Structured share mode for E2E (overrides failShare when set). */
  shareMode?: 'sent' | 'failed' | 'cancelled' | 'message_send_failed' | 'unsupported'
  /** When true, openTelegramLink is available and records calls (E2E fallback). */
  withShareLinkFallback?: boolean
}

/**
 * Deterministic Telegram mock used by development mode and Playwright E2E.
 * Fully functional app experience without a real Telegram runtime.
 */
export function createMockTelegram(options: MockTelegramOptions = {}): TelegramAdapter {
  const user: TelegramUser = { id: 900_000_001, firstName: 'Гость', username: 'mock_user' }

  return {
    platform: 'mock',
    mode: 'mock' as const,
    ready() {},
    expand() {},
    getStartParam() {
      return options.startParam ?? null
    },
    getUser() {
      return user
    },
    getInitDataRaw() {
      // Deterministic non-secret stand-in: never valid against a real bot token.
      const payload = JSON.stringify({ id: user.id, first_name: user.firstName })
      return `user=${encodeURIComponent(payload)}&start_param=${encodeURIComponent(
        options.startParam ?? '',
      )}`
    },
    haptic(_style?: HapticStyle) {
      /* no-op */
    },
    shareMessage(preparedId: string) {
      void preparedId
      const mode = options.shareMode ?? (options.failShare ? 'failed' : 'sent')
      if (mode === 'cancelled') {
        return Promise.resolve({ status: 'cancelled', reason: 'USER_DECLINED', signal: 'event' } as const)
      }
      if (mode === 'message_send_failed') {
        return Promise.resolve({ status: 'failed', reason: 'MESSAGE_SEND_FAILED', signal: 'event' } as const)
      }
      if (mode === 'unsupported') {
        return Promise.resolve({ status: 'unsupported', reason: 'UNSUPPORTED', signal: 'event' } as const)
      }
      if (mode === 'failed') {
        return Promise.resolve({ status: 'failed', reason: 'UNKNOWN_ERROR', signal: 'callback' } as const)
      }
      return Promise.resolve({ status: 'sent', signal: 'event' } as const)
    },
    ...(options.withShareLinkFallback || options.shareMode === 'message_send_failed'
      ? {
          openTelegramLink(url: string): boolean {
            try {
              const w = window as unknown as { __openTelegramLinkCalls?: string[] }
              w.__openTelegramLinkCalls = w.__openTelegramLinkCalls ?? []
              w.__openTelegramLinkCalls.push(url)
            } catch {}
            return true
          },
        }
      : {}),
    getTelegramVersion() {
      return '8.0'
    },
  }
}
