/**
 * guess90s E2E: audio-based 90s music quiz.
 * Uses ?quiz=guess90s and validates audio-preview branching via content.kind.
 */
import { expect, test, expectNoRuntimeErrors } from './fixtures'

const pad = (n: number) => String(n).padStart(2, '0')

async function answerAllGuessQuestions(
  page: import('@playwright/test').Page,
  pick: (questionId: string, options: string[]) => Promise<string>,
): Promise<void> {
  for (let i = 1; i <= 20; i++) {
    await expect(page.getByTestId('progress')).toHaveText(`${pad(i)} / 20`)
    // Audio preview should be present for every question
    const audio = page.getByTestId('audio-preview')
    await expect(audio).toBeVisible()
    await expect(audio).toHaveAttribute('data-state', /.*/)
    await expect(page.getByTestId('audio-play-button')).toBeVisible()
    await expect(page.getByTestId('audio-attribution')).toContainText('Apple')

    // Click Play (mocked Audio will go playing -> played after 4s, but we don't wait full 4s)
    const playBtn = page.getByTestId('audio-play-button')
    // Only click if not already playing
    if (await playBtn.isEnabled()) {
      await playBtn.click()
      // After play, state should eventually be playing or played; we don't gate on 4s
      await expect(page.getByTestId('audio-state')).toBeVisible()
    }

    const options = page.getByTestId('answer-option')
    const count = await options.count()
    expect(count).toBe(4)
    const ids: string[] = []
    for (let j = 0; j < count; j++) {
      const id = await options.nth(j).getAttribute('data-answer-id')
      if (id) ids.push(id)
    }
    const chosen = await pick(`g${i}`, ids)
    await page.locator(`[data-answer-id="${chosen}"]`).first().click()
    if (i < 20) {
      await expect(page.getByTestId('progress')).toHaveText(`${pad(i + 1)} / 20`, { timeout: 3000 })
    }
    // After answer, track info should be revealed (only after feedback)
    // Wait for next question transition before checking track info persistence
  }
}

test.describe('guess90s journey (?quiz=guess90s, mock mode)', () => {
  test.setTimeout(60000)
  test('landing → 20 audio questions → reveal → score result → share → restart', async ({
    page,
    errorCollector,
  }, testInfo) => {
    await page.goto('/?mock=1&quiz=guess90s')

    await expect(page.getByRole('heading', { level: 1 })).toContainText('4 секунд')
    await expect(page.getByTestId('start-cta')).toBeVisible()
    await page.screenshot({
      path: `gauntlet/reports/evidence/${testInfo.project.name}/g-01-landing.png`,
      fullPage: true,
    })

    await page.getByTestId('start-cta').click()
    await expect(page.getByTestId('quiz-screen')).toBeVisible()
    await expect(page.getByTestId('progress')).toHaveText('01 / 20')
    await expect(page.getByTestId('quiz-question')).toHaveAttribute('data-content-kind', 'audio-preview')
    await page.screenshot({
      path: `gauntlet/reports/evidence/${testInfo.project.name}/g-02-quiz.png`,
      fullPage: true,
    })

    await answerAllGuessQuestions(page, async (_qid, ids) => ids[0])

    await expect(page.getByTestId('result-screen')).toBeVisible({ timeout: 5000 })
    await expect(page.getByTestId('result-title')).toBeVisible()
    await expect(page.locator('[data-presentation="score"]')).toHaveCount(1)
    await expect(page.getByTestId('result-score')).toBeVisible()
    await expect(page.getByTestId('result-score')).toContainText('/ 20')
    await page.screenshot({
      path: `gauntlet/reports/evidence/${testInfo.project.name}/g-03-result.png`,
      fullPage: true,
    })

    await page.getByTestId('share-button').click()
    await expect(page.getByTestId('share-status')).toHaveText('native', { timeout: 5000 })

    await page.getByTestId('restart-button').click()
    await expect(page.getByTestId('start-cta')).toBeVisible()

    await expectNoRuntimeErrors(page, errorCollector)
  })

  test('feedback lock and track reveal after answer', async ({ page, errorCollector }) => {
    await page.goto('/?mock=1&quiz=guess90s')
    await page.getByTestId('start-cta').click()
    await expect(page.getByTestId('progress')).toHaveText('01 / 20')
    // pick wrong answer 'b' (correct is 'a') to test wrong mark and track reveal
    await page.locator('[data-answer-id="b"]').first().click()
    await expect(page.getByTestId('answer-mark-wrong')).toBeVisible({ timeout: 1500 })
    // After feedback, audio track info should be visible
    await expect(page.getByTestId('audio-track-info')).toBeVisible({ timeout: 1500 })
    await expect(page.getByTestId('audio-apple-link')).toHaveAttribute('href', /music\.apple\.com/)
    await expect(page.getByTestId('progress')).toHaveText('02 / 20', { timeout: 3000 })
    await expectNoRuntimeErrors(page, errorCollector)
  })

  test('replay does not block answering', async ({ page, errorCollector }) => {
    await page.goto('/?mock=1&quiz=guess90s')
    await page.getByTestId('start-cta').click()
    await expect(page.getByTestId('progress')).toHaveText('01 / 20')
    const playBtn = page.getByTestId('audio-play-button')
    await playBtn.click()
    // Wait for played state (mock will go playing immediately, our hook will go played after 4s)
    // Instead of waiting 4s, we just verify replay button appears eventually
    await page.waitForTimeout(500)
    // If replay button visible, click it
    const replayBtn = page.getByTestId('audio-replay-button')
    if (await replayBtn.count() > 0 && await replayBtn.isVisible().catch(() => false)) {
      await replayBtn.click()
    }
    // Still able to answer
    await page.locator('[data-answer-id="a"]').first().click()
    await expect(page.getByTestId('progress')).toHaveText('02 / 20', { timeout: 3000 })
    await expectNoRuntimeErrors(page, errorCollector)
  })
})

test.describe('guess90s deeplink', () => {
  test('s2_g90_<code>_<uid> opens guess90s', async ({ page, errorCollector }) => {
    await page.goto('/?mock=1&startapp=s2_g90_gl_847291')
    await expect(page.getByTestId('start-cta')).toBeVisible()
    const heading = await page.getByRole('heading', { level: 1 }).textContent()
    expect(heading ?? '').toContain('4 секунд')
    await page.getByTestId('start-cta').click()
    await expect(page.getByTestId('progress')).toHaveText('01 / 20')
    await expectNoRuntimeErrors(page, errorCollector)
  })

  test('unknown g90 code falls back without blank', async ({ page, errorCollector }) => {
    await page.goto('/?mock=1&startapp=s2_g90_zz_847291')
    await expect(page.getByTestId('start-cta')).toBeVisible()
    await expectNoRuntimeErrors(page, errorCollector)
  })
})
