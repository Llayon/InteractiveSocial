import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createAnalytics, __resetAnalyticsForTests, getAnalytics, initAnalytics } from '@/analytics/analytics'

describe('analytics facade regression', () => {
  beforeEach(() => {
    __resetAnalyticsForTests()
    vi.restoreAllMocks()
  })

  it('trackOnce does not duplicate lifecycle events (React StrictMode safe)', () => {
    const calls: Array<{ event: string }> = []
    const provider = { track: (event: string) => calls.push({ event }) }
    const analytics = createAnalytics({ provider })
    analytics.trackOnce('app_open', 'app_open')
    analytics.trackOnce('app_open', 'app_open')
    analytics.trackOnce('app_open', 'app_open')
    expect(calls).toHaveLength(1)
  })

  it('trackOnce deduplicates per key, not per event', () => {
    const calls: string[] = []
    const provider = { track: (event: string) => calls.push(event) }
    const analytics = createAnalytics({ provider })
    analytics.trackOnce('key1', 'app_open')
    analytics.trackOnce('key2', 'app_open')
    expect(calls).toHaveLength(2)
  })

  it('getAnalytics singleton and initAnalytics replacement', () => {
    const p1 = { track: vi.fn() }
    initAnalytics({ provider: p1, baseContext: { platform: 'max' } })
    getAnalytics().track('quiz_start', { quiz_id: 'music90s' })
    expect(p1.track).toHaveBeenCalledTimes(1)

    const p2 = { track: vi.fn() }
    initAnalytics({ provider: p2, baseContext: { platform: 'browser' } })
    getAnalytics().track('quiz_start', { quiz_id: 'music90s' })
    expect(p2.track).toHaveBeenCalledTimes(1)
    expect(p1.track).toHaveBeenCalledTimes(1)
  })

  it('baseContext is attached to every event', () => {
    const received: Array<Record<string, unknown>> = []
    const provider = { track: (_e: string, p: Record<string, unknown>) => received.push(p) }
    const analytics = createAnalytics({ provider, baseContext: { platform: 'max', anonymous_id: 'anon-1', session_id: 'sess-1' } })
    analytics.track('quiz_start', { quiz_id: 'music90s' })
    expect(received[0]).toMatchObject({ platform: 'max', anonymous_id: 'anon-1', session_id: 'sess-1', quiz_id: 'music90s' })
  })

  it('updateContext merges and is used for subsequent events', () => {
    const received: Array<Record<string, unknown>> = []
    const provider = { track: (_e: string, p: Record<string, unknown>) => received.push(p) }
    const analytics = createAnalytics({ provider, baseContext: { platform: 'browser' } })
    analytics.updateContext({ platform: 'max', anonymous_id: 'anon-2' })
    analytics.track('app_open', {})
    expect(received[0]).toMatchObject({ platform: 'max', anonymous_id: 'anon-2' })
  })

  it('provider throw never breaks UX', () => {
    const bad = { track: () => { throw new Error('boom') } }
    const analytics = createAnalytics({ provider: bad })
    expect(() => analytics.track('quiz_start', {})).not.toThrow()
    expect(() => analytics.trackOnce('k', 'quiz_start', {})).not.toThrow()
  })

  it('existing events payload example maps correctly to PostHog via handler', async () => {
    // Simulate getAnalytics().track('quiz_start', {quiz_id:'music90s'}) with bootstrap context
    const received: Array<{ event: string; payload: Record<string, unknown> }> = []
    const mockProvider = {
      track: (event: string, payload: Record<string, unknown>) => received.push({ event, payload }),
    }
    const analytics = createAnalytics({
      provider: mockProvider,
      baseContext: { platform: 'max', anonymous_id: 'anon-test', session_id: 'sess-test', source: 'channel' },
    })
    analytics.track('quiz_start', { quiz_id: 'music90s' })
    expect(received[0].event).toBe('quiz_start')
    expect(received[0].payload).toMatchObject({
      quiz_id: 'music90s',
      platform: 'max',
      source: 'channel',
      anonymous_id: 'anon-test',
      session_id: 'sess-test',
    })
  })
})
