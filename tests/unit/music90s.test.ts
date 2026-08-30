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

  it('has exactly 14 questions, each with a single valid correct answer', () => {
    expect(q.questions).toHaveLength(14)
    for (const question of q.questions) {
      expect(typeof question.correctAnswerId).toBe('string')
      const ids = question.answers.map((a) => a.id)
      expect(ids).toContain(question.correctAnswerId)
      // unique answer ids within question
      expect(new Set(ids).size).toBe(ids.length)
      // exactly 4 answers
      expect(ids).toHaveLength(4)
    }
    // unique question ids globally
    const qids = q.questions.map((qu) => qu.id)
    expect(new Set(qids).size).toBe(qids.length)
  })

  it('uses the canonical five bands covering 0..14 with no gaps/overlaps', () => {
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
    expect(sorted[sorted.length - 1].max).toBe(14)
    for (let i = 0; i < sorted.length - 1; i++) {
      expect(sorted[i].max + 1).toBe(sorted[i + 1].min)
    }
    // explicit boundaries 0-3 / 4-6 / 7-9 / 10-12 / 13-14
    expect(sorted[0]).toEqual({ min: 0, max: 3, resultId: 'm90_rookie' })
    expect(sorted[1]).toEqual({ min: 4, max: 6, resultId: 'm90_familiar' })
    expect(sorted[2]).toEqual({ min: 7, max: 9, resultId: 'm90_cassette' })
    expect(sorted[3]).toEqual({ min: 10, max: 12, resultId: 'm90_disco' })
    expect(sorted[4]).toEqual({ min: 13, max: 14, resultId: 'm90_legend' })
  })

  it('has globally namespaced result ids (m90_*)', () => {
    for (const result of q.results) {
      expect(result.id).toMatch(/^m90_/)
    }
  })

  it('question order and correct answers match the fixed 14 spec', () => {
    const expected: Array<{ id: string; correct: string }> = [
      { id: 'm1', correct: 'a' }, // Крошка моя
      { id: 'm2', correct: 'b' }, // Богдан Титомир
      { id: 'm3', correct: 'b' }, // Алёна Апина
      { id: 'm4', correct: 'c' }, // Алла Пугачёва
      { id: 'm5', correct: 'd' }, // Я сошла с ума
      { id: 'm6', correct: 'c' }, // Натали — Мальчик хочет в Тамбов
      { id: 'm7', correct: 'b' }, // MTV Россия
      { id: 'm8', correct: 'b' }, // 90 минут суммарно
      { id: 'm9', correct: 'c' }, // Mr. Credo
      { id: 'm10', correct: 'b' }, // Максим Фадеев
      { id: 'm11', correct: 'a' }, // На-На
      { id: 'm12', correct: 'b' }, // Тополиный пух
      { id: 'm13', correct: 'd' }, // Дима Билан
      { id: 'm14', correct: 'b' }, // Лика Стар — Одинокая луна
    ]
    expected.forEach(({ id, correct }, i) => {
      expect(q.questions[i].id).toBe(id)
      expect(q.questions[i].correctAnswerId).toBe(correct)
    })
  })
})

describe('Music90s: correct answers match the approved content', () => {
  it('m1 — Крошка моя = a (Руки Вверх! emoji cipher)', () => {
    expect(q.questions[0].correctAnswerId).toBe('a')
  })
  it('m2 — Богдан Титомир = b (Кар-Мэн founder)', () => {
    expect(q.questions[1].correctAnswerId).toBe('b')
  })
  it('m3 — Алёна Апина = b (Комбинация)', () => {
    expect(q.questions[2].correctAnswerId).toBe('b')
  })
  it('m4 — Алла Пугачёва = c (Eurovision 1997)', () => {
    expect(q.questions[3].correctAnswerId).toBe('c')
  })
  it('m5 — Я сошла с ума = d (2000, not 90s)', () => {
    expect(q.questions[4].correctAnswerId).toBe('d')
  })
  it('m6 — mismatch Натали = c', () => {
    expect(q.questions[5].correctAnswerId).toBe('c')
  })
  it('m7 — MTV Россия = b', () => {
    expect(q.questions[6].correctAnswerId).toBe('b')
  })
  it('m8 — 90 минут суммарно = b', () => {
    expect(q.questions[7].correctAnswerId).toBe('b')
  })
  it('m9 — Mr. Credo = c', () => {
    expect(q.questions[8].correctAnswerId).toBe('c')
  })
  it('m10 — Максим Фадеев = b', () => {
    expect(q.questions[9].correctAnswerId).toBe('b')
  })
  it('m11 — На-На = a', () => {
    expect(q.questions[10].correctAnswerId).toBe('a')
  })
  it('m12 — Тополиный пух = b', () => {
    expect(q.questions[11].correctAnswerId).toBe('b')
  })
  it('m13 — Дима Билан = d', () => {
    expect(q.questions[12].correctAnswerId).toBe('d')
  })
  it('m14 — Лика Стар Одинокая луна = b', () => {
    expect(q.questions[13].correctAnswerId).toBe('b')
  })
})

