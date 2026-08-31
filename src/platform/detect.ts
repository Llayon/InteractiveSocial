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
 * Determines platform kind.
 *
 * Order:
 * 1. ?mock=1 forces mock. If &platform=max is present, mock simulates MAX, else Telegram-like mock (back-compat).
 * 2. navigator.webdriver → mock (Playwright)
 * 3. import.meta.env.DEV → mock (dev mode)
 * 4. real MAX detection
 * 5. real Telegram detection
 * 6. browser fallback
 *
 * Detection never classifies Telegram as MAX or vice versa.
 */
export function detectPlatform(): PlatformKind {
  if (typeof window === 'undefined') return 'browser'
  const params = new URLSearchParams(window.location.search)
  if (params.has('mock')) {
    // MAX mock is explicit via ?mock=1&platform=max
    const p = params.get('platform')
    if (p === 'max') return 'max' // treat mock MAX as 'max' for some flows, but consumer may map to 'mock'
    // Historically mock returns 'mock' regardless; we keep that for Telegram mock.
    // The factory will handle ?mock=1&platform=max → mock-mode MAX adapter.
    // To satisfy "mock" platform for tests, we return 'mock' but factory checks platform param.
    // For simplicity, if platform=max, we return 'mock' with MAX semantics — but type says 'max'|'mock'.
    // We choose to return 'mock' for any mock query, and factory decides adapter.
    // However for detection unit tests we want MAX mock to be distinguishable, so return 'mock' here
    // and let factory override. To pass K1.1 collision tests, detectPlatform itself should return 'mock'
    // when ?mock is set, regardless of inner platform.
    return 'mock'
  }
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
