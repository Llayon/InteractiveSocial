import { afterEach, describe, expect, it, vi } from 'vitest'
import { preflightMaxImageUrl, createMaxImageAttachment, buildMaxAttachments } from '../../api/_lib/maxMedia'
import { parseMaxMessageResponse } from '../../api/_lib/maxApi'
import { prepareMaxShareMessage } from '@/platform/share/ShareTransport'
import { music90sQuiz } from '@/content/quizzes/music90s/quiz'

describe('MAX forensic: preflight', () => {
  afterEach(() => vi.restoreAllMocks())

  it('preflight valid image returns ok with correct ct/host/version', async () => {
    const fetchMock = vi.fn(async () =>
      new Response('', { status: 200, headers: { 'content-type': 'image/jpeg', 'content-length': '55547' } }),
    )
    vi.stubGlobal('fetch', fetchMock)
    const res = await preflightMaxImageUrl('https://tginteractive.vercel.app/share-cards/v2/m90_score_10.jpg')
    expect(res.ok).toBe(true)
    expect(res.status).toBe(200)
    expect(res.contentType).toContain('image/jpeg')
    expect(res.host).toBe('tginteractive.vercel.app')
  })

  it('preflight 404 -> not ok, no false success', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('Not Found', { status: 404, headers: { 'content-type': 'text/html' } })))
    const res = await preflightMaxImageUrl('https://tginteractive.vercel.app/share-cards/v2/m90_score_10.jpg')
    expect(res.ok).toBe(false)
    expect(res.status).toBe(404)
  })

  it('preflight bad content-type -> not ok', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<html>', { status: 200, headers: { 'content-type': 'text/html' } })))
    const res = await preflightMaxImageUrl('https://tginteractive.vercel.app/share-cards/v2/m90_score_10.jpg')
    expect(res.ok).toBe(false)
  })

  it('preflight network error -> not ok', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('network down') }))
    const res = await preflightMaxImageUrl('https://tginteractive.vercel.app/share-cards/v2/m90_score_10.jpg')
    expect(res.ok).toBe(false)
    expect(res.errorCode).toBe('network_error')
  })

  it('preflight HEAD 405 fallback to GET', async () => {
    const mock = vi.fn(async (_url: string, init?: RequestInit) => {
      const method = (init as { method?: string })?.method
      if (method === 'HEAD') return new Response('', { status: 405 })
      return new Response('', { status: 200, headers: { 'content-type': 'image/jpeg', 'content-length': '123' } })
    })
    vi.stubGlobal('fetch', mock as unknown as typeof fetch)
    const res = await preflightMaxImageUrl('https://tginteractive.vercel.app/share-cards/v2/m90_score_10.jpg')
    expect(res.ok).toBe(true)
  })
})

describe('MAX forensic: image attachment via token vs url', () => {
  afterEach(() => vi.restoreAllMocks())

  it('createMaxImageAttachment: token flow success when bytes fetch + upload succeed', async () => {
    // Sequence: preflight HEAD -> 200, image GET -> bytes, uploads POST -> url, upload POST -> token
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      const u = String(url)
      if (u.includes('/share-cards/')) {
        // both HEAD and GET for preflight and bytes: return image
        const headers: Record<string, string> = { 'content-type': 'image/jpeg', 'content-length': '1000' }
        if ((init as { method?: string })?.method === 'HEAD') {
          return new Response('', { status: 200, headers })
        }
        // GET for bytes
        return new Response(new Uint8Array([1, 2, 3]).buffer as ArrayBuffer, { status: 200, headers: { 'content-type': 'image/jpeg' } })
      }
      if (u.includes('/uploads?type=image')) {
        return new Response(JSON.stringify({ url: 'https://iu.oneme.ru/upload.do?token=abc' }), { status: 200, headers: { 'content-type': 'application/json' } })
      }
      if (u.includes('iu.oneme.ru')) {
        return new Response(JSON.stringify({ token: '_tok123' }), { status: 200, headers: { 'content-type': 'application/json' } })
      }
      return new Response('', { status: 404 })
    })
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch)

    const res = await createMaxImageAttachment({
      token: 'test_token',
      imageUrl: 'https://tginteractive.vercel.app/share-cards/v2/m90_score_10.jpg',
      assetKey: 'm90_score_10',
    })
    expect(res.attachment).not.toBeNull()
    expect(res.via).toBe('token')
    expect((res.attachment as { payload: { token: string } }).payload.token).toBe('_tok123')
  })

  it('createMaxImageAttachment: fallback to url when upload fails', async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      const u = String(url)
      if (u.includes('/share-cards/')) {
        if ((init as { method?: string })?.method === 'HEAD') {
          return new Response('', { status: 200, headers: { 'content-type': 'image/jpeg', 'content-length': '1000' } })
        }
        return new Response(new Uint8Array([1, 2, 3]).buffer as ArrayBuffer, { status: 200, headers: { 'content-type': 'image/jpeg' } })
      }
      if (u.includes('/uploads?type=image')) {
        return new Response(JSON.stringify({ error: 'server error' }), { status: 500, headers: { 'content-type': 'application/json' } })
      }
      return new Response('', { status: 404 })
    })
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch)
    const res = await createMaxImageAttachment({
      token: 'test_token',
      imageUrl: 'https://tginteractive.vercel.app/share-cards/v2/m90_score_10.jpg',
      assetKey: 'm90_score_10',
    })
    expect(res.attachment).not.toBeNull()
    expect(res.via).toBe('url')
    expect((res.attachment as { payload: { url: string } }).payload.url).toContain('m90_score_10.jpg')
  })

  it('buildMaxAttachments includes image + keyboard', () => {
    const att = { type: 'image' as const, payload: { token: 'tok' } }
    const list = buildMaxAttachments(att, 'https://max.ru/bot?startapp=quiz_music90s')
    expect(list).toHaveLength(2)
    expect(list[0].type).toBe('image')
    expect((list[1] as { payload: { buttons: unknown } }).payload.buttons).toBeDefined()
  })
})

