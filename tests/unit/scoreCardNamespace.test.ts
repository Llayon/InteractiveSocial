import { describe, expect, it } from 'vitest'
import { music90sQuiz } from '@/content/quizzes/music90s/quiz'
import { guess90sQuiz } from '@/content/quizzes/guess90s/quiz'
import { RUNTIME_IMAGE_MANIFEST } from '@/images/manifest'
import { resolveShareCardAsset, scoreCardAsset } from '@/features/quiz/scoring'

describe('Quiz-scoped exact-score asset namespace (no collision)', () => {
  it('music90s 9 → m90_score_09 (9/18) via quiz-scoped asset', () => {
    const asset = scoreCardAsset(music90sQuiz, 9)
    expect(asset).toBe('m90_score_09')
    const result = music90sQuiz.results.find((r) => r.id === 'm90_cassette')!
    expect(resolveShareCardAsset(music90sQuiz, result, 9)).toBe('m90_score_09')
    // manifest hero for this exact score must exist and be quiz-scoped
    expect(RUNTIME_IMAGE_MANIFEST.results['m90_score_09']).toBeTruthy()
    // total for music90s is 18, so 9/18 is correct
    expect(music90sQuiz.questions.length).toBe(18)
  })

  it('music90s 18 → m90_score_18 (18/18)', () => {
    const asset = scoreCardAsset(music90sQuiz, 18)
    expect(asset).toBe('m90_score_18')
    const result = music90sQuiz.results.find((r) => r.id === 'm90_era18')!
    expect(resolveShareCardAsset(music90sQuiz, result, 18)).toBe('m90_score_18')
    expect(RUNTIME_IMAGE_MANIFEST.results['m90_score_18']).toBeTruthy()
  })

  it('guess90s 9 → g90_score_09 (9/20) with correct denominator', () => {
    const asset = scoreCardAsset(guess90sQuiz, 9)
    expect(asset).toBe('g90_score_09')
    // guess90s total is its questions.length, must be used for denominator
    const total = guess90sQuiz.questions.length
    // Do not infer from catalog; read actual quiz length
    expect(total).toBeGreaterThan(0)
    // For current implementation guess90s run length is 20 (full catalog)
    expect(total).toBe(20)
    const result = guess90sQuiz.results.find((r) => r.id === 'g90_familiar')! // 6-10 band contains 9
    expect(resolveShareCardAsset(guess90sQuiz, result, 9)).toBe('g90_score_09')
    expect(RUNTIME_IMAGE_MANIFEST.results['g90_score_09']).toBeTruthy()
    // Ensure g90 asset is distinct from m90
    expect(scoreCardAsset(guess90sQuiz, 9)).not.toBe(scoreCardAsset(music90sQuiz, 9))
  })

  it('no asset key collision between quizzes for same score', () => {
    for (let s = 0; s <= 18; s++) {
      const m = scoreCardAsset(music90sQuiz, s)
      const g = scoreCardAsset(guess90sQuiz, s)
      expect(m).not.toBe(g)
      expect(m).toMatch(/^m90_score_/)
      expect(g).toMatch(/^g90_score_/)
    }
    // Ensure generic score_XX is not used for new shares (quiz-scoped required)
    // Check that all exact-score keys in manifest are quiz-scoped, not generic alone
    const mKeys = Array.from({ length: 19 }, (_, i) => `m90_score_${String(i).padStart(2, '0')}`)
    const gKeys = Array.from({ length: 21 }, (_, i) => `g90_score_${String(i).padStart(2, '0')}`)
    for (const k of mKeys) expect(RUNTIME_IMAGE_MANIFEST.results[k]).toBeTruthy()
    for (const k of gKeys) expect(RUNTIME_IMAGE_MANIFEST.results[k]).toBeTruthy()
  })

  it('guess90s actual run length / maximum score is from quiz definition', () => {
    const total = guess90sQuiz.questions.length
    // Report actual value; do not hardcode catalog length inference
    expect(total).toBe(guess90sQuiz.questions.length)
    // Verify bands cover 0..total
    const bands = guess90sQuiz.scoring.kind === 'correct-count' ? guess90sQuiz.scoring.bands : []
    const sorted = [...bands].sort((a, b) => a.min - b.min)
    expect(sorted[0].min).toBe(0)
    expect(sorted[sorted.length - 1].max).toBe(total)
    console.log(`[guess90s] actual run length / max score = ${total}`)
  })
})
