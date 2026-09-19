import { createBrowserFallback } from './telegram/browser.js'
import { createMockTelegram } from './telegram/mock.js'
import { createRealTelegram } from './telegram/real.js'
import { createMaxAdapter } from './max/adapter.js'
import { createMaxMock } from './max/mock.js'
import { detectPlatform, isMockEmulatingMax } from './detect.js'
import type { MiniAppAdapter, PlatformKind } from './types.js'

export function createPlatformAdapter(mode: PlatformKind = detectPlatform()): MiniAppAdapter {
  // E2E mock that emulates MAX must return a MAX mock adapter even when detectPlatform() returns 'max'
  // (detectPlatform returns 'max' for ?mock=1&platform=max to keep platform === 'max' in App).
  if (isMockEmulatingMax()) {
    const params = new URLSearchParams(window.location.search)
    return createMaxMock({
      startParam: params.get('tgWebAppStartParam') ?? params.get('startapp') ?? params.get('start_param'),
      failShare: params.get('share') === 'fail',
      unsupported: params.get('share') === 'unsupported',
    })
  }
  if (mode === 'mock') {
    const params = new URLSearchParams(window.location.search)
    const shareParam = params.get('share')
    const shareMode =
      shareParam === 'cancelled' || shareParam === 'declined'
        ? ('cancelled' as const)
        : shareParam === 'message_send_failed' || shareParam === 'send_failed'
          ? ('message_send_failed' as const)
          : shareParam === 'unsupported'
            ? ('unsupported' as const)
            : shareParam === 'fail'
              ? ('failed' as const)
              : undefined
    return createMockTelegram({
      startParam: params.get('tgWebAppStartParam') ?? params.get('startapp'),
      failShare: params.get('share') === 'fail',
      ...(shareMode ? { shareMode } : {}),
      ...(shareMode === 'message_send_failed' ? { withShareLinkFallback: true } : {}),
    })
  }
  switch (mode) {
    case 'telegram':
      return createRealTelegram()
    case 'max':
      return createMaxAdapter()
    case 'browser':
    default:
      return createBrowserFallback()
  }
}

// Back-compat: existing imports still work
export { detectPlatform } from './detect.js'
export { createMockTelegram } from './telegram/mock.js'
export { createBrowserFallback } from './telegram/browser.js'
export { createRealTelegram } from './telegram/real.js'
export { createMaxMock } from './max/mock.js'
export { createMaxAdapter } from './max/adapter.js'
