/**
 * Cross-quiz deeplink v2 protocol E2E: a recipient opening a
 * `s2_<quizCode>_<resultCode>_<uid>` link must resolve to the correct
 * quiz, never to the default Interior quiz. Old Interior v2 and legacy
 * v1 links must keep working (no historical share must break).
 */
import { expect, test, expectNoRuntimeErrors } from './fixtures'

test.describe('v2 share deeplink routing across quizzes', () => {
  test('s2_m90_<code>_<uid> opens Music90s, not the default Interior quiz', async ({
    page,
    errorCollector,
  }) => {
    await page.goto('/?mock=1&startapp=s2_m90_dc_847291')
    // Music90s landing copy: eyebrow is «музыкальный тест», title contains 90-х.
    await expect(page.getByTestId('start-cta')).toBeVisible()
    const heading = await page.getByRole('heading', { level: 1 }).textContent()
    expect(heading ?? '').toContain('90-х')
    await page.getByTestId('start-cta').click()
    await expect(page.getByTestId('quiz-screen')).toBeVisible()
    // Music90s has 18 questions — Interior has 8. The hard gate.
    await expect(page.getByTestId('progress')).toHaveText('01 / 18')
    await expectNoRuntimeErrors(page, errorCollector)
  })

  test('s2_ic_<code>_<uid> still resolves to Interior (no historical breakage)', async ({
    page,
    errorCollector,
  }) => {
    await page.goto('/?mock=1&startapp=s2_ic_it_847291')
    await expect(page.getByTestId('start-cta')).toBeVisible()
    const heading = await page.getByRole('heading', { level: 1 }).textContent()
    expect(heading ?? '').toContain('интерьерный')
    await page.getByTestId('start-cta').click()
    await expect(page.getByTestId('progress')).toHaveText('01 / 08')
    await expectNoRuntimeErrors(page, errorCollector)
  })

  test('legacy share_<result> still routes Interior by result owner', async ({
    page,
    errorCollector,
  }) => {
    await page.goto('/?mock=1&startapp=share_italian-847291')
    await expect(page.getByTestId('start-cta')).toBeVisible()
    await page.getByTestId('start-cta').click()
    await expect(page.getByTestId('progress')).toHaveText('01 / 08')
    await expectNoRuntimeErrors(page, errorCollector)
  })

  test('unknown v2 target falls back to the default quiz with a console warning', async ({
    page,
    errorCollector,
  }) => {
    await page.goto('/?mock=1&startapp=s2_zz_zz_847291')
    // Default is the first registered quiz (Interior). It must not blank.
    await expect(page.getByTestId('start-cta')).toBeVisible()
    await expectNoRuntimeErrors(page, errorCollector)
  })
})
