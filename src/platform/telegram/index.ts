import { isTMA } from '@tma.js/sdk'
import { createBrowserFallback } from './browser.js'
import { createMockTelegram } from './mock.js'
import { createRealTelegram } from './real.js'
import type { TelegramAdapter, TelegramMode } from './types.js'

export type { TelegramAdapter, TelegramMode, TelegramUser, HapticStyle } from './types.js'

function isRealTelegramEnvironment(): boolean {
  try {
    return Boolean(isTMA())
  } catch {
    return false
  }
}

/**
 * Explicit mode resolution:
 * - ?mock=1 always forces the deterministic mock (any build),
 * - development and Playwright runs use the mock,
 * - production uses real Telegram only inside a real Mini App container;
 *   otherwise it degrades to the plain-web fallback (never a fake identity).
 */
export function detectTelegramMode(): TelegramMode {
  if (typeof window === 'undefined') return 'browser'
  const params = new URLSearchParams(window.location.search)
  if (params.has('mock')) return 'mock'
  if (navigator.webdriver === true) return 'mock' // Playwright & friends
  if (import.meta.env.DEV) return 'mock'
  return isRealTelegramEnvironment() ? 'telegram' : 'browser'
}

export function createTelegramAdapter(mode: TelegramMode = detectTelegramMode()): TelegramAdapter {
  switch (mode) {
    case 'telegram':
      return createRealTelegram()
    case 'mock': {
      const params = new URLSearchParams(window.location.search)
      return createMockTelegram({
        startParam: params.get('tgWebAppStartParam') ?? params.get('startapp'),
        failShare: params.get('share') === 'fail',
      })
    }
    case 'browser':
    default:
      return createBrowserFallback()
  }
}

export { createMockTelegram } from './mock.js'
export { createBrowserFallback } from './browser.js'
export { createRealTelegram } from './real.js'
