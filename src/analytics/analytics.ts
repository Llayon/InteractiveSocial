import type { AnalyticsContext, AnalyticsEvent } from './events.js'

export interface AnalyticsProvider {
  track(event: AnalyticsEvent | string, payload: Record<string, unknown>): void
}

/**
 * Lightweight console adapter — the default provider until a real analytics
 * service is connected. Replaceable via createAnalytics({ provider }).
 */
export const consoleProvider: AnalyticsProvider = {
  track(event, payload) {
    // Intentionally quiet in tests; visible but non-intrusive elsewhere.
    if (typeof console !== 'undefined') {
      console.info(`[analytics] ${event}`, payload)
    }
  },
}

export interface Analytics {
  track(event: AnalyticsEvent, payload?: Record<string, unknown>): void
  /** Emit an event at most once per logical key (re-render / remount safe). */
  trackOnce(onceKey: string, event: AnalyticsEvent, payload?: Record<string, unknown>): void
  updateContext(context: AnalyticsContext): void
}

const emittedOnceKeys = new Set<string>()

/**
 * Analytics facade. Guarantees:
 * - provider failures never break product UX (all errors swallowed),
 * - lifecycle events are not duplicated by React re-renders (trackOnce),
 * - common context is attached to every event.
 */
export function createAnalytics(options?: {
  provider?: AnalyticsProvider
  baseContext?: AnalyticsContext
}): Analytics {
  const provider = options?.provider ?? consoleProvider
  const context: AnalyticsContext = { ...options?.baseContext }

  return {
    updateContext(partial) {
      try {
        Object.assign(context, partial)
      } catch {
        /* analytics must never throw */
      }
    },

    track(event, payload = {}) {
      try {
        provider.track(event, { ...context, ...payload })
      } catch {
        /* swallow: analytics failure must never break UX */
      }
    },

    trackOnce(onceKey, event, payload = {}) {
      if (emittedOnceKeys.has(onceKey)) return
      emittedOnceKeys.add(onceKey)
      this.track(event, payload)
    },
  }
}

let instance: Analytics | null = null

export function initAnalytics(options?: Parameters<typeof createAnalytics>[0]): Analytics {
  instance = createAnalytics(options)
  return instance
}

export function getAnalytics(): Analytics {
  if (!instance) {
    instance = createAnalytics()
  }
  return instance
}
