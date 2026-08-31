export type PlatformKind = 'telegram' | 'max' | 'browser' | 'mock'

export interface MiniAppUser {
  id: number
  firstName: string
  username?: string
}

export type HapticStyle = 'light' | 'medium' | 'heavy' | 'soft' | 'rigid'

export interface MiniAppAdapter {
  /**
   * telegram — real Telegram Mini App
   * max      — real MAX Mini App
   * mock     — deterministic mock (dev / ?mock=1 / Playwright)
   * browser  — plain web fallback (no fake identity)
   */
  readonly platform: PlatformKind
  /** @deprecated — use platform, kept for BC with existing telegram code */
  readonly mode: PlatformKind
  ready(): void
  expand(): void
  getStartParam(): string | null
  getUser(): MiniAppUser | null
  /** Raw initData string for server-side validation. Empty outside messenger. */
  getInitDataRaw(): string
  haptic(style?: HapticStyle): void
}

// Back-compat aliases — existing code imports from '@/platform/telegram'
export type TelegramMode = PlatformKind
export type TelegramUser = MiniAppUser
export type TelegramAdapter = MiniAppAdapter
