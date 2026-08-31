import { expect, test, expectNoRuntimeErrors } from './fixtures'

async function answerMusic14(page: import('@playwright/test').Page) {
  for (let i = 0; i < 14; i++) {
    await page.getByTestId('answer-option').first().click()
  }
}

test.describe('MAX mock journey', () => {
  test('landing → music14 → result → share (MAX mock)', async ({ page, errorCollector }) => {
    await page.goto('/?mock=1&platform=max&startapp=quiz_music90s')
    await expect(page.getByTestId('start-cta')).toBeVisible()
    await page.getByTestId('start-cta').click()
    await expect(page.getByTestId('quiz-screen')).toBeVisible()
    await answerMusic14(page)
    await expect(page.getByTestId('result-screen')).toBeVisible({ timeout: 5000 })
    await expect(page.getByTestId('share-button')).toBeVisible()
    // Share via MAX transport (mocked /api/max/share/prepare → max_mid)
    await page.getByTestId('share-button').click()
    await expect(page.getByTestId('share-status')).toHaveText('native', { timeout: 5000 })
    await expectNoRuntimeErrors(page, errorCollector)
  })

  test('interior via MAX mock', async ({ page, errorCollector }) => {
    await page.goto('/?mock=1&platform=max&startapp=quiz_interior-character')
    await expect(page.getByTestId('start-cta')).toBeVisible()
    await page.getByTestId('start-cta').click()
    await expect(page.getByTestId('quiz-screen')).toBeVisible()
    for (let i = 0; i < 8; i++) {
      await page.getByTestId('answer-option').first().click()
    }
    await expect(page.getByTestId('result-screen')).toBeVisible({ timeout: 5000 })
    await page.getByTestId('share-button').click()
    await expect(page.getByTestId('share-status')).toHaveText('native', { timeout: 5000 })
    await expectNoRuntimeErrors(page, errorCollector)
  })

  test('MAX s2 attribution routing', async ({ page, errorCollector }) => {
    await page.goto('/?mock=1&platform=max&startapp=s2_m90_lg_123456')
    await expect(page.getByTestId('start-cta')).toBeVisible()
    await expectNoRuntimeErrors(page, errorCollector)
  })
})
