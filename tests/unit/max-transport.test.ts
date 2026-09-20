/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Agent } from 'undici'
import {
  buildMaxApiDispatcher,
  fetchViaDefault,
  fetchWithTimeout,
  getFetchPolicy,
  getMaxApiHost,
} from '../../api/_lib/maxApi'

describe('MAX transport policy', () => {
  it('MAX_API_HOST is derived from MAX_API_BASE, not hard-coded twice', () => {
    expect(getMaxApiHost()).toBe('platform-api2.max.ru')
  })

  it('A: MAX API hostname (any case/path/query) → max-api', () => {
    expect(getFetchPolicy('https://platform-api2.max.ru/messages')).toBe('max-api')
    expect(getFetchPolicy('https://platform-api2.max.ru/me')).toBe('max-api')
    expect(getFetchPolicy('https://platform-api2.max.ru/uploads?type=image')).toBe('max-api')
    expect(getFetchPolicy('HTTPS://PLATFORM-API2.MAX.RU/messages?user_id=1')).toBe('max-api')
  })

  it('B: upload hosts → default (MAX CA must not reach them)', () => {
    expect(getFetchPolicy('https://iu.oneme.ru/upload.do?token=abc')).toBe('default')
    expect(getFetchPolicy('https://fu.oneme.ru/something')).toBe('default')
    expect(getFetchPolicy('https://cs12.okcdn.ru/image.jpg')).toBe('default')
  })

  it('C: arbitrary external URLs → default, no MAX CA', () => {
    expect(getFetchPolicy('https://example.com/image.jpg')).toBe('default')
    expect(getFetchPolicy('https://iu.oneme.ru.tginteractivebot.vercel.app/share-cards/v4/x.jpg')).toBe('default')
    expect(getFetchPolicy('not a url')).toBe('default')
  })

  it('A2: MAX API gets a real scoped undici dispatcher when CA is available', () => {
    // Repo ships certs/russian-trusted-ca.pem, so getPemCa() resolves without env.
    const dispatcher = buildMaxApiDispatcher()
    expect(dispatcher).toBeDefined()
    expect(dispatcher).toBeInstanceOf(Agent)
  })
})

describe('default transport isolation (bug repro: foreign dispatcher)', () => {
  let globalFetch: ReturnType<typeof vi.fn>

  beforeEach(() => {
    globalFetch = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }))
    vi.stubGlobal('fetch', globalFetch as any)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('B2: foreign npm-undici dispatcher is stripped before global fetch', async () => {
    const foreign = new Agent({ connect: { rejectUnauthorized: true } } as any)
    const init = { method: 'POST', body: 'x', dispatcher: foreign, agent: { keepAlive: true } } as any
    await fetchViaDefault('https://iu.oneme.ru/upload.do?token=secret-query-must-not-leak', init, 5_000)
    expect(globalFetch).toHaveBeenCalledTimes(1)
    const [, receivedInit] = globalFetch.mock.calls[0] as unknown as [string, Record<string, unknown>]
    expect(receivedInit).not.toHaveProperty('dispatcher')
    expect(receivedInit).not.toHaveProperty('agent')
    expect(receivedInit.method).toBe('POST')
    expect(receivedInit.body).toBe('x')
    expect(receivedInit.signal).toBeInstanceOf(AbortSignal)
  })

  it('invariant: fetchWithTimeout never hands a dispatcher to global fetch (iu.oneme.ru)', async () => {
    const foreign = new Agent({} as any)
    await fetchWithTimeout(
      'https://iu.oneme.ru/upload.do',
      { method: 'POST', dispatcher: foreign } as any,
      5_000,
    )
    expect(globalFetch).toHaveBeenCalledTimes(1)
    const [, receivedInit] = globalFetch.mock.calls[0] as unknown as [string, Record<string, unknown>]
    expect(receivedInit).not.toHaveProperty('dispatcher')
  })

  it('invariant: fetchWithTimeout never hands a dispatcher to global fetch (MAX API under vitest)', async () => {
    const foreign = new Agent({} as any)
    await fetchWithTimeout(
      'https://platform-api2.max.ru/messages?user_id=1',
      { method: 'POST', body: '{}', dispatcher: foreign } as any,
      5_000,
    )
    expect(globalFetch).toHaveBeenCalledTimes(1)
    const [, receivedInit] = globalFetch.mock.calls[0] as unknown as [string, Record<string, unknown>]
    expect(receivedInit).not.toHaveProperty('dispatcher')
  })

  it('timeout: AbortError propagates, timer does not hang the test', async () => {
    const hanging = vi.fn(
      (_url: unknown, init?: { signal?: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')), {
            once: true,
          })
        }),
    )
    vi.stubGlobal('fetch', hanging as any)
    await expect(fetchViaDefault('https://example.com/slow', { method: 'GET' }, 30)).rejects.toMatchObject({
      name: 'AbortError',
    })
    expect(hanging).toHaveBeenCalledTimes(1)
  })
})

