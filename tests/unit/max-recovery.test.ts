/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest'
import { render, fireEvent, waitFor } from '@testing-library/react'
import React from 'react'
import { signMaxInitData } from '../../api/_lib/maxInitData'
import * as maxApi from '../../api/_lib/maxApi'
import * as maxMedia from '../../api/_lib/maxMedia'
import { maxShareTransport } from '@/platform/share/ShareTransport'
import { ShareButton } from '@/features/share/ShareButton'
import { deliverCompletedResultForPlatform } from '@/features/share/deliver'
import { music90sQuiz } from '@/content/quizzes/music90s/quiz'

const BOT_TOKEN = '123456:TEST_MAX_TOKEN_FOR_UNIT'
const APP_BASE_URL = 'https://example.com'
const MAX_BOT_USERNAME = 'test_bot'

function freshAuthDate(): number {
  return Math.floor(Date.now() / 1000)
}
function buildValidRaw(overrides: Record<string, string> = {}, token = BOT_TOKEN): string {
  const authDate = String(freshAuthDate())
  const base: Record<string, string> = {
    auth_date: authDate,
    query_id: 'test_query_123',
    user: JSON.stringify({ id: 424242, first_name: 'Макс', username: 'max_user' }),
    start_param: 'quiz_music90s',
    ...overrides,
  }
  if (overrides.auth_date) base.auth_date = overrides.auth_date
  return signMaxInitData(base, token)
}

// Helper to create mock Vercel res
function createMockRes() {
  const res: any = {
    statusCode: 200,
    body: null,
    status(code: number) {
      res.statusCode = code
      return res
    },
    json(payload: unknown) {
      res.body = payload
      return res
    },
  }
  return res
}

