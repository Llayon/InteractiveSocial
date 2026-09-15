/**
 * Music90s comment-share E2E: Telegram post CTA.
 * Launch via startapp=post_music90s_launch in mock-as-Telegram env.
 */
import { expect, test, expectNoRuntimeErrors } from './fixtures'

const pad = (n: number) => String(n).padStart(2, '0')
const POST_URL = 'https://t.me/takeiteasybefore/2435'

async function answerAll18(page: import('@playwright/test').Page) {
  for (let i = 1; i <= 18; i++) {
    await expect(page.getByTestId('progress')).toHaveText(`${pad(i)} / 18`)
    await page.getByTestId('answer-option').first().click()
    if (i < 18) {
      await expect(page.getByTestId('progress')).toHaveText(`${pad(i + 1)} / 18`, { timeout: 3000 })
    }
  }
}

async function installClipboardAndOpenStubs(page: import('@playwright/test').Page) {
  await page.evaluate(() => {
    const w = window as unknown as Record<string, unknown>
    w.__copiedText = null
    w.__openedUrl = null
    try {
      const nav = navigator as unknown as Record<string, unknown>
      const fakeClipboard = {
        writeText: async (text: string) => {
          ;(window as unknown as Record<string, unknown>).__copiedText = text
        },
      }
      Object.defineProperty(navigator, 'clipboard', { value: fakeClipboard, configurable: true })
      void nav
    } catch {}
    const origOpen = window.open.bind(window)
    void origOpen
    ;(window as unknown as { open: unknown }).open = ((url: string) => {
      ;(window as unknown as Record<string, unknown>).__openedUrl = url
      return null
    }) as unknown as typeof window.open
  })
}

test.describe('music90s comment-share (post_music90s_launch)', () => {
  test('CTA visible, click copies score text and opens post 2435', async ({
    page,
    errorCollector,
    analyticsCollector,
  }, testInfo) => {
    await page.goto('/?mock=1&startapp=post_music90s_launch')
    await expect(page.getByRole('heading', { level: 1 })).toContainText('90-х')
    await page.getByTestId('start-cta').click()
    await expect(page.getByTestId('quiz-screen')).toBeVisible()
    await answerAll18(page)
    await expect(page.getByTestId('result-screen')).toBeVisible({ timeout: 5_000 })

    // Primary challenge CTA unchanged
    await expect(page.getByTestId('share-button')).toContainText('Бросить вызов')

    // New secondary CTA
    const cta = page.getByTestId('comment-share-button')
    await expect(cta).toBeVisible()
    await expect(cta).toContainText('Показать результат в комментариях')

    await installClipboardAndOpenStubs(page)
    await cta.click()

    // Clipboard contains expected score/result text (no URLs/handles)
    await expect
      .poll(async () => page.evaluate(() => (window as unknown as Record<string, unknown>).__copiedText))
      .not.toBeNull()
    const copied = (await page.evaluate(
      () => (window as unknown as Record<string, unknown>).__copiedText,
    )) as string
    const scoreText = await page.getByTestId('result-score').textContent()
    const titleText = (await page.getByTestId('result-title').textContent())?.trim() ?? ''
    // score like "7 / 18" → "7/18"
    const m = /(\d+)\s*\/\s*(\d+)/.exec(scoreText ?? '')
    expect(m).not.toBeNull()
    const expectedStart = `У меня ${m![1]}/${m![2]} — `
    expect(copied.startsWith(expectedStart)).toBe(true)
    expect(copied).toContain(titleText)
    expect(copied).toContain('А у вас сколько?')
    expect(copied).not.toContain('https://')
    expect(copied).not.toContain('t.me')
    expect(copied).not.toContain('@takeiteasybefore')

    // Post URL exact
    await expect
      .poll(async () => page.evaluate(() => (window as unknown as Record<string, unknown>).__openedUrl))
      .toBe(POST_URL)

    // Success hint
    await expect(page.getByTestId('comment-share-hint')).toContainText(
      'Результат скопирован — вставьте его в комментариях',
    )

    await page.screenshot({
      path: `gauntlet/reports/evidence/${testInfo.project.name}/m-comments-result.png`,
      fullPage: true,
    })

    // Analytics collector
    await expect
      .poll(() => analyticsCollector.events().filter((e) => e.event === 'comment_share_impression').length)
      .toBe(1)
    await expect
      .poll(() => analyticsCollector.events().filter((e) => e.event === 'comment_share_click').length)
      .toBe(1)
    await expect
      .poll(() => analyticsCollector.events().filter((e) => e.event === 'comment_copy_success').length)
      .toBe(1)
    await expect
      .poll(() => analyticsCollector.events().filter((e) => e.event === 'comment_post_open').length)
      .toBe(1)

    const imp = analyticsCollector.events().find((e) => e.event === 'comment_share_impression')!
    expect(imp.properties.quiz_id).toBe('music90s')
    expect(imp.properties.campaign_id).toBe('music90s_launch')
    expect(imp.properties.acquisition_source).toBe('wife_post_telegram')
    expect(['telegram', 'mock']).toContain(imp.properties.platform as string)
    expect(imp.properties).not.toHaveProperty('comment_text')

    const click = analyticsCollector.events().find((e) => e.event === 'comment_share_click')!
    expect(click.properties.quiz_id).toBe('music90s')
    expect(click.properties.campaign_id).toBe('music90s_launch')

    // No challenge pollution from comment action (challenge_click may exist only from share-button, which we never clicked)
    const challengeClicks = analyticsCollector.events().filter((e) => e.event === 'challenge_click')
    expect(challengeClicks).toHaveLength(0)

    await expectNoRuntimeErrors(page, errorCollector)
  })

  test('negative: quiz_music90s → CTA absent', async ({ page, errorCollector }) => {
    await page.goto('/?mock=1&startapp=quiz_music90s')
    await expect(page.getByTestId('start-cta')).toBeVisible()
    await page.getByTestId('start-cta').click()
    await answerAll18(page)
    await expect(page.getByTestId('result-screen')).toBeVisible({ timeout: 5_000 })
    await expect(page.getByTestId('share-button')).toBeVisible()
    await expect(page.getByTestId('comment-share-button')).toHaveCount(0)
    await expectNoRuntimeErrors(page, errorCollector)
  })

  test('negative: MAX + post_music90s_launch → CTA absent', async ({ page, errorCollector }) => {
    await page.goto('/?mock=1&platform=max&startapp=post_music90s_launch')
    await expect(page.getByTestId('start-cta')).toBeVisible()
    await page.getByTestId('start-cta').click()
    await expect(page.getByTestId('quiz-screen')).toBeVisible()
    for (let i = 1; i <= 18; i++) {
      await page.getByTestId('answer-option').first().click()
      if (i < 18) {
        await expect(page.getByTestId('progress')).toHaveText(`${pad(i + 1)} / 18`, { timeout: 3000 })
      }
    }
    await expect(page.getByTestId('result-screen')).toBeVisible({ timeout: 5_000 })
    await expect(page.getByTestId('share-button')).toBeVisible()
    await expect(page.getByTestId('comment-share-button')).toHaveCount(0)
    await expectNoRuntimeErrors(page, errorCollector)
  })
})
