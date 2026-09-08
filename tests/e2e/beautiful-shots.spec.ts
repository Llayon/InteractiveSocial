import { expect, test } from './fixtures'

test.describe('beautiful-shots challenge e2e', () => {

  test('Landing → Start → Day 1 → Complete → Completion → reload Day 1 remains completed', async ({ page }) => {
    await page.goto('/beautiful-shots?mock=1')
    await expect(page.getByTestId('challenge-landing')).toBeVisible()
    await expect(page.getByTestId('challenge-start-cta')).toBeVisible()
    await expect(page.getByRole('heading', { level: 1 })).toContainText('КРАСИВЫХ')

    await page.getByTestId('challenge-start-cta').click()
    await expect(page.getByTestId('challenge-home')).toBeVisible()
    await expect(page.getByTestId('challenge-progress-count')).toHaveText('00 / 30')
    await expect(page.getByTestId('challenge-next-card')).toContainText('ДЕНЬ 01')
    await expect(page.getByTestId('challenge-continue-cta')).toBeVisible()

    await page.getByTestId('challenge-continue-cta').click()
    await expect(page.getByTestId('challenge-day-detail')).toBeVisible()
    await expect(page.getByTestId('challenge-day-title')).toContainText('Предмет в руке у окна')
    await expect(page.getByTestId('challenge-day-hero')).toBeVisible()
    await expect(page.getByTestId('challenge-complete-cta')).toBeVisible()

    await page.getByTestId('challenge-hint-cta').click()
    await expect(page.getByTestId('challenge-hint-sheet')).toBeVisible()
    await expect(page.getByTestId('challenge-hint-close')).toBeVisible()
    await page.getByTestId('challenge-hint-close').click()
    await expect(page.getByTestId('challenge-hint-sheet')).toBeHidden()

    await page.getByTestId('challenge-complete-cta').click()

    await expect(page.getByTestId('challenge-feedback')).toBeVisible()
    await page.getByTestId('feedback-easy').click()
    await page.getByTestId('feedback-submit').click()
    await expect(page.getByTestId('challenge-feedback-done')).toBeVisible()
    await page.getByTestId('challenge-feedback-close').click()

    await expect(page.getByTestId('challenge-completion')).toBeVisible()
    await expect(page.getByTestId('challenge-completion-number')).toHaveText('01')
    await expect(page.getByTestId('challenge-completion-progress')).toHaveText('01 / 30')
    await expect(page.getByTestId('challenge-completion-cta')).toBeVisible()

    await page.getByTestId('challenge-completion-cta').click()
    await expect(page.getByTestId('challenge-home')).toBeVisible()
    await expect(page.getByTestId('challenge-progress-count')).toHaveText('01 / 30')

    await page.reload()
    await expect(page.getByTestId('challenge-home')).toBeVisible()
    await expect(page.getByTestId('challenge-progress-count')).toHaveText('01 / 30')
    await page.getByTestId('challenge-open-grid').click()
    await expect(page.getByTestId('challenge-grid')).toBeVisible()
    await expect(page.getByTestId('challenge-grid-cells').locator('button')).toHaveCount(30)
    const day1 = page.getByTestId('challenge-grid-day-1')
    await expect(day1).toHaveAttribute('data-state', 'completed')
    const day2 = page.getByTestId('challenge-grid-day-2')
    await expect(day2).toHaveAttribute('data-state', 'locked')
    const day8 = page.getByTestId('challenge-grid-day-8')
    await expect(day8).toHaveAttribute('data-state', 'locked')
    await expect(day8).toBeDisabled()
    const day30 = page.getByTestId('challenge-grid-day-30')
    await expect(day30).toHaveAttribute('data-state', 'locked')
  })

  test('locked state: future days are locked and cannot be opened', async ({ page }) => {
    await page.goto('/beautiful-shots?mock=1')
    await page.getByTestId('challenge-start-cta').click()
    await expect(page.getByTestId('challenge-home')).toBeVisible()
    await page.getByTestId('challenge-open-grid').click()
    await expect(page.getByTestId('challenge-grid')).toBeVisible()
    await expect(page.getByTestId('challenge-grid-cells').locator('button')).toHaveCount(30)
    const day5 = page.getByTestId('challenge-grid-day-5')
    await expect(day5).toHaveAttribute('data-state', 'locked')
    await expect(day5).toBeDisabled()
    const day1 = page.getByTestId('challenge-grid-day-1')
    await expect(day1).toHaveAttribute('data-state', 'available')
    await expect(day1).toBeEnabled()
    const day8 = page.getByTestId('challenge-grid-day-8')
    await expect(day8).toHaveAttribute('data-state', 'locked')
    const day30 = page.getByTestId('challenge-grid-day-30')
    await expect(day30).toHaveAttribute('data-state', 'locked')
  })

  test('quick completion saved as quick', async ({ page }) => {
    await page.goto('/beautiful-shots?mock=1')
    await page.getByTestId('challenge-start-cta').click()
    await page.getByTestId('challenge-continue-cta').click()
    await page.getByTestId('challenge-hint-cta').click()
    await expect(page.getByTestId('challenge-hint-sheet')).toBeVisible()
    await page.getByTestId('challenge-quick-complete-cta').click()
    await expect(page.getByTestId('challenge-feedback')).toBeVisible()
    await page.getByTestId('feedback-normal').click()
    await page.getByTestId('feedback-submit').click()
    await page.getByTestId('challenge-feedback-close').click()
    await expect(page.getByTestId('challenge-completion')).toBeVisible()
    await expect(page.getByTestId('challenge-completion')).toContainText('ЗАСЧИТАНО')
    await page.getByTestId('challenge-completion-cta').click()
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

  test('after completing all 7 published days shows continuation not false 30/30', async ({ page }) => {
    await page.goto('/beautiful-shots?mock=1')
    await page.evaluate(() => {
      const pad = (n: number) => String(n).padStart(2, '0')
      const progress = {
        challengeId: 'beautiful-shots',
        startedAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
        startedAtLocalDate: (() => {
          const d = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000)
          return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
        })(),
        completed: Array.from({ length: 7 }, (_, i) => ({ day: i + 1, completedAt: new Date().toISOString(), mode: 'normal' })),
      }
      localStorage.setItem('challenge-progress:beautiful-shots', JSON.stringify(progress))
    })
    await page.reload()
    await expect(page.getByTestId('challenge-home')).toBeVisible()
    await expect(page.getByTestId('challenge-progress-count')).toHaveText('07 / 30')
    await expect(page.getByTestId('challenge-done-today')).toContainText('Продолжение программы скоро')
    await expect(page.getByTestId('challenge-done-today')).not.toContainText('Все 30 дней завершены')
    await page.getByTestId('challenge-open-grid').click()
    await expect(page.getByTestId('challenge-grid-cells').locator('button')).toHaveCount(30)
    await expect(page.getByTestId('challenge-grid-day-8')).toHaveAttribute('data-state', 'locked')
    await expect(page.getByTestId('challenge-grid-day-8')).toBeDisabled()
  })
})
