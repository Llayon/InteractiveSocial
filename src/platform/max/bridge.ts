/**
 * Typed wrapper for MAX Bridge (https://st.max.ru/js/max-web-app.js)
 *
 * The script exposes window.WebApp. We never scatter window.WebApp
 * across React components — all MAX-specific logic lives here.
 */

export interface MaxWebAppUser {
  id: number
  first_name: string
  last_name?: string
  username?: string
  language_code?: string
  photo_url?: string
}

export interface MaxWebAppChat {
  id: number
  type: 'DIALOG' | 'CHAT' | 'CHANNEL'
}

export interface MaxInitDataUnsafe {
  query_id?: string
  auth_date?: number
  hash?: string
  user?: MaxWebAppUser
  chat?: MaxWebAppChat
  start_param?: string
  // ip etc may be present
  [k: string]: unknown
}

export interface MaxWebApp {
  initData: string
  initDataUnsafe: MaxInitDataUnsafe
  platform: 'ios' | 'android' | 'desktop' | 'web' | string
  version: string
  deviceName?: string
  HapticFeedback?: {
    impactOccurred?(style: string, disableVibrationFallback?: boolean): void
    notificationOccurred?(type: string, disableVibrationFallback?: boolean): void
    selectionChanged?(disableVibrationFallback?: boolean): void
  }
  shareMaxContent?(params: { mid: string; chatType: 'DIALOG' | 'CHAT' } | { text?: string; link?: string }): void
  shareContent?(params: { text?: string; link?: string }): void
  // other methods we don't use in MVP
  [k: string]: unknown
}

declare global {
  interface Window {
    WebApp?: MaxWebApp
  }
}

export function getMaxWebApp(): MaxWebApp | undefined {
  try {
    const w = (globalThis as unknown as { WebApp?: MaxWebApp }).WebApp
    if (w && typeof w.initData === 'string') return w
    // Fallback: window.WebApp
    if (typeof window !== 'undefined' && (window as unknown as { WebApp?: MaxWebApp }).WebApp) {
      return (window as unknown as { WebApp?: MaxWebApp }).WebApp
    }
    return undefined
  } catch {
    return undefined
  }
}

let maxBridgeLoadPromise: Promise<MaxWebApp | undefined> | null = null

/**
 * Dynamically loads MAX Bridge if not already present.
 * Uses singleton guard to avoid duplicate injection.
 * Safe to call multiple times.
 */
export function ensureMaxBridgeLoaded(): Promise<MaxWebApp | undefined> {
  if (typeof document === 'undefined') return Promise.resolve(getMaxWebApp())
  const existing = getMaxWebApp()
  if (existing) return Promise.resolve(existing)
  if (maxBridgeLoadPromise) return maxBridgeLoadPromise

  maxBridgeLoadPromise = new Promise((resolve) => {
    const script = document.createElement('script')
    script.src = 'https://st.max.ru/js/max-web-app.js'
    script.async = true
    script.onload = () => resolve(getMaxWebApp())
    script.onerror = () => resolve(undefined)
    document.head.appendChild(script)
    // Timeout fallback — if script doesn't load in 5s, resolve undefined
    setTimeout(() => resolve(getMaxWebApp()), 5_000)
  })
  return maxBridgeLoadPromise
}

export function isMaxBridgeAvailable(): boolean {
  return Boolean(getMaxWebApp())
}

/**
 * Parses a candidate initData string safely.
 * Returns true if it looks like a MAX initData (has auth_date, hash, user).
 */
export function isProbablyMaxInitData(raw: string): boolean {
  if (!raw || typeof raw !== 'string') return false
  if (!raw.includes('auth_date=') || !raw.includes('hash=')) return false
  return true
}
