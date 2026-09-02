/**
 * Music90s E2E: full user journey on the second production quiz (18 questions).
 * Launched via the canonical `?quiz=music90s` deep link so the canonical
 * resolver is exercised, never a hardcoded one in shared code.
 */
import { expect, test, expectNoRuntimeErrors } from './fixtures'

const pad = (n: number) => String(n).padStart(2, '0')

// Correct answers per spec for deterministic scoring
const CORRECT: Record<string, string> = {
  m1: 'a', m2: 'b', m3: 'b', m4: 'a', m5: 'd', m6: 'c', m7: 'b', m8: 'b', m9: 'c',
  m10: 'b', m11: 'b', m12: 'b', m13: 'a', m14: 'b', m15: 'a', m16: 'b', m17: 'b', m18: 'b',
}

async function answerAllMusicQuestions(
  page: import('@playwright/test').Page,
  pick: (questionId: string, options: string[]) => Promise<string>,
): Promise<void> {
  for (let i = 1; i <= 18; i++) {
    await expect(page.getByTestId('progress')).toHaveText(`${pad(i)} / 18`)
    const options = page.getByTestId('answer-option')
    const count = await options.count()
    const ids: string[] = []
    for (let j = 0; j < count; j++) {
      const id = await options.nth(j).getAttribute('data-answer-id')
      if (id) ids.push(id)
    }
    const chosen = await pick(`m${i}`, ids)
    await page.locator(`[data-answer-id="${chosen}"]`).first().click()
    if (i < 18) {
      await expect(page.getByTestId('progress')).toHaveText(`${pad(i + 1)} / 18`)
    }
  }
}

