import { expect, test } from './fixtures'
import { MUSIC90_CATEGORY_BY_ID } from '../../src/content/quizzes/music90s/select'

test.describe('Music90s question analytics (run_id, question_view, question_answered)', () => {
  test('quiz_start, question_view, question_answered sequence for first 2 questions', async ({ page, analyticsCollector, errorCollector }) => {
    await page.goto('/?mock=1&quiz=music90s')
    await expect(page.getByTestId('start-cta')).toBeVisible()
    await page.getByTestId('start-cta').click()
    await expect(page.getByTestId('quiz-screen')).toBeVisible()
    await expect(page.getByTestId('progress')).toHaveText('01 / 18')

    // wait for quiz_start and first question_view
    await expect.poll(() => analyticsCollector.events().filter((e) => e.event === 'quiz_start').length).toBe(1)
    await expect.poll(() => analyticsCollector.events().filter((e) => e.event === 'question_view' && e.properties.position === 1).length).toBe(1)

    const start = analyticsCollector.events().find((e) => e.event === 'quiz_start')!
    const runId = start.properties.run_id as string
    expect(typeof runId).toBe('string')
    expect(runId.length).toBeGreaterThan(5)
    expect(start.properties.quiz_id).toBe('music90s')
    expect(start.properties.question_count).toBe(18)

    const view1 = analyticsCollector.events().find((e) => e.event === 'question_view' && e.properties.position === 1)!
    expect(view1.properties.run_id).toBe(runId)
    expect(view1.properties.quiz_id).toBe('music90s')
    expect(view1.properties.question_count).toBe(18)
    expect(typeof view1.properties.question_id).toBe('string')
    const qid1 = await page.getByTestId('quiz-question').getAttribute('data-question-id')
    expect(view1.properties.question_id).toBe(qid1)
    expect(view1.properties.position).toBe(1)
    const cat1 = MUSIC90_CATEGORY_BY_ID[qid1 as keyof typeof MUSIC90_CATEGORY_BY_ID]
    expect(view1.properties.category).toBe(cat1)
    expect(view1.properties.question_text).toBeUndefined()

    // answer first question (click first option)
    await page.getByTestId('answer-option').first().click()
    await expect(page.getByTestId('progress')).toHaveText('02 / 18', { timeout: 3000 })

    await expect.poll(() => analyticsCollector.events().filter((e) => e.event === 'question_answered' && e.properties.position === 1).length).toBe(1)
    const ans1 = analyticsCollector.events().find((e) => e.event === 'question_answered' && e.properties.position === 1)!
    expect(ans1.properties.run_id).toBe(runId)
    expect(ans1.properties.question_id).toBe(qid1)
    expect(ans1.properties.position).toBe(1)
    expect(ans1.properties.question_count).toBe(18)
    expect(ans1.properties.category).toBe(cat1)
    expect(typeof ans1.properties.is_correct).toBe('boolean')
    expect(typeof ans1.properties.elapsed_ms).toBe('number')
    expect((ans1.properties.elapsed_ms as number) >= 0).toBe(true)
    expect((ans1.properties.elapsed_ms as number) <= 600_000).toBe(true)
    expect(ans1.properties.question_text).toBeUndefined()
    expect(ans1.properties.answer_text).toBeUndefined()

    // second question view should have happened automatically after answer
    await expect.poll(() => analyticsCollector.events().filter((e) => e.event === 'question_view' && e.properties.position === 2).length).toBe(1)
    const view2 = analyticsCollector.events().find((e) => e.event === 'question_view' && e.properties.position === 2)!
    expect(view2.properties.run_id).toBe(runId)
    const qid2 = await page.getByTestId('quiz-question').getAttribute('data-question-id')
    expect(view2.properties.question_id).toBe(qid2)
    expect(view2.properties.position).toBe(2)
    expect(view2.properties.category).toBe(MUSIC90_CATEGORY_BY_ID[qid2 as keyof typeof MUSIC90_CATEGORY_BY_ID])

    // answer second
    await page.getByTestId('answer-option').first().click()
    await expect(page.getByTestId('progress')).toHaveText('03 / 18', { timeout: 3000 })
    await expect.poll(() => analyticsCollector.events().filter((e) => e.event === 'question_answered' && e.properties.position === 2).length).toBe(1)
    const ans2 = analyticsCollector.events().find((e) => e.event === 'question_answered' && e.properties.position === 2)!
    expect(ans2.properties.run_id).toBe(runId)
    expect(ans2.properties.position).toBe(2)
    expect(ans2.properties.question_id).toBe(qid2)

    // ordering check: quiz_start before view1 before answered1 before view2 before answered2
    const events = analyticsCollector.events()
    const idx = (ev: string, pos?: number) => events.findIndex((e) => e.event === ev && (pos === undefined || e.properties.position === pos))
    expect(idx('quiz_start')).toBeLessThan(idx('question_view', 1))
    expect(idx('question_view', 1)).toBeLessThan(idx('question_answered', 1))
    expect(idx('question_answered', 1)).toBeLessThan(idx('question_view', 2))
    expect(idx('question_view', 2)).toBeLessThan(idx('question_answered', 2))

    await expectNoRuntimeErrors(page, errorCollector)
  })

  test('question_view deduplicated on rerender/back', async ({ page, analyticsCollector, errorCollector }) => {
    await page.goto('/?mock=1&quiz=music90s')
    await page.getByTestId('start-cta').click()
    await expect(page.getByTestId('progress')).toHaveText('01 / 18')
    await expect.poll(() => analyticsCollector.events().filter((e) => e.event === 'question_view' && e.properties.position === 1).length).toBe(1)
    const before = analyticsCollector.events().filter((e) => e.event === 'question_view').length
    // answer to go to 2, then back to 1
    await page.getByTestId('answer-option').first().click()
    await expect(page.getByTestId('progress')).toHaveText('02 / 18', { timeout: 3000 })
    await page.getByTestId('back-button').click()
    await expect(page.getByTestId('progress')).toHaveText('01 / 18')
    await page.waitForTimeout(300)
    const after = analyticsCollector.events().filter((e) => e.event === 'question_view' && e.properties.position === 1).length
    expect(after).toBe(1)
    // only one new view for pos2
    const total = analyticsCollector.events().filter((e) => e.event === 'question_view').length
    expect(total).toBe(before + 1)
    await expectNoRuntimeErrors(page, errorCollector)
  })

  test('restart creates new run_id', async ({ page, analyticsCollector, errorCollector }) => {
    await page.goto('/?mock=1&quiz=music90s')
    await page.getByTestId('start-cta').click()
    await expect(page.getByTestId('progress')).toHaveText('01 / 18')
    await expect.poll(() => analyticsCollector.events().filter((e) => e.event === 'quiz_start').length).toBe(1)
    const run1 = analyticsCollector.events().find((e) => e.event === 'quiz_start')!.properties.run_id as string
    // complete 18 quickly
    for (let i = 1; i <= 18; i++) {
      await page.getByTestId('answer-option').first().click()
      if (i < 18) await expect(page.getByTestId('progress')).toHaveText(`${String(i + 1).padStart(2, '0')} / 18`, { timeout: 3000 })
    }
    await expect(page.getByTestId('result-screen')).toBeVisible({ timeout: 5000 })
    await page.getByTestId('restart-button').click()
    await expect(page.getByTestId('start-cta')).toBeVisible()
    await page.getByTestId('start-cta').click()
    await expect(page.getByTestId('progress')).toHaveText('01 / 18')
    await expect.poll(() => analyticsCollector.events().filter((e) => e.event === 'quiz_start').length).toBe(2)
    const run2 = analyticsCollector.events().filter((e) => e.event === 'quiz_start').pop()!.properties.run_id as string
    expect(run2).not.toBe(run1)
    await expect.poll(() => analyticsCollector.events().filter((e) => e.event === 'question_view' && e.properties.run_id === run2 && e.properties.position === 1).length).toBe(1)
    await expectNoRuntimeErrors(page, errorCollector)
  })
})

async function expectNoRuntimeErrors(page: import('@playwright/test').Page, collector: import('./fixtures').ErrorCollector) {
  const { expectNoRuntimeErrors: check } = await import('./fixtures')
  await check(page, collector)
}
