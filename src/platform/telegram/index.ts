// Re-export neutral types for new code; keep telegram path as BC facade
export type { TelegramAdapter, TelegramMode, TelegramUser, HapticStyle, MiniAppAdapter, MiniAppUser, PlatformKind } from './types.js'
export { detectPlatform as detectTelegramMode } from '../detect.js'
export { createPlatformAdapter as createTelegramAdapter } from '../factory.js'

export { createMockTelegram } from './mock.js'
export { createBrowserFallback } from './browser.js'
export { createRealTelegram } from './real.js'
// Also re-export new factory for consumers that want platform-aware creation
export { createPlatformAdapter } from '../factory.js'
export { detectPlatform } from '../detect.js'
