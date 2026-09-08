import { describe, expect, it, beforeEach, vi, afterEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { isChallengeRoute } from '@/challenges/router'
import { beautifulShotsChallenge } from '@/challenges/beautiful-shots/challenge'
import { getAvailableDay, getPublishedDayState, isDayPublished, getNextAvailableIncompleteDay } from '@/challenges/engine/unlock'
import { LocalStorageChallengeProgressStore } from '@/challenges/engine/store'
import * as analyticsModule from '@/analytics/analytics'

function makeDate(y: number, m: number, d: number, h = 12): Date {
  return new Date(y, m - 1, d, h, 0, 0, 0)
}

function makeProgress(startLocalDate: string, completed: { day: number; mode: 'normal' | 'quick' }[] = []) {
  return {
    challengeId: 'beautiful-shots' as const,
    startedAt: makeDate(2026, 9, 6).toISOString(),
    startedAtLocalDate: startLocalDate,
    completed: completed.map((c) => ({ day: c.day, completedAt: new Date().toISOString(), mode: c.mode })),
  }
}

describe('regression: durationDays 30 with days.length 7', () => {
  it('definition keeps duration 30 but only 1–7 published', () => {
    expect(beautifulShotsChallenge.durationDays).toBe(30)
    expect(beautifulShotsChallenge.days).toHaveLength(7)
    expect(beautifulShotsChallenge.days.map((d) => d.day)).toEqual([1, 2, 3, 4, 5, 6, 7])
  })

  it('Day 8 is unpublished even when calendar says available', () => {
    const progress = makeProgress('2026-09-06', [])
    const available = getAvailableDay(progress, makeDate(2026, 10, 6))
    expect(available).toBe(30)
    expect(isDayPublished(beautifulShotsChallenge, 8)).toBe(false)
    expect(getPublishedDayState(beautifulShotsChallenge, 8, progress, available)).toBe('locked')
    expect(isDayPublished(beautifulShotsChallenge, 7)).toBe(true)
  })

  it('getNextAvailableIncompleteDay skips unpublished', () => {
    const progress = makeProgress('2026-09-06', [{ day: 1, mode: 'normal' }, { day: 2, mode: 'normal' }, { day: 3, mode: 'normal' }, { day: 4, mode: 'normal' }, { day: 5, mode: 'normal' }, { day: 6, mode: 'normal' }, { day: 7, mode: 'normal' }])
    const available = 30
    const next = getNextAvailableIncompleteDay(beautifulShotsChallenge, progress, available)
    expect(next).toBeNull()
  })

  it('Day 8 cannot be opened via published guard', () => {
    expect(isDayPublished(beautifulShotsChallenge, 8)).toBe(false)
    expect(isDayPublished(beautifulShotsChallenge, 7)).toBe(true)
    expect(isDayPublished(beautifulShotsChallenge, 30)).toBe(false)
  })
})

describe('regression: completion semantics', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('quick -> normal = upgrade', async () => {
    const store = new LocalStorageChallengeProgressStore()
    await store.startChallenge('beautiful-shots', makeDate(2026, 9, 6))
    await store.completeDay('beautiful-shots', 1, 'quick', makeDate(2026, 9, 6, 10))
    let p = await store.getProgress('beautiful-shots')
    expect(p?.completed.find((c) => c.day === 1)?.mode).toBe('quick')
    await store.completeDay('beautiful-shots', 1, 'normal', makeDate(2026, 9, 6, 11))
    p = await store.getProgress('beautiful-shots')
    expect(p?.completed.find((c) => c.day === 1)?.mode).toBe('normal')
  })

  it('normal -> quick = no-op (cannot downgrade)', async () => {
    const store = new LocalStorageChallengeProgressStore()
    await store.startChallenge('beautiful-shots', makeDate(2026, 9, 6))
    await store.completeDay('beautiful-shots', 2, 'normal', makeDate(2026, 9, 7, 10))
    let p = await store.getProgress('beautiful-shots')
    expect(p?.completed.find((c) => c.day === 2)?.mode).toBe('normal')
    await store.completeDay('beautiful-shots', 2, 'quick', makeDate(2026, 9, 7, 11))
    p = await store.getProgress('beautiful-shots')
    expect(p?.completed.find((c) => c.day === 2)?.mode).toBe('normal')
  })

  it('normal -> normal = no-op', async () => {
    const store = new LocalStorageChallengeProgressStore()
    await store.startChallenge('beautiful-shots', makeDate(2026, 9, 6))
    await store.completeDay('beautiful-shots', 3, 'normal', makeDate(2026, 9, 6, 10))
    const before = await store.getProgress('beautiful-shots')
    const beforeAt = before?.completed.find((c) => c.day === 3)?.completedAt
    await store.completeDay('beautiful-shots', 3, 'normal', makeDate(2026, 9, 6, 12))
    const after = await store.getProgress('beautiful-shots')
    expect(after?.completed.find((c) => c.day === 3)?.completedAt).toBe(beforeAt)
  })

  it('quick -> quick = no-op', async () => {
    const store = new LocalStorageChallengeProgressStore()
    await store.startChallenge('beautiful-shots', makeDate(2026, 9, 6))
    await store.completeDay('beautiful-shots', 4, 'quick', makeDate(2026, 9, 6, 10))
    const before = await store.getProgress('beautiful-shots')
    const beforeAt = before?.completed.find((c) => c.day === 4)?.completedAt
    await store.completeDay('beautiful-shots', 4, 'quick', makeDate(2026, 9, 6, 12))
    const after = await store.getProgress('beautiful-shots')
    expect(after?.completed.find((c) => c.day === 4)?.completedAt).toBe(beforeAt)
  })
})

