/**
 * Music90s E2E: full user journey on the second production quiz (18 questions sampled from 42 bank).
 * Launched via the canonical `?quiz=music90s` deep link so the canonical
 * resolver is exercised, never a hardcoded one in shared code.
 * Sampling is stratified random per attempt (stable within attempt, new on replay).
 */
import { expect, test, expectNoRuntimeErrors } from './fixtures'

const pad = (n: number) => String(n).padStart(2, '0')

// Correct answers for full bank 42 (m1..m42)
const CORRECT: Record<string, string> = {
  m1: 'a', m2: 'b', m3: 'b', m4: 'a', m5: 'd', m6: 'c', m7: 'b', m8: 'b', m9: 'c',
  m10: 'b', m11: 'b', m12: 'b', m13: 'a', m14: 'b', m15: 'a', m16: 'b', m17: 'b', m18: 'b',
  m19: 'b', m20: 'b', m21: 'c', m22: 'b', m23: 'a', m24: 'c', m25: 'b', m26: 'a', m27: 'a', m28: 'b', m29: 'b', m30: 'b',
  m31: 'a', m32: 'a', m33: 'a', m34: 'a', m35: 'b', m36: 'a', m37: 'a', m38: 'a', m39: 'a', m40: 'a', m41: 'a', m42: 'a',
}