describe('MAX recovery — attempt-aware dedup (ROOT CAUSE A)', () => {
  beforeEach(() => {
    process.env.MAX_BOT_TOKEN = BOT_TOKEN
    process.env.APP_BASE_URL = APP_BASE_URL
    process.env.MAX_BOT_USERNAME = MAX_BOT_USERNAME
    vi.restoreAllMocks()
  })
  afterEach(() => {
    vi.restoreAllMocks()
    delete process.env.MAX_BOT_TOKEN
    delete process.env.APP_BASE_URL
    delete process.env.MAX_BOT_USERNAME
  })

  it('same user, same quiz, same result band, DIFFERENT completionId → sends new message each time', async () => {
    const handler = (await import('../../api/max/results/deliver')).default
    const spySend = vi.spyOn(maxApi, 'maxSendMessage').mockImplementation(async () => ({
      ok: true,
      mid: `mid_${Math.random().toString(36).slice(2)}`,
      status: 200,
    }))
    vi.spyOn(maxMedia, 'createMaxImageAttachment').mockResolvedValue({ attachment: null, via: 'none' as const })

    const raw = buildValidRaw()
    const score = 15 // maps to m90_legend (14-16)
    const resultId = 'm90_legend'

    const req1: any = { method: 'POST', body: { quizId: 'music90s', resultId, score, initDataRaw: raw, completionId: '550e8400-e29b-41d4-a716-446655440001' } }
    const res1 = createMockRes()
    await handler(req1, res1)
    expect(res1.body.ok).toBe(true)
    expect(res1.body.deliveredSelf).toBe(true)
    expect(res1.body.selfMid).toBeTruthy()
    const mid1 = res1.body.selfMid
    expect(spySend).toHaveBeenCalledTimes(1)

    const req2: any = { method: 'POST', body: { quizId: 'music90s', resultId, score, initDataRaw: raw, completionId: '550e8400-e29b-41d4-a716-446655440002' } }
    const res2 = createMockRes()
    await handler(req2, res2)
    expect(res2.body.ok).toBe(true)
    expect(res2.body.deliveredSelf).toBe(true)
    expect(res2.body.selfMid).toBeTruthy()
    // Different completionId → different mid, second send happened
    expect(spySend).toHaveBeenCalledTimes(2)
    expect(res2.body.selfMid).not.toBe(mid1)
  })

  it('same completionId repeated → no duplicate send (idempotent)', async () => {
    const handler = (await import('../../api/max/results/deliver')).default
    const spySend = vi.spyOn(maxApi, 'maxSendMessage').mockImplementation(async () => ({
      ok: true,
      mid: 'mid_same_attempt',
      status: 200,
    }))
    vi.spyOn(maxMedia, 'createMaxImageAttachment').mockResolvedValue({ attachment: null, via: 'none' as const })

    const raw = buildValidRaw()
    const completionId = '550e8400-e29b-41d4-a716-446655440099'
    const payload = { quizId: 'music90s', resultId: 'm90_legend', score: 15, initDataRaw: raw, completionId }

    const reqA: any = { method: 'POST', body: payload }
    const resA = createMockRes()
    await handler(reqA, resA)
    expect(resA.body.selfMid).toBe('mid_same_attempt')
    expect(spySend).toHaveBeenCalledTimes(1)

    const reqB: any = { method: 'POST', body: payload }
    const resB = createMockRes()
    await handler(reqB, resB)
    // dedup hit → no additional send, same mid returned
    expect(spySend).toHaveBeenCalledTimes(1)
    expect(resB.body.selfMid).toBe('mid_same_attempt')
    expect(resB.body.deliveredSelf).toBe(true)
  })

  it('failed send not cached — retry with same completionId attempts again', async () => {
    const handler = (await import('../../api/max/results/deliver')).default
    let call = 0
    const spySend = vi.spyOn(maxApi, 'maxSendMessage').mockImplementation(async () => {
      call++
      if (call === 1) return { ok: false, status: 500, errorCode: 'internal' }
      return { ok: true, mid: 'mid_retry', status: 200 }
    })
    vi.spyOn(maxMedia, 'createMaxImageAttachment').mockResolvedValue({ attachment: null, via: 'none' as const })

    const raw = buildValidRaw()
    const cid = '550e8400-e29b-41d4-a716-446655440100'
    const payload = { quizId: 'music90s', resultId: 'm90_legend', score: 15, initDataRaw: raw, completionId: cid }

    const req1: any = { method: 'POST', body: payload }
    const res1 = createMockRes()
    await handler(req1, res1)
    expect(res1.body.deliveredSelf).toBe(false)
    expect(res1.body.selfMid).toBeNull()
    expect(spySend).toHaveBeenCalledTimes(1)

    const req2: any = { method: 'POST', body: payload }
    const res2 = createMockRes()
    await handler(req2, res2)
    // second attempt should retry because first failed wasn't cached
    expect(spySend).toHaveBeenCalledTimes(2)
    expect(res2.body.deliveredSelf).toBe(true)
    expect(res2.body.selfMid).toBe('mid_retry')
  })
})