describe('regression: query route', () => {
  const originalWindow = globalThis.window
  afterEach(() => {
    vi.restoreAllMocks()
    if (originalWindow) {
      try {
        window.history.replaceState(null, '', '/')
      } catch {}
    }
  })

  it('?challenge=beautiful-shots is challenge route', () => {
    window.history.replaceState(null, '', '/?challenge=beautiful-shots')
    expect(isChallengeRoute()).toBe(true)
  })

  it('?product=beautiful-shots is challenge route', () => {
    window.history.replaceState(null, '', '/?product=beautiful-shots')
    expect(isChallengeRoute()).toBe(true)
  })

  it('path /beautiful-shots is challenge route', () => {
    window.history.replaceState(null, '', '/beautiful-shots')
    expect(isChallengeRoute()).toBe(true)
  })

  it('normal / is not challenge route', () => {
    window.history.replaceState(null, '', '/')
    expect(isChallengeRoute()).toBe(false)
  })

  it('/?quiz=music90s is not challenge route', () => {
    window.history.replaceState(null, '', '/?quiz=music90s')
    expect(isChallengeRoute()).toBe(false)
  })

  it('startParam challenge_beautiful-shots is challenge route', () => {
    expect(isChallengeRoute({ startParam: 'challenge_beautiful-shots' })).toBe(true)
    expect(isChallengeRoute({ startParam: 'challenge_beautiful_shots' })).toBe(true)
  })

  it('startParam quiz_ still not challenge', () => {
    expect(isChallengeRoute({ startParam: 'quiz_music90s' })).toBe(false)
    expect(isChallengeRoute({ startParam: 's2_m90_lg_123' })).toBe(false)
  })
})

