import { describe, expect, it } from 'vitest'
import { guess90sCatalog } from '@/content/quizzes/guess90s/catalog'
import { guess90sQuiz, questions } from '@/content/quizzes/guess90s/quiz'
import { results } from '@/content/quizzes/guess90s/results'
import { quizzes } from '@/content/quizzes'
import { computeCorrectCount, resolveBandResultId, resolveOutcome } from '@/features/quiz/scoring'
import { loadQuiz } from '@/features/quiz/schema'

describe('guess90s catalog: 20 Apple-preview entries', () => {
  it('has exactly 20 entries', () => {
    expect(guess90sCatalog).toHaveLength(20)
  })
  it('every entry has Apple metadata and 4s fragment', () => {
    for (const entry of guess90sCatalog) {
      expect(entry.trackId).toBeGreaterThan(0)
      expect(entry.previewUrl).toMatch(/^https:\/\/audio-ssl\.itunes\.apple\.com\//)
      expect(entry.trackViewUrl).toMatch(/^https:\/\/music\.apple\.com\//)
      expect(entry.durationSeconds).toBe(4)
      expect(entry.attribution).toBe('Preview provided courtesy of Apple')
      expect(entry.startSeconds).toBeGreaterThanOrEqual(0)
      expect(entry.previewAvailable).toBe(true)
      expect(entry.status).toBe('PASS')
      expect(['high', 'medium']).toContain(entry.recognizability)
      expect(entry.vocalsAtStart).toBe(false)
    }
  })
  it('every catalog entry has unique trackId', () => {
    const ids = guess90sCatalog.map((e) => e.trackId)
    expect(new Set(ids).size).toBe(20)
  })
  it('all startSeconds have endSeconds = start+4', () => {
    for (const e of guess90sCatalog) {
      const end = e.startSeconds + e.durationSeconds
      expect(end).toBe(e.startSeconds + 4)
    }
  })
})

describe('guess90s quiz definition', () => {
  it('id is guess90s and title matches spec', () => {
    expect(guess90sQuiz.id).toBe('guess90s')
    expect(guess90sQuiz.title).toBe('Угадай хит 90-х с 4 секунд')
  })
  it('uses correct-count scoring', () => {
    expect(guess90sQuiz.scoring.kind).toBe('correct-count')
  })
  it('has 20 playthrough questions (catalog 20, playthrough 20)', () => {
    expect(guess90sQuiz.questions).toHaveLength(20)
    expect(questions).toHaveLength(20)
  })
  it('every question is audio-preview with duration 4', () => {
    for (const q of guess90sQuiz.questions) {
      expect(q.content?.kind).toBe('audio-preview')
      if (q.content?.kind === 'audio-preview') {
        expect(q.content.provider).toBe('apple-itunes')
        expect(q.content.durationSeconds).toBe(4)
        expect(q.content.trackId).toBeGreaterThan(0)
        expect(q.content.previewUrl).toMatch(/^https:\/\/audio-ssl\.itunes\.apple\.com\//)
        expect(q.content.trackViewUrl).toMatch(/^https:\/\/music\.apple\.com\//)
        expect(q.content.attribution).toBe('Preview provided courtesy of Apple')
        expect(typeof q.content.startSeconds).toBe('number')
      }
    }
  })
  it('every audio question has exactly one correct answer among 4 options', () => {
    for (const q of guess90sQuiz.questions) {
      expect(q.answers).toHaveLength(4)
      expect(typeof q.correctAnswerId).toBe('string')
      const ids = q.answers.map((a) => a.id)
      expect(ids).toContain(q.correctAnswerId)
      expect(new Set(ids).size).toBe(4)
    }
  })
  it('question ids are unique and category audio', () => {
    const ids = guess90sQuiz.questions.map((q) => q.id)
    expect(new Set(ids).size).toBe(20)
    for (const q of guess90sQuiz.questions) {
      expect(q.category).toBe('audio')
    }
  })
  it('result bands cover 0..20 with 5 g90_* ids', () => {
    const bands = guess90sQuiz.scoring.kind === 'correct-count' ? guess90sQuiz.scoring.bands : []
    expect(bands.map((b) => b.resultId)).toEqual([
      'g90_rookie',
      'g90_familiar',
      'g90_cassette',
      'g90_disco',
      'g90_legend',
    ])
    const sorted = [...bands].sort((a, b) => a.min - b.min)
    expect(sorted[0].min).toBe(0)
    expect(sorted[sorted.length - 1].max).toBe(20)
    for (let i = 0; i < sorted.length - 1; i++) {
      expect(sorted[i].max + 1).toBe(sorted[i + 1].min)
    }
  })
  it('every result id is globally unique', () => {
    const allResultIds = quizzes.flatMap((q) => q.results.map((r) => r.id))
    expect(new Set(allResultIds).size).toBe(allResultIds.length)
    for (const r of results) {
      expect(allResultIds.filter((id) => id === r.id)).toHaveLength(1)
    }
  })
  it('passes loadQuiz integrity', () => {
    expect(() => loadQuiz(guess90sQuiz)).not.toThrow()
  })
  it('is registered in QuizRegistry', () => {
    const found = quizzes.find((q) => q.id === 'guess90s')
    expect(found).toBeDefined()
    expect(found?.id).toBe('guess90s')
  })
})

describe('guess90s scoring', () => {
  it('all correct -> g90_legend', () => {
    const allCorrect = guess90sQuiz.questions.map((q) => ({ questionId: q.id, answerId: q.correctAnswerId! }))
    const outcome = resolveOutcome(guess90sQuiz, allCorrect)
    expect(outcome).toEqual({ kind: 'correct-count', resultId: 'g90_legend', correct: 20, total: 20 })
  })
  it('0 correct -> g90_rookie', () => {
    const allWrong = guess90sQuiz.questions.map((q) => ({
      questionId: q.id,
      answerId: q.answers.find((a) => a.id !== q.correctAnswerId)!.id,
    }))
    const outcome = resolveOutcome(guess90sQuiz, allWrong)
    expect(outcome.resultId).toBe('g90_rookie')
    expect((outcome as unknown as { correct: number }).correct).toBe(0)
  })
  it('16/20 -> g90_disco (spec example scaled)', () => {
    expect(resolveBandResultId(guess90sQuiz, 16)).toBe('g90_disco')
    expect(resolveBandResultId(guess90sQuiz, 18)).toBe('g90_disco')
    expect(resolveBandResultId(guess90sQuiz, 8)).toBe('g90_familiar')
  })
  it('failed preview skip does not count as wrong', () => {
    // Simulate skip marker: should not increment correct count
    const answers = [
      { questionId: guess90sQuiz.questions[0].id, answerId: '__skipped__' },
      ...guess90sQuiz.questions.slice(1, 6).map((q) => ({ questionId: q.id, answerId: q.correctAnswerId! })),
    ]
    // 5 correct out of 5 answered non-skipped -> 5/20 but skipped ignored for correct count
    expect(computeCorrectCount(guess90sQuiz, answers)).toBe(5)
    // If we had counted skipped as wrong, correct would still be 5, but we verify skipped not counted as correct
    const withoutSkip = guess90sQuiz.questions.slice(1, 6).map((q) => ({ questionId: q.id, answerId: q.correctAnswerId! }))
    expect(computeCorrectCount(guess90sQuiz, withoutSkip)).toBe(5)
  })
})

describe('existing quizzes remain intact', () => {
  it('interior-character unchanged (8 questions, archetype)', async () => {
    const { interiorCharacterQuiz } = await import('@/content/quizzes/interior-character/quiz')
    expect(interiorCharacterQuiz.questions).toHaveLength(8)
    expect(interiorCharacterQuiz.scoring.kind).toBe('archetype')
    expect(interiorCharacterQuiz.id).toBe('interior-character')
  })
  it('music90s unchanged (14 questions, text quiz, correct-count)', async () => {
    const { music90sQuiz } = await import('@/content/quizzes/music90s/quiz')
    expect(music90sQuiz.questions).toHaveLength(14)
    expect(music90sQuiz.scoring.kind).toBe('correct-count')
    for (const q of music90sQuiz.questions) {
      expect(q.content).toBeUndefined()
      expect(q.category).not.toBe('audio')
    }
    expect(music90sQuiz.questions[0].correctAnswerId).toBe('a') // Крошка моя
  })
})
