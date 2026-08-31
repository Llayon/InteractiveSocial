import type { HapticStyle, MiniAppAdapter, MiniAppUser } from '../types.js'

export interface MaxMockOptions {
  startParam?: string | null
  /** 'native' -> shareMaxContent fails, 'prepare' -> prepare endpoint will be mocked to fail, undefined -> success */
  failShare?: boolean
  unsupported?: boolean
}

/**
 * Deterministic MAX mock for dev / E2E.
 * Mirrors Telegram mock shape but with platform='max' and MAX-like initData.
 */
export function createMaxMock(options: MaxMockOptions = {}): MiniAppAdapter {
  const user: MiniAppUser = { id: 700_000_001, firstName: 'Макс', username: 'max_mock' }

  // Mock shareMaxContent behavior exposed via global for ShareTransport to detect if needed.
  // We attach a fake WebApp to window for transport layer to call.
  if (typeof window !== 'undefined') {
    const w = window as unknown as Record<string, unknown>
    if (!w.WebApp) {
      w.WebApp = {
        initData: `user=${encodeURIComponent(JSON.stringify({ id: user.id, first_name: user.firstName }))}&start_param=${encodeURIComponent(options.startParam ?? '')}&auth_date=${Math.floor(Date.now() / 1000)}&hash=fake_hash_for_mock`,
        initDataUnsafe: {
          user: { id: user.id, first_name: user.firstName, username: user.username },
          start_param: options.startParam ?? '',
          auth_date: Math.floor(Date.now() / 1000),
          hash: 'fake_hash_for_mock',
        },
        platform: 'android',
        version: '25.9.16',
        shareMaxContent: (_params: unknown) => {
          // no-op, transport will handle outcome via mock flag
        },
        HapticFeedback: {
          impactOccurred: () => undefined,
        },
      }
    }
  }

  return {
    platform: 'max',
    mode: 'max' as const,
    ready() {},
    expand() {},
    getStartParam() {
      return options.startParam ?? null
    },
    getUser() {
      return user
    },
    getInitDataRaw() {
      const payload = JSON.stringify({ id: user.id, first_name: user.firstName })
      return `user=${encodeURIComponent(payload)}&start_param=${encodeURIComponent(options.startParam ?? '')}&auth_date=${Math.floor(Date.now() / 1000)}&hash=fake_hash_for_mock`
    },
    haptic(_style?: HapticStyle) {},
  }
}

/**
 * Extended mock that also simulates shareMaxContent outcome.
 * Used by ShareTransport tests to control 'sent'/'failed'/'unsupported'.
 */
export function createMaxMockWithShare(
  options: MaxMockOptions & { shareOutcome?: 'sent' | 'failed' | 'unsupported' },
): MiniAppAdapter & { _mockShareMaxContent: (mid: string) => Promise<'sent' | 'failed' | 'unsupported'> } {
  const base = createMaxMock(options) as unknown as MiniAppAdapter & Record<string, unknown>
  const outcome = options.shareOutcome ?? (options.failShare ? 'failed' : options.unsupported ? 'unsupported' : 'sent')
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  base._mockShareMaxContent = async (_mid: string) => outcome
  return base as unknown as MiniAppAdapter & { _mockShareMaxContent: (mid: string) => Promise<'sent' | 'failed' | 'unsupported'> }
}
