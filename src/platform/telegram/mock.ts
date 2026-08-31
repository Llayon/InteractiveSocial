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
      return Promise.resolve<'sent' | 'failed'>(options.failShare ? 'failed' : 'sent')
    },
  }
}
