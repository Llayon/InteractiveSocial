import { beforeEach, describe, expect, it, vi } from 'vitest'
import handler, { validateAnalyticsPayload, sanitizeProperties } from '../../api/analytics'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mockReq(method: string, body: unknown, headers: Record<string,string> = {}): any {
  return {
    method,
    body,
    headers,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mockRes(): any {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res: any = {}
  res.statusCode = 200
  res.body = null
  res.ended = false
  res.status = (code: number) => {
    res.statusCode = code
    return res
  }
  res.json = (data: unknown) => {
    res.body = data
    return res
  }
  res.end = () => {
    res.ended = true
    return res
  }
  return res
}

describe('validateAnalyticsPayload', () => {
  it('accepts valid event and properties', () => {
    const r = validateAnalyticsPayload({ event: 'quiz_start', properties: { quiz_id: 'music90s' } })
    expect(r.ok).toBe(true)
  })
  it('accepts missing properties as empty object', () => {
    const r = validateAnalyticsPayload({ event: 'app_open' })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.properties).toEqual({})
  })
  it('rejects array properties', () => {
    const r = validateAnalyticsPayload({ event: 'quiz_start', properties: [] as unknown as Record<string, unknown> })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.status).toBe(400)
  })
  it('rejects empty event', () => {
    const r = validateAnalyticsPayload({ event: '', properties: {} })
    expect(r.ok).toBe(false)
  })
  it('rejects too long event', () => {
    const r = validateAnalyticsPayload({ event: 'a'.repeat(101), properties: {} })
    expect(r.ok).toBe(false)
  })
  it('rejects huge payload', () => {
    const big = 'x'.repeat(33*1024)
    const r = validateAnalyticsPayload({ event: 'quiz_start', properties: { big } })
    expect(r.ok).toBe(false)
    if (!r.ok) expect([400,413]).toContain(r.status)
  })
  it('rejects too many keys', () => {
    const props: Record<string, unknown> = {}
    for(let i=0;i<101;i++) props[`k${i}`]=i
    const r = validateAnalyticsPayload({ event: 'quiz_start', properties: props })
    expect(r.ok).toBe(false)
  })
})

describe('sanitizeProperties privacy', () => {
  it('strips forbidden fields', () => {
    const sanitized = sanitizeProperties({
      quiz_id: 'music90s',
      telegram_user_id: 123,
      username: 'evil',
      first_name: 'John',
      email: 'a@b.com',
      initData: 'raw',
      token: 'secret',
      chat_id: 999,
      question_text: 'full text',
      answer_text: 'full answer',
      platform: 'max',
    } as Record<string, unknown>)
    expect(sanitized.quiz_id).toBe('music90s')
    expect(sanitized.platform).toBe('max')
    expect(sanitized).not.toHaveProperty('telegram_user_id')
    expect(sanitized).not.toHaveProperty('username')
    expect(sanitized).not.toHaveProperty('first_name')
    expect(sanitized).not.toHaveProperty('email')
    expect(sanitized).not.toHaveProperty('initData')
    expect(sanitized).not.toHaveProperty('token')
    expect(sanitized).not.toHaveProperty('chat_id')
    expect(sanitized).not.toHaveProperty('question_text')
    expect(sanitized).not.toHaveProperty('answer_text')
  })
  it('keeps safe fields like quiz_id, question_id, category, position, is_correct, score', () => {
    const sanitized = sanitizeProperties({
      quiz_id: 'music90s',
      question_id: 'm1',
      category: 'song',
      position: 3,
      is_correct: true,
      score: 12,
      platform: 'max',
      anonymous_id: 'anon-123',
      session_id: 'sess-456',
      run_id: 'run-789',
    } as Record<string, unknown>)
    expect(sanitized).toMatchObject({
      quiz_id: 'music90s',
      question_id: 'm1',
      category: 'song',
      position: 3,
      is_correct: true,
      score: 12,
    })
  })
})

