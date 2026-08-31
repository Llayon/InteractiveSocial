/**
 * Platform-aware deep-link builder.
 *
 * Telegram: https://t.me/<botUsername>/<appShort>?startapp=<payload>
 * MAX:      https://max.ru/<maxBotUsername>?startapp=<payload>
 *
 * Wire payload syntax is identical (s2_... / quiz_... / share_...),
 * so existing resolver stays platform-agnostic.
 */

export type DeepLinkPlatform = 'telegram' | 'max'

export function buildTelegramDeepLink(
  botUsername: string,
  appShortName: string,
  startParam: string,
): string {
  const safe = encodeURIComponent(startParam)
  return `https://t.me/${botUsername}/${appShortName}?startapp=${safe}`
}

export function buildMaxDeepLink(maxBotUsername: string, startParam: string): string {
  const safe = encodeURIComponent(startParam)
  return `https://max.ru/${maxBotUsername}?startapp=${safe}`
}

export function buildPlatformDeepLink(
  platform: DeepLinkPlatform,
  opts: { telegramBotUsername?: string; telegramAppShort?: string; maxBotUsername?: string },
  startParam: string,
): { url: string; usable: boolean } {
  if (platform === 'max') {
    if (!opts.maxBotUsername) return { url: '', usable: false }
    return { url: buildMaxDeepLink(opts.maxBotUsername, startParam), usable: true }
  }
  if (!opts.telegramBotUsername) return { url: '', usable: false }
  return {
    url: buildTelegramDeepLink(opts.telegramBotUsername, opts.telegramAppShort ?? 'app', startParam),
    usable: true,
  }
}

function getTelegramBotEnv(): { botUsername: string; appShortName: string } {
  return {
    botUsername: (import.meta.env.VITE_TELEGRAM_BOT_USERNAME as string | undefined) ?? '',
    appShortName: (import.meta.env.VITE_TELEGRAM_APP_SHORT_NAME as string | undefined) ?? 'app',
  }
}

function getMaxBotEnv(): string {
  return (import.meta.env.VITE_MAX_BOT_USERNAME as string | undefined) ?? ''
}

/**
 * Client helper: builds link for current platform adapter.
 * Never returns raw Vercel URL — always messenger deep link or empty.
 */
export function buildCurrentPlatformDeepLink(
  platform: DeepLinkPlatform,
  startParam: string,
): { url: string; usable: boolean } {
  if (platform === 'max') {
    const maxBot = getMaxBotEnv()
    if (!maxBot) return { url: '', usable: false }
    return { url: buildMaxDeepLink(maxBot, startParam), usable: true }
  }
  const { botUsername, appShortName } = getTelegramBotEnv()
  if (!botUsername) return { url: '', usable: false }
  return { url: buildTelegramDeepLink(botUsername, appShortName, startParam), usable: true }
}
