import type { MiniAppAdapter, MiniAppUser } from '../types.js'
import { getMaxWebApp } from './bridge.js'
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
  // Fallback to URL (e.g. https://max.ru/<bot>?startapp=...)
  try {
    return readStartParamFromUrl()
  } catch {
    return null
  }
}

/**
 * Real MAX Mini App adapter — implements MiniAppAdapter.
 * All MAX-specific calls live here.
 */
export function createMaxAdapter(): MiniAppAdapter {
  // Capture synchronously at creation time (initData is static per launch)
  const initDataRaw = (() => {
    const wa = getMaxWebApp()
    if (wa && typeof wa.initData === 'string' && wa.initData.length > 0) return wa.initData
    return ''
  })()

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
      const viaUnsafe = parseUserFromInitDataUnsafe()
      if (viaUnsafe) return viaUnsafe
      // Try parsing raw initData user JSON
      if (!initDataRaw) return null
      try {
        const params = new URLSearchParams(initDataRaw)
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
      return initDataRaw
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
