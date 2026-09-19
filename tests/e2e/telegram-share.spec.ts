import { expect, test, expectNoRuntimeErrors } from './fixtures'

async function answerInterior(page: import('@playwright/test').Page) {
  for (let i = 0; i < 8; i++) {
    await page.getByTestId('answer-option').first().click()
  }
}

test.describe('Telegram share reliability (classified failures)', () => {
  test('prepared message succeeds → share_success, status native', async ({
    page,
    analyticsCollector,
    errorCollector,
  }) => {
    await page.goto('/?mock=1&tgWebAppStartParam=post_aug25')
    await expect(page.getByTestId('start-cta')).toBeVisible()
    await page.getByTestId('start-cta').click()
    await expect(page.getByTestId('quiz-screen')).toBeVisible()
    await answerInterior(page)
    await expect(page.getByTestId('result-screen')).toBeVisible({ timeout: 5000 })

    await page.getByTestId('share-button').click()
    await expect(page.getByTestId('share-status')).toHaveText('native', { timeout: 5000 })
    await expect(page.getByTestId('share-button')).toContainText('Отправлено')

    await expect
      .poll(() => analyticsCollector.events().filter((e) => e.event === 'share_success').length)
      .toBe(1)
    await expectNoRuntimeErrors(page, errorCollector)
  })

  test('MESSAGE_SEND_FAILED → share_native_failed + telegram_share_fallback_opened, single fallback', async ({
    page,
    analyticsCollector,
    errorCollector,
  }) => {
    await page.goto('/?mock=1&share=message_send_failed&tgWebAppStartParam=post_aug25')
    await expect(page.getByTestId('start-cta')).toBeVisible()
    await page.getByTestId('start-cta').click()
    await expect(page.getByTestId('quiz-screen')).toBeVisible()
    await answerInterior(page)
    await expect(page.getByTestId('result-screen')).toBeVisible({ timeout: 5000 })

    await page.getByTestId('share-button').click()
    // Fallback chooser opened → truthful UX returns CTA to idle, never "Отправлено"
    await expect(page.getByTestId('share-status')).toHaveText('idle', { timeout: 8000 })
    await expect(page.getByTestId('share-button')).toContainText('Отправить результат подруге')
    await expect(page.getByTestId('share-button')).not.toContainText('Отправлено')

    await expect
      .poll(() => analyticsCollector.events().filter((e) => e.event === 'share_native_failed').length)
      .toBe(1)
    const nativeFailed = analyticsCollector.events().find((e) => e.event === 'share_native_failed')!
    expect(nativeFailed.properties.reason).toBe('MESSAGE_SEND_FAILED')

    await expect
      .poll(
        () => analyticsCollector.events().filter((e) => e.event === 'telegram_share_fallback_opened').length,
      )
      .toBe(1)
    const opened = analyticsCollector
      .events()
      .find((e) => e.event === 'telegram_share_fallback_opened')!
    expect(opened.properties.transport).toBe('openTelegramLink')

    // Single fallback mechanism: openTelegramLink invoked exactly once
    const calls = await page.evaluate(
      () => (window as unknown as { __openTelegramLinkCalls?: string[] }).__openTelegramLinkCalls ?? [],
    )
    expect(calls.length).toBe(1)
    expect(String(calls[0]).startsWith('https://t.me/share/url?url=')).toBe(true)

    // Never reported as delivered
    expect(analyticsCollector.events().filter((e) => e.event === 'share_success').length).toBe(0)
    await expectNoRuntimeErrors(page, errorCollector)
  })

  test('USER_DECLINED → share_cancelled, button idle, no second chooser', async ({
    page,
    analyticsCollector,
    errorCollector,
  }) => {
    await page.goto('/?mock=1&share=cancelled&tgWebAppStartParam=post_aug25')
    await expect(page.getByTestId('start-cta')).toBeVisible()
    await page.getByTestId('start-cta').click()
    await expect(page.getByTestId('quiz-screen')).toBeVisible()
    await answerInterior(page)
    await expect(page.getByTestId('result-screen')).toBeVisible({ timeout: 5000 })

    await page.getByTestId('share-button').click()
    await expect(page.getByTestId('share-status')).toHaveText('idle', { timeout: 5000 })
    await expect(page.getByTestId('share-button')).toContainText('Отправить результат подруге')

    await expect
      .poll(() => analyticsCollector.events().filter((e) => e.event === 'share_cancelled').length)
      .toBe(1)
    const cancelled = analyticsCollector.events().find((e) => e.event === 'share_cancelled')!
    expect(cancelled.properties.reason).toBe('USER_DECLINED')

    // No failure recorded, no fallback chooser
    expect(analyticsCollector.events().filter((e) => e.event === 'share_native_failed').length).toBe(0)
    expect(
      analyticsCollector.events().filter((e) => e.event === 'telegram_share_fallback_opened').length,
    ).toBe(0)
    const calls = await page.evaluate(
      () => (window as unknown as { __openTelegramLinkCalls?: string[] }).__openTelegramLinkCalls ?? [],
    )
    expect(calls.length).toBe(0)
    await expectNoRuntimeErrors(page, errorCollector)
  })
})
