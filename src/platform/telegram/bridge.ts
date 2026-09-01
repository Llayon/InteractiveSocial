/**
 * Telegram Bridge loader — async, non-parser-blocking.
 * Only loaded when platform=telegram. Not requested for MAX or browser.
 */

let telegramBridgeLoadPromise: Promise<boolean> | null = null

export function isTelegramBridgeAvailable(): boolean {
  try {
    return Boolean((globalThis as unknown as { Telegram?: { WebApp?: unknown } }).Telegram?.WebApp)
  } catch {
    return false
  }
}

export function ensureTelegramBridgeLoaded(): Promise<boolean> {
  if (typeof document === 'undefined') return Promise.resolve(isTelegramBridgeAvailable())
  if (isTelegramBridgeAvailable()) return Promise.resolve(true)
  if (telegramBridgeLoadPromise) return telegramBridgeLoadPromise

  telegramBridgeLoadPromise = new Promise((resolve) => {
    const script = document.createElement('script')
    script.src = 'https://telegram.org/js/telegram-web-app.js'
    script.async = true
    script.onload = () => resolve(isTelegramBridgeAvailable())
    script.onerror = () => resolve(false)
    document.head.appendChild(script)
    setTimeout(() => resolve(isTelegramBridgeAvailable()), 5_000)
  })
  return telegramBridgeLoadPromise
}
