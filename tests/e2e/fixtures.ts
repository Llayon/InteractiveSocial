import { expect, test as base, type Page } from '@playwright/test'

/**
 * Shared E2E fixtures:
 * - deterministic Telegram mock environment (?mock=1),
 * - prepared-share API interception (no real backend / bot token needed),
 * - hard gate on runtime errors: pageerror, console.error,
 *   unhandled promise rejection.
 */

export interface ErrorCollector {
  list: () => string[]
}

export const test = base.extend<{ errorCollector: ErrorCollector }>({
  errorCollector: async ({ page }, use) => {
    const errors: string[] = []

    await page.addInitScript(() => {
      const w = window as unknown as { __unhandledRejections?: string[] }
      w.__unhandledRejections = []
      window.addEventListener('unhandledrejection', (event) => {
        w.__unhandledRejections?.push(String(event.reason))
      })
    })

    // No real Telegram runtime and no CDN dependency in E2E. We fulfill with
    // an empty script instead of aborting — an aborted request would surface
    // as a browser console.error and trip the runtime-error hard gate.
    await page.route(/telegram\.org/, (route) =>
      route.fulfill({ status: 200, contentType: 'application/javascript', body: '' }),
    )
    // Deterministic prepared-message backend (Telegram + MAX).
    await page.route('**/api/share/prepare', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, id: 'prepared_e2e_1' }),
      }),
    )
    await page.route('**/api/max/share/prepare', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, mid: 'max_mid_e2e_1' }),
      }),
    )
    await page.route('**/api/results/deliver', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, deliveredSelf: true, deliveredSharer: false }),
      }),
    )
    await page.route('**/api/max/results/deliver', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, deliveredSelf: true, deliveredSharer: false }),
      }),
    )
    // MAX bridge script — avoid 404 in offline E2E (also mocked via no static tag, but keep for safety)
    await page.route(/st\.max\.ru/, (route) =>
      route.fulfill({ status: 200, contentType: 'application/javascript', body: '' }),
    )

    page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`))
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(`console.error: ${msg.text()}`)
      }
    })

    await use({ list: () => errors })
  },
})

export { expect }

/**
 * Hard quality-bar assertion: zero runtime errors of any kind.
 * `ignore` allows narrowly-scoped, documented exceptions (e.g. a test that
 * intentionally answers HTTP 502 — Chromium logs any failed response as a
 * console error, which is exactly the behavior under test there).
 */
export async function expectNoRuntimeErrors(
  page: Page,
  collector: ErrorCollector,
  ignore: string[] = [],
): Promise<void> {
  const unhandled = await page.evaluate(() => {
    return (window as unknown as { __unhandledRejections?: string[] }).__unhandledRejections ?? []
  })
  const all = [...collector.list(), ...unhandled.map((r) => `unhandledrejection: ${r}`)]
  const relevant = all.filter((message) => !ignore.some((pattern) => message.includes(pattern)))
  expect(relevant).toEqual([])
}
