import { readStartParamFromUrl } from './mock.js'
import type { TelegramAdapter } from './types.js'

/**
 * Plain-web fallback for opening the site outside Telegram.
 *
 * This state is intentionally distinct from the Telegram mock:
 * - no fake Telegram identity is ever created,
 * - initData is empty (server-side share preparation will be rejected),
 * - native share is reported as unsupported → graceful UI fallback.
 */
export function createBrowserFallback(): TelegramAdapter {
  return {
    mode: 'browser',
    ready() {},
    expand() {},
    getStartParam() {
      return readStartParamFromUrl()
    },
    getUser() {
      return null
    },
    getInitDataRaw() {
      return ''
    },
    haptic() {
      /* no-op */
    },
    shareMessage() {
      return Promise.reject(new Error('native share is unavailable outside Telegram'))
    },
  }
}