describe('MAX delivery returns real mid (section 4/5)', () => {
  beforeEach(() => {
    process.env.MAX_BOT_TOKEN = BOT_TOKEN
    process.env.APP_BASE_URL = APP_BASE_URL
    process.env.MAX_BOT_USERNAME = MAX_BOT_USERNAME
  })
  afterEach(() => {
    vi.restoreAllMocks()
    delete process.env.MAX_BOT_TOKEN
    delete process.env.APP_BASE_URL
    delete process.env.MAX_BOT_USERNAME
  })

  it('successful maxSendMessage → send via handler returns selfMid present', async () => {
    const handler = (await import('../../api/max/results/deliver')).default
    vi.spyOn(maxApi, 'maxSendMessage').mockResolvedValue({ ok: true, mid: 'real_mid_123', status: 200 })
    vi.spyOn(maxMedia, 'createMaxImageAttachment').mockResolvedValue({ attachment: null, via: 'none' as const })
    const raw = buildValidRaw()
    const res = createMockRes()
    await handler({ method: 'POST', body: { quizId: 'music90s', resultId: 'm90_legend', score: 15, initDataRaw: raw, completionId: 'cid_test_mid_success' } } as any, res)
    expect(res.body.ok).toBe(true)
    expect(res.body.deliveredSelf).toBe(true)
    expect(res.body.selfMid).toBe('real_mid_123')
  })

  it('failed send → deliveredSelf false, selfMid null', async () => {
    const handler = (await import('../../api/max/results/deliver')).default
    vi.spyOn(maxApi, 'maxSendMessage').mockResolvedValue({ ok: false, status: 502, errorCode: 'max_failure' })
    vi.spyOn(maxMedia, 'createMaxImageAttachment').mockResolvedValue({ attachment: null, via: 'none' as const })
    const raw = buildValidRaw()
    const res = createMockRes()
    await handler({ method: 'POST', body: { quizId: 'music90s', resultId: 'm90_legend', score: 15, initDataRaw: raw, completionId: 'cid_failed_mid' } } as any, res)
    expect(res.body.ok).toBe(true)
    expect(res.body.deliveredSelf).toBe(false)
    expect(res.body.selfMid).toBeNull()
  })

  it('MAX message succeeded but no valid mid → treated as no-mid diagnostic (deliveredSelf false)', async () => {
    const handler = (await import('../../api/max/results/deliver')).default
    // Simulate maxSendMessage returning ok true but mid missing (parse failure) → our sendMaxPhoto should treat as failure
    vi.spyOn(maxApi, 'maxSendMessage').mockResolvedValue({ ok: true, status: 200 } as any) // no mid
    vi.spyOn(maxMedia, 'createMaxImageAttachment').mockResolvedValue({ attachment: null, via: 'none' as const })
    const raw = buildValidRaw()
    const res = createMockRes()
    await handler({ method: 'POST', body: { quizId: 'music90s', resultId: 'm90_legend', score: 15, initDataRaw: raw, completionId: 'cid_no_mid_diag' } } as any, res)
    // sendMaxPhoto returns ok false due to missing mid, so deliveredSelf false
    expect(res.body.deliveredSelf).toBe(false)
    expect(res.body.selfMid).toBeNull()
  })
})

