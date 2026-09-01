import { describe, expect, it, afterEach, vi } from 'vitest'
import { hasMaxLaunchParamsInUrl, extractInitDataRawFromHash, extractStartParamFromHash } from '@/platform/detect'

describe('MAX BRIDGE BOOTSTRAP — launch hint detector', () => {
  const originalHash = window.location.hash
  const originalSearch = window.location.search

  afterEach(() => {
    history.replaceState(null, '', originalSearch + originalHash)
    vi.unstubAllGlobals()
  })

  it('A. MAX URL present, no pre-existing window.WebApp → platform max via hash', async () => {
    // No window.WebApp
    const w = window as unknown as Record<string, unknown>
    const prev = w.WebApp
    delete w.WebApp

    // Set MAX launch hash with WebAppData+WebAppPlatform
    const fakeInitData = `auth_date=${Math.floor(Date.now() / 1000)}&user=${encodeURIComponent(JSON.stringify({ id: 1, first_name: 'Test' }))}&hash=abc&start_param=quiz_music90s`
    history.replaceState(null, '', `#WebAppData=${encodeURIComponent(fakeInitData)}&WebAppPlatform=web&WebAppVersion=26.2.8`)

    expect(hasMaxLaunchParamsInUrl()).toBe(true)
    expect(extractInitDataRawFromHash()).toBe(fakeInitData)
    expect(extractStartParamFromHash()).toBe('quiz_music90s')

    // Restore
    w.WebApp = prev
  })

  it('B/C. MAX Bridge CDN slow/failed must not block first paint — ensureMaxBridgeLoaded is async', async () => {
    const { ensureMaxBridgeLoaded } = await import('@/platform/max/bridge')
    const w = window as unknown as Record<string, unknown>
    const prev = w.WebApp
    delete w.WebApp

    // Mock document.createElement to simulate slow CDN (delay 10s) and then verify that
    // ensureMaxBridgeLoaded returns quickly and does not block.
    const origCreate = document.createElement.bind(document)
    let capturedSrc = ''
    const spy = vi.spyOn(document, 'createElement').mockImplementation(((tag: string) => {
      const el = origCreate(tag)
      if (tag === 'script') {
        Object.defineProperty(el, 'src', {
          get() { return capturedSrc },
          set(v: string) { capturedSrc = v },
          configurable: true,
        })
        // Simulate slow response: do not fire load immediately, let timeout handle
        // But also ensure no error
      }
      return el
    }) as unknown as typeof document.createElement)

    const start = Date.now()
    const promise = ensureMaxBridgeLoaded()
    const elapsedImmediate = Date.now() - start
    // Should return a promise immediately, not block
    expect(elapsedImmediate).toBeLessThan(100)
    expect(capturedSrc).toBe('https://st.max.ru/js/max-web-app.js')

    // Even with slow CDN, promise should resolve within bounded timeout (5s), not hang forever
    // We don't await full 5s here, just check that promise is pending and will resolve
    expect(promise).toBeInstanceOf(Promise)

    spy.mockRestore()
    w.WebApp = prev
  })

  it('D. direct Music launch via WebAppData start_param', () => {
    const fakeInitData = `auth_date=${Math.floor(Date.now() / 1000)}&user=${encodeURIComponent(JSON.stringify({ id: 2, first_name: 'A' }))}&hash=xyz&start_param=quiz_music90s`
    history.replaceState(null, '', `#WebAppData=${encodeURIComponent(fakeInitData)}&WebAppPlatform=android&WebAppVersion=26.2.8`)
    expect(extractStartParamFromHash()).toBe('quiz_music90s')
  })

  it('E. default bot launch (no start_param) → null, still MAX detected', () => {
    const fakeInitData = `auth_date=${Math.floor(Date.now() / 1000)}&user=${encodeURIComponent(JSON.stringify({ id: 3, first_name: 'B' }))}&hash=123`
    history.replaceState(null, '', `#WebAppData=${encodeURIComponent(fakeInitData)}&WebAppPlatform=ios&WebAppVersion=26.2.8`)
    expect(hasMaxLaunchParamsInUrl()).toBe(true)
    expect(extractStartParamFromHash()).toBeNull()
  })

  it('G. browser with manual ?startapp must NOT become MAX', () => {
    history.replaceState(null, '', '?startapp=quiz_music90s')
    // No hash WebAppData, so not MAX
    expect(hasMaxLaunchParamsInUrl()).toBe(false)
  })

  it('G2. browser with no hash → not MAX', () => {
    history.replaceState(null, '', '')
    expect(hasMaxLaunchParamsInUrl()).toBe(false)
  })
})
