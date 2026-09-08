import { describe, expect, it, beforeEach, vi } from 'vitest'
import {
  formatLocalDate,
  differenceInCalendarDaysLocal,
  getAvailableDay,
  getDayState,
  getNextAvailableIncompleteDay,
} from '@/challenges/engine/unlock'
import { LocalStorageChallengeProgressStore } from '@/challenges/engine/store'
import type { ChallengeProgress } from '@/challenges/engine/types'
import { beautifulShotsChallenge } from '@/challenges/beautiful-shots/challenge'

function makeDate(y: number, m: number, d: number, h = 12, min = 0): Date {
  return new Date(y, m - 1, d, h, min, 0, 0)
}

function makeProgress(startLocalDate: string, startInstant: Date, completed: { day: number; mode: 'normal' | 'quick' }[] = []): ChallengeProgress {
  return {
    challengeId: 'beautiful-shots',
    startedAt: startInstant.toISOString(),
    startedAtLocalDate: startLocalDate,
    completed: completed.map((c) => ({ day: c.day, completedAt: new Date().toISOString(), mode: c.mode })),
  }
}

describe('challenge unlock: calendar daily', () => {
  it('1. Day 1 available immediately after start', () => {
    const start = makeDate(2026, 9, 6, 10, 0)
    const progress = makeProgress('2026-09-06', start)
    const available = getAvailableDay(progress, makeDate(2026, 9, 6, 10, 5))
    expect(available).toBe(1)
    expect(getDayState(1, progress, available)).toBe('available')
    expect(getDayState(2, progress, available)).toBe('locked')
  })

  it('2. Day 2 opens on next LOCAL calendar date', () => {
    const start = makeDate(2026, 9, 6, 10, 0)
    const progress = makeProgress('2026-09-06', start)
    const nextDay = makeDate(2026, 9, 7, 0, 5)
    expect(getAvailableDay(progress, nextDay)).toBe(2)
  })

  it('3. Start at 23:59 local -> Day 2 after local midnight', () => {
    const start = makeDate(2026, 9, 6, 23, 59)
    const progress = makeProgress('2026-09-06', start)
    expect(getAvailableDay(progress, makeDate(2026, 9, 6, 23, 59))).toBe(1)
    expect(getAvailableDay(progress, makeDate(2026, 9, 7, 0, 0))).toBe(2)
    expect(getAvailableDay(progress, makeDate(2026, 9, 7, 0, 1))).toBe(2)
  })

  it('4. After 5 calendar days Days 1-6 available', () => {
    const start = makeDate(2026, 9, 6, 12, 0)
    const progress = makeProgress('2026-09-06', start)
    const day6 = makeDate(2026, 9, 11, 9, 0)
    expect(getAvailableDay(progress, day6)).toBe(6)
    const avail = getAvailableDay(progress, day6)
    for (let d = 1; d <= 6; d++) expect(getDayState(d, progress, avail)).toBe('available')
    expect(getDayState(7, progress, avail)).toBe('locked')
  })

  it('5. Future day locked', () => {
    const start = makeDate(2026, 9, 6, 10, 0)
    const progress = makeProgress('2026-09-06', start)
    const avail = getAvailableDay(progress, makeDate(2026, 9, 6, 15, 0))
    expect(getDayState(10, progress, avail)).toBe('locked')
  })

  it('6. Old available day stays available after days pass', () => {
    const start = makeDate(2026, 9, 6, 10, 0)
    const progress = makeProgress('2026-09-06', start)
    const availLater = getAvailableDay(progress, makeDate(2026, 9, 10, 10, 0))
    expect(getDayState(1, progress, availLater)).toBe('available')
    expect(getDayState(2, progress, availLater)).toBe('available')
    expect(getDayState(3, progress, availLater)).toBe('available')
  })

  it('7. Completed day stays completed regardless of time', () => {
    const start = makeDate(2026, 9, 6, 10, 0)
    const progress = makeProgress('2026-09-06', start, [{ day: 1, mode: 'normal' }])
    const availNow = getAvailableDay(progress, makeDate(2026, 9, 6, 11, 0))
    expect(getDayState(1, progress, availNow)).toBe('completed')
    const availLater = getAvailableDay(progress, makeDate(2026, 9, 20, 11, 0))
    expect(getDayState(1, progress, availLater)).toBe('completed')
  })

  it('8. Quick completion stored as quick', () => {
    const start = makeDate(2026, 9, 6, 10, 0)
    const progress = makeProgress('2026-09-06', start, [{ day: 1, mode: 'quick' }])
    const avail = getAvailableDay(progress, makeDate(2026, 9, 6, 11, 0))
    expect(getDayState(1, progress, avail)).toBe('completed_quick')
    expect(getDayState(2, progress, avail)).toBe('locked')
  })

  it('11. available day clamp <= 30', () => {
    const start = makeDate(2026, 9, 1, 10, 0)
    const progress = makeProgress('2026-09-01', start)
    const farFuture = makeDate(2026, 11, 1, 10, 0)
    expect(getAvailableDay(progress, farFuture)).toBe(30)
  })

  it('12. After Day 30 challenge complete', () => {
    const start = makeDate(2026, 9, 1, 10, 0)
    const allCompleted: { day: number; mode: 'normal' | 'quick' }[] = []
    for (let i = 1; i <= 30; i++) allCompleted.push({ day: i, mode: 'normal' })
    const progress = makeProgress('2026-09-01', start, allCompleted)
    expect(progress.completed.length).toBe(30)
  })

  it('14. CTA chooses earliest available incomplete day', () => {
    const start = makeDate(2026, 9, 6, 10, 0)
    const progress = makeProgress('2026-09-06', start, [
      { day: 1, mode: 'normal' },
      { day: 2, mode: 'normal' },
    ])
    const avail = getAvailableDay(progress, makeDate(2026, 9, 10, 10, 0))
    expect(avail).toBe(5)
    const next = getNextAvailableIncompleteDay(beautifulShotsChallenge, progress, avail)
    expect(next).toBe(3)
  })

  it('differenceInCalendarDaysLocal correctness', () => {
    expect(differenceInCalendarDaysLocal('2026-09-07', '2026-09-06')).toBe(1)
    expect(differenceInCalendarDaysLocal('2026-09-06', '2026-09-06')).toBe(0)
    expect(differenceInCalendarDaysLocal('2026-09-06', '2026-09-07')).toBe(-1)
  })

  it('formatLocalDate uses local timezone', () => {
    const d = makeDate(2026, 1, 2, 3, 4)
    const s = formatLocalDate(d)
    expect(s).toBe('2026-01-02')
  })
})

