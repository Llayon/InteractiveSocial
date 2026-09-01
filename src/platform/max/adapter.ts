import type { MiniAppAdapter, MiniAppUser } from '../types.js'
import { getMaxWebApp } from './bridge.js'
import { extractInitDataRawFromHash, extractStartParamFromHash } from '../detect.js'
import { readStartParamFromUrl } from '../telegram/mock.js'

function parseUserFromInitDataUnsafe(): MiniAppUser | null {
  const wa = getMaxWebApp()
  if (!wa) return null
  const u = wa.initDataUnsafe?.user as { id?: unknown; first_name?: unknown; username?: unknown } | undefined
  if (!u || typeof u.id !== 'number') return null
  return {
    id: u.id,
    firstName: typeof u.first_name === 'string' && u.first_name ? u.first_name : 'друг',
    username: typeof u.username === 'string' ? u.username : undefined,
  }
}

function getStartParamFromMax(): string | null {
  const wa = getMaxWebApp()
  if (wa?.initDataUnsafe?.start_param && typeof wa.initDataUnsafe.start_param === 'string') {
    const v = wa.initDataUnsafe.start_param.trim()
    if (v) return v
  }
  // Official fallbacks per docs: WebAppStartParam URL value, then start_param inside WebAppData
  // 1) URL search fallback (e.g. ?startapp=..., manual)
  try {
    const fromUrl = readStartParamFromUrl()
    if (fromUrl) return fromUrl
  } catch {
    // ignore
  }
  // 2) Hash WebAppData fallback for client routing before Bridge ready
  //    WebAppData contains encoded initData with start_param
  try {
    const fromHash = extractStartParamFromHash()
    if (fromHash) return fromHash
  } catch {
    // ignore
  }
  // 3) Also check explicit WebAppStartParam in hash/search if present
  try {
    if (typeof window !== 'undefined') {
      const hash = window.location.hash || ''
      const params = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash)
      const v = params.get('WebAppStartParam')
      if (v && v.trim()) return v.trim()
      const search = new URLSearchParams(window.location.search)
      const s = search.get('WebAppStartParam')
      if (s && s.trim()) return s.trim()
    }
  } catch {
    // ignore
  }
  return null
}

/**
 * Real MAX Mini App adapter — implements MiniAppAdapter.
 * All MAX-specific calls live here.
 */
export function createMaxAdapter(): MiniAppAdapter {
  // initData is static per launch, but Bridge may not be ready at adapter creation.
  // getInitDataRaw is dynamic: prefer window.WebApp.initData, fallback to WebAppData from hash.
  // This is safe for transport because server validates HMAC; client does NOT treat as trusted identity.
  const getRaw = (): string => {
    const wa = getMaxWebApp()
    if (wa && typeof wa.initData === 'string' && wa.initData.length > 0) return wa.initData
    const fromHash = extractInitDataRawFromHash()
    if (fromHash) return fromHash
    return ''
  }

  return {
    platform: 'max',
    mode: 'max' as const,
    ready() {
      // MAX bridge doesn't require explicit ready; no-op
    },
    expand() {
      // no-op for MVP
    },
    getStartParam() {
      return getStartParamFromMax()
    },
    getUser() {
      // Prefer initDataUnsafe user; fallback to parsing initData raw if needed
      // If Bridge not yet available, returning null is acceptable — do not delay render
      const viaUnsafe = parseUserFromInitDataUnsafe()
      if (viaUnsafe) return viaUnsafe
      const raw = getRaw()
      if (!raw) return null
      try {
        const params = new URLSearchParams(raw)
        const userJson = params.get('user')
        if (!userJson) return null
        const parsed = JSON.parse(userJson) as { id?: number; first_name?: string; username?: string }
        if (typeof parsed.id !== 'number') return null
        return { id: parsed.id, firstName: parsed.first_name ?? 'друг', username: parsed.username }
      } catch {
        return null
      }
    },
    getInitDataRaw() {
      return getRaw()
    },
    haptic(style = 'light') {
      try {
        const wa = getMaxWebApp()
        const map: Record<string, string> = {
          light: 'light',
          medium: 'medium',
          heavy: 'heavy',
          soft: 'soft',
          rigid: 'rigid',
        }
        const s = map[style] ?? 'light'
        wa?.HapticFeedback?.impactOccurred?.(s)
      } catch {
        /* no-op */
      }
    },
  }
}
