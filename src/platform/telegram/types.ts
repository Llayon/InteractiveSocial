import type { HapticStyle, MiniAppAdapter, MiniAppUser, PlatformKind } from '../types.js'

export type TelegramMode = PlatformKind
export type TelegramUser = MiniAppUser
export type { HapticStyle, MiniAppUser, PlatformKind, MiniAppAdapter }

export interface TelegramAdapter extends MiniAppAdapter {
  // Back-compat: real Telegram adapter also supports shareMessage for prepared inline messages.
  // MAX mock/browser adapters may not expose it; callers should check platform or use ShareTransport.
  shareMessage?(preparedId: string): Promise<'sent' | 'failed' | 'unsupported'>
  // Alias for BC: mode is actually PlatformKind, but keep name stable
  readonly mode: PlatformKind
  getUser(): MiniAppUser | null
}
