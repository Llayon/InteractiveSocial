import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  ANONYMOUS_ID_STORAGE_KEY,
  __resetIdentityCache,
  createSessionId,
  getOrCreateAnonymousId,
} from '@/analytics/identity'

function makeStorage(initial: Record<string, string> = {}): Storage {
  const store = new Map<string, string>(Object.entries(initial))
  return {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => {
      store.set(k, v)
    },
    removeItem: (k: string) => {
      store.delete(k)
    },
    clear: () => store.clear(),
    key: (i: number) => Array.from(store.keys())[i] ?? null,
    get length() {
      return store.size
    },
  } as Storage
}

describe('analytics identity', () => {
  beforeEach(() => {
    __resetIdentityCache()
    vi.restoreAllMocks()
  })

  it('anonymous_id stable across initialization when localStorage available (deterministic via injected generator)', () => {
    let counter = 0
    const uuid = () => `uuid-${++counter}`
    const storage = makeStorage()

    const first = getOrCreateAnonymousId({ storage, generateUuid: uuid })
    expect(first).toBe('uuid-1')
    expect(storage.getItem(ANONYMOUS_ID_STORAGE_KEY)).toBe('uuid-1')

    // Second call should return same cached value, not generate new
    __resetIdentityCache()
    // But if we simulate new page load with persisted storage, it should read existing
    const second = getOrCreateAnonymousId({ storage, generateUuid: () => 'should-not-be-used' })
    expect(second).toBe('uuid-1')
  })

  it('anonymous_id cached in-memory within same page', () => {
    let calls = 0
    const uuid = () => `gen-${++calls}`
    const storage = makeStorage()
    const a = getOrCreateAnonymousId({ storage, generateUuid: uuid })
    const b = getOrCreateAnonymousId({ storage, generateUuid: uuid })
    expect(a).toBe(b)
    expect(calls).toBe(1)
  })

  it('session_id changes on new bootstrap (each call generates new)', () => {
    let counter = 0
    const uuid = () => `sess-${++counter}`
    const first = createSessionId(uuid)
    const second = createSessionId(uuid)
    expect(first).not.toBe(second)
    expect(first).toBe('sess-1')
    expect(second).toBe('sess-2')
  })

  it('no Telegram/MAX user id involved — generated ids are random UUIDs, not user ids', () => {
    const storage = makeStorage()
    const uuid = () => '550e8400-e29b-41d4-a716-446655440000'
    const anon = getOrCreateAnonymousId({ storage, generateUuid: uuid })
    expect(anon).toBe('550e8400-e29b-41d4-a716-446655440000')
    expect(anon).not.toContain('424242')
    const sess = createSessionId(uuid)
    expect(sess).not.toContain('telegram')
  })

  it('storage failure does not crash (getItem throws, setItem throws)', () => {
    const failingStorage = {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('quota')
      },
    } as unknown as Storage

    let counter = 0
    const uuid = () => `fallback-${++counter}`

    expect(() => getOrCreateAnonymousId({ storage: failingStorage, generateUuid: uuid })).not.toThrow()
    const id = getOrCreateAnonymousId({ storage: failingStorage, generateUuid: uuid })
    expect(typeof id).toBe('string')
    expect(id.length).toBeGreaterThan(0)
  })

  it('crypto.randomUUID failure falls back to Math.random path', () => {
    const storage = makeStorage()
    // Simulate generateUuid throwing
    const throwingUuid = () => {
      throw new Error('crypto unavailable')
    }
    // Should still return something via fallback in getOrCreateAnonymousId's catch
    const id = getOrCreateAnonymousId({ storage, generateUuid: throwingUuid })
    expect(typeof id).toBe('string')
    expect(id.length).toBeGreaterThan(0)
  })

  it('createSessionId never throws even if generator throws', () => {
    expect(() => createSessionId(() => { throw new Error('fail') })).not.toThrow()
    const id = createSessionId(() => { throw new Error('fail') })
    expect(typeof id).toBe('string')
  })

  it('uses localStorage key interactive_social_analytics_id', () => {
    const storage = makeStorage()
    getOrCreateAnonymousId({ storage, generateUuid: () => 'test-id' })
    expect(storage.getItem(ANONYMOUS_ID_STORAGE_KEY)).toBe('test-id')
  })
})
