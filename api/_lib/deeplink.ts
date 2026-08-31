/**
 * Server-side deep-link builder (platform-aware).
 *
 * Keeps t.me and max.ru generation in one place.
 * All image/card and share flows must use this — never hand-roll URLs.
 */

export function buildTelegramDeepLink(
  botUsername: string,
  appShortName: string,
  startParam: string,
): string {
  return `https://t.me/${botUsername}/${appShortName}?startapp=${encodeURIComponent(startParam)}`
}

export function buildMaxDeepLink(maxBotUsername: string, startParam: string): string {
  return `https://max.ru/${maxBotUsername}?startapp=${encodeURIComponent(startParam)}`
}

export type DeepLinkPlatform = 'telegram' | 'max'

export function buildPlatformDeepLink(
  platform: DeepLinkPlatform,
  botUsername: string,
  startParam: string,
  appShortName = 'app',
): string {
  if (platform === 'max') return buildMaxDeepLink(botUsername, startParam)
  return buildTelegramDeepLink(botUsername, appShortName, startParam)
}
