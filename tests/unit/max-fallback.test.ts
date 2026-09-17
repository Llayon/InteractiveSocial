/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, fireEvent, waitFor } from '@testing-library/react'
import { signMaxInitData } from '../../api/_lib/maxInitData'
import * as maxApi from '../../api/_lib/maxApi'
import * as maxMedia from '../../api/_lib/maxMedia'
import { maxShareTransport } from '@/platform/share/ShareTransport'
import { ShareButton } from '@/features/share/ShareButton'
import { deliverCompletedResultForPlatform } from '@/features/share/deliver'
import { music90sQuiz } from '@/content/quizzes/music90s/quiz'

const BOT_TOKEN = '123456:TEST_MAX_TOKEN_FOR_FALLBACK'
const APP_BASE_URL = 'https://example.com'
const MAX_BOT_USERNAME = 'test_bot'

function buildValidRaw(overrides: Record<string, string> = {}, token = BOT_TOKEN): string {
  const authDate = String(Math.floor(Date.now() / 1000))
  const base: Record<string, string> = {
    auth_date: authDate,
    query_id: 'test_query_fallback',
    user: JSON.stringify({ id: 777001, first_name: 'Test', username: 't' }),
    start_param: 'quiz_music90s',
    ...overrides,
  }
  return signMaxInitData(base, token)
}

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

function maxAdapter(): any {
  return {
    platform: 'max',
    mode: 'max',
    getStartParam: () => null,
    getInitDataRaw: () => 'init_raw',
    getUser: () => ({ id: 777001, firstName: 'Test' }),
    haptic: () => {},
  }
}

describe('MAX deliver observability — error propagation (dialog.not.found)', () => {
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

  it('404 dialog.not.found propagates selfErrorCode/selfStatus/selfVia', async () => {
    const handler = (await import('../../api/max/results/deliver')).default
    vi.spyOn(maxApi, 'maxSendMessage').mockResolvedValue({
      ok: false,
      status: 404,
      errorCode: 'dialog.not.found',
      errorMessage: 'Dialog not found',
    })
    vi.spyOn(maxMedia, 'createMaxImageAttachment').mockResolvedValue({
      attachment: { type: 'image', payload: { url: 'https://example.com/share-cards/v4/m90_score_12.jpg' } } as any,
      via: 'url' as const,
    })
    const raw = buildValidRaw()
    const res = createMockRes()
    await handler(
      { method: 'POST', body: { quizId: 'music90s', resultId: 'm90_disco', score: 12, initDataRaw: raw, completionId: 'cid_dialog_not_found_1' } } as any,
      res,
    )
    expect(res.body.ok).toBe(true)
    expect(res.body.deliveredSelf).toBe(false)
    expect(res.body.selfMid).toBeNull()
    expect(res.body.selfErrorCode).toBe('dialog.not.found')
    expect(res.body.selfStatus).toBe(404)
    expect(res.body.selfVia).toBe('url')
  })

  it('200 + valid mid still returns mid with no error fields', async () => {
    const handler = (await import('../../api/max/results/deliver')).default
    vi.spyOn(maxApi, 'maxSendMessage').mockResolvedValue({ ok: true, mid: 'mid_ok_1', status: 200 })
    vi.spyOn(maxMedia, 'createMaxImageAttachment').mockResolvedValue({ attachment: null, via: 'none' as const })
    const raw = buildValidRaw()
    const res = createMockRes()
    await handler(
      { method: 'POST', body: { quizId: 'music90s', resultId: 'm90_disco', score: 12, initDataRaw: raw, completionId: 'cid_dialog_ok_1' } } as any,
      res,
    )
    expect(res.body.deliveredSelf).toBe(true)
    expect(res.body.selfMid).toBe('mid_ok_1')
  })

  it('200 ok but missing mid → max_mid_missing with status', async () => {
    const handler = (await import('../../api/max/results/deliver')).default
    vi.spyOn(maxApi, 'maxSendMessage').mockResolvedValue({ ok: true, status: 200 } as any)
    vi.spyOn(maxMedia, 'createMaxImageAttachment').mockResolvedValue({ attachment: null, via: 'none' as const })
    const raw = buildValidRaw()
    const res = createMockRes()
    await handler(
      { method: 'POST', body: { quizId: 'music90s', resultId: 'm90_disco', score: 12, initDataRaw: raw, completionId: 'cid_mid_missing_1' } } as any,
      res,
    )
    expect(res.body.deliveredSelf).toBe(false)
    expect(res.body.selfMid).toBeNull()
    expect(res.body.selfErrorCode).toBe('max_mid_missing')
    expect(res.body.selfStatus).toBe(200)
  })

  it('client parses selfErrorCode/selfStatus/selfVia', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({ ok: true, deliveredSelf: false, deliveredSharer: false, selfMid: null, selfErrorCode: 'dialog.not.found', selfStatus: 404, selfVia: 'url' }),
        { status: 200 },
      ),
    )
    vi.stubGlobal('fetch', fetchMock)
    const res = await deliverCompletedResultForPlatform('max', 'music90s', 'm90_disco', 'init_raw', 12, 'cid_client_parse')
    expect(res.ok).toBe(true)
    if (res.ok) {
      expect(res.deliveredSelf).toBe(false)
      expect((res as any).selfErrorCode).toBe('dialog.not.found')
      expect((res as any).selfStatus).toBe(404)
      expect((res as any).selfVia).toBe('url')
    }
    vi.unstubAllGlobals()
  })
})

