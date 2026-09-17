/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, vi } from 'vitest'
import { runMaxAutoDelivery } from '@/features/share/maxAutoDelivery'
import {
  TERMINAL_MAX_DELIVERY_ERRORS,
  shouldSkipMaxPrePrepare,
} from '@/platform/share/ShareTransport'
import type { DeliverResult } from '@/features/share/deliver'

function mockAnalytics() {
  return { track: vi.fn(), trackOnce: vi.fn() } as any
}

function mockTransport(prePrepareImpl?: () => Promise<string | null>) {
  return {
    setPreparedMid: vi.fn(),
    prePrepare: vi.fn(prePrepareImpl ?? (async () => null)),
  } as any
}

const BASE = {
  quizId: 'music90s',
  resultId: 'm90_disco',
  score: 12,
  initDataRaw: 'init_raw',
  completionId: 'cid_auto_delivery',
}

function eventsOf(analytics: any): string[] {
  return analytics.track.mock.calls.map((c: any[]) => String(c[0]))
}

function payloadOf(analytics: any, event: string): Record<string, unknown> {
  const call = analytics.track.mock.calls.find((c: any[]) => c[0] === event)
  return (call?.[1] ?? {}) as Record<string, unknown>
}

describe('shouldSkipMaxPrePrepare — canonical terminal decision', () => {
  it('skips only the proven terminal error', () => {
    expect(shouldSkipMaxPrePrepare('dialog.not.found')).toBe(true)
  })

  it('keeps recoverable errors on the prePrepare path', () => {
    expect(shouldSkipMaxPrePrepare('network_error')).toBe(false)
    expect(shouldSkipMaxPrePrepare('max_mid_missing')).toBe(false)
    expect(shouldSkipMaxPrePrepare('attachment_error')).toBe(false)
    expect(shouldSkipMaxPrePrepare('http_500')).toBe(false)
    expect(shouldSkipMaxPrePrepare('no_mid')).toBe(false)
    expect(shouldSkipMaxPrePrepare(undefined)).toBe(false)
    expect(shouldSkipMaxPrePrepare('')).toBe(false)
    expect(shouldSkipMaxPrePrepare('dialog.not_found')).toBe(false)
  })

  it('terminal set contains only the production-proven error', () => {
    expect([...TERMINAL_MAX_DELIVERY_ERRORS]).toEqual(['dialog.not.found'])
  })
})

describe('runMaxAutoDelivery — Case A: terminal dialog.not.found', () => {
  it('no prePrepare, immediate fallback-ready, fallback_ready emitted once', async () => {
    const analytics = mockAnalytics()
    const transport = mockTransport()
    const deliverFn = vi.fn(async (): Promise<DeliverResult> => ({
      ok: true,
      deliveredSelf: false,
      deliveredSharer: false,
      selfMid: null,
      selfErrorCode: 'dialog.not.found',
      selfStatus: 404,
      selfVia: 'url',
    }))

    const outcome = await runMaxAutoDelivery({ ...BASE, analytics, deliverFn, transport })

    expect(deliverFn).toHaveBeenCalledTimes(1)
    expect(transport.prePrepare).not.toHaveBeenCalled()
    expect(transport.setPreparedMid).not.toHaveBeenCalled()
    expect(outcome.readiness).toBe('fallback-ready')
    expect(outcome.mid).toBeNull()
    expect(outcome.skippedPrePrepare).toBe(true)
    expect(typeof outcome.deliveryElapsedMs).toBe('number')

    const events = eventsOf(analytics)
    expect(events).toContain('max_result_delivery_failed')
    expect(events.filter((e) => e === 'max_share_fallback_ready')).toHaveLength(1)
    expect(events).not.toContain('max_share_mid_ready')
    expect(events).not.toContain('max_prepare_success')

    expect(payloadOf(analytics, 'max_result_delivery_failed')).toMatchObject({
      quiz_id: 'music90s',
      result_id: 'm90_disco',
      platform: 'max',
      reason: 'dialog.not.found',
      status: 404,
      media_via: 'url',
    })
    expect(payloadOf(analytics, 'max_share_fallback_ready')).toMatchObject({
      quiz_id: 'music90s',
      result_id: 'm90_disco',
      platform: 'max',
      reason: 'dialog.not.found',
    })
  })
})

