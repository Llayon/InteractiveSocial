import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRealTelegram, SHARE_CALLBACK_GRACE_MS } from '@/platform/telegram/real'
import { telegramShareTransport, buildTelegramShareUrl } from '@/platform/share/ShareTransport'
import { music90sQuiz } from '@/content/quizzes/music90s/quiz'
import type { Analytics } from '@/analytics/analytics'
import type { TelegramShareResult } from '@/platform/telegram/types'

/* eslint-disable @typescript-eslint/no-explicit-any */

function makeAnalytics() {
  const events: { event: string; payload: Record<string, unknown> }[] = []
  const analytics = {
    track: (event: string, payload: Record<string, unknown> = {}) => {
      events.push({ event, payload })
    },
    updateContext: () => undefined,
    trackOnce: (event: string, payload: Record<string, unknown> = {}) => {
      events.push({ event, payload })
    },
  }
  return { analytics: analytics as unknown as Analytics, events }
}

function count(events: { event: string }[], name: string): number {
  return events.filter((e) => e.event === name).length
}

interface CapturedHandlers {
  handlers: Map<string, Array<(p?: unknown) => void>>
  onEvent: any
  offEvent: any
}

function installWebAppMock(opts: {
  version?: string
  shareMessageImpl?: (id: string, cb?: (ok: unknown) => void) => void
  openTelegramLinkImpl?: (url: string) => void
} = {}): CapturedHandlers {
  const handlers = new Map<string, Array<(p?: unknown) => void>>()
  const onEvent = vi.fn((type: string, cb: (p?: unknown) => void) => {
    const list = handlers.get(type) ?? []
    list.push(cb)
    handlers.set(type, list)
  })
  const offEvent = vi.fn((type: string, cb: (p?: unknown) => void) => {
    const list = handlers.get(type) ?? []
    handlers.set(
      type,
      list.filter((f) => f !== cb),
    )
  })
  const shareMessage = opts.shareMessageImpl
    ? vi.fn(opts.shareMessageImpl)
    : vi.fn((_id: string) => undefined)
  // Ensure fn.length reflects callback support: vitest fn length is 0,
  // so we override with a real function of the right arity.
  let shareFn: any = shareMessage
  if (opts.shareMessageImpl) {
    // Keep declared arity from the provided impl
    shareFn = opts.shareMessageImpl
  }
  const openTelegramLink = opts.openTelegramLinkImpl ? vi.fn(opts.openTelegramLinkImpl) : undefined
  ;(globalThis as any).Telegram = {
    WebApp: {
      version: opts.version ?? '8.0',
      shareMessage: shareFn,
      onEvent,
      offEvent,
      ...(openTelegramLink ? { openTelegramLink } : {}),
    },
  }
  return { handlers, onEvent, offEvent }
}

function fire(handlers: Map<string, Array<(p?: unknown) => void>>, type: string, payload?: unknown) {
  const list = handlers.get(type) ?? []
  for (const cb of [...list]) {
    try {
      cb(payload)
    } catch {}
  }
}

beforeEach(() => {
  vi.restoreAllMocks()
  vi.stubEnv('VITE_TELEGRAM_BOT_USERNAME', 'tginteractivebot')
  vi.stubEnv('VITE_TELEGRAM_APP_SHORT_NAME', 'app')
})