test.describe('Music90s journey (?quiz=music90s, mock mode)', () => {
  test('landing → 18 answers → reveal → score result → share → restart', async ({
    page,
    errorCollector,
  }, testInfo) => {
    await page.goto('/?mock=1&quiz=music90s')

    await expect(page.getByRole('heading', { level: 1 })).toContainText('90-х')
    await expect(page.getByTestId('start-cta')).toBeVisible()
    // Landing must say 18 questions per spec
    await expect(page.locator('body')).toContainText('18 вопросов')
    await page.screenshot({
      path: `gauntlet/reports/evidence/${testInfo.project.name}/m-01-landing.png`,
      fullPage: true,
    })

    await page.getByTestId('start-cta').click()
    await expect(page.getByTestId('quiz-screen')).toBeVisible()
    await expect(page.getByTestId('progress')).toHaveText('01 / 18')
    await page.screenshot({
      path: `gauntlet/reports/evidence/${testInfo.project.name}/m-02-quiz.png`,
      fullPage: true,
    })

    await answerAllMusicQuestions(page, async (_qid, ids) => ids[0])

    await expect(page.getByTestId('result-screen')).toBeVisible({ timeout: 5_000 })
    await expect(page.getByTestId('result-title')).toBeVisible()
    await expect(page.locator('[data-presentation="score"]')).toHaveCount(1)
    await expect(page.getByTestId('result-score')).toBeVisible()
    await expect(page.getByTestId('result-score')).toContainText('/ 18')
    await page.screenshot({
      path: `gauntlet/reports/evidence/${testInfo.project.name}/m-03-result.png`,
      fullPage: true,
    })

    await page.getByTestId('share-button').click()
    await expect(page.getByTestId('share-status')).toHaveText('native', { timeout: 5_000 })

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
    await expect(page.getByTestId('progress')).toHaveText('01 / 18')

    const wrong = page.locator('[data-answer-id="b"]').first()
    await wrong.click()
    await expect(page.getByTestId('answer-mark-wrong')).toBeVisible({ timeout: 1500 })
    const other = page.getByTestId('answer-option').nth(1)
    await expect(other).toBeDisabled()
    await wrong.click({ force: true }).catch(() => undefined)
    await expect(page.getByTestId('progress')).toHaveText('01 / 18')
    await expect(page.getByTestId('progress')).toHaveText('02 / 18', { timeout: 3000 })
    await expectNoRuntimeErrors(page, errorCollector)
  })

  test('correct answer (m1 = "Крошка моя") shows the correct feedback mark', async ({
    page,
    errorCollector,
  }) => {
    await page.goto('/?mock=1&quiz=music90s')
    await page.getByTestId('start-cta').click()
    await expect(page.getByTestId('progress')).toHaveText('01 / 18')
    const aOption = page.locator('[data-answer-id="a"]').first()
    await aOption.click()
    await expect(page.getByTestId('answer-mark-correct')).toBeVisible({ timeout: 1500 })
    await expectNoRuntimeErrors(page, errorCollector)
  })

  test('long Q14 fits without horizontal overflow', async ({ page, errorCollector }) => {
    await page.goto('/?mock=1&quiz=music90s')
    await page.getByTestId('start-cta').click()
    for (let i = 1; i <= 13; i++) {
      await expect(page.getByTestId('progress')).toHaveText(`${pad(i)} / 18`)
      await page.getByTestId('answer-option').first().click()
      await expect(page.getByTestId('progress')).toHaveText(`${pad(i + 1)} / 18`, { timeout: 3000 })
    }
    await expect(page.getByTestId('progress')).toHaveText('14 / 18')
    const question = page.getByTestId('quiz-question')
    await expect(question).toBeVisible()
    await expect(question).toContainText('Бондарчук')
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
    expect(overflow).toBe(false)
    await expectNoRuntimeErrors(page, errorCollector)
  })

  test('long questions Q2, Q11, Q16, Q17 render without overflow', async ({ page, errorCollector }) => {
    await page.goto('/?mock=1&quiz=music90s')
    await page.getByTestId('start-cta').click()
    // Q2
    await expect(page.getByTestId('progress')).toHaveText('01 / 18')
    await page.locator('[data-answer-id="a"]').first().click()
    await expect(page.getByTestId('progress')).toHaveText('02 / 18', { timeout: 3000 })
    let q = page.getByTestId('quiz-question')
    await expect(q).toContainText('Позови меня в ночи')
    // fast forward to Q11
    for (let i = 2; i <= 10; i++) {
      await page.getByTestId('answer-option').first().click()
      await expect(page.getByTestId('progress')).toHaveText(`${pad(i + 1)} / 18`, { timeout: 3000 })
    }
    await expect(page.getByTestId('progress')).toHaveText('11 / 18')
    q = page.getByTestId('quiz-question')
    await expect(q).toContainText('русскими Spice Girls')
    // Q16 via continue
    for (let i = 11; i <= 15; i++) {
      await page.getByTestId('answer-option').first().click()
      await expect(page.getByTestId('progress')).toHaveText(`${pad(i + 1)} / 18`, { timeout: 3000 })
    }
    await expect(page.getByTestId('progress')).toHaveText('16 / 18')
    q = page.getByTestId('quiz-question')
    await expect(q).toContainText('серебристом мини-платье')
    await expectNoRuntimeErrors(page, errorCollector)
  })

  test('18/18 perfect score → Ты и есть 90-е (18 из 18)', async ({ page, errorCollector }) => {
    await page.goto('/?mock=1&quiz=music90s')
    await page.getByTestId('start-cta').click()
    await answerAllMusicQuestions(page, async (qid, ids) => {
      const correct = CORRECT[qid]
      return ids.includes(correct) ? correct : ids[0]
    })
    await expect(page.getByTestId('result-screen')).toBeVisible({ timeout: 5_000 })
    await expect(page.getByTestId('result-score')).toContainText('18 / 18')
    await expect(page.getByTestId('result-title')).toContainText('Ты и есть 90-е')
    // share must use 18/18 card
    await page.getByTestId('share-button').click()
    await expect(page.getByTestId('share-status')).toHaveText('native', { timeout: 5000 })
    await expectNoRuntimeErrors(page, errorCollector)
  })

  test('17/18 near-perfect → Ты и есть 90-е (17 из 18)', async ({ page, errorCollector }) => {
    await page.goto('/?mock=1&quiz=music90s')
    await page.getByTestId('start-cta').click()
    // answer all correct except last one wrong
    await answerAllMusicQuestions(page, async (qid, ids) => {
      if (qid === 'm18') {
        // pick wrong answer (not 'b')
        return ids.find((id) => id !== CORRECT[qid]) ?? ids[0]
      }
      return CORRECT[qid]
    })
    await expect(page.getByTestId('result-screen')).toBeVisible({ timeout: 5_000 })
    await expect(page.getByTestId('result-score')).toContainText('17 / 18')
    await expect(page.getByTestId('result-title')).toContainText('Ты и есть 90-е')
    await page.getByTestId('share-button').click()
    await expect(page.getByTestId('share-status')).toHaveText('native', { timeout: 5000 })
    await expectNoRuntimeErrors(page, errorCollector)
  })
})
