import { expect, test } from './fixtures'

test.describe('diagnostic build', () => {
  test('boot probe visible even before React', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await expect(page.locator('#boot-probe')).toBeVisible()
    await expect(page.locator('#boot-probe')).toContainText('BOOT_HTML_a0b0e98')
    await expect(page.locator('#boot-stages')).toContainText('HTML_LOADED')
  })

  test('versioned path serves same diagnostic HTML', async ({ page }) => {
    await page.goto('/max-diag-a0b0e98', { waitUntil: 'domcontentloaded' })
    await expect(page.locator('#boot-probe')).toBeVisible()
    await expect(page.locator('#boot-probe')).toContainText('BOOT_HTML_a0b0e98')
    await expect(page.getByTestId('start-cta')).toBeVisible({ timeout: 2000 })
  })

  test('stale asset 404 still shows boot error, not white screen', async ({ page }) => {
    // Simulate stale index.html pointing to old hashed asset that is now 404
    await page.route(/\/assets\/index-.*\.js/, (route) => route.fulfill({ status: 404, body: 'Not Found' }))
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    // Even with main JS 404, boot probe should still be visible (HTML marker)
    await expect(page.locator('#boot-probe')).toBeVisible()
    // And asset failure should be captured in boot-errors or stages
    const stages = await page.evaluate(() => (window as unknown as Record<string, unknown>).__BOOT_STAGES__ as string[] | undefined)
    // If main JS failed, stages may not include APP_MOUNTED, but HTML_LOADED should be there
    expect(stages?.join(' ')).toContain('HTML_LOADED')
    // Body should not be empty white screen — boot probe ensures visibility
    await expect(page.locator('body')).not.toBeEmpty()
  })

  test('CSS visibility: root has dimensions after mount', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await expect(page.getByTestId('start-cta')).toBeVisible({ timeout: 2000 })
    const rect = await page.evaluate(() => {
      const r = document.getElementById('root')
      const rect = r?.getBoundingClientRect()
      const cs = r ? getComputedStyle(r) : null
      return {
        width: rect?.width ?? 0,
        height: rect?.height ?? 0,
        display: cs?.display,
        opacity: cs?.opacity,
        visibility: cs?.visibility,
        bodyLen: document.body.innerText.length,
      }
    })
    expect(rect.width).toBeGreaterThan(0)
    expect(rect.height).toBeGreaterThan(0)
    expect(rect.display).not.toBe('none')
    expect(rect.visibility).not.toBe('hidden')
    expect(rect.bodyLen).toBeGreaterThan(20)
  })
})
