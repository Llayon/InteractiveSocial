import { expect, test } from './fixtures'

test.describe('beautiful-shots challenge e2e', () => {

  test('Landing → Start → Day 1 → Complete → Completion → reload Day 1 remains completed', async ({ page }) => {
    await page.goto('/beautiful-shots?mock=1')
    // Landing
    await expect(page.getByTestId('challenge-landing')).toBeVisible()
    await expect(page.getByTestId('challenge-start-cta')).toBeVisible()
    await expect(page.getByRole('heading', { level: 1 })).toContainText('КРАСИВЫХ')

    // Start
    await page.getByTestId('challenge-start-cta').click()
    await expect(page.getByTestId('challenge-home')).toBeVisible()
    await expect(page.getByTestId('challenge-progress-count')).toHaveText('00 / 30')
    // Next card Day 1
    await expect(page.getByTestId('challenge-next-card')).toContainText('ДЕНЬ 01')
    await expect(page.getByTestId('challenge-continue-cta')).toBeVisible()

    // Open Day 1
    await page.getByTestId('challenge-continue-cta').click()
    await expect(page.getByTestId('challenge-day-detail')).toBeVisible()
    await expect(page.getByTestId('challenge-day-title')).toContainText('Предмет в руке у окна')
    await expect(page.getByTestId('challenge-day-hero')).toBeVisible()
    await expect(page.getByTestId('challenge-complete-cta')).toBeVisible()

    // Hint sheet
    await page.getByTestId('challenge-hint-cta').click()
    await expect(page.getByTestId('challenge-hint-sheet')).toBeVisible()
    await expect(page.getByTestId('challenge-hint-close')).toBeVisible()
    await page.getByTestId('challenge-hint-close').click()
    await expect(page.getByTestId('challenge-hint-sheet')).toBeHidden()

    // Complete normal
    await page.getByTestId('challenge-complete-cta').click()

    // Feedback after completion
    await expect(page.getByTestId('challenge-feedback')).toBeVisible()
    await page.getByTestId('feedback-easy').click()
    await page.getByTestId('feedback-submit').click()
    await expect(page.getByTestId('challenge-feedback-done')).toBeVisible()
    // Continue from feedback to completion
    await page.getByTestId('challenge-feedback-close').click()

    // Completion screen
    await expect(page.getByTestId('challenge-completion')).toBeVisible()
    await expect(page.getByTestId('challenge-completion-number')).toHaveText('01')
    await expect(page.getByTestId('challenge-completion-progress')).toHaveText('01 / 30')
    await expect(page.getByTestId('challenge-completion-cta')).toBeVisible()

    // Go to home via CTA
    await page.getByTestId('challenge-completion-cta').click()
    await expect(page.getByTestId('challenge-home')).toBeVisible()
    await expect(page.getByTestId('challenge-progress-count')).toHaveText('01 / 30')

    // Reload preserves
    await page.reload()
    await expect(page.getByTestId('challenge-home')).toBeVisible()
    await expect(page.getByTestId('challenge-progress-count')).toHaveText('01 / 30')
    // Day 1 should be shown as completed in grid
    await page.getByTestId('challenge-open-grid').click()
    await expect(page.getByTestId('challenge-grid')).toBeVisible()
    const day1 = page.getByTestId('challenge-grid-day-1')
    await expect(day1).toHaveAttribute('data-state', 'completed')
    // Day 2 should be locked on same day (only Day1 available initially; after 1 completion next is Day1? Actually Day1 completed, next available is Day2? No, Day2 is not yet calendar unlocked on same day.
    // So grid Day 2 should be locked
    const day2 = page.getByTestId('challenge-grid-day-2')
    await expect(day2).toHaveAttribute('data-state', 'locked')
  })

  test('locked state: future days are locked and cannot be opened', async ({ page }) => {
    await page.goto('/beautiful-shots?mock=1')
    await page.getByTestId('challenge-start-cta').click()
    await expect(page.getByTestId('challenge-home')).toBeVisible()
    await page.getByTestId('challenge-open-grid').click()
    await expect(page.getByTestId('challenge-grid')).toBeVisible()
    // Day 5 should be locked on first day
    const day5 = page.getByTestId('challenge-grid-day-5')
    await expect(day5).toHaveAttribute('data-state', 'locked')
    await expect(day5).toBeDisabled()
    // Day 1 should be available
    const day1 = page.getByTestId('challenge-grid-day-1')
    await expect(day1).toHaveAttribute('data-state', 'available')
    await expect(day1).toBeEnabled()
  })

  test('quick completion saved as quick', async ({ page }) => {
    await page.goto('/beautiful-shots?mock=1')
    await page.getByTestId('challenge-start-cta').click()
    await page.getByTestId('challenge-continue-cta').click()
    // Open hint and use quick
    await page.getByTestId('challenge-hint-cta').click()
    await expect(page.getByTestId('challenge-hint-sheet')).toBeVisible()
    await page.getByTestId('challenge-quick-complete-cta').click()
    // feedback
    await expect(page.getByTestId('challenge-feedback')).toBeVisible()
    await page.getByTestId('feedback-normal').click()
    await page.getByTestId('feedback-submit').click()
    await page.getByTestId('challenge-feedback-close').click()
    await expect(page.getByTestId('challenge-completion')).toBeVisible()
    await expect(page.getByTestId('challenge-completion')).toContainText('ЗАСЧИТАНО')
    await page.getByTestId('challenge-completion-cta').click()
    // Check grid shows quick
    await page.getByTestId('challenge-open-grid').click()
    const day1 = page.getByTestId('challenge-grid-day-1')
    await expect(day1).toHaveAttribute('data-state', 'completed_quick')
  })

  test('responsive viewports: landing visible at 360, 390, 430', async ({ page }) => {
    for (const viewport of [
      { width: 360, height: 800 },
      { width: 390, height: 844 },
      { width: 430, height: 932 },
    ]) {
      await page.setViewportSize(viewport)
      await page.goto('/beautiful-shots?mock=1')
      await expect(page.getByTestId('challenge-landing')).toBeVisible()
      await expect(page.getByTestId('challenge-start-cta')).toBeVisible()
    }
  })
})