describe('MAX share transport — first tap synchronous (section 9/22)', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    maxShareTransport.clearCache()
    // need to stub navigator.clipboard etc not needed
  })
  afterEach(() => {
    vi.restoreAllMocks()
    maxShareTransport.clearCache()
    // clean window.WebApp mock
    try { delete (globalThis as any).WebApp } catch {}
    try { delete (window as any).WebApp } catch {}
  })

  it('when selfMid cached, shareMaxContent called synchronously before any fetch', async () => {
    const fetchSpy = vi.fn(async () => {
      throw new Error('fetch should not be called on cached path')
    })
    vi.stubGlobal('fetch', fetchSpy as any)

    const completionId = 'cid_first_tap_sync'
    const mid = 'mid_cached_for_first_tap'
    maxShareTransport.setPreparedMid({ quizId: 'music90s', resultId: 'm90_legend', score: 15, mid, completionId })

    const shareCalls: any[] = []
    const mockWebApp = {
      initData: 'x',
      initDataUnsafe: {},
      platform: 'android',
      version: '1',
      shareMaxContent: vi.fn((p: any) => shareCalls.push(p)),
    }
    ;(globalThis as any).WebApp = mockWebApp
    ;(window as any).WebApp = mockWebApp

    const mockAdapter: any = {
      platform: 'max',
      mode: 'max',
      getStartParam: () => null,
      getInitDataRaw: () => 'init_raw',
      getUser: () => ({ id: 1, firstName: 'Test' }),
      haptic: () => {},
    }
    const mockAnalytics: any = { track: vi.fn(), trackOnce: vi.fn() }
    const quiz = music90sQuiz
    const result = quiz.results.find(r => r.id === 'm90_legend')!

    const promise = maxShareTransport.shareResult({
      adapter: mockAdapter,
      analytics: mockAnalytics,
      quizId: 'music90s',
      resultId: 'm90_legend',
      result,
      score: 15,
      total: 18,
      quizTitle: quiz.title,
      completionId,
    })

    // shareMaxContent should have been called synchronously (before promise resolves fully, but after calling shareResult the mock should have been invoked without awaiting fetch)
    // Since shareResult is async, we need to await it, but we assert fetchSpy never called
    const outcome = await promise
    expect(outcome).toBe('native')
    expect(shareCalls.length).toBe(1)
    expect(shareCalls[0]).toEqual({ mid, chatType: 'DIALOG' })
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('/api/max/share/prepare NOT called in normal cached-mid path', async () => {
    const fetchSpy = vi.fn(async () => new Response(JSON.stringify({ ok: true, mid: 'should_not_be_used' }), { status: 200 }))
    vi.stubGlobal('fetch', fetchSpy as any)
    maxShareTransport.clearCache()
    const cid = 'cid_no_prepare'
    const mid = 'mid_cached_no_prepare'
    maxShareTransport.setPreparedMid({ quizId: 'music90s', resultId: 'm90_legend', score: 15, mid, completionId: cid })
    const mockWebApp = {
      initData: 'x',
      initDataUnsafe: {},
      platform: 'android',
      version: '1',
      shareMaxContent: vi.fn(),
    }
    ;(globalThis as any).WebApp = mockWebApp
    const mockAdapter: any = {
      platform: 'max',
      mode: 'max',
      getStartParam: () => null,
      getInitDataRaw: () => 'init',
      getUser: () => ({ id: 1, firstName: 'Test' }),
      haptic: () => {},
    }
    const mockAnalytics: any = { track: vi.fn(), trackOnce: vi.fn() }
    const result = music90sQuiz.results.find(r => r.id === 'm90_legend')!
    await maxShareTransport.shareResult({
      adapter: mockAdapter,
      analytics: mockAnalytics,
      quizId: 'music90s',
      resultId: 'm90_legend',
      result,
      score: 15,
      quizTitle: music90sQuiz.title,
      total: 18,
      completionId: cid,
    })
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})

describe('MAX button readiness (section 10/23)', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    maxShareTransport.clearCache()
  })
  afterEach(() => vi.restoreAllMocks())

  it('before mid ready: button disabled label Готовим карточку…', async () => {
    const result = music90sQuiz.results.find(r => r.id === 'm90_legend')!
    const mockAdapter: any = {
      platform: 'max',
      mode: 'max',
      getInitDataRaw: () => 'init',
      getStartParam: () => null,
      getUser: () => ({ id: 1, firstName: 'Test' }),
      haptic: () => {},
    }
    const { container } = render(
      React.createElement(ShareButton, {
        quizId: 'music90s',
        resultId: 'm90_legend',
        shareCta: 'Бросить вызов',
        shareCtaIntro: 'intro',
        score: 15,
        total: 18,
        quizTitle: music90sQuiz.title,
        result,
        adapter: mockAdapter,
        completionId: 'cid_button_pending',
        maxMid: null,
        maxPending: true,
      })
    )
    const btn = container.querySelector('[data-testid="share-button"]') as HTMLButtonElement
    expect(btn.disabled).toBe(true)
    expect(btn.textContent).toContain('Готовим карточку')
  })

  it('after mid ready: button enabled label Бросить вызов', async () => {
    const result = music90sQuiz.results.find(r => r.id === 'm90_legend')!
    const mockAdapter: any = {
      platform: 'max',
      mode: 'max',
      getInitDataRaw: () => 'init',
      getStartParam: () => null,
      getUser: () => ({ id: 1, firstName: 'Test' }),
      haptic: () => {},
    }
    const { container } = render(
      React.createElement(ShareButton, {
        quizId: 'music90s',
        resultId: 'm90_legend',
        shareCta: 'Бросить вызов',
        shareCtaIntro: 'intro',
        score: 15,
        total: 18,
        quizTitle: music90sQuiz.title,
        result,
        adapter: mockAdapter,
        completionId: 'cid_button_ready',
        maxMid: 'mid_ready',
        maxPending: false,
      })
    )
    const btn = container.querySelector('[data-testid="share-button"]') as HTMLButtonElement
    expect(btn.disabled).toBe(false)
    expect(btn.textContent).toContain('Бросить вызов')
  })

  it('after Bridge invocation MAX must NOT show Отправлено ✓', async () => {
    const result = music90sQuiz.results.find(r => r.id === 'm90_legend')!
    const mockAdapter: any = {
      platform: 'max',
      mode: 'max',
      getInitDataRaw: () => 'init',
      getStartParam: () => null,
      getUser: () => ({ id: 1, firstName: 'Test' }),
      haptic: () => {},
    }
    // Ensure transport has cached mid so click is synchronous
    const cid = 'cid_after_bridge'
    const mid = 'mid_after_bridge'
    maxShareTransport.setPreparedMid({ quizId: 'music90s', resultId: 'm90_legend', score: 15, mid, completionId: cid })
    const mockWebApp = {
      initData: 'x',
      initDataUnsafe: {},
      platform: 'android',
      version: '1',
      shareMaxContent: vi.fn(),
    }
    ;(globalThis as any).WebApp = mockWebApp
    ;(window as any).WebApp = mockWebApp

    const { container } = render(
      React.createElement(ShareButton, {
        quizId: 'music90s',
        resultId: 'm90_legend',
        shareCta: 'Бросить вызов',
        shareCtaIntro: 'intro',
        score: 15,
        total: 18,
        quizTitle: music90sQuiz.title,
        result,
        adapter: mockAdapter,
        completionId: cid,
        maxMid: mid,
        maxPending: false,
      })
    )
    const btn = container.querySelector('[data-testid="share-button"]') as HTMLButtonElement
    await fireEvent.click(btn)
    // Wait a tick for async handleClick
    await waitFor(() => expect(btn.textContent).not.toContain('Отправляем'))
    // After native, MAX should return to Бросить вызов, not Отправлено ✓
    expect(btn.textContent).toContain('Бросить вызов')
    expect(btn.textContent).not.toContain('Отправлено')
  })

  it('Telegram regression: existing button behavior remains unchanged (shows Отправлено ✓)', async () => {
    const result = music90sQuiz.results.find(r => r.id === 'm90_legend')!
    const mockTelegram: any = {
      platform: 'telegram',
      mode: 'telegram',
      getInitDataRaw: () => 'init_telegram',
      getStartParam: () => null,
      getUser: () => ({ id: 1, firstName: 'Test' }),
      haptic: () => {},
      shareMessage: vi.fn(async () => 'sent'),
    }
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ ok: true, id: 'prepared_123' }), { status: 200 })) as any)
    const { container } = render(
      React.createElement(ShareButton, {
        quizId: 'music90s',
        resultId: 'm90_legend',
        shareCta: 'Бросить вызов',
        shareCtaIntro: 'intro',
        score: 15,
        total: 18,
        quizTitle: music90sQuiz.title,
        result,
        adapter: mockTelegram,
      })
    )
    const btn = container.querySelector('[data-testid="share-button"]') as HTMLButtonElement
    await fireEvent.click(btn)
    await waitFor(() => expect(btn.textContent).toContain('Отправлено'))
    expect(btn.textContent).toContain('Отправлено ✓')
  })
})