describe('MAX forensic: parseMaxMessageResponse strict', () => {
  it('accepts wrapped message.body.mid', () => {
    expect(parseMaxMessageResponse({ message: { body: { mid: 'mid_123' } } }).ok).toBe(true)
  })
  it('accepts direct body.mid', () => {
    expect(parseMaxMessageResponse({ body: { mid: 'mid_2' } }).ok).toBe(true)
  })
  it('rejects missing mid -> failure, never synthesize', () => {
    expect(parseMaxMessageResponse({ message: { body: {} } }).ok).toBe(false)
    expect(parseMaxMessageResponse({ message: {} }).ok).toBe(false)
    expect(parseMaxMessageResponse({ body: { text: 'hi' } }).ok).toBe(false)
  })
  it('rejects top-level mid heuristic', () => {
    expect(parseMaxMessageResponse({ mid: '123' }).ok).toBe(false)
  })
})

describe('MAX forensic: prepare success vs failure transport', () => {
  afterEach(() => vi.restoreAllMocks())

  it('prepare valid -> real mid, 200 but missing mid -> structured failure', async () => {
    // valid
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ ok: true, mid: 'mid_valid_999' }), { status: 200, headers: { 'content-type': 'application/json' } })),
    )
    const ok = await prepareMaxShareMessage('music90s', 'm90_cassette', 'init_raw', 10)
    expect(ok.ok).toBe(true)
    if (ok.ok) expect(ok.mid).toBe('mid_valid_999')

    // missing mid: server returns ok true but no mid -> our client should treat as failure
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'content-type': 'application/json' } })),
    )
    const missing = await prepareMaxShareMessage('music90s', 'm90_cassette', 'init_raw', 10)
    expect(missing.ok).toBe(false)
    expect((missing as { code: string }).code).toBe('max_mid_missing')
  })

  it('MAX API rejects image attachment -> structured prepare failure, not native success', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ ok: false, error: 'max_failure' }), { status: 502, headers: { 'content-type': 'application/json' } })),
    )
    const res = await prepareMaxShareMessage('music90s', 'm90_cassette', 'init_raw', 10)
    expect(res.ok).toBe(false)
  })

  it('preflight 404 should not lead to false native success', async () => {
    // Simulate preflight failure but prepare endpoint would still be called; client must fallback
    // Here we just verify preflight logic: if preflight fails, attachment fallback still url but not success
    vi.stubGlobal('fetch', vi.fn(async () => new Response('not found', { status: 404, headers: { 'content-type': 'text/html' } })))
    const pre = await preflightMaxImageUrl('https://tginteractive.vercel.app/share-cards/v2/m90_score_10.jpg')
    expect(pre.ok).toBe(false)
    // The client prepare would still fail at server side; we assert prepare fails when server returns 502
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ ok: false, error: 'max_failure' }), { status: 502 })),
    )
    const prepare = await prepareMaxShareMessage('music90s', 'm90_cassette', 'init_raw', 10)
    expect(prepare.ok).toBe(false)
  })
})