describe('LocalStorageChallengeProgressStore', () => {
  beforeEach(() => {
    window.localStorage.clear()
    vi.restoreAllMocks()
  })

  it('9. reload restores progress', async () => {
    const store = new LocalStorageChallengeProgressStore()
    const startDate = makeDate(2026, 9, 6, 10, 0)
    await store.startChallenge('beautiful-shots', startDate)
    await store.completeDay('beautiful-shots', 1, 'normal', makeDate(2026, 9, 6, 11, 0))
    const store2 = new LocalStorageChallengeProgressStore()
    const p = await store2.getProgress('beautiful-shots')
    expect(p).not.toBeNull()
    expect(p?.completed.some((c) => c.day === 1 && c.mode === 'normal')).toBe(true)
    expect(p?.startedAtLocalDate).toBe('2026-09-06')
  })

  it('10. duplicate completion does not break state', async () => {
    const store = new LocalStorageChallengeProgressStore()
    await store.startChallenge('beautiful-shots', makeDate(2026, 9, 6, 10, 0))
    await store.completeDay('beautiful-shots', 2, 'normal', makeDate(2026, 9, 7, 10, 0))
    await store.completeDay('beautiful-shots', 2, 'normal', makeDate(2026, 9, 7, 11, 0))
    const p = await store.getProgress('beautiful-shots')
    expect(p?.completed.filter((c) => c.day === 2)).toHaveLength(1)
  })

  it('duplicate quick->normal updates correctly (or keeps gracefully)', async () => {
    const store = new LocalStorageChallengeProgressStore()
    await store.startChallenge('beautiful-shots', makeDate(2026, 9, 6, 10, 0))
    await store.completeDay('beautiful-shots', 1, 'quick', makeDate(2026, 9, 6, 10, 5))
    let p = await store.getProgress('beautiful-shots')
    expect(p?.completed.find((c) => c.day === 1)?.mode).toBe('quick')
    await store.completeDay('beautiful-shots', 1, 'normal', makeDate(2026, 9, 6, 11, 0))
    p = await store.getProgress('beautiful-shots')
    expect(p?.completed.find((c) => c.day === 1)?.mode).toBe('normal')
  })

  it('13. corrupted localStorage fail-safe', async () => {
    window.localStorage.setItem('challenge-progress:beautiful-shots', 'not json {')
    const store = new LocalStorageChallengeProgressStore()
    const p = await store.getProgress('beautiful-shots')
    expect(p).toBeNull()
    expect(window.localStorage.getItem('challenge-progress:beautiful-shots')).toBeNull()
    const fresh = await store.startChallenge('beautiful-shots', makeDate(2026, 9, 6, 10, 0))
    expect(fresh.startedAtLocalDate).toBe('2026-09-06')
  })

  it('corrupted completed array handled', async () => {
    window.localStorage.setItem('challenge-progress:beautiful-shots', JSON.stringify({ challengeId: 'beautiful-shots', startedAt: new Date().toISOString(), startedAtLocalDate: '2026-09-06', completed: [{ day: 'bad', completedAt: 'bad', mode: 'bad' }] }))
    const store = new LocalStorageChallengeProgressStore()
    const p = await store.getProgress('beautiful-shots')
    expect(p).toBeNull()
  })

  it('available day clamp via store uses local date', async () => {
    const store = new LocalStorageChallengeProgressStore()
    await store.startChallenge('beautiful-shots', makeDate(2026, 8, 1, 10, 0))
    const p = await store.getProgress('beautiful-shots')
    const avail = getAvailableDay(p, makeDate(2026, 12, 31, 10, 0))
    expect(avail).toBe(30)
  })
})

describe('challenge definition', () => {
  it('has duration 30 with only 7 published days', () => {
    expect(beautifulShotsChallenge.durationDays).toBe(30)
    expect(beautifulShotsChallenge.days).toHaveLength(7)
    expect(beautifulShotsChallenge.id).toBe('beautiful-shots')
    expect(beautifulShotsChallenge.slug).toBe('beautiful-shots')
    for (let i = 1; i <= 7; i++) {
      const d = beautifulShotsChallenge.days.find((x) => x.day === i)!
      expect(d.task.length).toBeGreaterThan(10)
      expect(d.tips).toBeDefined()
      expect(d.difficulty).toBeGreaterThanOrEqual(1)
    }
    expect(beautifulShotsChallenge.days.find((x) => x.day === 8)).toBeUndefined()
  })

  it('heroImage may be undefined without breaking', () => {
    const d1 = beautifulShotsChallenge.days[0]
    expect(d1.heroImage === undefined || typeof d1.heroImage === 'string').toBe(true)
  })
})
