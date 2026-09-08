import type { AnalyticsEvent } from './events.js'
import type { AnalyticsProvider } from './analytics.js'

const ANALYTICS_ENDPOINT = '/api/analytics'

export interface SendAnalyticsEventOptions {
  endpoint?: string
  fetchFn?: typeof fetch
}

async function sendAnalyticsEvent(
  event: AnalyticsEvent | string,
  payload: Record<string, unknown>,
  options: SendAnalyticsEventOptions = {},
): Promise<void> {
  const endpoint = options.endpoint ?? ANALYTICS_ENDPOINT
  const fetchFn = options.fetchFn ?? globalThis.fetch?.bind(globalThis)

  if (typeof fetchFn !== 'function') return

  const body = JSON.stringify({ event, properties: payload ?? {} })

  try {
    await fetchFn(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
      // keepalive allows the request to outlive page navigation/unload
      keepalive: true,
    } as RequestInit)
  } catch {
    // fire-and-forget: swallow all network errors
  }
}

/**
 * HTTP analytics provider — forwards events to same-origin /api/analytics.
 * Non-blocking, never throws, never shows UI errors.
 */
export const httpAnalyticsProvider: AnalyticsProvider = {
  track(event, payload) {
    // void: explicitly fire-and-forget, unhandled rejections are swallowed inside
    void sendAnalyticsEvent(event, payload)
  },
}

/**
 * Composite provider: fan-out to multiple providers.
 * Failures in one provider never break another.
 */
export function compositeProvider(...providers: AnalyticsProvider[]): AnalyticsProvider {
  return {
    track(event, payload) {
      for (const provider of providers) {
        try {
          provider.track(event, payload)
        } catch {
          // swallow
        }
      }
    },
  }
}

/**
 * For tests: synchronous helper that performs the same fetch logic
 * but is awaitable and injectable.
 */
export async function __sendAnalyticsEventForTests(
  event: string,
  payload: Record<string, unknown>,
  fetchFn: typeof fetch,
  endpoint = ANALYTICS_ENDPOINT,
): Promise<void> {
  await sendAnalyticsEvent(event, payload, { fetchFn, endpoint })
}

export { sendAnalyticsEvent, ANALYTICS_ENDPOINT }
