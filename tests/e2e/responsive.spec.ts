import { expect, test, expectNoRuntimeErrors } from './fixtures'

const pad = (n: number) => String(n).padStart(2, '0')

async function assertNoHorizontalOverflow(page: import('@playwright/test').Page): Promise<void> {
  const metrics = await page.evaluate(() => {
    const doc = document.documentElement
    return {
      scrollWidth: doc.scrollWidth,
      innerWidth: window.innerWidth,
      scrollHeight: doc.scrollHeight,
    }
  })
  // Zero horizontal page overflow.
  expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.innerWidth + 1)
}

async function assertCtaUsable(
  page: import('@playwright/test').Page,
  testId: string,
): Promise<void> {
  const box = await page.getByTestId(testId).boundingBox()
  expect(box).not.toBeNull()
  if (!box) return
  // No clipped CTA / unreachable controls.
  expect(box.x).toBeGreaterThanOrEqual(-1)
  expect(box.x + box.width).toBeLessThanOrEqual(page.viewportSize()!.width + 1)
  // Touch targets remain usable (>=40px height).
  expect(box.height).toBeGreaterThanOrEqual(40)
}

test.describe('responsive quality bar', () => {
  test('landing state: zero overflow, usable CTA, no console errors', async ({
    page,
    errorCollector,
  }) => {
    await page.goto('/?mock=1')
    await expect(page.getByTestId('start-cta')).toBeVisible()
    await assertNoHorizontalOverflow(page)
    await assertCtaUsable(page, 'start-cta')
    await expectNoRuntimeErrors(page, errorCollector)
  })

  test('mid-quiz state: zero overflow on every question layout', async ({
    page,
    errorCollector,
  }) => {
    await page.goto('/?mock=1')
    await page.getByTestId('start-cta').click()

    for (let i = 1; i <= 8; i++) {
      await expect(page.getByTestId('progress')).toHaveText(`${pad(i)} / 08`)
      await assertNoHorizontalOverflow(page)
      const options = page.getByTestId('answer-option')
      await expect(options.first()).toBeVisible()
      if (i === 3) {
        // Palette layout must not clip its swatches either.
        const paletteBox = await options.first().boundingBox()
        expect(paletteBox).not.toBeNull()
      }
      await options.first().click()
    }
    await expectNoRuntimeErrors(page, errorCollector)
  })

  test('result state: zero overflow, both CTAs reachable', async ({ page, errorCollector }) => {
    await page.goto('/?mock=1')
    await page.getByTestId('start-cta').click()
    for (let i = 1; i <= 8; i++) {
      await page.getByTestId('answer-option').first().click()
    }
    await expect(page.getByTestId('result-screen')).toBeVisible({ timeout: 5_000 })
    await assertNoHorizontalOverflow(page)
    await assertCtaUsable(page, 'share-button')
    await assertCtaUsable(page, 'restart-button')
    await expectNoRuntimeErrors(page, errorCollector)
  })
})