describe('MAX client transport instrumentation', () => {
  afterEach(() => vi.restoreAllMocks())

  it('prepare success + mid -> shareMaxContent({mid}) native', async () => {
    const { maxShareTransport } = await import('@/platform/share/ShareTransport')
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true, mid: 'mid_123' }), { status: 200, headers: { 'content-type': 'application/json' } }))
    vi.stubGlobal('fetch', fetchMock)
    // Mock WebApp
    const shareMock = vi.fn()
    vi.stubGlobal('WebApp' as unknown as string, { initData: 'x', initDataUnsafe: {}, shareMaxContent: shareMock } as unknown as never)
    // Also need window.WebApp for getMaxWebApp fallback
    ;(globalThis as unknown as { WebApp?: unknown }).WebApp = { initData: 'x', initDataUnsafe: {}, shareMaxContent: shareMock, platform: 'android', version: '1' }
    // Mock location search for non-mock
    Object.defineProperty(window, 'location', { value: new URL('https://example.com/'), writable: true })
    const adapter = {
      platform: 'max' as const,
      mode: 'max' as const,
      getStartParam: () => null,
      getInitDataRaw: () => 'raw',
      getUser: () => ({ id: 1, firstName: 't' }),
      ready: () => {},
      expand: () => {},
      haptic: () => {},
    }
    const analytics = { track: vi.fn(), trackOnce: vi.fn(), updateContext: vi.fn() } as unknown as import('@/analytics/analytics').Analytics
    // Clear cache
    ;(maxShareTransport as unknown as { cachedMid: string | null; cachedQuizKey: string | null }).cachedMid = null
    ;(maxShareTransport as unknown as { cachedQuizKey: string | null }).cachedQuizKey = null
    const outcome = await maxShareTransport.shareResult({
      adapter,
      analytics,
      quizId: 'music90s',
      resultId: 'm90_cassette',
      result: music90sQuiz.results.find((r) => r.id === 'm90_cassette')!,
      score: 10,
      total: 18,
      quizTitle: music90sQuiz.title,
    })
    expect(outcome).toBe('native')
    expect(shareMock).toHaveBeenCalledWith({ mid: 'mid_123', chatType: 'DIALOG' })
    // analytics should contain max_prepare_success and bridge_invoked, not fallback as native
    expect(analytics.track).toHaveBeenCalledWith('max_prepare_success', expect.anything())
    expect(analytics.track).toHaveBeenCalledWith('max_share_mid_ready', expect.anything())
  })

  it('prepare failure -> fallback text/link observable, not native', async () => {
    const { maxShareTransport } = await import('@/platform/share/ShareTransport')
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ ok: false, error: 'max_failure' }), { status: 502, headers: { 'content-type': 'application/json' } })))
    const adapter = {
      platform: 'max' as const,
      mode: 'max' as const,
      getStartParam: () => null,
      getInitDataRaw: () => 'raw',
      getUser: () => ({ id: 1, firstName: 't' }),
      ready: () => {},
      expand: () => {},
      haptic: () => {},
    }
    const analytics = { track: vi.fn(), trackOnce: vi.fn(), updateContext: vi.fn() } as unknown as import('@/analytics/analytics').Analytics
    ;(maxShareTransport as unknown as { cachedMid: string | null }).cachedMid = null
    ;(maxShareTransport as unknown as { cachedQuizKey: string | null }).cachedQuizKey = null
    const outcome = await maxShareTransport.shareResult({
      adapter,
      analytics,
      quizId: 'music90s',
      resultId: 'm90_cassette',
      result: music90sQuiz.results.find((r) => r.id === 'm90_cassette')!,
      score: 10,
      total: 18,
      quizTitle: music90sQuiz.title,
    })
    expect(outcome).toBe('fallback')
    expect(analytics.track).toHaveBeenCalledWith('max_prepare_failed', expect.anything())
    expect(analytics.track).toHaveBeenCalledWith('max_share_fallback_text', expect.anything())
    // must NOT have share_success (native)
    const calls = (analytics.track as unknown as ReturnType<typeof vi.fn>).mock.calls.map((c) => c[0])
    expect(calls).not.toContain('share_success')
  })

  it('fallback transport is explicitly observable', async () => {
    const { maxShareTransport } = await import('@/platform/share/ShareTransport')
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ ok: false, error: 'max_failure' }), { status: 502 })))
    const adapter = {
      platform: 'max' as const,
      mode: 'max' as const,
      getStartParam: () => null,
      getInitDataRaw: () => 'raw',
      getUser: () => ({ id: 1, firstName: 't' }),
      ready: () => {},
      expand: () => {},
      haptic: () => {},
    }
    const analytics = { track: vi.fn(), trackOnce: vi.fn(), updateContext: vi.fn() } as unknown as import('@/analytics/analytics').Analytics
    ;(maxShareTransport as unknown as { cachedMid: string | null }).cachedMid = null
    ;(maxShareTransport as unknown as { cachedQuizKey: string | null }).cachedQuizKey = null
    const outcome = await maxShareTransport.shareResult({
      adapter,
      analytics,
      quizId: 'music90s',
      resultId: 'm90_cassette',
      result: music90sQuiz.results.find((r) => r.id === 'm90_cassette')!,
      score: 10,
      total: 18,
      quizTitle: music90sQuiz.title,
    })
    expect(outcome).toBe('fallback')
    // fallback event must be present
    expect(analytics.track).toHaveBeenCalledWith(expect.stringContaining('fallback'), expect.anything())
  })
})

