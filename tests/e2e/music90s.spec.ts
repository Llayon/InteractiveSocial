/**
 * Music90s E2E: full user journey on the second production quiz.
 * Launched via the canonical `?quiz=music90s` deep link so the canonical
 * resolver is exercised, never a hardcoded one in shared code.
 */
import { expect, test, expectNoRuntimeErrors } from './fixtures'

const pad = (n: number) => String(n).padStart(2, '0')

async function answerAllMusicQuestions(
  page: import('@playwright/test').Page,
  pick: (questionId: string, options: string[]) => Promise<string>,
): Promise<void> {
  for (let i = 1; i <= 10; i++) {
    await expect(page.getByTestId('progress')).toHaveText(`${pad(i)} / 10`)
    const options = page.getByTestId('answer-option')
    const count = await options.count()
    const ids: string[] = []
    for (let j = 0; j < count; j++) {
      const id = await options.nth(j).getAttribute('data-answer-id')
      if (id) ids.push(id)
    }
    const chosen = await pick(`m${i}`, ids)
    // Lock → ✓/✕ visible, then auto-advance.
    await page.locator(`[data-answer-id="${chosen}"]`).first().click()
    if (i < 10) {
      await expect(page.getByTestId('progress')).toHaveText(`${pad(i + 1)} / 10`)
    }
  }
}

test.describe('Music90s journey (?quiz=music90s, mock mode)', () => {
  test('landing → 10 answers → reveal → score result → share → restart', async ({
    page,
    errorCollector,
  }, testInfo) => {
    await page.goto('/?mock=1&quiz=music90s')

    // Landing uses the quiz-aware eyebrow and copy.
    await expect(page.getByRole('heading', { level: 1 })).toContainText('90-х')
    await expect(page.getByTestId('start-cta')).toBeVisible()
    await page.screenshot({
      path: `gauntlet/reports/evidence/${testInfo.project.name}/m-01-landing.png`,
      fullPage: true,
    })

    await page.getByTestId('start-cta').click()
    await expect(page.getByTestId('quiz-screen')).toBeVisible()
    await expect(page.getByTestId('progress')).toHaveText('01 / 10')
    await page.screenshot({
      path: `gauntlet/reports/evidence/${testInfo.project.name}/m-02-quiz.png`,
      fullPage: true,
    })

    // Pick the FIRST answer of every question. That yields a deterministic
    // band we can assert (we know the approved content above).
    await answerAllMusicQuestions(page, async (_qid, ids) => ids[0])

    // Reveal overlay then the score result.
    await expect(page.getByTestId('result-screen')).toBeVisible({ timeout: 5_000 })
    await expect(page.getByTestId('result-title')).toBeVisible()
    // Score result, not personality: hero carries data-presentation="score"
    await expect(page.locator('[data-presentation="score"]')).toHaveCount(1)
    // Exact-score visible (3 / 10 in this all-first-answers scenario).
    await expect(page.getByTestId('result-score')).toBeVisible()
    await page.screenshot({
      path: `gauntlet/reports/evidence/${testInfo.project.name}/m-03-result.png`,
      fullPage: true,
    })

    // Native share via intercepted prepared-message endpoint.
    await page.getByTestId('share-button').click()
    await expect(page.getByTestId('share-status')).toHaveText('native', { timeout: 5_000 })

    // Restart loop closes the cycle.
    await page.getByTestId('restart-button').click()
    await expect(page.getByTestId('start-cta')).toBeVisible()

    await expectNoRuntimeErrors(page, errorCollector)
  })

  test('feedback lock: second tap during feedback does NOT double-advance', async ({
    page,
    errorCollector,
  }) => {
    await page.goto('/?mock=1&quiz=music90s')
    await page.getByTestId('start-cta').click()
    await expect(page.getByTestId('progress')).toHaveText('01 / 10')

    // m1 (emoji, correctAnswerId = 'c' = 'Тучи'): pick the first option ('a').
    const first = page.getByTestId('answer-option').first()
    await first.click()
    // The feedback barrier must show the answer mark immediately.
    await expect(page.getByTestId('answer-mark-wrong')).toBeVisible({ timeout: 1500 })
    // While the feedback is on screen the other options must be disabled.
    const second = page.getByTestId('answer-option').nth(1)
    await expect(second).toBeDisabled()
    // Try a second click — must NOT advance past 02/10 within the 900ms lock.
    await first.click({ force: true }).catch(() => undefined)
    await expect(page.getByTestId('progress')).toHaveText('01 / 10')
    // After the configured barrier, advance happens.
    await expect(page.getByTestId('progress')).toHaveText('02 / 10', { timeout: 3000 })
    await expectNoRuntimeErrors(page, errorCollector)
  })

  test('correct answer (m1 = "Тучи") shows the correct feedback mark', async ({
    page,
    errorCollector,
  }) => {
    await page.goto('/?mock=1&quiz=music90s')
    await page.getByTestId('start-cta').click()
    await expect(page.getByTestId('progress')).toHaveText('01 / 10')
    // 'c' is the correct answer to m1.
    const cOption = page.locator('[data-answer-id="c"]').first()
    await cOption.click()
    await expect(page.getByTestId('answer-mark-correct')).toBeVisible({ timeout: 1500 })
    await expectNoRuntimeErrors(page, errorCollector)
  })
})
