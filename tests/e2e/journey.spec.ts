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

    // Q1 renders real artwork — assert the media <img> actually load (guards
    // against 404s / lazy-load regressions, not just presence in the DOM).
    const mediaImgs = page.locator('[data-testid="answer-option"] .answer-card__media img')
    const imgCount = await mediaImgs.count()
    expect(imgCount).toBeGreaterThan(0)
    for (let i = 0; i < imgCount; i++) {
      await expect(mediaImgs.nth(i)).toBeVisible()
      await expect
        .poll(() => mediaImgs.nth(i).evaluate((e) => (e as HTMLImageElement).naturalWidth))
        .toBeGreaterThan(0)
    }

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

  // G08: evidence of the *real* share-card asset at its native 1080×1350 size.
  // Per the approved plan this is NOT a new product feature — it renders the
  // actual public/share-cards/result_<id>.png so the vision critic can compare
  // it 1:1 against references/share-card.png.
  test('share-card asset evidence in native 1080×1350 rendering', async ({
    page,
    errorCollector,
  }, testInfo) => {
    await page.goto('/?mock=1')
    await page.getByTestId('start-cta').click()
    await answerAllQuestions(page)
    await expect(page.getByTestId('result-screen')).toBeVisible({ timeout: 5_000 })

    const resultId = await page.getByTestId('result-card').getAttribute('data-result-id')
    expect(resultId).toBeTruthy()

    await page.setViewportSize({ width: 1080, height: 1350 })
    await page.goto(`/share-cards/result_${resultId}.jpg`)
    const img = page.locator('img')
    await expect(img).toBeVisible()
    const natural = await img.evaluate((el: HTMLImageElement) => ({
      width: el.naturalWidth,
      height: el.naturalHeight,
    }))
    expect(natural).toEqual({ width: 1080, height: 1350 })
    await page.screenshot({
      path: `gauntlet/reports/evidence/${testInfo.project.name}/04-share-card.png`,
    })

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
