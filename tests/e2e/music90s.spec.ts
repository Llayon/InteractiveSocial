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
  for (let i = 1; i <= 14; i++) {
    await expect(page.getByTestId('progress')).toHaveText(`${pad(i)} / 14`)
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
    if (i < 14) {
      await expect(page.getByTestId('progress')).toHaveText(`${pad(i + 1)} / 14`)
    }
  }
}

test.describe('Music90s journey (?quiz=music90s, mock mode)', () => {
  test('landing → 14 answers → reveal → score result → share → restart', async ({
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
    await expect(page.getByTestId('progress')).toHaveText('01 / 14')
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
    // Exact-score visible (e.g. N / 14 in this all-first-answers scenario).
    await expect(page.getByTestId('result-score')).toBeVisible()
    await expect(page.getByTestId('result-score')).toContainText('/ 14')
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
    await expect(page.getByTestId('progress')).toHaveText('01 / 14')

    // m1 correct is 'a' (Крошка моя) -> pick wrong 'b' to test wrong mark + lock
    const wrong = page.locator('[data-answer-id="b"]').first()
    await wrong.click()
    // The feedback barrier must show the answer mark immediately.
    await expect(page.getByTestId('answer-mark-wrong')).toBeVisible({ timeout: 1500 })
    // While the feedback is on screen the other options must be disabled.
    const other = page.getByTestId('answer-option').nth(1)
    await expect(other).toBeDisabled()
    // Try a second click — must NOT advance past 02/14 within the 900ms lock.
    await wrong.click({ force: true }).catch(() => undefined)
    await expect(page.getByTestId('progress')).toHaveText('01 / 14')
    // After the configured barrier, advance happens.
    await expect(page.getByTestId('progress')).toHaveText('02 / 14', { timeout: 3000 })
    await expectNoRuntimeErrors(page, errorCollector)
  })

  test('correct answer (m1 = "Крошка моя") shows the correct feedback mark', async ({
    page,
    errorCollector,
  }) => {
    await page.goto('/?mock=1&quiz=music90s')
    await page.getByTestId('start-cta').click()
    await expect(page.getByTestId('progress')).toHaveText('01 / 14')
    // 'a' is the correct answer to m1.
    const aOption = page.locator('[data-answer-id="a"]').first()
    await aOption.click()
    await expect(page.getByTestId('answer-mark-correct')).toBeVisible({ timeout: 1500 })
    await expectNoRuntimeErrors(page, errorCollector)
  })

  test('long Q14 fits without horizontal overflow', async ({ page, errorCollector }) => {
    await page.goto('/?mock=1&quiz=music90s')
    await page.getByTestId('start-cta').click()
    // fast-forward to Q14 by answering first 13
    for (let i = 1; i <= 13; i++) {
      await expect(page.getByTestId('progress')).toHaveText(`${pad(i)} / 14`)
      await page.getByTestId('answer-option').first().click()
      await expect(page.getByTestId('progress')).toHaveText(`${pad(i + 1)} / 14`, { timeout: 3000 })
    }
    await expect(page.getByTestId('progress')).toHaveText('14 / 14')
    const question = page.getByTestId('quiz-question')
    await expect(question).toBeVisible()
    // verify title text is rendered and not clipped via overflow
    await expect(question).toContainText('Тарантино')
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
    expect(overflow).toBe(false)
    await expectNoRuntimeErrors(page, errorCollector)
  })
})
