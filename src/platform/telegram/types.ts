import type { HapticStyle, MiniAppAdapter, MiniAppUser, PlatformKind } from '../types.js'

export type TelegramMode = PlatformKind
export type TelegramUser = MiniAppUser
export type { HapticStyle, MiniAppUser, PlatformKind, MiniAppAdapter }

export type TelegramShareFailedReason =
  | 'MESSAGE_EXPIRED'
  | 'MESSAGE_SEND_FAILED'
  | 'UNKNOWN_ERROR'
  | 'callback_false'
  | 'timeout'
  | 'exception'

export type TelegramShareSignal = 'callback' | 'event' | 'version' | 'timeout' | 'exception'

export type TelegramShareResult =
  | { status: 'sent'; signal: 'callback' | 'event' }
  | { status: 'cancelled'; reason: 'USER_DECLINED'; signal: 'event' }
  | { status: 'unsupported'; reason: 'UNSUPPORTED' | 'client_version'; signal: 'event' | 'version' }
  | { status: 'failed'; reason: TelegramShareFailedReason; signal: TelegramShareSignal }

/** Legacy string contract — kept for backward compat with mocks/tests. */
export type TelegramLegacyShareStatus = 'sent' | 'failed' | 'unsupported'

export interface TelegramAdapter extends MiniAppAdapter {
  // Structured result contract (Bot API 8.0 shareMessageSent/shareMessageFailed).
  // Implementations may still resolve legacy strings — callers must normalize.
  shareMessage?(preparedId: string): Promise<TelegramShareResult | TelegramLegacyShareStatus>
  /** Opens a t.me share link inside Telegram (openTelegramLink). Returns true when invoked. */
  openTelegramLink?(url: string): boolean
  /** Telegram WebApp version string (e.g. "8.0"), when available. */
  getTelegramVersion?(): string | undefined
  // Alias for BC: mode is actually PlatformKind, but keep name stable
  readonly mode: PlatformKind
  getUser(): MiniAppUser | null
}