describe('runMaxAutoDelivery — Case B: recoverable error, prePrepare recovers', () => {
  it('prePrepare called, media-ready on mid', async () => {
    const analytics = mockAnalytics()
    const transport = mockTransport(async () => 'mid_recovered')
    const deliverFn = vi.fn(async (): Promise<DeliverResult> => ({
      ok: true,
      deliveredSelf: false,
      deliveredSharer: false,
      selfMid: null,
      selfErrorCode: 'network_error',
      selfStatus: 0,
      selfVia: 'url',
    }))

    const outcome = await runMaxAutoDelivery({ ...BASE, analytics, deliverFn, transport })

    expect(transport.prePrepare).toHaveBeenCalledTimes(1)
    // Parity with legacy QuizApp flow: the real transport caches the mid
    // inside prePrepare itself, so no explicit setPreparedMid call here.
    expect(transport.setPreparedMid).not.toHaveBeenCalled()
    expect(outcome.readiness).toBe('media-ready')
    expect(outcome.mid).toBe('mid_recovered')
    expect(outcome.skippedPrePrepare).toBe(false)
    expect(payloadOf(analytics, 'max_share_mid_ready')).toMatchObject({ fallback: true })
    expect(eventsOf(analytics)).not.toContain('max_share_fallback_ready')
  })
})

describe('runMaxAutoDelivery — Case C: recoverable error, prePrepare fails', () => {
  it('falls back after the single recovery attempt', async () => {
    const analytics = mockAnalytics()
    const transport = mockTransport(async () => null)
    const deliverFn = vi.fn(async (): Promise<DeliverResult> => ({
      ok: false,
      code: 'http_502',
    }))

    const outcome = await runMaxAutoDelivery({ ...BASE, analytics, deliverFn, transport })

    expect(transport.prePrepare).toHaveBeenCalledTimes(1)
    expect(outcome.readiness).toBe('fallback-ready')
    expect(outcome.mid).toBeNull()
    expect(outcome.skippedPrePrepare).toBe(false)
    expect(payloadOf(analytics, 'max_result_delivery_failed')).toMatchObject({ reason: 'http_502' })
    expect(payloadOf(analytics, 'max_share_fallback_ready')).toMatchObject({ reason: 'http_502' })
    expect(eventsOf(analytics)).not.toContain('max_share_mid_ready')
  })
})

describe('runMaxAutoDelivery — Case D: success with mid unchanged', () => {
  it('no prePrepare, media-ready, mid_ready emitted', async () => {
    const analytics = mockAnalytics()
    const transport = mockTransport()
    const deliverFn = vi.fn(async (): Promise<DeliverResult> => ({
      ok: true,
      deliveredSelf: true,
      deliveredSharer: false,
      selfMid: 'mid_direct',
    }))

    const outcome = await runMaxAutoDelivery({ ...BASE, analytics, deliverFn, transport })

    expect(transport.prePrepare).not.toHaveBeenCalled()
    expect(transport.setPreparedMid).toHaveBeenCalledWith({
      quizId: 'music90s',
      resultId: 'm90_disco',
      score: 12,
      mid: 'mid_direct',
      completionId: 'cid_auto_delivery',
    })
    expect(outcome.readiness).toBe('media-ready')
    expect(outcome.mid).toBe('mid_direct')
    const events = eventsOf(analytics)
    expect(events).toContain('max_result_delivery_success')
    expect(events).toContain('max_share_mid_ready')
    expect(events).not.toContain('max_share_fallback_ready')
  })
})

describe('runMaxAutoDelivery — deliver throw stays best-effort', () => {
  it('exception still attempts one prePrepare, then falls back', async () => {
    const analytics = mockAnalytics()
    const transport = mockTransport(async () => null)
    const deliverFn = vi.fn(async (): Promise<DeliverResult> => {
      throw new Error('aborted')
    })

    const outcome = await runMaxAutoDelivery({ ...BASE, analytics, deliverFn, transport })

    expect(transport.prePrepare).toHaveBeenCalledTimes(1)
    expect(outcome.readiness).toBe('fallback-ready')
    expect(payloadOf(analytics, 'max_result_delivery_failed')).toMatchObject({ reason: 'exception' })
    expect(payloadOf(analytics, 'max_share_fallback_ready')).toMatchObject({ reason: 'exception' })
  })
})
