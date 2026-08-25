import { getAnalytics, initAnalytics } from '@/analytics/analytics'
import { deriveSource } from '@/analytics/events'
import type { TelegramAdapter } from '@/platform/telegram'

export interface BootstrapOptions {
  telegram: TelegramAdapter
}

/**
 * Application bootstrap: initializes the platform adapter and analytics,
 * emits the single `app_open` event with attribution context.
 * Must be called exactly once per page load, before first render effects.
 */
export function bootstrap(options: BootstrapOptions): void {
  const { telegram } = options
  telegram.ready()
  telegram.expand()

  const startParam = telegram.getStartParam() ?? undefined

  initAnalytics({
    baseContext: {
      platform: telegram.mode,
      start_param: startParam,
      source: deriveSource(startParam),
    },
  })

  getAnalytics().trackOnce('app_open', 'app_open')
}
