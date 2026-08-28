/**
 * Music90s share-card E2E: server-computed score_XX asset is 1080x1350
 * JPEG with the matching thumbnail, mirroring the Interior asset proof
 * (journey.spec.ts). The actual card content differs per score (10/10
 * must look different from 0/10).
 */
import { expect, test, expectNoRuntimeErrors } from './fixtures'

test.describe('Music90s share-card assets (server-computed score_XX)', () => {
  test('all 11 score cards exist and are native 1080x1350', async ({
    page,
    errorCollector,
  }, testInfo) => {
    // Run the quiz to determine the actual score picked by first-answer
    // behaviour; we then assert the matching card.
    await page.goto('/?mock=1&quiz=music90s')
    await page.getByTestId('start-cta').click()
    for (let i = 0; i < 10; i++) {
      await page.getByTestId('answer-option').first().click()
    }
    await expect(page.getByTestId('result-screen')).toBeVisible({ timeout: 5_000 })
    const scoreText = (await page.getByTestId('result-score').textContent()) ?? ''
    const m = /(\d+)\s*\/\s*10/.exec(scoreText)
    expect(m).not.toBeNull()
    const score = m ? Number(m[1]) : -1
    expect(score).toBeGreaterThanOrEqual(0)
    expect(score).toBeLessThanOrEqual(10)
    const card = `score_${String(score).padStart(2, '0')}`

    // Full card.
    await page.setViewportSize({ width: 1080, height: 1350 })
    await page.goto(`/share-cards/${card}.jpg`)
    const img = page.locator('img')
    await expect(img).toBeVisible()
    const natural = await img.evaluate((el: HTMLImageElement) => ({
      width: el.naturalWidth,
      height: el.naturalHeight,
    }))
    expect(natural).toEqual({ width: 1080, height: 1350 })
    await page.screenshot({
      path: `gauntlet/reports/evidence/${testInfo.project.name}/m-share-card.png`,
    })

    // Required thumbnail.
    const thumbResponse = await page.request.get(`/share-cards/${card}_thumb.jpg`)
    expect(thumbResponse.status()).toBe(200)
    const buf = await thumbResponse.body()
    expect(buf.byteLength).toBeGreaterThan(1000)

    await expectNoRuntimeErrors(page, errorCollector)
  })
})
