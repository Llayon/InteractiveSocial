import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildShareStartParam, parseShareStartParam } from '../../api/_lib/attribution.js'
import { deliverCompletedResult } from '@/features/share/deliver'

describe('share attribution encoding', () => {
  it('round-trips result id and sharer user id', () => {
    const param = buildShareStartParam('quiet', 900000001)
    expect(param).toBe('share_quiet.900000001')
    expect(parseShareStartParam(param)).toEqual({ resultId: 'quiet', sharerUserId: 900000001 })
  })

  it('parses legacy links without attribution', () => {
    expect(parseShareStartParam('share_paris')).toEqual({ resultId: 'paris', sharerUserId: null })
  })

  it('rejects malformed parameters', () => {
    expect(parseShareStartParam(null)).toBeNull()
    expect(parseShareStartParam('')).toBeNull()
    expect(parseShareStartParam('evil_../../etc')).toBeNull()
    expect(parseShareStartParam('share_paris.notanumber')).toBeNull()
    expect(parseShareStartParam('share_Paris.123')).toBeNull()
  })
})

describe('deliverCompletedResult client', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('posts resultId and initDataRaw to the deliver endpoint', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ ok: true, deliveredSelf: true, deliveredSharer: false }), {
        status: 200,
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const outcome = await deliverCompletedResult('quiet', 'init-data-raw')

    expect(outcome).toEqual({ ok: true, deliveredSelf: true, deliveredSharer: false })
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/results/deliver',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ resultId: 'quiet', initDataRaw: 'init-data-raw' }),
      }),
    )
  })

  it('reports failure without throwing when the backend is unreachable', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('network down')
      }),
    )

    const outcome = await deliverCompletedResult('quiet', 'x')
    expect(outcome).toEqual({ ok: false, code: 'network_error' })
  })

  it('maps non-2xx responses to a failure code', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ ok: false, error: 'invalid_init_data' }), { status: 401 })),
    )

    const outcome = await deliverCompletedResult('quiet', 'bad')
    expect(outcome).toEqual({ ok: false, code: 'http_401' })
  })
})
