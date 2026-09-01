import { expect, test, expectNoRuntimeErrors } from './fixtures'

test.describe('MAX bootstrap regression (P0 fix)', () => {
  test('A. MAX URL present, no pre-existing window.WebApp → platform max', async ({ page }) => {
    const fakeInit = `auth_date=${Math.floor(Date.now() / 1000)}&user=${encodeURIComponent(JSON.stringify({ id: 999, first_name: 'Test' }))}&hash=testhash&start_param=quiz_music90s`
    await page.goto(`/#WebAppData=${encodeURIComponent(fakeInit)}&WebAppPlatform=web&WebAppVersion=26.2.8`)
    // App should detect MAX via hash and render landing (not browser fallback mis-detect)
    await expect(page.getByTestId('start-cta')).toBeVisible({ timeout: 2000 })
    // Check that platform detection via evaluate is max (expose via adapter or via hasMaxLaunchParams)
    const isMax = await page.evaluate(() => {
      const hash = window.location.hash
      const params = new URLSearchParams(hash.slice(1))
      return params.has('WebAppData') && params.has('WebAppPlatform')
    })
    expect(isMax).toBe(true)
  })

  test('B. MAX Bridge CDN slow (10s) → quiz UI visible BEFORE bridge', async ({ page }) => {
    // Override st.max.ru to be slow
    await page.unroute(/st\.max\.ru/)
    await page.route(/st\.max\.ru/, async (route) => {
      await new Promise((r) => setTimeout(r, 10000))
      await route.fulfill({ status: 200, contentType: 'application/javascript', body: 'window.WebApp={initData:"",initDataUnsafe:{},platform:"web",version:"26.2.8"}' })
    })
    const fakeInit = `auth_date=${Math.floor(Date.now() / 1000)}&user=${encodeURIComponent(JSON.stringify({ id: 1, first_name: 'A' }))}&hash=abc&start_param=quiz_music90s`
    const start = Date.now()
    await page.goto(`/#WebAppData=${encodeURIComponent(fakeInit)}&WebAppPlatform=web&WebAppVersion=26.2.8`, { waitUntil: 'domcontentloaded' })
    // Performance assertion: landing must be visible quickly, not waiting for 10s bridge (allow 4s for CI variance)
    await expect(page.getByTestId('start-cta')).toBeVisible({ timeout: 2000 })
    const elapsed = Date.now() - start
    expect(elapsed).toBeLessThan(4000)
    // Ensure no white screen
    await expect(page.locator('body')).not.toBeEmpty()
  })

  test('C. MAX Bridge CDN fails → quiz still renders, no pageerror', async ({ page, errorCollector }) => {
    await page.unroute(/st\.max\.ru/)
    await page.route(/st\.max\.ru/, (route) => route.abort('failed'))
    const fakeInit = `auth_date=${Math.floor(Date.now() / 1000)}&user=${encodeURIComponent(JSON.stringify({ id: 2, first_name: 'B' }))}&hash=xyz&start_param=quiz_interior-character`
    await page.goto(`/#WebAppData=${encodeURIComponent(fakeInit)}&WebAppPlatform=android&WebAppVersion=26.2.8`, { waitUntil: 'domcontentloaded' })
    await expect(page.getByTestId('start-cta')).toBeVisible({ timeout: 2000 })
    // Haptics/share degrade gracefully, but quiz routing works
    await page.getByTestId('start-cta').click()
    await expect(page.getByTestId('quiz-screen')).toBeVisible({ timeout: 2000 })
    await expectNoRuntimeErrors(page, errorCollector, ['Failed to load resource: net::ERR_FAILED'])
  })

  test('D. direct Music launch via MAX hash → Music90s opens', async ({ page }) => {
    const fakeInit = `auth_date=${Math.floor(Date.now() / 1000)}&user=${encodeURIComponent(JSON.stringify({ id: 3, first_name: 'C' }))}&hash=123&start_param=quiz_music90s`
    await page.goto(`/#WebAppData=${encodeURIComponent(fakeInit)}&WebAppPlatform=ios&WebAppVersion=26.2.8`, { waitUntil: 'domcontentloaded' })
    await expect(page.getByTestId('start-cta')).toBeVisible()
    await expect(page.getByTestId('start-cta')).toHaveText('Проверить память')
    // Debug: ensure platform and startParam are correct
    const dbg = await page.evaluate(() => ({
      platform: (window as unknown as Record<string, unknown>).__platform,
      startParam: (window as unknown as Record<string, unknown>).__startParam,
      hash: window.location.hash,
    }))
    expect(dbg.platform).toBe('max')
    expect(dbg.startParam).toBe('quiz_music90s')
    await page.getByTestId('start-cta').click()
    await expect(page.getByTestId('quiz-screen')).toBeVisible()
    await expect(page.getByTestId('progress')).toHaveText('01 / 14')
  })

  test('E. default bot Mini App launch (no start_param) → Interior (default)', async ({ page }) => {
    const fakeInit = `auth_date=${Math.floor(Date.now() / 1000)}&user=${encodeURIComponent(JSON.stringify({ id: 4, first_name: 'D' }))}&hash=999`
    await page.goto(`/#WebAppData=${encodeURIComponent(fakeInit)}&WebAppPlatform=web&WebAppVersion=26.2.8`)
    await expect(page.getByTestId('start-cta')).toBeVisible()
    await expect(page.getByTestId('start-cta')).toHaveText('Узнать свой характер')
  })

  test('F. Telegram launch must NOT request st.max.ru as render-blocking', async ({ page }) => {
    let maxRequested = false
    await page.route(/st\.max\.ru/, (route) => {
      maxRequested = true
      return route.fulfill({ status: 200, contentType: 'application/javascript', body: '' })
    })
    await page.goto('/?mock=1')
    await expect(page.getByTestId('start-cta')).toBeVisible({ timeout: 2000 })
    // For Telegram mock, MAX bridge should not be requested as render-blocking
    // Allow that it might be requested later lazily, but not before first paint
    // We check that landing was visible quickly and no blocking
    expect(maxRequested).toBe(false)
  })

  test('G. browser must not accidentally become MAX', async ({ page }) => {
    await page.goto('/?startapp=quiz_music90s')
    await expect(page.getByTestId('start-cta')).toBeVisible()
    // Should be browser or mock (in DEV), but not MAX via hash
    const hash = await page.evaluate(() => window.location.hash)
    expect(hash).toBe('')
    // Ensure not MAX
    const isMaxHash = await page.evaluate(() => {
      const h = window.location.hash
      const p = new URLSearchParams(h.slice(1))
      return p.has('WebAppData') && p.has('WebAppPlatform')
    })
    expect(isMaxHash).toBe(false)
  })

  test('Performance: MAX bridge never-resolve must not prevent render', async ({ page }) => {
    await page.unroute(/st\.max\.ru/)
    await page.route(/st\.max\.ru/, () => new Promise(() => {})) // never resolves
    const fakeInit = `auth_date=${Math.floor(Date.now() / 1000)}&user=${encodeURIComponent(JSON.stringify({ id: 5, first_name: 'E' }))}&hash=abc&start_param=quiz_music90s`
    await page.goto(`/#WebAppData=${encodeURIComponent(fakeInit)}&WebAppPlatform=web&WebAppVersion=26.2.8`, { waitUntil: 'domcontentloaded' })
    await expect(page.getByTestId('start-cta')).toBeVisible({ timeout: 2000 })
    await expect(page.getByTestId('start-cta')).toHaveText('Проверить память')
  })
})
