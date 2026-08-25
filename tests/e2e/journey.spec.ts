import { expect, test, expectNoRuntimeErrors } from './fixtures'

const pad = (n: number) => String(n).padStart(2, '0')

async function answerAllQuestions(page: import('@playwright/test').Page): Promise<void> {
  for (let i = 0; i < 8; i++) {
    await expect(page.getByTestId('progress')).toHaveText(`${pad(i + 1)} / 08`)
    await page.getByTestId('answer-option').first().click()
  }
}

test.describe('full user journey (Telegram mock mode)', () => {
  test('landing → 8 answers → reveal → result → share → restart', async ({
    page,
    errorCollector,
  }, testInfo) => {
    await page.goto('/?mock=1&tgWebAppStartParam=post_aug25')

    // Landing
    await expect(page.getByRole('heading', { level: 1 })).toContainText(
      'Какой у тебя интерьерный характер?',
    )
    await expect(page.getByTestId('start-cta')).toBeVisible()
    await page.screenshot({
      path: `gauntlet/reports/evidence/${testInfo.project.name}/01-landing.png`,
      fullPage: true,
    })

    // Start
    await page.getByTestId('start-cta').click()
    await expect(page.getByTestId('quiz-screen')).toBeVisible()
    await expect(page.getByTestId('progress')).toHaveText('01 / 08')
    await page.screenshot({
      path: `gauntlet/reports/evidence/${testInfo.project.name}/02-quiz.png`,
      fullPage: true,
    })

    // 8 deterministic answers
    await answerAllQuestions(page)

    // Reveal transition then editorial result
    await expect(page.getByTestId('result-screen')).toBeVisible({ timeout: 5_000 })
    await expect(page.getByTestId('result-title')).toBeVisible()
    await expect(page.getByTestId('result-traits').locator('li')).toHaveCount(5)
    await expect(page.getByTestId('share-button')).toHaveText('Отправить результат подруге')
    await expect(page.getByTestId('restart-button')).toHaveText('Пройти ещё раз')
    await page.screenshot({
      path: `gauntlet/reports/evidence/${testInfo.project.name}/03-result.png`,
      fullPage: true,
    })

    // Native share via intercepted prepared-message endpoint
    await page.getByTestId('share-button').click()
    await expect(page.getByTestId('share-status')).toHaveText('native', { timeout: 5_000 })

    // Restart loop closes the cycle
    await page.getByTestId('restart-button').click()
    await expect(page.getByTestId('start-cta')).toBeVisible()

    await expectNoRuntimeErrors(page, errorCollector)
  })

  test('back preserves selection; changing an answer keeps the flow consistent', async ({
    page,
    errorCollector,
  }) => {
    await page.goto('/?mock=1')
    await page.getByTestId('start-cta').click()

    await expect(page.getByTestId('progress')).toHaveText('01 / 08')
    const firstOption = page.getByTestId('answer-option').first()
    await firstOption.click()

    await expect(page.getByTestId('progress')).toHaveText('02 / 08')
    await page.getByTestId('back-button').click()
    await expect(page.getByTestId('progress')).toHaveText('01 / 08')
    await expect(page.getByTestId('answer-option').first()).toHaveClass(/is-selected/)

    // Change the previous answer → still progresses exactly one step.
    await page.getByTestId('answer-option').last().click()
    await expect(page.getByTestId('progress')).toHaveText('02 / 08')

    await answerAllQuestionsFrom(page, 2)
    await expect(page.getByTestId('result-screen')).toBeVisible({ timeout: 5_000 })

    await expectNoRuntimeErrors(page, errorCollector)
  })

  test('share failure degrades gracefully without crash', async ({ page, errorCollector }) => {
    await page.unroute('**/api/share/prepare')
    await page.route('**/api/share/prepare', (route) =>
      route.fulfill({
        status: 502,
        contentType: 'application/json',
        body: JSON.stringify({ ok: false, error: 'telegram_failure' }),
      }),
    )

    await page.goto('/?mock=1')
    await page.getByTestId('start-cta').click()
    await answerAllQuestions(page)
    await expect(page.getByTestId('result-screen')).toBeVisible({ timeout: 5_000 })

    await page.getByTestId('share-button').click()
    // Graceful degradation is async — poll the status instead of reading once.
    await expect(page.getByTestId('share-status')).toHaveText(/^(fallback|failed)$/, {
      timeout: 5_000,
    })
    await expect(page.getByTestId('restart-button')).toBeEnabled()

    // Documented exception: the intentionally broken /api/share/prepare
    // (HTTP 502) is logged by Chromium as a console error — this is the
    // graceful-degradation behavior under test here.
    await expectNoRuntimeErrors(page, errorCollector, [
      'Failed to load resource: the server responded with a status of 502',
    ])
  })

  test('start parameter attribution reaches the app without breaking it', async ({
    page,
    errorCollector,
  }) => {
    await page.goto('/?mock=1&startapp=share_italian')
    await expect(page.getByTestId('start-cta')).toBeVisible()
    await page.getByTestId('start-cta').click()
    await expect(page.getByTestId('quiz-screen')).toBeVisible()
    await expectNoRuntimeErrors(page, errorCollector)
  })
})

/** Continue answering from question `startIndex+1` (1-based progress). */
async function answerAllQuestionsFrom(page: import('@playwright/test').Page, nextIndex: number) {
  for (let i = nextIndex; i <= 8; i++) {
    await expect(page.getByTestId('progress')).toHaveText(`${pad(i)} / 08`)
    await page.getByTestId('answer-option').first().click()
  }
}
