import { consoleProvider, getAnalytics, initAnalytics } from '@/analytics/analytics'
import type { AnalyticsProvider } from '@/analytics/analytics'
import { resolveAcquisitionAttribution } from '@/analytics/attribution'
import { deriveEntrySource, deriveSource } from '@/analytics/events'
import { createSessionId, getOrCreateAnonymousId } from '@/analytics/identity'
import { compositeProvider, httpAnalyticsProvider } from '@/analytics/httpProvider'
import type { MiniAppAdapter } from '@/platform/types'
import type { TelegramAdapter } from '@/platform/telegram'

export interface BootstrapOptions {
  telegram: TelegramAdapter
  // New neutral name; telegram alias kept for BC
  adapter?: MiniAppAdapter
}

function resolveAnalyticsProvider(): AnalyticsProvider {
  try {
    const env = (import.meta as unknown as { env?: Record<string, unknown> }).env
    const mode = env?.MODE as string | undefined
    const isProd = Boolean(env?.PROD)
    const isTest = mode === 'test'
    const explicit = env?.VITE_ANALYTICS_PROVIDER as string | undefined

    if (isTest) return consoleProvider
    if (isProd) return httpAnalyticsProvider
    if (explicit === 'console') return consoleProvider
    if (explicit === 'http') return httpAnalyticsProvider
    return compositeProvider(consoleProvider, httpAnalyticsProvider)
  } catch {
    return consoleProvider
  }
}

/**
 * Application bootstrap: initializes the platform adapter and analytics,
 * emits the single `app_open` event with attribution context.
 * Must be called exactly once per page load, before first render effects.
 */
export function bootstrap(options: BootstrapOptions): void {
  const adapter = (options.adapter ?? options.telegram) as MiniAppAdapter
  adapter.ready()
  adapter.expand()

  const startParam = adapter.getStartParam() ?? undefined

  let anonymousId: string | undefined
  let sessionId: string | undefined
  try {
    anonymousId = getOrCreateAnonymousId()
  } catch {
    anonymousId = undefined
  }
  try {
    sessionId = createSessionId()
  } catch {
    sessionId = undefined
  }

  const provider = resolveAnalyticsProvider()

  const attribution = resolveAcquisitionAttribution({
    startParam: startParam ?? null,
    platform: adapter.platform,
  })

  initAnalytics({
    provider,
    baseContext: {
      platform: adapter.platform,
      start_param: startParam,
      source: deriveSource(startParam),
      entry_source: deriveEntrySource(startParam ?? null),
      acquisition_channel: attribution.acquisition_channel,
      acquisition_source: attribution.acquisition_source,
      ...(attribution.campaign_id ? { campaign_id: attribution.campaign_id } : {}),
      ...(anonymousId ? { anonymous_id: anonymousId } : {}),
      ...(sessionId ? { session_id: sessionId } : {}),
    },
  })

  getAnalytics().trackOnce('app_open', 'app_open')
}