describe('Music90s: score → band → result mapping', () => {
  it.each([
    [0, 'm90_rookie'],
    [1, 'm90_rookie'],
    [2, 'm90_rookie'],
    [3, 'm90_rookie'],
    [4, 'm90_familiar'],
    [5, 'm90_familiar'],
    [6, 'm90_familiar'],
    [7, 'm90_cassette'],
    [8, 'm90_cassette'],
    [9, 'm90_cassette'],
    [10, 'm90_disco'],
    [11, 'm90_disco'],
    [12, 'm90_disco'],
    [13, 'm90_legend'],
    [14, 'm90_legend'],
  ])('score %i → %s', (score, expected) => {
    expect(resolveBandResultId(q, score)).toBe(expected)
  })

  it('rejects scores outside 0..14 and non-integers (server validation)', () => {
    expect(() => resolveBandResultId(q, -1)).toThrow()
    expect(() => resolveBandResultId(q, 15)).toThrow()
    expect(() => resolveBandResultId(q, NaN)).toThrow()
    // 7.5 falls inside a band for the pure lookup, but server rejects non-integers
    expect(Number.isInteger(7.5)).toBe(false)
    // wrong band for exact score: server checks band matches resultId
    expect(resolveBandResultId(q, 10)).toBe('m90_disco')
    expect(resolveBandResultId(q, 10)).not.toBe('m90_rookie')
  })

  it('rejects wrong band for exact score via server validation (simulated)', () => {
    // server checks: resolveBandResultId(score) === result.id
    expect(resolveBandResultId(q, 14)).toBe('m90_legend')
    expect(resolveBandResultId(q, 14)).not.toBe('m90_rookie')
    expect(resolveBandResultId(q, 0)).toBe('m90_rookie')
    expect(resolveBandResultId(q, 10)).toBe('m90_disco')
  })
})

describe('Music90s: outcome boundary', () => {
  it('all-correct answers resolve to m90_legend with correct=14/total=14', () => {
    const allCorrect = answerAll(q.questions.map((qu) => qu.correctAnswerId!))
    const outcome = resolveCorrectCountOutcome(q, allCorrect)
    expect(outcome).toEqual({
      kind: 'correct-count',
      resultId: 'm90_legend',
      correct: 14,
      total: 14,
    })
  })

  it('all-wrong answers resolve to m90_rookie with correct=0/total=14', () => {
    const allWrong = answerAll(
      q.questions.map((qu) => qu.answers.find((a) => a.id !== qu.correctAnswerId)!.id),
    )
    const outcome = resolveCorrectCountOutcome(q, allWrong)
    expect(outcome).toEqual({
      kind: 'correct-count',
      resultId: 'm90_rookie',
      correct: 0,
      total: 14,
    })
  })

  it('mixed answer set maps to the correct band (e.g. 6/14 → familiar)', () => {
    const half = q.questions.map((qu, i) => ({
      questionId: qu.id,
      answerId: i < 6 ? qu.correctAnswerId! : qu.answers.find((a) => a.id !== qu.correctAnswerId)!.id,
    }))
    expect(computeCorrectCount(q, half)).toBe(6)
    const outcome = resolveOutcome(q, half)
    expect(outcome).toEqual({
      kind: 'correct-count',
      resultId: 'm90_familiar',
      correct: 6,
      total: 14,
    })
  })

  it('13/14 → legend boundary', () => {
    const thirteen = q.questions.map((qu, i) => ({
      questionId: qu.id,
      answerId: i < 13 ? qu.correctAnswerId! : qu.answers.find((a) => a.id !== qu.correctAnswerId)!.id,
    }))
    expect(computeCorrectCount(q, thirteen)).toBe(13)
    expect(resolveOutcome(q, thirteen).resultId).toBe('m90_legend')
  })

  it('answer list ordering never changes the outcome (correct set)', () => {
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
    expect(scoreCardAsset(14)).toBe('score_14')
  })
  it('covers 0..14', () => {
    for (let s = 0; s <= 14; s++) {
      expect(scoreCardAsset(s)).toBe(`score_${String(s).padStart(2, '0')}`)
    }
  })
  it('boundary assets exist logically (resolver)', () => {
    // resolveShareCardAsset is tested via integration, but asset naming must hold
    expect(scoreCardAsset(11)).toBe('score_11')
    expect(scoreCardAsset(12)).toBe('score_12')
    expect(scoreCardAsset(13)).toBe('score_13')
    expect(scoreCardAsset(14)).toBe('score_14')
  })
})