async function answerAllMusicQuestions(
  page: import('@playwright/test').Page,
  pick: (questionId: string, options: string[]) => Promise<string>,
): Promise<void> {
  for (let i = 1; i <= 18; i++) {
    await expect(page.getByTestId('progress')).toHaveText(`${pad(i)} / 18`)
    // read actual question id for sampling-aware correctness
    const qid = await page.getByTestId('quiz-question').getAttribute('data-question-id')
    const options = page.getByTestId('answer-option')
    const count = await options.count()
    const ids: string[] = []
    for (let j = 0; j < count; j++) {
      const id = await options.nth(j).getAttribute('data-answer-id')
      if (id) ids.push(id)
    }
    const chosen = await pick(qid ?? `m${i}`, ids)
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
    // Landing must say 18 questions per spec (bank 42, attempt 18)
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

    const qid = await page.getByTestId('quiz-question').getAttribute('data-question-id')
    const correct = qid ? CORRECT[qid] : 'a'
    const wrongId = ['a','b','c','d'].find(id => id !== correct) ?? 'b'
    const wrong = page.locator(`[data-answer-id="${wrongId}"]`).first()
    await wrong.click()
    await expect(page.getByTestId('answer-mark-wrong')).toBeVisible({ timeout: 1500 })
    const other = page.getByTestId('answer-option').nth(1)
    await expect(other).toBeDisabled()
    await wrong.click({ force: true }).catch(() => undefined)
    await expect(page.getByTestId('progress')).toHaveText('01 / 18')
    await expect(page.getByTestId('progress')).toHaveText('02 / 18', { timeout: 3000 })
    await expectNoRuntimeErrors(page, errorCollector)
  })

  test('correct answer shows the correct feedback mark (sampling-aware)', async ({
    page,
    errorCollector,
  }) => {
    await page.goto('/?mock=1&quiz=music90s')
    await page.getByTestId('start-cta').click()
    await expect(page.getByTestId('progress')).toHaveText('01 / 18')
    const qid = await page.getByTestId('quiz-question').getAttribute('data-question-id')
    const correct = qid ? CORRECT[qid] : 'a'
    const aOption = page.locator(`[data-answer-id="${correct}"]`).first()
    await aOption.click()
    await expect(page.getByTestId('answer-mark-correct')).toBeVisible({ timeout: 1500 })
    await expectNoRuntimeErrors(page, errorCollector)
  })

  test('all 18 sampled questions fit without horizontal overflow', async ({ page, errorCollector }) => {
    await page.goto('/?mock=1&quiz=music90s')
    await page.getByTestId('start-cta').click()
    for (let i = 1; i <= 18; i++) {
      await expect(page.getByTestId('progress')).toHaveText(`${pad(i)} / 18`)
      const question = page.getByTestId('quiz-question')
      await expect(question).toBeVisible()
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
      expect(overflow).toBe(false)
      await page.getByTestId('answer-option').first().click()
      if (i < 18) await expect(page.getByTestId('progress')).toHaveText(`${pad(i + 1)} / 18`, { timeout: 3000 })
    }
    await expectNoRuntimeErrors(page, errorCollector)
  })

  test('sampled run shows 18 distinct progress steps and stable within run', async ({ page, errorCollector }) => {
    await page.goto('/?mock=1&quiz=music90s')
    await page.getByTestId('start-cta').click()
    const ids: string[] = []
    for (let i = 1; i <= 18; i++) {
      await expect(page.getByTestId('progress')).toHaveText(`${pad(i)} / 18`)
      const qid = await page.getByTestId('quiz-question').getAttribute('data-question-id')
      if (qid) ids.push(qid)
      // go back check stability
      if (i === 5) {
        const before = qid
        await page.getByTestId('back-button').click()
        await expect(page.getByTestId('progress')).toHaveText('04 / 18')
        await page.getByTestId('next-button').click()
        await expect(page.getByTestId('progress')).toHaveText('05 / 18')
        const after = await page.getByTestId('quiz-question').getAttribute('data-question-id')
        expect(after).toBe(before)
        // need to re-answer this question to proceed (back preserves answer, but we are on same question)
        // Actually after back/next, current question retains answer, next requires manual? For feedback mode, answer already given, so we can just go next? Simplify: answer again
        // But our current flow already answered 5, so after back to 4 we need to answer 4 again? Let's just continue by answering current (5) again is not needed; we already answered 5 before back, so we are at 5 again, need to proceed to 6
        // The progress should still be 05, so we need to click next is disabled? In feedback mode, after answer we auto-advanced, so back preserves answer, next should be enabled. We tested stability.
      }
      await page.getByTestId('answer-option').first().click()
      if (i < 18) await expect(page.getByTestId('progress')).toHaveText(`${pad(i + 1)} / 18`, { timeout: 3000 })
    }
    // 18 unique ids sampled from 42
    expect(new Set(ids).size).toBe(18)
    await expectNoRuntimeErrors(page, errorCollector)
  })

  test('18/18 perfect score → Главред журнала Cool ✨ (18 из 18)', async ({ page, errorCollector }) => {
    await page.goto('/?mock=1&quiz=music90s')
    await page.getByTestId('start-cta').click()
    await answerAllMusicQuestions(page, async (qid, ids) => {
      const correct = CORRECT[qid]
      return correct && ids.includes(correct) ? correct : ids[0]
    })
    await expect(page.getByTestId('result-screen')).toBeVisible({ timeout: 5_000 })
    await expect(page.getByTestId('result-score')).toContainText('18 / 18')
    await expect(page.getByTestId('result-title')).toContainText('Главред журнала Cool')
    // share must use 18/18 card
    await page.getByTestId('share-button').click()
    await expect(page.getByTestId('share-status')).toHaveText('native', { timeout: 5000 })
    await expectNoRuntimeErrors(page, errorCollector)
  })

  test('17/18 near-perfect → Главред журнала Cool (17 из 18)', async ({ page, errorCollector }) => {
    await page.goto('/?mock=1&quiz=music90s')
    await page.getByTestId('start-cta').click()
    let firstQid: string | null = null
    await answerAllMusicQuestions(page, async (qid, ids) => {
      if (!firstQid) firstQid = qid
      if (qid === firstQid) {
        // intentionally answer wrong for first question to get 17/18
        const correct = CORRECT[qid]
        return ids.find((id) => id !== correct) ?? ids[0]
      }
      const correct = CORRECT[qid]
      return correct && ids.includes(correct) ? correct : ids[0]
    })
    await expect(page.getByTestId('result-screen')).toBeVisible({ timeout: 5_000 })
    await expect(page.getByTestId('result-score')).toContainText('17 / 18')
    await expect(page.getByTestId('result-title')).toContainText('Главред журнала Cool')
    await page.getByTestId('share-button').click()
    await expect(page.getByTestId('share-status')).toHaveText('native', { timeout: 5000 })
    await expectNoRuntimeErrors(page, errorCollector)
  })
})
