import { expect, expectNoRuntimeErrors, test } from './fixtures'

const IMG_RE = /\.(png|jpe?g|webp)(\?|$)/

/**
 * Runtime image network contract (phase-based, robust against srcset/cache
 * fan-out — we assert logical families, never exact request counts).
 *
 *  critical Q1 load : q1_* allowed; q2_ / results / share-cards / *.png banned
 *  idle after Q1    : q2_* prefetch allowed; results and share-cards banned
 *  result phase     : ONLY the resolved result's family under /optimized/;
 *                     the five unrelated heroes are banned
 */
test.describe('runtime image network contract', () => {
  test('quiz screen loads its own family; result loads one hero family', async ({
    page,
    errorCollector,
  }) => {
    const requests: string[] = []
    page.on('request', (r) => {
      const url = r.url()
      if (IMG_RE.test(url) || url.includes('/optimized/') || url.includes('/share-cards/')) {
        requests.push(url)
      }
    })

    await page.goto('/?mock=1')
    await page.getByTestId('start-cta').click()
    await expect(page.getByTestId('quiz-screen')).toBeVisible()
    await expect(page.getByTestId('progress')).toHaveText('01 / 08')

    // Critical phase — captured immediately after first paint of Q1.
    const critical = requests.join('\n')
    expect(critical).not.toMatch(/\/optimized\/quiz\/q2_/)
    expect(critical).not.toMatch(/\/optimized\/results\//)
    expect(critical).not.toMatch(/\/share-cards\//)
    expect(critical).not.toMatch(/\.png(\?|$)/)
    for (const key of ['q1_a', 'q1_b', 'q1_c', 'q1_d']) {
      expect(critical).toMatch(new RegExp(`/optimized/quiz/${key}-\\d+\\.`))
    }

    // Idle phase — controlled Q2 prefetch is allowed here (06).
    await page.waitForTimeout(700)
    const idle = requests.join('\n')
    expect(idle).not.toMatch(/\/optimized\/results\//)
    expect(idle).not.toMatch(/\/share-cards\//)

    // Deterministic walk → result.
    for (let i = 1; i <= 8; i++) {
      await expect(page.getByTestId('progress')).toHaveText(
        `${String(i).padStart(2, '0')} / 08`,
      )
      await page.getByTestId('answer-option').first().click()
    }
    await expect(page.getByTestId('result-screen')).toBeVisible({ timeout: 5_000 })
    const resultId = await page.getByTestId('result-card').getAttribute('data-result-id')
    expect(resultId).toBeTruthy()

    const all = requests.join('\n')
    const otherHeroes = all
      .split('\n')
      .filter((u) => u.includes('/optimized/results/') && !u.includes(`/results/${resultId}-`))
    expect(otherHeroes).toEqual([])
    expect(all).not.toMatch(/\/share-cards\//)
    expect(all).not.toMatch(/\.png(\?|$)/)

    await expectNoRuntimeErrors(page, errorCollector)
  })
})