describe('No second bot message on normal share (section 11/24)', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    maxShareTransport.clearCache()
  })
  afterEach(() => vi.restoreAllMocks())

  it('completion delivery returns selfMid → share click does not call /api/max/share/prepare', async () => {
    const fetchSpy = vi.fn(async (url: string) => {
      // Should not be called for share prepare
      if (String(url).includes('/api/max/share/prepare')) {
        throw new Error('should not call prepare on cached path')
      }
      return new Response(JSON.stringify({ ok: true, mid: 'mid_from_deliver' }), { status: 200 })
    })
    // But we won't actually call deliver here; we simulate App flow: deliver gave mid, setPreparedMid
    const cid = 'cid_no_second_msg'
    const mid = 'mid_from_deliver'
    maxShareTransport.setPreparedMid({ quizId: 'music90s', resultId: 'm90_legend', score: 15, mid, completionId: cid })
    vi.stubGlobal('fetch', fetchSpy as any)
    const mockWebApp = { initData: 'x', initDataUnsafe: {}, platform: 'android', version: '1', shareMaxContent: vi.fn() }
    ;(globalThis as any).WebApp = mockWebApp
    ;(window as any).WebApp = mockWebApp
    const mockAdapter: any = {
      platform: 'max',
      mode: 'max',
      getStartParam: () => null,
      getInitDataRaw: () => 'init',
      getUser: () => ({ id: 1, firstName: 'Test' }),
      haptic: () => {},
    }
    const mockAnalytics: any = { track: vi.fn(), trackOnce: vi.fn() }
    const result = music90sQuiz.results.find(r => r.id === 'm90_legend')!
    await maxShareTransport.shareResult({
      adapter: mockAdapter,
      analytics: mockAnalytics,
      quizId: 'music90s',
      resultId: 'm90_legend',
      result,
      score: 15,
      total: 18,
      quizTitle: music90sQuiz.title,
      completionId: cid,
    })
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})

