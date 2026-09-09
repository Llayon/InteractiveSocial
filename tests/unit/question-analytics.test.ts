import { describe, expect, it, vi } from 'vitest'
import {
  computeElapsedMs,
  ELAPSED_MS_CAP,
  generateRunId,
  getQuestionAnalyticsCategory,
  nowMs,
} from '@/analytics/questionAnalytics'
import { MUSIC90_CATEGORY_BY_ID } from '@/content/quizzes/music90s/select'
import { music90sQuiz } from '@/content/quizzes/music90s/quiz'
import { interiorCharacterQuiz } from '@/content/quizzes/interior-character/quiz'
import { guess90sQuiz } from '@/content/quizzes/guess90s/quiz'

describe('questionAnalytics helper', () => {
  it('generateRunId produces non-empty string and different on each call', () => {
    const a = generateRunId()
    const b = generateRunId()
    expect(typeof a).toBe('string')
    expect(a.length).toBeGreaterThan(5)
    expect(a).not.toBe(b)
  })

  it('generateRunId with crypto mocked is deterministic via injected generator', () => {
    const mockUUID = vi.fn(() => 'test-uuid-123')
    const spy = vi.spyOn(globalThis.crypto as unknown as { randomUUID: () => string }, 'randomUUID').mockImplementation(mockUUID as unknown as () => string)
    const id = generateRunId()
    expect(id).toBe('test-uuid-123')
    expect(mockUUID).toHaveBeenCalled()
    spy.mockRestore()
  })

  it('getQuestionAnalyticsCategory returns canonical for music90s', () => {
    for (const q of music90sQuiz.questions) {
      const cat = getQuestionAnalyticsCategory(music90sQuiz, q)
      expect(cat).toBe(MUSIC90_CATEGORY_BY_ID[q.id])
    }
  })

  it('getQuestionAnalyticsCategory for interior returns undefined (no semantics)', () => {
    const q = interiorCharacterQuiz.questions[0]
    const cat = getQuestionAnalyticsCategory(interiorCharacterQuiz, q)
    expect(cat).toBeUndefined()
  })

  it('getQuestionAnalyticsCategory for guess90s returns audio', () => {
    const q = guess90sQuiz.questions[0]
    const cat = getQuestionAnalyticsCategory(guess90sQuiz, q)
    expect(cat).toBe('audio')
  })

  it('computeElapsedMs calculates correctly and caps', () => {
    expect(computeElapsedMs(1000, 4750)).toBe(3750)
    expect(computeElapsedMs(undefined, 2000)).toBe(0)
    expect(computeElapsedMs(5000, 4000)).toBe(0) // negative -> 0
    expect(computeElapsedMs(0, 700_000)).toBe(ELAPSED_MS_CAP)
    expect(ELAPSED_MS_CAP).toBe(600_000)
  })

  it('nowMs uses performance.now when available', () => {
    const spy = vi.spyOn(performance, 'now').mockReturnValue(1234.5)
    expect(nowMs()).toBe(1234.5)
    spy.mockRestore()
  })

  it('computeElapsedMs caps at 600_000 as documented', () => {
    const capped = computeElapsedMs(0, 1_000_000)
    expect(capped).toBe(600_000)
    expect(capped).toBeLessThanOrEqual(600_000)
  })
})

describe('computeElapsedMs edge', () => {
  it('elapsed_ms >=0 and <= cap always', () => {
    expect(computeElapsedMs(0, 0)).toBe(0)
    expect(computeElapsedMs(100, 100)).toBe(0)
    expect(computeElapsedMs(0, 599_999)).toBe(599_999)
    expect(computeElapsedMs(0, 600_001)).toBe(600_000)
  })
})
