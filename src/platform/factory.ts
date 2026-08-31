import { createBrowserFallback } from './telegram/browser.js'
import { createMockTelegram } from './telegram/mock.js'
import { createRealTelegram } from './telegram/real.js'
import { createMaxAdapter } from './max/adapter.js'
import { createMaxMock } from './max/mock.js'
import { detectPlatform, isMockEmulatingMax } from './detect.js'
import type { MiniAppAdapter, PlatformKind } from './types.js'

export function createPlatformAdapter(mode: PlatformKind = detectPlatform()): MiniAppAdapter {
  // Mock is special: check if it should emulate MAX
  if (mode === 'mock') {
    if (isMockEmulatingMax()) {
      const params = new URLSearchParams(window.location.search)
      return createMaxMock({
        startParam: params.get('tgWebAppStartParam') ?? params.get('startapp') ?? params.get('start_param'),
        failShare: params.get('share') === 'fail',
        unsupported: params.get('share') === 'unsupported',
      })
    }
    const params = new URLSearchParams(window.location.search)
    return createMockTelegram({
      startParam: params.get('tgWebAppStartParam') ?? params.get('startapp'),
      failShare: params.get('share') === 'fail',
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
