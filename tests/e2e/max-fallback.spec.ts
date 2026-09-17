import { expect, test, expectNoRuntimeErrors } from './fixtures'

test.describe('MAX dialog.not.found skips redundant prepare', () => {
  test('delivery 404 → CTA usable without auto prepare (interior, MAX mock)', async ({
    page,
    errorCollector,
    analyticsCollector,
  }) => {
    let prepareCalls = 0
    let deliverCalls = 0

    // Override fixture mocks: deliver fails terminally, prepare counts calls.
    await page.unroute('**/api/max/results/deliver')
    await page.route('**/api/max/results/deliver', (route) => {
      deliverCalls += 1
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          deliveredSelf: false,
          deliveredSharer: false,
          selfMid: null,
          selfErrorCode: 'dialog.not.found',
          selfStatus: 404,
          selfVia: 'url',
        }),
      })
    })
    await page.unroute('**/api/max/share/prepare')
    await page.route('**/api/max/share/prepare', (route) => {
      prepareCalls += 1
      return route.fulfill({
        status: 502,
        contentType: 'application/json',
        body: JSON.stringify({ ok: false, error: 'max_failure' }),
      })
    })

    await page.goto('/?mock=1&platform=max&startapp=quiz_interior-character')
    await expect(page.getByTestId('start-cta')).toBeVisible()
    await page.getByTestId('start-cta').click()
    await expect(page.getByTestId('quiz-screen')).toBeVisible()
    for (let i = 0; i < 8; i++) {
      await page.getByTestId('answer-option').first().click()
    }
    await expect(page.getByTestId('result-screen')).toBeVisible({ timeout: 5000 })

    // Fallback-ready: CTA usable immediately after deliver response,
    // without waiting for a second (doomed) prepare roundtrip.
    await expect(page.getByTestId('share-button')).toBeEnabled({ timeout: 10000 })
    await expect(page.getByTestId('share-button')).not.toContainText('Готовим карточку')
    expect(prepareCalls).toBe(0)

    // Analytics funnel: failed → fallback_ready, no mid before user click.
    const eventNames = () => analyticsCollector.list().map((e) => e.event)
    expect(deliverCalls).toBe(1)
    await expect.poll(eventNames, { timeout: 10000 }).toContain('max_result_delivery_failed')
    await expect.poll(eventNames, { timeout: 10000 }).toContain('max_share_fallback_ready')
    expect(eventNames()).not.toContain('max_share_mid_ready')
    expect(prepareCalls).toBe(0)

    await expectNoRuntimeErrors(page, errorCollector)
  })
})
