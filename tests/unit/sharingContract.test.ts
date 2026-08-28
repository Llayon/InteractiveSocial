import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  buildFallbackShareUrl,
  prepareShareMessage,
  shareResult,
  type PrepareShareResult,
} from '@/features/share/share'
import { interiorCharacterQuiz } from '@/content/quizzes/interior-character/quiz'
import type { Analytics } from '@/analytics/analytics'
import { music90sQuiz } from '@/content/quizzes/music90s/quiz'
import type { TelegramAdapter } from '@/platform/telegram'

/**
 * Sharing regression suite.
 *
 * The original regression: prepared photo cards stopped reaching real
 * Telegram recipients, while ShareButton still showed "Sent". Root cause
 * was a callback handler that assumed the WebApp.shareMessage callback
 * argument was { ok: boolean }. Per current Bot API the callback is a
 * raw boolean (or undefined on clients that do not call it). The old code
 * resolved `undefined` to "sent", masking the failure.
 *
 * These tests pin the corrected contract so a future regression is
 * caught by CI without needing a real device.
 */

interface AnalyticsEvent {
  event: string
  payload: Record<string, unknown>
}

function makeAnalytics(): { analytics: Analytics; events: AnalyticsEvent[] } {
  const events: AnalyticsEvent[] = []
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

function makeTelegram(overrides: Partial<TelegramAdapter> = {}): TelegramAdapter {
  return {
    mode: 'telegram',
    ready: () => undefined,
    expand: () => undefined,
    getStartParam: () => null,
    getUser: () => null,
    getInitDataRaw: () => 'valid.init.data',
    haptic: () => undefined,
    shareMessage: () => Promise.resolve('unsupported'),
    ...overrides,
  }
}

describe('buildFallbackShareUrl returns a t.me deep link, never a raw Vercel URL', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_TELEGRAM_BOT_USERNAME', 'takeiteasybefore')
    vi.stubEnv('VITE_TELEGRAM_APP_SHORT_NAME', 'app')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('returns a t.me deep link with the share_ start_param when bot username is configured', () => {
    const { url, usable } = buildFallbackShareUrl('quiet')
    expect(usable).toBe(true)
    expect(url).toBe('https://t.me/takeiteasybefore/app?startapp=share_quiet')
    expect(url).not.toContain('vercel.app')
  })
})