describe('maxMedia regression: token primary, URL fallback preserved', () => {
  const IMAGE_URL = 'https://cdn.example.com/share-cards/v4/m90_transport_probe.jpg'

  function stubRouter(opts: { uploadOk: boolean }) {
    const calls: Array<{ url: string; init: Record<string, unknown> }> = []
    const router = vi.fn(async (url: unknown, init?: Record<string, unknown>) => {
      const u = String(url)
      calls.push({ url: u, init: { ...(init ?? {}) } })
      if (u === IMAGE_URL && (init?.method ?? 'GET') === 'HEAD') {
        return new Response('', {
          status: 200,
          headers: { 'content-type': 'image/jpeg', 'content-length': '1234' },
        })
      }
      if (u === IMAGE_URL) {
        return new Response(new Uint8Array([1, 2, 3, 4]), {
          status: 200,
          headers: { 'content-type': 'image/jpeg' },
        })
      }
      if (u.includes('/uploads?type=image')) {
        return new Response(JSON.stringify({ url: 'https://iu.oneme.ru/upload.do?token=abc' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      }
      if (u.includes('iu.oneme.ru')) {
        if (!opts.uploadOk) return new Response('boom', { status: 500 })
        return new Response(JSON.stringify({ token: 'uploaded_token_123' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      }
      return new Response('not found', { status: 404 })
    })
    vi.stubGlobal('fetch', router as any)
    return calls
  }

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('upload success → via=token, multipart + auth preserved, no dispatcher', async () => {
    const calls = stubRouter({ uploadOk: true })
    const { createMaxImageAttachment } = await import('../../api/_lib/maxMedia')
    const res = await createMaxImageAttachment({ token: 'BOT', imageUrl: IMAGE_URL, assetKey: 'm90_probe' })
    expect(res.via).toBe('token')
    expect(res.attachment).toEqual({ type: 'image', payload: { token: 'uploaded_token_123' } })

    const uploadCall = calls.find((c) => c.url.includes('iu.oneme.ru'))
    expect(uploadCall).toBeDefined()
    // Multipart payload unchanged
    expect(uploadCall!.init.body).toBeInstanceOf(FormData)
    expect((uploadCall!.init.body as FormData).has('data')).toBe(true)
    // Authorization header unchanged for this pass
    expect(uploadCall!.init.headers).toMatchObject({ Authorization: 'BOT' })
    // Transport isolation at the upload boundary
    expect(uploadCall!.init).not.toHaveProperty('dispatcher')
    expect(uploadCall!.init).not.toHaveProperty('agent')
  })

  it('upload failure → URL fallback preserved (via=url)', async () => {
    stubRouter({ uploadOk: false })
    const { createMaxImageAttachment } = await import('../../api/_lib/maxMedia')
    const res = await createMaxImageAttachment({ token: 'BOT', imageUrl: IMAGE_URL, assetKey: 'm90_probe' })
    expect(res.via).toBe('url')
    expect(res.attachment).toEqual({ type: 'image', payload: { url: IMAGE_URL } })
  })
})