describe('regression: App product boundary (no quiz hooks on challenge route)', () => {
  afterEach(() => {
    window.localStorage.clear()
    window.history.replaceState(null, '', '/')
    vi.restoreAllMocks()
  })

  function createMockAdapter(platform: 'telegram' | 'max' | 'browser' | 'mock' = 'mock'): import('@/platform/types').MiniAppAdapter {
    return {
      platform,
      mode: platform as unknown as import('@/platform/types').MiniAppAdapter['mode'],
      ready: vi.fn(),
      expand: vi.fn(),
      getStartParam: vi.fn(() => null),
      getUser: vi.fn(() => ({ id: 1, firstName: 'Test' })),
      getInitDataRaw: vi.fn(() => ''),
      haptic: vi.fn(),
    } as unknown as import('@/platform/types').MiniAppAdapter
  }

  it('/beautiful-shots does not emit quiz_view or quiz_landing_view', async () => {
    window.history.replaceState(null, '', '/beautiful-shots')
    const adapter = createMockAdapter('browser')
    const track = vi.fn()
    const trackOnce = vi.fn()
    const spy = vi.spyOn(analyticsModule, 'getAnalytics').mockReturnValue({
      track,
      trackOnce,
      updateContext: vi.fn(),
    } as unknown as ReturnType<typeof analyticsModule.getAnalytics>)

    const { render } = await import('@testing-library/react')
    const React = (await import('react')).default
    const AppMod = await import('@/app/App')
    const { unmount } = render(React.createElement(AppMod.App, { adapter } as never))

    await waitFor(() => {
      const all = [...track.mock.calls.map((c) => c[0]), ...trackOnce.mock.calls.map((c) => c[1])]
      expect(all).toContain('challenge_view')
    })
    const all = [...track.mock.calls.map((c) => c[0]), ...trackOnce.mock.calls.map((c) => c[1])]
    expect(all).not.toContain('quiz_view')
    expect(all).not.toContain('quiz_landing_view')
    spy.mockRestore()
    unmount()
  })

  it('challenge_start exactly once with correct platform', async () => {
    window.history.replaceState(null, '', '/beautiful-shots')
    window.localStorage.clear()
    const adapter = createMockAdapter('telegram')
    const track = vi.fn()
    const trackOnce = vi.fn()
    const spy = vi.spyOn(analyticsModule, 'getAnalytics').mockReturnValue({
      track,
      trackOnce,
      updateContext: vi.fn(),
    } as never)

    const { render } = await import('@testing-library/react')
    const user = userEvent.setup()
    const { default: React } = await import('react')
    const AppMod = await import('@/app/App')
    const { unmount } = render(React.createElement(AppMod.App, { adapter } as never))
    const cta = await screen.findByTestId('challenge-start-cta')
    await user.click(cta)
    await waitFor(() => {
      const allStarts = [
        ...track.mock.calls.filter((c) => c[0] === 'challenge_start').map((c) => c[1]),
        ...trackOnce.mock.calls.filter((c) => c[1] === 'challenge_start').map((c) => c[2]),
      ]
      expect(allStarts).toHaveLength(1)
      expect(allStarts[0]).toEqual(expect.objectContaining({ challenge_id: 'beautiful-shots', platform: 'telegram' }))
    })
    spy.mockRestore()
    unmount()
  })

  it('existing quiz routes remain unchanged', async () => {
    window.history.replaceState(null, '', '/?quiz=music90s')
    window.localStorage.clear()
    const adapter = createMockAdapter('browser')
    const { render } = await import('@testing-library/react')
    const AppMod = await import('@/app/App')
    const { default: React } = await import('react')
    const { unmount } = render(React.createElement(AppMod.App, { adapter } as never))
    expect(await screen.findByTestId('start-cta')).toBeInTheDocument()
    expect(screen.queryByTestId('challenge-landing')).not.toBeInTheDocument()
    expect(screen.getByText(/Ты точно помнишь музыку 90-х/)).toBeInTheDocument()
    unmount()
  })

  it('Telegram challenge startParam routes to ChallengeApp even on root', async () => {
    window.history.replaceState(null, '', '/')
    window.localStorage.clear()
    const adapter = createMockAdapter('telegram')
    ;(adapter.getStartParam as unknown as ReturnType<typeof vi.fn>).mockReturnValue('challenge_beautiful-shots')
    const { render } = await import('@testing-library/react')
    const { default: React } = await import('react')
    const AppMod = await import('@/app/App')
    const { unmount } = render(React.createElement(AppMod.App, { adapter } as never))
    expect(await screen.findByTestId('challenge-landing')).toBeInTheDocument()
    expect(screen.queryByTestId('start-cta')).not.toBeInTheDocument()
    unmount()
  })

  it('MAX challenge startParam routes to ChallengeApp even on root', async () => {
    window.history.replaceState(null, '', '/')
    window.localStorage.clear()
    const adapter = createMockAdapter('max')
    ;(adapter.getStartParam as unknown as ReturnType<typeof vi.fn>).mockReturnValue('challenge_beautiful-shots')
    const { render } = await import('@testing-library/react')
    const { default: React } = await import('react')
    const AppMod = await import('@/app/App')
    const { unmount } = render(React.createElement(AppMod.App, { adapter } as never))
    expect(await screen.findByTestId('challenge-landing')).toBeInTheDocument()
    unmount()
  })

  it('quiz startParam still routes to QuizApp', async () => {
    window.history.replaceState(null, '', '/')
    window.localStorage.clear()
    const adapter = createMockAdapter('telegram')
    ;(adapter.getStartParam as unknown as ReturnType<typeof vi.fn>).mockReturnValue('quiz_music90s')
    const { render } = await import('@testing-library/react')
    const { default: React } = await import('react')
    const AppMod = await import('@/app/App')
    const { unmount } = render(React.createElement(AppMod.App, { adapter } as never))
    expect(await screen.findByTestId('start-cta')).toBeInTheDocument()
    expect(screen.queryByTestId('challenge-landing')).not.toBeInTheDocument()
    unmount()
  })

  it('s2_ startParam still routes to QuizApp', async () => {
    window.history.replaceState(null, '', '/')
    window.localStorage.clear()
    const adapter = createMockAdapter('telegram')
    ;(adapter.getStartParam as unknown as ReturnType<typeof vi.fn>).mockReturnValue('s2_m90_lg_123')
    const { render } = await import('@testing-library/react')
    const { default: React } = await import('react')
    const AppMod = await import('@/app/App')
    const { unmount } = render(React.createElement(AppMod.App, { adapter } as never))
    expect(await screen.findByTestId('start-cta')).toBeInTheDocument()
    unmount()
  })
})
