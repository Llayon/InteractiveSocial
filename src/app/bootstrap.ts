import { getAnalytics, initAnalytics } from '@/analytics/analytics'
import { deriveSource } from '@/analytics/events'
import type { MiniAppAdapter } from '@/platform/types'
import type { TelegramAdapter } from '@/platform/telegram'

export interface BootstrapOptions {
  telegram: TelegramAdapter
  // New neutral name; telegram alias kept for BC
  adapter?: MiniAppAdapter
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

  initAnalytics({
    baseContext: {
      platform: adapter.platform,
      start_param: startParam,
      source: deriveSource(startParam),
    },
  })

  getAnalytics().trackOnce('app_open', 'app_open')
}
