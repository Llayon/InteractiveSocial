/**
 * Anonymous identity helpers for analytics.
 *
 * - anonymous_id : per-installation / per-browser, persisted in localStorage.
 * - session_id   : per page/app open, ephemeral (in-memory only).
 *
 * No Telegram / MAX user identifiers are ever used.
 * All failures are swallowed — analytics must never break UX.
 */

export const ANONYMOUS_ID_STORAGE_KEY = 'interactive_social_analytics_id'

type UuidFn = () => string

function defaultGenerateUuid(): string {
  try {
    const c = globalThis.crypto as unknown as { randomUUID?: () => string } | undefined
    if (c && typeof c.randomUUID === 'function') {
      return c.randomUUID()
    }
  } catch {
    // fall through
  }
  // RFC4122 v4 fallback — not cryptographically strong but deterministic enough
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const r = (Math.random() * 16) | 0
    const v = char === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

let memoryAnonymousId: string | null = null

export interface GetOrCreateAnonymousIdOptions {
  storage?: Pick<Storage, 'getItem' | 'setItem'>
  generateUuid?: UuidFn
  storageKey?: string
}

/**
 * Return the stable anonymous_id for this browser.
 * - Tries localStorage (ANONYMOUS_ID_STORAGE_KEY)
 * - Falls back to in-memory per-page id if storage unavailable
 * - Never throws
 */
export function getOrCreateAnonymousId(options: GetOrCreateAnonymousIdOptions = {}): string {
  const generateUuid = options.generateUuid ?? defaultGenerateUuid
  const storageKey = options.storageKey ?? ANONYMOUS_ID_STORAGE_KEY

  // In-memory fast path (already resolved this page)
  if (memoryAnonymousId) return memoryAnonymousId

  const storage = options.storage ?? tryGetLocalStorage()

  if (storage) {
    try {
      const existing = storage.getItem(storageKey)
      if (typeof existing === 'string' && existing.length > 0) {
        memoryAnonymousId = existing
        return existing
      }
    } catch {
      // storage read failed — fall through to generation
    }

    try {
      const generated = generateUuid()
      try {
        storage.setItem(storageKey, generated)
      } catch {
        // quota / disabled — keep in memory only
      }
      memoryAnonymousId = generated
      return generated
    } catch {
      // generation failure — fall through
    }
  }

  // Storage unavailable — ephemeral per-page id
  try {
    const generated = generateUuid()
    memoryAnonymousId = generated
    return generated
  } catch {
    memoryAnonymousId = `anon_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
    return memoryAnonymousId
  }
}

/**
 * Create a new session_id for this app open.
 * Always ephemeral — never persisted.
 */
export function createSessionId(generateUuid?: UuidFn): string {
  const fn = generateUuid ?? defaultGenerateUuid
  try {
    return fn()
  } catch {
    return `sess_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
  }
}

/**
 * Reset in-memory cache (test helper).
 */
export function __resetIdentityCache(): void {
  memoryAnonymousId = null
}

function tryGetLocalStorage(): Storage | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null
    // Touch storage to detect blocked access (e.g. third-party iframe)
    const testKey = '__analytics_storage_test__'
    window.localStorage.setItem(testKey, '1')
    window.localStorage.removeItem(testKey)
    return window.localStorage
  } catch {
    return null
  }
}