describe('shareResult: native share outcome contract', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
  })

  it('Interior: prepare returns valid photo result and analytics fires share_success', async () => {
    const interiorResult = interiorCharacterQuiz.results[0]
    const fakeFetch = vi.fn<(input: RequestInfo, init?: RequestInit) => Promise<Response>>(async () =>
      new Response(JSON.stringify({ ok: true, id: 'prepared_interior' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    )
    vi.stubGlobal('fetch', fakeFetch)

    const { analytics, events } = makeAnalytics()
    const telegram = makeTelegram({
      shareMessage: () => Promise.resolve('sent' as const),
    })

    const outcome = await shareResult({
      telegram,
      analytics,
      quizId: interiorCharacterQuiz.id,
      resultId: interiorResult.id,
      result: interiorResult,
    })

    expect(outcome).toBe('native')
    expect(events.find((e) => e.event === 'share_success')).toBeDefined()
    expect(events.find((e) => e.event === 'share_prepare_failed')).toBeUndefined()
    expect(events.find((e) => e.event === 'share_native_failed')).toBeUndefined()
  })

  it('Music90s: prepare builds a score photo result, native success', async () => {
    const m90 = music90sQuiz.results[0]
    const fakeFetch = vi.fn<(input: RequestInfo, init?: RequestInit) => Promise<Response>>(async () =>
      new Response(JSON.stringify({ ok: true, id: 'prepared_music_07' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    )
    vi.stubGlobal('fetch', fakeFetch)

    const { analytics, events } = makeAnalytics()
    const telegram = makeTelegram({
      shareMessage: () => Promise.resolve('sent' as const),
    })

    const outcome = await shareResult({
      telegram,
      analytics,
      quizId: music90sQuiz.id,
      resultId: m90.id,
      result: m90,
      score: 7,
      total: music90sQuiz.questions.length,
      quizTitle: music90sQuiz.title,
    })

    expect(outcome).toBe('native')
    const click = events.find((e) => e.event === 'share_click')
    expect(click?.payload.score).toBe(7)
    expect(events.find((e) => e.event === 'share_success')).toBeDefined()

    const sentBody = JSON.parse((fakeFetch.mock.calls[0]?.[1] as unknown as { body?: string } | undefined)?.body ?? '')
    expect(sentBody).toMatchObject({
      quizId: 'music90s',
      resultId: 'm90_rookie',
      score: 7,
    })
  })

  it('Bot API failure does NOT report native success; analytics fires share_prepare_failed', async () => {
    const interiorResult = interiorCharacterQuiz.results[0]
    const fakeFetch = vi.fn<(input: RequestInfo, init?: RequestInit) => Promise<Response>>(async () =>
      new Response(JSON.stringify({ ok: false, error: 'telegram_failure' }), {
        status: 502,
        headers: { 'content-type': 'application/json' },
      }),
    )
    vi.stubGlobal('fetch', fakeFetch)

    const { analytics, events } = makeAnalytics()
    const telegram = makeTelegram({
      shareMessage: () => Promise.resolve('sent' as const),
    })

    const outcome = await shareResult({
      telegram,
      analytics,
      quizId: interiorCharacterQuiz.id,
      resultId: interiorResult.id,
      result: interiorResult,
    })

    expect(outcome).not.toBe('native')
    expect(events.find((e) => e.event === 'share_prepare_failed')).toBeDefined()
    expect(events.find((e) => e.event === 'share_success')).toBeUndefined()
  })

  it('callback false fires share_native_failed and returns failed', async () => {
    const interiorResult = interiorCharacterQuiz.results[0]
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(JSON.stringify({ ok: true, id: 'p' }), { status: 200 }),
      ),
    )
    const { analytics, events } = makeAnalytics()
    const telegram = makeTelegram({
      shareMessage: () => Promise.resolve('failed' as const),
    })
    const outcome = await shareResult({
      telegram,
      analytics,
      quizId: interiorCharacterQuiz.id,
      resultId: interiorResult.id,
      result: interiorResult,
    })
    expect(outcome).toBe('failed')
    expect(events.find((e) => e.event === 'share_native_failed')).toBeDefined()
    expect(events.find((e) => e.event === 'share_success')).toBeUndefined()
  })

  it('plain-web browser: no fetch call, outcome is fallback', async () => {
    const interiorResult = interiorCharacterQuiz.results[0]
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    vi.stubEnv('VITE_TELEGRAM_BOT_USERNAME', 'takeiteasybefore')
    const { analytics, events } = makeAnalytics()
    const telegram = makeTelegram({ mode: 'browser' })
    const outcome = await shareResult({
      telegram,
      analytics,
      quizId: interiorCharacterQuiz.id,
      resultId: interiorResult.id,
      result: interiorResult,
    })
    expect(outcome).toBe('fallback')
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(events.find((e) => e.event === 'share_failed')).toBeDefined()
  })
})

describe('prepareShareMessage body contract', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('Interior: includes quizId, resultId, initDataRaw; no score field', async () => {
    const captured: { init: RequestInit }[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: RequestInit) => {
        captured.push({ init })
        return new Response(JSON.stringify({ ok: true, id: 'p' }), { status: 200 })
      }),
    )
    const r: PrepareShareResult = await prepareShareMessage(
      'interior-character',
      'quiet',
      'init.data',
    )
    expect(r.ok).toBe(true)
    const body = JSON.parse(captured[0]!.init.body as string)
    expect(body).toEqual({
      quizId: 'interior-character',
      resultId: 'quiet',
      initDataRaw: 'init.data',
    })
  })

  it('Music90s: includes quizId, resultId, score, initDataRaw', async () => {
    const captured: { init: RequestInit }[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: RequestInit) => {
        captured.push({ init })
        return new Response(JSON.stringify({ ok: true, id: 'p' }), { status: 200 })
      }),
    )
    const r = await prepareShareMessage('music90s', 'm90_disco', 'init', 8)
    expect(r.ok).toBe(true)
    const body = JSON.parse(captured[0]!.init.body as string)
    expect(body).toEqual({
      quizId: 'music90s',
      resultId: 'm90_disco',
      score: 8,
      initDataRaw: 'init',
    })
  })
})
