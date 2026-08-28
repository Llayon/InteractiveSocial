import { describe, expect, it } from 'vitest'
import { music90sQuiz } from '@/content/quizzes/music90s/quiz'
import {
  computeCorrectCount,
  resolveBandResultId,
  resolveCorrectCountOutcome,
  resolveOutcome,
  scoreCardAsset,
} from '@/features/quiz/scoring'

const q = music90sQuiz

function answerAll(ids: string[]) {
  return ids.map((answerId, i) => ({ questionId: q.questions[i].id, answerId }))
}

describe('Music90s: correct-count scoring config', () => {
  it('has scoring.kind === correct-count', () => {
    expect(q.scoring.kind).toBe('correct-count')
  })

  it('has exactly 10 questions, each with a single valid correct answer', () => {
    expect(q.questions).toHaveLength(10)
    for (const question of q.questions) {
      expect(typeof question.correctAnswerId).toBe('string')
      const ids = question.answers.map((a) => a.id)
      expect(ids).toContain(question.correctAnswerId)
    }
  })

  it('uses the canonical five bands covering 0..10 with no gaps/overlaps', () => {
    const bands = q.scoring.kind === 'correct-count' ? q.scoring.bands : []
    expect(bands.map((b) => b.resultId)).toEqual([
      'm90_rookie',
      'm90_familiar',
      'm90_cassette',
      'm90_disco',
      'm90_legend',
    ])
    const sorted = [...bands].sort((a, b) => a.min - b.min)
    expect(sorted[0].min).toBe(0)
    expect(sorted[sorted.length - 1].max).toBe(10)
    for (let i = 0; i < sorted.length - 1; i++) {
      expect(sorted[i].max + 1).toBe(sorted[i + 1].min)
    }
  })

  it('has globally namespaced result ids (m90_*)', () => {
    for (const result of q.results) {
      expect(result.id).toMatch(/^m90_/)
    }
  })
})

describe('Music90s: correct answers match the approved content', () => {
  it('m1 (emoji) — «Тучи» = answer c', () => {
    expect(q.questions[0].correctAnswerId).toBe('c')
  })
  it('m2 (emoji) — «Кассета и CD — главные носители» = answer a', () => {
    expect(q.questions[1].correctAnswerId).toBe('a')
  })
  it('m3 (artist) — «Крошка моя» = Руки Вверх! = answer b', () => {
    expect(q.questions[2].correctAnswerId).toBe('b')
  })
  it('m4 (artist) — «Тучи» = Иванушки International = answer c', () => {
    expect(q.questions[3].correctAnswerId).toBe('c')
  })
  it('m5 (timeline) — Иванушки 1995 = earliest = answer a', () => {
    expect(q.questions[4].correctAnswerId).toBe('a')
  })
  it('m6 (timeline) — «Тучи» 1997 = earliest = answer b', () => {
    expect(q.questions[5].correctAnswerId).toBe('b')
  })
  it('m7 (title) — Земфира «Я сошла с ума» = answer d', () => {
    expect(q.questions[6].correctAnswerId).toBe('d')
  })
  it('m8 (title) — «Тополиный пух» = answer a', () => {
    expect(q.questions[7].correctAnswerId).toBe('a')
  })
  it('m9 (absurd) — «Руки Вверх!» = answer c', () => {
    expect(q.questions[8].correctAnswerId).toBe('c')
  })
  it('m10 (absurd) — «Владимирский централ» = answer b', () => {
    expect(q.questions[9].correctAnswerId).toBe('b')
  })
})

describe('Music90s: score → band → result mapping', () => {
  it.each([
    [0, 'm90_rookie'],
    [1, 'm90_rookie'],
    [2, 'm90_rookie'],
    [3, 'm90_familiar'],
    [4, 'm90_familiar'],
    [5, 'm90_cassette'],
    [6, 'm90_cassette'],
    [7, 'm90_disco'],
    [8, 'm90_disco'],
    [9, 'm90_legend'],
    [10, 'm90_legend'],
  ])('score %i → %s', (score, expected) => {
    expect(resolveBandResultId(q, score)).toBe(expected)
  })

  it('rejects scores outside 0..total (programming error)', () => {
    expect(() => resolveBandResultId(q, -1)).toThrow()
    expect(() => resolveBandResultId(q, 11)).toThrow()
  })
})

describe('Music90s: outcome boundary', () => {
  it('all-correct answers resolve to m90_legend with correct=10/total=10', () => {
    const allCorrect = answerAll(q.questions.map((qu) => qu.correctAnswerId!))
    const outcome = resolveCorrectCountOutcome(q, allCorrect)
    expect(outcome).toEqual({
      kind: 'correct-count',
      resultId: 'm90_legend',
      correct: 10,
      total: 10,
    })
  })

  it('all-wrong answers resolve to m90_rookie with correct=0/total=10', () => {
    const allWrong = answerAll(
      q.questions.map((qu) => qu.answers.find((a) => a.id !== qu.correctAnswerId)!.id),
    )
    const outcome = resolveCorrectCountOutcome(q, allWrong)
    expect(outcome).toEqual({
      kind: 'correct-count',
      resultId: 'm90_rookie',
      correct: 0,
      total: 10,
    })
  })

  it('mixed answer set maps to the correct band (e.g. 6/10 → cassette)', () => {
    const half = q.questions.map((qu, i) => ({
      questionId: qu.id,
      answerId: i < 6 ? qu.correctAnswerId! : qu.answers.find((a) => a.id !== qu.correctAnswerId)!.id,
    }))
    expect(computeCorrectCount(q, half)).toBe(6)
    const outcome = resolveOutcome(q, half)
    expect(outcome).toEqual({
      kind: 'correct-count',
      resultId: 'm90_cassette',
      correct: 6,
      total: 10,
    })
  })

  it('answer list ordering never changes the outcome (correct set)', () => {
    // correct-count resolution is order-agnostic: computeCorrectCount walks
    // ALL quiz.questions and the band lookup uses the raw count. Reverse
    // the SAME (questionId, answerId) pairs — not just the answerIds.
    const correct = q.questions.map((qu) => ({ questionId: qu.id, answerId: qu.correctAnswerId! }))
    const reversed = [...correct].reverse()
    const a = resolveOutcome(q, correct)
    const b = resolveOutcome(q, reversed)
    expect(a.resultId).toBe(b.resultId)
    expect(computeCorrectCount(q, correct)).toBe(computeCorrectCount(q, reversed))
  })
})

describe('Music90s: share-card asset key encoding', () => {
  it('two-digit zero-padded score_XX', () => {
    expect(scoreCardAsset(0)).toBe('score_00')
    expect(scoreCardAsset(7)).toBe('score_07')
    expect(scoreCardAsset(10)).toBe('score_10')
  })
})