afterEach(() => {
  try {
    delete (globalThis as any).Telegram
  } catch {}
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('Telegram adapter — structured result contract', () => {
  it('A: shareMessageSent event → sent/event', async () => {
    const cap = installWebAppMock({ shareMessageImpl: (_id: string) => undefined })
    const adapter = createRealTelegram()
    const p = adapter.shareMessage!('prepared_a')
    await Promise.resolve()
    fire(cap.handlers, 'shareMessageSent')
    const res = (await p) as TelegramShareResult
    expect(res).toEqual({ status: 'sent', signal: 'event' })
  })

  it('B: callback(true) → sent/callback', async () => {
    installWebAppMock({
      shareMessageImpl: (_id: string, cb?: (ok: unknown) => void) => {
        cb?.(true)
      },
    })
    const adapter = createRealTelegram()
    const res = (await adapter.shareMessage!('prepared_b')) as TelegramShareResult
    expect(res).toEqual({ status: 'sent', signal: 'callback' })
  })

  it('C: shareMessageFailed USER_DECLINED → cancelled', async () => {
    const cap = installWebAppMock({ shareMessageImpl: (_id: string) => undefined })
    const adapter = createRealTelegram()
    const p = adapter.shareMessage!('prepared_c')
    await Promise.resolve()
    fire(cap.handlers, 'shareMessageFailed', { error: 'USER_DECLINED' })
    const res = (await p) as TelegramShareResult
    expect(res).toEqual({ status: 'cancelled', reason: 'USER_DECLINED', signal: 'event' })
  })

  it('D: shareMessageFailed UNSUPPORTED → unsupported', async () => {
    const cap = installWebAppMock({ shareMessageImpl: (_id: string) => undefined })
    const adapter = createRealTelegram()
    const p = adapter.shareMessage!('prepared_d')
    await Promise.resolve()
    fire(cap.handlers, 'shareMessageFailed', { error: 'UNSUPPORTED' })
    const res = (await p) as TelegramShareResult
    expect(res).toEqual({ status: 'unsupported', reason: 'UNSUPPORTED', signal: 'event' })
  })

  it('E: MESSAGE_SEND_FAILED exact reason retained', async () => {
    const cap = installWebAppMock({ shareMessageImpl: (_id: string) => undefined })
    const adapter = createRealTelegram()
    const p = adapter.shareMessage!('prepared_e')
    await Promise.resolve()
    fire(cap.handlers, 'shareMessageFailed', { error: 'MESSAGE_SEND_FAILED' })
    const res = (await p) as TelegramShareResult
    expect(res).toEqual({ status: 'failed', reason: 'MESSAGE_SEND_FAILED', signal: 'event' })
  })

  it('F: MESSAGE_EXPIRED exact reason retained', async () => {
    const cap = installWebAppMock({ shareMessageImpl: (_id: string) => undefined })
    const adapter = createRealTelegram()
    const p = adapter.shareMessage!('prepared_f')
    await Promise.resolve()
    fire(cap.handlers, 'shareMessageFailed', { error: 'MESSAGE_EXPIRED' })
    const res = (await p) as TelegramShareResult
    expect(res).toEqual({ status: 'failed', reason: 'MESSAGE_EXPIRED', signal: 'event' })
  })

  it('G: UNKNOWN_ERROR exact reason retained', async () => {
    const cap = installWebAppMock({ shareMessageImpl: (_id: string) => undefined })
    const adapter = createRealTelegram()
    const p = adapter.shareMessage!('prepared_g')
    await Promise.resolve()
    fire(cap.handlers, 'shareMessageFailed', { error: 'UNKNOWN_ERROR' })
    const res = (await p) as TelegramShareResult
    expect(res).toEqual({ status: 'failed', reason: 'UNKNOWN_ERROR', signal: 'event' })
  })

  it('H: callback(false) + failure event during grace → event wins', async () => {
    const cap = installWebAppMock({
      shareMessageImpl: (_id: string, cb?: (ok: unknown) => void) => {
        cb?.(false)
        setTimeout(() => fire(cap.handlers, 'shareMessageFailed', { error: 'MESSAGE_SEND_FAILED' }), 100)
      },
    })
    const adapter = createRealTelegram()
    const res = (await adapter.shareMessage!('prepared_h')) as TelegramShareResult
    expect(res).toEqual({ status: 'failed', reason: 'MESSAGE_SEND_FAILED', signal: 'event' })
    expect(SHARE_CALLBACK_GRACE_MS).toBeGreaterThanOrEqual(250)
    expect(SHARE_CALLBACK_GRACE_MS).toBeLessThanOrEqual(500)
  })

  it('I: callback(false) + no event → callback_false', async () => {
    installWebAppMock({
      shareMessageImpl: (_id: string, cb?: (ok: unknown) => void) => {
        cb?.(false)
      },
    })
    const adapter = createRealTelegram()
    const res = (await adapter.shareMessage!('prepared_i')) as TelegramShareResult
    expect(res).toEqual({ status: 'failed', reason: 'callback_false', signal: 'callback' })
  })

  it('J: timeout → failed/timeout', async () => {
    vi.useFakeTimers()
    installWebAppMock({ shareMessageImpl: (_id: string) => undefined })
    const adapter = createRealTelegram()
    const p = adapter.shareMessage!('prepared_j')
    const assertion = expect(p).resolves.toEqual({ status: 'failed', reason: 'timeout', signal: 'timeout' })
    await vi.advanceTimersByTimeAsync(20_000)
    await assertion
  })

  it('K: listeners removed exactly once after settle', async () => {
    const cap = installWebAppMock({ shareMessageImpl: (_id: string) => undefined })
    const adapter = createRealTelegram()
    const p = adapter.shareMessage!('prepared_k')
    await Promise.resolve()
    const onCalls = cap.onEvent.mock.calls.length
    expect(onCalls).toBeGreaterThanOrEqual(2)
    fire(cap.handlers, 'shareMessageSent')
    await p
    // Each official registration removed once
    expect(cap.offEvent).toHaveBeenCalledTimes(onCalls)
    expect(cap.offEvent).toHaveBeenCalledWith('shareMessageSent', expect.any(Function))
    expect(cap.offEvent).toHaveBeenCalledWith('shareMessageFailed', expect.any(Function))
  })

  it('L: official Telegram.WebApp.onEvent is exercised', async () => {
    const cap = installWebAppMock({
      shareMessageImpl: (_id: string, cb?: (ok: unknown) => void) => {
        cb?.(true)
      },
    })
    const adapter = createRealTelegram()
    await adapter.shareMessage!('prepared_l')
    expect(cap.onEvent).toHaveBeenCalledWith('shareMessageSent', expect.any(Function))
    expect(cap.onEvent).toHaveBeenCalledWith('shareMessageFailed', expect.any(Function))
  })

  it('version < 8 → unsupported/client_version without bridge call', async () => {
    const shareSpy = vi.fn((_id: string) => undefined)
    installWebAppMock({ version: '7.2', shareMessageImpl: shareSpy })
    const adapter = createRealTelegram()
    const res = (await adapter.shareMessage!('prepared_v')) as TelegramShareResult
    expect(res).toEqual({ status: 'unsupported', reason: 'client_version', signal: 'version' })
    expect(shareSpy).not.toHaveBeenCalled()
  })
})

describe('Telegram transport — failure classification + single fallback', () => {
  function telegramAdapter(overrides: Record<string, any> = {}): any {
    return {
      platform: 'telegram',
      mode: 'telegram',
      getStartParam: () => null,
      getInitDataRaw: () => 'init_raw',
      getUser: () => null,
      haptic: () => {},
      getTelegramVersion: () => '8.0',
      ...overrides,
    }
  }

  function stubPrepareOk() {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(JSON.stringify({ ok: true, id: 'prepared_tg_1' }), { status: 200 }),
      ) as any,
    )
  }

  function setNavigatorShare(mock: any | undefined) {
    if (mock === undefined) {
      try {
        delete (navigator as any).share
      } catch {}
    } else {
      Object.defineProperty(navigator, 'share', { value: mock, configurable: true, writable: true })
    }
  }

  function setClipboard(mock: any | undefined) {
    if (mock === undefined) {
      try {
        delete (navigator as any).clipboard
      } catch {}
    } else {
      Object.defineProperty(navigator, 'clipboard', { value: mock, configurable: true, writable: true })
    }
  }

  function transportArgs(adapter: any, analytics: any) {
    const result = music90sQuiz.results.find((r) => r.id === 'm90_disco')!
    return {
      adapter,
      analytics,
      quizId: 'music90s',
      resultId: 'm90_disco',
      result,
      score: 12,
      total: 18,
      quizTitle: music90sQuiz.title,
    }
  }

  beforeEach(() => {
    stubPrepareOk()
  })

  afterEach(() => {
    setNavigatorShare(undefined)
    setClipboard(undefined)
  })

  it('USER_DECLINED → cancelled, no fallback mechanisms, share_cancelled only', async () => {
    const { analytics, events } = makeAnalytics()
    const openTelegramLink = vi.fn(() => true)
    const navShare = vi.fn(async () => {})
    setNavigatorShare(navShare)
    const writeText = vi.fn(async () => {})
    setClipboard({ writeText })
    const adapter = telegramAdapter({
      shareMessage: async (): Promise<TelegramShareResult> => ({
        status: 'cancelled',
        reason: 'USER_DECLINED',
        signal: 'event',
      }),
      openTelegramLink,
    })

    const outcome = await telegramShareTransport.shareResult(transportArgs(adapter, analytics))

    expect(outcome).toBe('cancelled')
    expect(openTelegramLink).not.toHaveBeenCalled()
    expect(navShare).not.toHaveBeenCalled()
    expect(writeText).not.toHaveBeenCalled()
    expect(count(events, 'share_cancelled')).toBe(1)
    expect(count(events, 'share_native_failed')).toBe(0)
    expect(count(events, 'share_success')).toBe(0)
  })

  it('MESSAGE_SEND_FAILED → openTelegramLink once, no further fallback', async () => {
    const { analytics, events } = makeAnalytics()
    const openTelegramLink = vi.fn(() => true)
    const navShare = vi.fn(async () => {})
    setNavigatorShare(navShare)
    const writeText = vi.fn(async () => {})
    setClipboard({ writeText })
    const adapter = telegramAdapter({
      shareMessage: async (): Promise<TelegramShareResult> => ({
        status: 'failed',
        reason: 'MESSAGE_SEND_FAILED',
        signal: 'event',
      }),
      openTelegramLink,
    })

    const outcome = await telegramShareTransport.shareResult(transportArgs(adapter, analytics))

    expect(outcome).toBe('opened')
    expect(openTelegramLink).toHaveBeenCalledTimes(1)
    const calledUrl = String((openTelegramLink.mock.calls[0] as unknown[])[0] ?? '')
    expect(calledUrl.startsWith('https://t.me/share/url?url=')).toBe(true)
    expect(calledUrl).toContain('&text=')
    expect(navShare).not.toHaveBeenCalled()
    expect(writeText).not.toHaveBeenCalled()
    expect(count(events, 'share_native_failed')).toBe(1)
    expect(events.find((e) => e.event === 'share_native_failed')?.payload.reason).toBe('MESSAGE_SEND_FAILED')
    expect(count(events, 'telegram_share_fallback_opened')).toBe(1)
    expect(count(events, 'share_success')).toBe(0)
  })

  it('openTelegramLink throws → navigator.share once', async () => {
    const { analytics, events } = makeAnalytics()
    const openTelegramLink = vi.fn(() => {
      throw new Error('tg link boom')
    })
    const navShare = vi.fn(async () => {})
    setNavigatorShare(navShare)
    const writeText = vi.fn(async () => {})
    setClipboard({ writeText })
    const adapter = telegramAdapter({
      shareMessage: async (): Promise<TelegramShareResult> => ({
        status: 'failed',
        reason: 'MESSAGE_SEND_FAILED',
        signal: 'event',
      }),
      openTelegramLink,
    })

    const outcome = await telegramShareTransport.shareResult(transportArgs(adapter, analytics))

    expect(openTelegramLink).toHaveBeenCalledTimes(1)
    expect(navShare).toHaveBeenCalledTimes(1)
    expect(outcome).toBe('opened')
    expect(writeText).not.toHaveBeenCalled()
    expect(count(events, 'share_native_failed')).toBe(1)
  })

  it('navigator.share rejects → clipboard.writeText once', async () => {
    const { analytics, events } = makeAnalytics()
    const navShare = vi.fn(async () => {
      throw new Error('user closed system sheet')
    })
    setNavigatorShare(navShare)
    const writeText = vi.fn(async () => {})
    setClipboard({ writeText })
    const adapter = telegramAdapter({
      shareMessage: async (): Promise<TelegramShareResult> => ({
        status: 'failed',
        reason: 'MESSAGE_EXPIRED',
        signal: 'event',
      }),
      // No openTelegramLink — unavailable
    })

    const outcome = await telegramShareTransport.shareResult(transportArgs(adapter, analytics))

    expect(navShare).toHaveBeenCalledTimes(1)
    expect(writeText).toHaveBeenCalledTimes(1)
    expect(outcome).toBe('fallback')
    expect(count(events, 'share_native_failed')).toBe(1)
  })

  it('confirmed sent → share_success, no fallback mechanisms', async () => {
    const { analytics, events } = makeAnalytics()
    const openTelegramLink = vi.fn(() => true)
    const navShare = vi.fn(async () => {})
    setNavigatorShare(navShare)
    const writeText = vi.fn(async () => {})
    setClipboard({ writeText })
    const adapter = telegramAdapter({
      shareMessage: async (): Promise<TelegramShareResult> => ({ status: 'sent', signal: 'event' }),
      openTelegramLink,
    })

    const outcome = await telegramShareTransport.shareResult(transportArgs(adapter, analytics))

    expect(outcome).toBe('native')
    expect(count(events, 'share_success')).toBe(1)
    expect(openTelegramLink).not.toHaveBeenCalled()
    expect(navShare).not.toHaveBeenCalled()
    expect(writeText).not.toHaveBeenCalled()
  })

  it('fallback URL format is official t.me/share/url', () => {
    const url = buildTelegramShareUrl('https://t.me/bot/app?startapp=quiz_music90s', 'hello world')
    expect(url.startsWith('https://t.me/share/url?url=')).toBe(true)
    expect(url).toContain(encodeURIComponent('https://t.me/bot/app?startapp=quiz_music90s'))
    expect(url).toContain(`text=${encodeURIComponent('hello world')}`)
  })

  it('legacy string failed normalizes without guessing USER_DECLINED', async () => {
    const { analytics, events } = makeAnalytics()
    const openTelegramLink = vi.fn(() => true)
    const adapter = telegramAdapter({
      shareMessage: async () => 'failed' as const,
      openTelegramLink,
    })
    setNavigatorShare(vi.fn(async () => {}))
    setClipboard({ writeText: vi.fn(async () => {}) })

    const outcome = await telegramShareTransport.shareResult(transportArgs(adapter, analytics))

    expect(outcome).toBe('opened')
    const nativeFailed = events.find((e) => e.event === 'share_native_failed')
    expect(nativeFailed).toBeDefined()
    expect(nativeFailed?.payload.reason).not.toBe('USER_DECLINED')
    expect(count(events, 'share_cancelled')).toBe(0)
  })
})