describe('client delivery includes completionId and parses selfMid', () => {
  afterEach(() => vi.unstubAllGlobals())
  it('deliverCompletedResultForPlatform sends completionId and extracts selfMid', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ ok: true, deliveredSelf: true, deliveredSharer: false, selfMid: 'mid_client_parsed' }), { status: 200 })
    )
    vi.stubGlobal('fetch', fetchMock)
    const res = await deliverCompletedResultForPlatform('max', 'music90s', 'm90_legend', 'init_raw', 15, 'cid_client_test')
    expect(res).toEqual({ ok: true, deliveredSelf: true, deliveredSharer: false, selfMid: 'mid_client_parsed' })
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/max/results/deliver',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ quizId: 'music90s', resultId: 'm90_legend', score: 15, initDataRaw: 'init_raw', completionId: 'cid_client_test' }),
      })
    )
  })
})

describe('MaxShareTransport cache key includes score and completionId (section 8)', () => {
  beforeEach(() => {
    maxShareTransport.clearCache()
  })
  it('different score not reused, different completionId not reused', () => {
    maxShareTransport.setPreparedMid({ quizId: 'music90s', resultId: 'm90_legend', score: 15, mid: 'mid_15', completionId: 'cid_a' })
    expect(maxShareTransport.getCachedMid('music90s', 'm90_legend', 15, 'cid_a')).toBe('mid_15')
    // same score but different completionId → not reused
    expect(maxShareTransport.getCachedMid('music90s', 'm90_legend', 15, 'cid_b')).toBeNull()
    // different score same completionId → not reused
    expect(maxShareTransport.getCachedMid('music90s', 'm90_legend', 14, 'cid_a')).toBeNull()
    // same everything → reused
    expect(maxShareTransport.getCachedMid('music90s', 'm90_legend', 15, 'cid_a')).toBe('mid_15')
  })
  it('on restart old prepared mid must not be reused (completionId changes)', () => {
    const cid1 = 'cid_restart_1'
    const cid2 = 'cid_restart_2'
    maxShareTransport.setPreparedMid({ quizId: 'music90s', resultId: 'm90_legend', score: 15, mid: 'mid_old', completionId: cid1 })
    // simulate restart clearing? Actually we test that without clear, different cid not reused
    expect(maxShareTransport.getCachedMid('music90s', 'm90_legend', 15, cid2)).toBeNull()
    // after clear, nothing
    maxShareTransport.clearCache()
    expect(maxShareTransport.getCachedMid('music90s', 'm90_legend', 15, cid1)).toBeNull()
  })
})

describe('v4 regression + copy unchanged', () => {
  it('assetVersion remains v4 and score cards resolve to v4', async () => {
    const { resolveShareCardAsset, shareCardImageUrl } = await import('@/features/quiz/scoring')
    const r = music90sQuiz.results.find(x => x.id === 'm90_legend')!
    const asset = resolveShareCardAsset(music90sQuiz, r, 15)
    expect(asset).toBe('m90_score_15')
    expect(shareCardImageUrl(music90sQuiz, asset, 'https://example.com')).toBe('https://example.com/share-cards/v4/m90_score_15.jpg')
    expect(music90sQuiz.share?.assetVersion).toBe('v4')
  })
  it('14-16 band copy is дискотека not главред (sticker fix)', () => {
    const r = music90sQuiz.results.find(x => x.id === 'm90_legend')!
    expect(r.presentation.shareQuote).toContain('королева школьной дискотеки')
    expect(r.presentation.shareQuote).not.toContain('главред')
  })
})