describe('MAX ShareButton readiness — fallback-ready never stuck', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    maxShareTransport.clearCache()
  })
  afterEach(() => {
    vi.restoreAllMocks()
    maxShareTransport.clearCache()
    try { delete (globalThis as any).WebApp } catch {}
    try { delete (window as any).WebApp } catch {}
    vi.unstubAllGlobals()
  })

  it('preparing → disabled, label Готовим карточку…', () => {
    const result = music90sQuiz.results.find((r) => r.id === 'm90_disco')!
    const { container } = render(
      React.createElement(ShareButton, {
        quizId: 'music90s',
        resultId: 'm90_disco',
        shareCta: 'Бросить вызов',
        shareCtaIntro: 'intro',
        score: 12,
        total: 18,
        quizTitle: music90sQuiz.title,
        result,
        adapter: maxAdapter(),
        completionId: 'cid_ready_prep',
        maxMid: null,
        maxPending: true,
        maxReadiness: 'preparing',
      }),
    )
    const btn = container.querySelector('[data-testid="share-button"]') as HTMLButtonElement
    expect(btn.disabled).toBe(true)
    expect(btn.textContent).toContain('Готовим карточку')
  })

  it('fallback-ready → enabled with normal CTA (never stuck)', () => {
    const result = music90sQuiz.results.find((r) => r.id === 'm90_disco')!
    const { container } = render(
      React.createElement(ShareButton, {
        quizId: 'music90s',
        resultId: 'm90_disco',
        shareCta: 'Бросить вызов',
        shareCtaIntro: 'intro',
        score: 12,
        total: 18,
        quizTitle: music90sQuiz.title,
        result,
        adapter: maxAdapter(),
        completionId: 'cid_ready_fb',
        maxMid: null,
        maxPending: false,
        maxReadiness: 'fallback-ready',
      }),
    )
    const btn = container.querySelector('[data-testid="share-button"]') as HTMLButtonElement
    expect(btn.disabled).toBe(false)
    expect(btn.textContent).toContain('Бросить вызов')
  })

  it('media-ready → enabled', () => {
    const result = music90sQuiz.results.find((r) => r.id === 'm90_disco')!
    const { container } = render(
      React.createElement(ShareButton, {
        quizId: 'music90s',
        resultId: 'm90_disco',
        shareCta: 'Бросить вызов',
        shareCtaIntro: 'intro',
        score: 12,
        total: 18,
        quizTitle: music90sQuiz.title,
        result,
        adapter: maxAdapter(),
        completionId: 'cid_ready_media',
        maxMid: 'mid_x',
        maxPending: false,
        maxReadiness: 'media-ready',
      }),
    )
    const btn = container.querySelector('[data-testid="share-button"]') as HTMLButtonElement
    expect(btn.disabled).toBe(false)
    expect(btn.textContent).toContain('Бросить вызов')
  })

  it('click fallback-ready → shareMaxContent({text,link}), no mid, no prepare fetch', async () => {
    const result = music90sQuiz.results.find((r) => r.id === 'm90_disco')!
    const fetchSpy = vi.fn(async () => {
      throw new Error('prepare must not be called in forceFallback path')
    })
    vi.stubGlobal('fetch', fetchSpy as any)
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

    const { container } = render(
      React.createElement(ShareButton, {
        quizId: 'music90s',
        resultId: 'm90_disco',
        shareCta: 'Бросить вызов',
        shareCtaIntro: 'intro',
        score: 12,
        total: 18,
        quizTitle: music90sQuiz.title,
        result,
        adapter: maxAdapter(),
        completionId: 'cid_click_fb',
        maxMid: null,
        maxPending: false,
        maxReadiness: 'fallback-ready',
      }),
    )
    const btn = container.querySelector('[data-testid="share-button"]') as HTMLButtonElement
    await fireEvent.click(btn)
    await waitFor(() => expect(shareCalls.length).toBe(1))
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(shareCalls[0]).toHaveProperty('link')
    expect(shareCalls[0]).not.toHaveProperty('mid')
  })

  it('click media-ready with cached mid → shareMaxContent({mid})', async () => {
    const result = music90sQuiz.results.find((r) => r.id === 'm90_disco')!
    const cid = 'cid_click_media'
    const mid = 'mid_click_media'
    maxShareTransport.setPreparedMid({ quizId: 'music90s', resultId: 'm90_disco', score: 12, mid, completionId: cid })
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
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('no fetch on cached path') }) as any)

    const { container } = render(
      React.createElement(ShareButton, {
        quizId: 'music90s',
        resultId: 'm90_disco',
        shareCta: 'Бросить вызов',
        shareCtaIntro: 'intro',
        score: 12,
        total: 18,
        quizTitle: music90sQuiz.title,
        result,
        adapter: maxAdapter(),
        completionId: cid,
        maxMid: mid,
        maxPending: false,
        maxReadiness: 'media-ready',
      }),
    )
    const btn = container.querySelector('[data-testid="share-button"]') as HTMLButtonElement
    await fireEvent.click(btn)
    await waitFor(() => expect(shareCalls.length).toBe(1))
    expect(shareCalls[0]).toEqual({ mid, chatType: 'DIALOG' })
  })

  it('legacy props without readiness keep old behavior (pending → disabled)', () => {
    const result = music90sQuiz.results.find((r) => r.id === 'm90_disco')!
    const { container } = render(
      React.createElement(ShareButton, {
        quizId: 'music90s',
        resultId: 'm90_disco',
        shareCta: 'Бросить вызов',
        shareCtaIntro: 'intro',
        score: 12,
        total: 18,
        quizTitle: music90sQuiz.title,
        result,
        adapter: maxAdapter(),
        completionId: 'cid_legacy',
        maxMid: null,
        maxPending: true,
      }),
    )
    const btn = container.querySelector('[data-testid="share-button"]') as HTMLButtonElement
    expect(btn.disabled).toBe(true)
  })
})