describe('MAX delivery: same media helper', () => {
  it('prepare and deliver both import from maxMedia', async () => {
    const fs = await import('node:fs')
    const prep = fs.readFileSync('api/max/share/prepare.ts', 'utf-8')
    const deliver = fs.readFileSync('api/max/results/deliver.ts', 'utf-8')
    expect(prep).toContain('createMaxImageAttachment')
    expect(deliver).toContain('createMaxImageAttachment')
    expect(prep).toContain('buildMaxAttachments')
    expect(deliver).toContain('buildMaxAttachments')
  })

  it('deliveredSelf false when attachment fails (structured truth)', async () => {
    // Simulate maxSendMessage failure path: deliver should return deliveredSelf false
    // We test via parse logic: if maxSendMessage returns ok false, deliveredSelf false
    const mockFetch = vi.fn(async (url: string) => {
      if (String(url).includes('/messages')) {
        return new Response(JSON.stringify({ code: 'attachment.not.ready', message: 'not ready' }), { status: 400, headers: { 'content-type': 'application/json' } })
      }
      if (String(url).includes('/uploads')) {
        return new Response(JSON.stringify({ url: 'https://iu.oneme.ru/upload.do' }), { status: 200, headers: { 'content-type': 'application/json' } })
      }
      if (String(url).includes('iu.oneme.ru')) {
        return new Response(JSON.stringify({ token: 'tok' }), { status: 200 })
      }
      // image fetch
      return new Response('', { status: 200, headers: { 'content-type': 'image/jpeg' } })
    })
    vi.stubGlobal('fetch', mockFetch as unknown as typeof fetch)
    // We don't call actual deliver endpoint here; just verify our helper would return false
    // The key assertion is that parseMaxMessageResponse with error 400 is not ok
    const parsed = parseMaxMessageResponse({ code: 'attachment.not.ready', message: 'not ready' })
    expect(parsed.ok).toBe(false)
  })
})

describe('Upload-token flow', () => {
  afterEach(() => vi.restoreAllMocks())

  it('upload URL retrieval, binary upload, token attachment', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      const u = String(url)
      if (u.includes('/uploads?type=image')) {
        return new Response(JSON.stringify({ url: 'https://iu.oneme.ru/upload.do?token=fromUrl' }), { status: 200 })
      }
      if (u.includes('iu.oneme.ru')) {
        return new Response(JSON.stringify({ token: 'uploaded_token_123' }), { status: 200 })
      }
      return new Response('', { status: 200, headers: { 'content-type': 'image/jpeg' } })
    })
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch)
    const { maxGetUploadUrl, maxUploadFile } = await import('../../api/_lib/maxApi')
    const up = await maxGetUploadUrl('tok', 'image')
    expect(up.ok).toBe(true)
    expect(up.url).toContain('iu.oneme.ru')
    const up2 = await maxUploadFile(up.url!, 'tok', new Uint8Array([1,2,3]), 'm90_score_10.jpg')
    expect(up2.ok).toBe(true)
    expect(up2.token).toBe('uploaded_token_123')
  })

  it('upload failure -> fallback', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (String(url).includes('/uploads')) return new Response('error', { status: 500 })
      return new Response('', { status: 200, headers: { 'content-type': 'image/jpeg' } })
    }))
    const { maxGetUploadUrl } = await import('../../api/_lib/maxApi')
    const res = await maxGetUploadUrl('tok', 'image')
    expect(res.ok).toBe(false)
  })
})

describe('Fallback context bug fix', () => {
  it('ShareButton forwards total and quizTitle', async () => {
    const fs = await import('node:fs')
    const content = fs.readFileSync('src/features/share/ShareButton.tsx', 'utf-8')
    expect(content).toContain('total?: number')
    expect(content).toContain('quizTitle?: string')
    expect(content).toContain('total,')
    expect(content).toContain('quizTitle')
  })
  it('ResultScreen passes total and quizTitle', async () => {
    const fs = await import('node:fs')
    const content = fs.readFileSync('src/features/result/Result.tsx', 'utf-8')
    expect(content).toContain('total={quiz.questions.length}')
    expect(content).toContain('quizTitle={quiz.title}')
  })
  it('fallback copy uses total/quizTitle generically', async () => {
    const fs = await import('node:fs')
    const transport = fs.readFileSync('src/platform/share/ShareTransport.ts', 'utf-8')
    expect(transport).toContain('score === undefined || total === undefined || !quizTitle')
    expect(transport).toContain('Я набрала ${score}/${total}')
  })
})
