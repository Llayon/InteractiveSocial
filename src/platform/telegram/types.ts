export type TelegramMode = 'telegram' | 'mock' | 'browser'

export interface TelegramUser {
  id: number
  firstName: string
  username?: string
}

export type HapticStyle = 'light' | 'medium' | 'heavy' | 'soft' | 'rigid'

export interface TelegramAdapter {
  /**
   * telegram   — running inside a real Telegram Mini App container
   * mock       — explicit deterministic mock (dev / ?mock=1 / E2E)
   * browser    — plain web fallback outside Telegram (no fake identity)
   */
  readonly mode: TelegramMode
  ready(): void
  expand(): void
  getStartParam(): string | null
  getUser(): TelegramUser | null
  /** Raw initData string for server-side validation. Empty outside Telegram. */
  getInitDataRaw(): string
  haptic(style?: HapticStyle): void
  /**
   * Opens the native Telegram share sheet for a prepared inline message.
   * Resolves 'sent' only on confirmed Telegram shareMessageSent event,
   * 'failed' on shareMessageFailed or unsupported environment.
   */
  shareMessage(preparedId: string): Promise<'sent' | 'failed'>
}
