import { beforeEach, describe, expect, it, vi } from 'vitest'
import { __sendAnalyticsEventForTests, ANALYTICS_ENDPOINT, httpAnalyticsProvider, compositeProvider } from '@/analytics/httpProvider'
import { createAnalytics, consoleProvider, __resetAnalyticsForTests } from '@/analytics/analytics'

describe('httpAnalyticsProvider', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    __resetAnalyticsForTests()
  })

  it('sends correct event name and properties via POST to same-origin /api/analytics', async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetchMock)

    await __sendAnalyticsEventForTests('quiz_start', { quiz_id: 'music90s', platform: 'max' }, fetchMock as unknown as typeof fetch)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe(ANALYTICS_ENDPOINT)
    expect(url).toBe('/api/analytics')
    expect(init?.method).toBe('POST')
    expect((init?.headers as Record<string, string>)?.['content-type']).toBe('application/json')
    const body = JSON.parse(init?.body as string)
    expect(body.event).toBe('quiz_start')
    expect(body.properties.quiz_id).toBe('music90s')
    expect(body.properties.platform).toBe('max')
  })

  it('uses POST and JSON content type', async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 204 }))
    await __sendAnalyticsEventForTests('question_answered', { question_id: 'm1' }, fetchMock as unknown as typeof fetch)
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(init?.method).toBe('POST')
    expect((init?.headers as Record<string, string>)['content-type']).toBe('application/json')
  })

  it('sets keepalive true', async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 204 }))
    await __sendAnalyticsEventForTests('app_open', {}, fetchMock as unknown as typeof fetch)
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit & { keepalive?: boolean }]
    expect(init?.keepalive).toBe(true)
  })

  it('provider track is fire-and-forget and does not throw on fetch rejection', () => {
    const failingFetch = vi.fn(async () => { throw new Error('network down') })
    vi.stubGlobal('fetch', failingFetch as unknown as typeof fetch)

    expect(() => httpAnalyticsProvider.track('quiz_start', { quiz_id: 'music90s' })).not.toThrow()
    // Even if fetch rejects, track should not create unhandled rejection that breaks UX
    // The provider wraps send in void and swallows
  })

  it('provider failure never breaks product UX (facade swallows provider throw)', () => {
    const throwingProvider = {
      track: () => { throw new Error('provider explode') },
    }
    const analytics = createAnalytics({ provider: throwingProvider })
    expect(() => analytics.track('quiz_start', { quiz_id: 'music90s' })).not.toThrow()
    expect(() => analytics.track('question_answered', {})).not.toThrow()
  })

  it('network rejection does not create unhandled error (swallowed)', async () => {
    const fetchMock = vi.fn(async () => { throw new Error('net') })
    // __sendAnalyticsEventForTests swallows? Actually it does not swallow, it propagates? The internal sendAnalyticsEvent does swallow.
    // Test via provider.track which should swallow
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch)
    expect(() => httpAnalyticsProvider.track('result_view', { quiz_id: 'music90s' })).not.toThrow()
    // Give microtask chance
    await new Promise((r) => setTimeout(r, 10))
    expect(fetchMock).toHaveBeenCalled()
  })

  it('compositeProvider fans out to both providers and tolerates one failure', () => {
    const calls: string[] = []
    const p1 = { track: (e: string) => calls.push(`p1:${e}`) }
    const p2 = { track: () => { throw new Error('p2 fail') } }
    const composite = compositeProvider(p1, p2)
    expect(() => composite.track('quiz_start', {})).not.toThrow()
    expect(calls).toEqual(['p1:quiz_start'])
  })

  it('consoleProvider remains functional (does not throw)', () => {
    expect(() => consoleProvider.track('quiz_start', { quiz_id: 'music90s' })).not.toThrow()
  })

  it('tracks via analytics facade automatically uses provider without call-site changes', () => {
    const received: Array<{ event: string; payload: Record<string, unknown> }> = []
    const mockProvider = { track: (e: string, p: Record<string, unknown>) => received.push({ event: e, payload: p }) }
    const analytics = createAnalytics({ provider: mockProvider, baseContext: { platform: 'max' } })
    analytics.track('quiz_start', { quiz_id: 'music90s' })
    expect(received).toHaveLength(1)
    expect(received[0].event).toBe('quiz_start')
    expect(received[0].payload.quiz_id).toBe('music90s')
    expect(received[0].payload.platform).toBe('max')
  })
})
