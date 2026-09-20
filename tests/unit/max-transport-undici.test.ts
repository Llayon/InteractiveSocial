/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Undici-branch isolation with a mocked 'undici' module.
 * Proves the regression invariant: when the MAX-API (undici) transport
 * fails, there is NO silent fallback to global fetch carrying the same
 * (foreign) dispatcher — the exact production bug
 * ("invalid onRequestStart method" on iu.oneme.ru).
 */

vi.mock('undici', () => {
  const fetchMock = vi.fn()
  class AgentMock {
    static calls: unknown[] = []
    constructor(opts: unknown) {
      AgentMock.calls.push(opts)
    }
  }
  return { Agent: AgentMock, fetch: fetchMock, __fetchMock: fetchMock, __AgentMock: AgentMock }
})

import * as undiciMock from 'undici'
import { buildMaxApiDispatcher, fetchViaDefault, fetchViaMaxApi } from '../../api/_lib/maxApi'

const mockFetch = (undiciMock as any).__fetchMock as ReturnType<typeof vi.fn>
const MockAgent = (undiciMock as any).__AgentMock as { calls: unknown[] }

describe('undici transport isolation (mocked undici)', () => {
  let globalFetch: ReturnType<typeof vi.fn>

  beforeEach(() => {
    MockAgent.calls.length = 0
    mockFetch.mockReset()
    globalFetch = vi.fn(async () => new Response('{}', { status: 200 }))
    vi.stubGlobal('fetch', globalFetch as any)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('A3: MAX API dispatcher is constructed as undici Agent with scoped CA', () => {
    const dispatcher = buildMaxApiDispatcher()
    expect(dispatcher).toBeDefined()
    expect(MockAgent.calls.length).toBeGreaterThan(0)
    const opts = MockAgent.calls[0] as { connect?: { ca?: string } }
    expect(typeof opts?.connect?.ca).toBe('string')
    expect(opts.connect!.ca!).toContain('BEGIN CERTIFICATE')
  })

  it('D: undici failure → NO automatic global fetch with the same dispatcher', async () => {
    mockFetch.mockRejectedValueOnce(new Error('invalid onRequestStart method'))
    const dispatcher = buildMaxApiDispatcher()
    expect(dispatcher).toBeDefined()

    await expect(
      fetchViaMaxApi('https://platform-api2.max.ru/messages?user_id=1', { method: 'POST', body: '{}' }, 5_000, dispatcher),
    ).rejects.toThrow('invalid onRequestStart method')

    // The forbidden pattern: npm-undici Agent handed to global fetch.
    expect(globalFetch).not.toHaveBeenCalled()
    // Compatible pair only: dispatcher went to undici.fetch, nowhere else.
    expect(mockFetch).toHaveBeenCalledTimes(1)
    const [, receivedInit] = mockFetch.mock.calls[0] as unknown as [string, Record<string, unknown>]
    expect(receivedInit.dispatcher).toBe(dispatcher)
  })

  it('E: default transport never constructs the MAX dispatcher (iu.oneme.ru)', async () => {
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({ token: 't' }), { status: 200 }))
    const agentCallsBefore = MockAgent.calls.length

    const form = new FormData()
    form.append('data', new Blob([new Uint8Array([1, 2, 3])], { type: 'image/jpeg' }), 'm90_probe.jpg')
    const res = await fetchViaDefault(
      'https://iu.oneme.ru/upload.do?token=abc',
      { method: 'POST', headers: { Authorization: 'BOT' }, body: form },
      5_000,
    )
    expect(res.status).toBe(200)

    // No MAX dispatcher constructed for the upload host…
    expect(MockAgent.calls.length).toBe(agentCallsBefore)
    // …and global fetch got a clean init (multipart + auth preserved).
    expect(globalFetch).toHaveBeenCalledTimes(1)
    const [, receivedInit] = globalFetch.mock.calls[0] as unknown as [string, Record<string, unknown>]
    expect(receivedInit).not.toHaveProperty('dispatcher')
    expect(receivedInit).not.toHaveProperty('agent')
    expect(receivedInit.body).toBeInstanceOf(FormData)
    expect(receivedInit.headers).toMatchObject({ Authorization: 'BOT' })
    // Undici fetch untouched on the default path.
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('bug-repro invariant: global fetch never receives a dispatcher object', async () => {
    const foreignDispatcher = { [Symbol.for('foreign')]: true }
    await fetchViaDefault(
      'https://iu.oneme.ru/upload.do',
      { method: 'POST', dispatcher: foreignDispatcher } as any,
      5_000,
    )
    expect(globalFetch).toHaveBeenCalledTimes(1)
    const receivedInit = (globalFetch.mock.calls[0] as unknown as [string, Record<string, unknown>])[1]
    expect(receivedInit).not.toHaveProperty('dispatcher')
  })
})
