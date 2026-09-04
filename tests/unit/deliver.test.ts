import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  buildLegacyShareStartParam,
  buildShareStartParam,
  parseShareStartParam,
  resolveAttribution,
} from '../../api/_lib/attribution.js'
import { deliverCompletedResult } from '@/features/share/deliver'

describe('share attribution encoding (v2 + v1 legacy)', () => {
  it('round-trips v2 wire codes and the sharer user id', () => {
    const param = buildShareStartParam('ic', 'it', 847291)
    expect(param).toBe('s2_ic_it_847291')
    expect(parseShareStartParam(param)).toEqual({
      version: 2,
      quizCode: 'ic',
      resultCode: 'it',
      sharerUserId: 847291,
    })
  })

  it('parses legacy dash- and dot-separated links', () => {
    expect(parseShareStartParam('share_paris')).toEqual({
      version: 1,
      resultId: 'paris',
      sharerUserId: null,
    })
    expect(parseShareStartParam('share_quiet-900000001')).toEqual({
      version: 1,
      resultId: 'quiet',
      sharerUserId: 900000001,
    })
    expect(parseShareStartParam('share_paris.900000001')).toEqual({
      version: 1,
      resultId: 'paris',
      sharerUserId: 900000001,
    })
  })

  it('rejects malformed parameters in both protocols', () => {
    expect(parseShareStartParam(null)).toBeNull()
    expect(parseShareStartParam('')).toBeNull()
    expect(parseShareStartParam('evil_../../etc')).toBeNull()
    expect(parseShareStartParam('share_paris.notanumber')).toBeNull()
    expect(parseShareStartParam('share_Paris.123')).toBeNull()
    expect(parseShareStartParam('s2_ic_it')).toBeNull()
    expect(parseShareStartParam('s2_ic_it_abc')).toBeNull()
    expect(parseShareStartParam('s2_IC_it_1')).toBeNull()
    expect(buildLegacyShareStartParam('paris', 1)).toBe('share_paris-1')
  })
})

describe('resolveAttribution (protocol → registry)', () => {
  it('resolves v2 codes back to the owning quiz and result', () => {
    expect(resolveAttribution('s2_ic_it_847291')).toEqual({
      version: 2,
      quizId: 'interior-character',
      resultId: 'italian',
      sharerUserId: 847291,
    })
  })

  it('resolves legacy links via the result-id owner scan', () => {
    expect(resolveAttribution('share_italian-847291')).toEqual({
      version: 1,
      quizId: 'interior-character',
      resultId: 'italian',
      sharerUserId: 847291,
    })
    expect(resolveAttribution('share_scandi')).toEqual({
      version: 1,
      quizId: 'interior-character',
      resultId: 'scandi',
      sharerUserId: null,
    })
  })

  it('yields null for unknown codes or results (safe no-attribution)', () => {
    expect(resolveAttribution('s2_zz_zz_847291')).toBeNull()
    expect(resolveAttribution('share_unknown-847291')).toBeNull()
    expect(resolveAttribution(null)).toBeNull()
  })
})

describe('deliverCompletedResult client', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('posts quizId, resultId and initDataRaw to the deliver endpoint', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ ok: true, deliveredSelf: true, deliveredSharer: false, selfMid: null }), {
        status: 200,
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const outcome = await deliverCompletedResult('interior-character', 'quiet', 'init-data-raw')

    expect(outcome).toEqual({ ok: true, deliveredSelf: true, deliveredSharer: false, selfMid: null })
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/results/deliver',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          quizId: 'interior-character',
          resultId: 'quiet',
          initDataRaw: 'init-data-raw',
        }),
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

    const outcome = await deliverCompletedResult('interior-character', 'quiet', 'x')
    expect(outcome).toEqual({ ok: false, code: 'network_error' })
  })

  it('maps non-2xx responses to a failure code', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ ok: false, error: 'invalid_init_data' }), { status: 401 })),
    )

    const outcome = await deliverCompletedResult('interior-character', 'quiet', 'bad')
    expect(outcome).toEqual({ ok: false, code: 'http_401' })
  })
})

