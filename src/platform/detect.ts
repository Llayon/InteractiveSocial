import { isTMA } from '@tma.js/sdk'
import type { PlatformKind } from './types.js'
import { getMaxWebApp } from './max/bridge.js'

function isRealTelegramEnvironment(): boolean {
  try {
    return Boolean(isTMA())
  } catch {
    return false
  }
}

function isRealMaxEnvironment(): boolean {
  try {
    const wa = getMaxWebApp()
    if (!wa) return false
    // MAX signals: initData present with auth_date+hash, platform in known set, version looks like YY.build.patch
    const raw = wa.initData
    if (typeof raw !== 'string' || raw.length === 0) return false
    if (!raw.includes('auth_date=') || !raw.includes('hash=')) return false
    const platform = wa.platform
    const knownPlatforms = new Set(['ios', 'android', 'desktop', 'web'])
    // version must exist but not required for detection strength — platform alone not enough.
    // Require at least platform in known set OR initDataUnsafe has expected shape.
    const hasKnownPlatform = typeof platform === 'string' && knownPlatforms.has(platform)
    const hasUnsafe = wa.initDataUnsafe !== undefined && wa.initDataUnsafe !== null
    // Both signals together make detection reliable; don't rely on window.WebApp alone.
    return hasKnownPlatform && hasUnsafe
  } catch {
    return false
  }
}

/**
 * Strong MAX launch hint that works WITHOUT window.WebApp.
 * Official: URL hash contains #WebAppData=...&WebAppPlatform=...&WebAppVersion=...
 * per https://dev.max.ru/docs/webapps/validation and /bridge.
 * This is available BEFORE max-web-app.js loads, so detection does not block on CDN.
 * Do NOT treat manual `?startapp=` in search as MAX.
 */
export function hasMaxLaunchParamsInUrl(): boolean {
  try {
    if (typeof window === 'undefined') return false
    const hash = window.location.hash || ''
    if (!hash) return false
    const withoutHash = hash.startsWith('#') ? hash.slice(1) : hash
    if (!withoutHash) return false
    const params = new URLSearchParams(withoutHash)
    // Strong signal: both WebAppData and WebAppPlatform must be present
    // WebAppData is the encoded initData string, WebAppPlatform is ios/android/desktop/web
    if (params.has('WebAppData') && params.has('WebAppPlatform')) return true
    return false
  } catch {
    return false
  }
}

/**
 * Extract raw initData string from location.hash WebAppData (fallback when Bridge not yet ready).
 * WebAppData value is URL-encoded initData; URLSearchParams decoding gives the raw string.
 */
export function extractInitDataRawFromHash(): string {
  try {
    if (typeof window === 'undefined') return ''
    const hash = window.location.hash || ''
    const withoutHash = hash.startsWith('#') ? hash.slice(1) : hash
    if (!withoutHash) return ''
    const params = new URLSearchParams(withoutHash)
    const webAppData = params.get('WebAppData')
    if (!webAppData) return ''
    // URLSearchParams already decodes, but WebAppData was encoded once, so this is the raw initData
    return webAppData
  } catch {
    return ''
  }
}

/**
 * Extract start_param from WebAppData in hash (for client routing before Bridge).
 */
export function extractStartParamFromHash(): string | null {
  try {
    const raw = extractInitDataRawFromHash()
    if (!raw) return null
    const inner = new URLSearchParams(raw)
    const v = inner.get('start_param')
    return v && v.trim() ? v.trim() : null
  } catch {
    return null
  }
}

/**
 * Determines platform kind.
 *
 * Order (fixed for MAX bootstrap regression):
 * 1. ?mock=1 forces mock. If &platform=max is present, mock simulates MAX, else Telegram-like mock (back-compat).
 * 2. navigator.webdriver → mock (Playwright)
 * 3. import.meta.env.DEV → mock (dev mode)
 * 4. MAX launch URL hint (hash WebAppData+WebAppPlatform) — works WITHOUT window.WebApp, so CDN never blocks first paint
 * 5. real MAX detection via window.WebApp (after bridge loads)
 * 6. real Telegram detection
 * 7. browser fallback
 *
 * Detection never classifies Telegram as MAX or vice versa.
 * Normal browser with manual `?startapp=` alone does NOT become MAX — requires WebAppData+WebAppPlatform.
 */
export function detectPlatform(): PlatformKind {
  if (typeof window === 'undefined') return 'browser'
  const params = new URLSearchParams(window.location.search)
  if (params.has('mock')) {
    // MAX mock is explicit via ?mock=1&platform=max
    const p = params.get('platform')
    if (p === 'max') return 'max'
    return 'mock'
  }
  // Strong MAX launch hint works WITHOUT window.WebApp and must not be blocked by CDN.
  // Check before webdriver/DEV so MAX E2E (Playwright) still resolves to MAX even with webdriver=true.
  if (hasMaxLaunchParamsInUrl()) return 'max'
  if (typeof navigator !== 'undefined' && (navigator as unknown as { webdriver?: boolean }).webdriver === true) return 'mock'
  if (typeof import.meta !== 'undefined' && (import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV) return 'mock'
  if (isRealMaxEnvironment()) return 'max'
  if (isRealTelegramEnvironment()) return 'telegram'
  return 'browser'
}

/**
 * Helper for factory: returns whether mock should emulate MAX.
 */
export function isMockEmulatingMax(): boolean {
  if (typeof window === 'undefined') return false
  const params = new URLSearchParams(window.location.search)
  return params.has('mock') && params.get('platform') === 'max'
}

/**
 * Test helper: detect from injected signals (no window).
 */
export function detectPlatformFromSignals(signals: {
  hasMockQuery: boolean
  mockPlatform?: string | null
  webdriver?: boolean
  isDev?: boolean
  isMaxEnv: boolean
  isTelegramEnv: boolean
}): PlatformKind {
  if (signals.hasMockQuery) return 'mock'
  if (signals.webdriver) return 'mock'
  if (signals.isDev) return 'mock'
  if (signals.isMaxEnv) return 'max'
  if (signals.isTelegramEnv) return 'telegram'
  return 'browser'
}