describe('POST /api/analytics handler', () => {
  const originalEnv = process.env
  beforeEach(() => {
    vi.restoreAllMocks()
    process.env = { ...originalEnv }
    // Ensure fetch mock default succeeds
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ status: 1 }), { status: 200 })) as unknown as typeof fetch)
  })

  it('valid POST valid event → forwarded (204)', async () => {
    process.env.POSTHOG_API_KEY = 'test_key'
    process.env.POSTHOG_HOST = 'https://us.i.posthog.com'
    const fetchMock = vi.fn(async () => new Response('1', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch)

    const req = mockReq('POST', { event: 'quiz_start', properties: { quiz_id: 'music90s', platform: 'max', anonymous_id: 'anon-123', session_id: 'sess-456' } })
    const res = mockRes()
    await handler(req, res)
    expect(res.statusCode).toBe(204)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const call = (fetchMock.mock.calls[0] as unknown as [string, RequestInit])
    const url = call[0]
    const init = call[1]
    expect(url).toContain('us.i.posthog.com')
    const payload = JSON.parse(init?.body as string)
    expect(payload.event).toBe('quiz_start')
    expect(payload.distinct_id).toBe('anon-123')
    expect(payload.properties.quiz_id).toBe('music90s')
    expect(payload.properties.$ip).toBe(null)
  })

  it('GET → 405', async () => {
    const req = mockReq('GET', {})
    const res = mockRes()
    await handler(req, res)
    expect(res.statusCode).toBe(405)
  })

  it('empty event → 400', async () => {
    const req = mockReq('POST', { event: '', properties: {} })
    const res = mockRes()
    await handler(req, res)
    expect(res.statusCode).toBe(400)
  })

  it('huge payload → reject (413 or 400)', async () => {
    const big = 'x'.repeat(40*1024)
    const req = mockReq('POST', { event: 'quiz_start', properties: { big } })
    // Also set content-length header to trigger early guard
    req.headers['content-length'] = String(JSON.stringify({ event: 'quiz_start', properties: { big } }).length)
    const res = mockRes()
    await handler(req, res)
    expect([400,413]).toContain(res.statusCode)
  })

  it('properties array → 400', async () => {
    const req = mockReq('POST', { event: 'quiz_start', properties: [] })
    const res = mockRes()
    await handler(req, res)
    expect(res.statusCode).toBe(400)
  })

  it('malformed JSON string body → 400', async () => {
    const req = mockReq('POST', '{ invalid json', { 'content-type': 'application/json' })
    // handler will try JSON.parse and return 400
    const res = mockRes()
    await handler(req, res)
    expect(res.statusCode).toBe(400)
  })

  it('upstream PostHog failure → controlled response (still 204, not 500)', async () => {
    process.env.POSTHOG_API_KEY = 'test_key'
    const failingFetch = vi.fn(async () => new Response('error', { status: 500 }))
    vi.stubGlobal('fetch', failingFetch as unknown as typeof fetch)
    const req = mockReq('POST', { event: 'quiz_complete', properties: { quiz_id: 'music90s', anonymous_id: 'anon-1' } })
    const res = mockRes()
    await handler(req, res)
    // Should still ack client with 204, not propagate 500
    expect(res.statusCode).toBe(204)
  })

  it('missing POSTHOG_API_KEY → 204 but not forwarded (no crash)', async () => {
    delete process.env.POSTHOG_API_KEY
    const fetchMock = vi.fn(async () => new Response('1', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch)
    const req = mockReq('POST', { event: 'quiz_start', properties: { quiz_id: 'music90s' } })
    const res = mockRes()
    await handler(req, res)
    expect(res.statusCode).toBe(204)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('does not return PostHog raw response to client', async () => {
    process.env.POSTHOG_API_KEY = 'test_key'
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ raw: 'posthog' }), { status: 200 })) as unknown as typeof fetch)
    const req = mockReq('POST', { event: 'result_view', properties: { quiz_id: 'music90s' } })
    const res = mockRes()
    await handler(req, res)
    expect(res.statusCode).toBe(204)
    expect(res.body).toBe(null)
  })

  it('sanitizes forbidden fields before forwarding', async () => {
    process.env.POSTHOG_API_KEY = 'test_key'
    const fetchMock = vi.fn(async () => new Response('1', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch)
    const req = mockReq('POST', {
      event: 'quiz_start',
      properties: {
        quiz_id: 'music90s',
        telegram_user_id: 999,
        username: 'hacker',
        token: 'secret',
        platform: 'max',
        anonymous_id: 'anon-safe',
      },
    })
    const res = mockRes()
    await handler(req, res)
    expect(res.statusCode).toBe(204)
    const call = (fetchMock.mock.calls[0] as unknown as [string, RequestInit])
    const payload = JSON.parse(call[1].body as string)
    expect(payload.properties).not.toHaveProperty('telegram_user_id')
    expect(payload.properties).not.toHaveProperty('username')
    expect(payload.properties).not.toHaveProperty('token')
    expect(payload.properties.quiz_id).toBe('music90s')
  })

  it('uses distinct_id from anonymous_id', async () => {
    process.env.POSTHOG_API_KEY = 'test_key'
    const fetchMock = vi.fn(async () => new Response('1', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch)
    const req = mockReq('POST', { event: 'app_open', properties: { anonymous_id: 'my-anon', session_id: 'my-sess', platform: 'browser' } })
    const res = mockRes()
    await handler(req, res)
    const call = (fetchMock.mock.calls[0] as unknown as [string, RequestInit])
    const payload = JSON.parse(call[1].body as string)
    expect(payload.distinct_id).toBe('my-anon')
  })

  it('sets $ip null for privacy', async () => {
    process.env.POSTHOG_API_KEY = 'test_key'
    const fetchMock = vi.fn(async () => new Response('1', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch)
    const req = mockReq('POST', { event: 'app_open', properties: { anonymous_id: 'a', platform: 'max' } })
    const res = mockRes()
    await handler(req, res)
    const call = (fetchMock.mock.calls[0] as unknown as [string, RequestInit])
    const payload = JSON.parse(call[1].body as string)
    expect(payload.properties.$ip).toBe(null)
  })

  it('accepts arbitrary safe properties for future run_id etc without schema migration', async () => {
    process.env.POSTHOG_API_KEY = 'test_key'
    const fetchMock = vi.fn(async () => new Response('1', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch)
    const req = mockReq('POST', {
      event: 'question_answered',
      properties: {
        quiz_id: 'music90s',
        question_id: 'm42',
        category: 'culture',
        position: 18,
        is_correct: true,
        run_id: 'run-123',
        elapsed_ms: 1234,
        platform: 'max',
        anonymous_id: 'anon',
        session_id: 'sess',
      },
    })
    const res = mockRes()
    await handler(req, res)
    expect(res.statusCode).toBe(204)
    const call = (fetchMock.mock.calls[0] as unknown as [string, RequestInit])
    const payload = JSON.parse(call[1].body as string)
    expect(payload.properties.run_id).toBe('run-123')
    expect(payload.properties.elapsed_ms).toBe(1234)
  })
})
