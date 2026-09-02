import { describe, expect, it } from 'vitest'
import { music90sQuiz } from '@/content/quizzes/music90s/quiz'
import { quizzes } from '@/content/quizzes'
import { codesForQuiz } from '@/content/quizzes/codes'
import {
  computeCorrectCount,
  resolveBandResultId,
  resolveCorrectCountOutcome,
  resolveOutcome,
  resolveShareCardAsset,
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

  it('has exactly 18 questions, each with a single valid correct answer', () => {
    expect(q.questions).toHaveLength(18)
    for (const question of q.questions) {
      expect(typeof question.correctAnswerId).toBe('string')
      const ids = question.answers.map((a) => a.id)
      expect(ids).toContain(question.correctAnswerId)
      expect(new Set(ids).size).toBe(ids.length)
      expect(ids).toHaveLength(4)
    }
    const qids = q.questions.map((qu) => qu.id)
    expect(new Set(qids).size).toBe(qids.length)
    expect(qids).toEqual(['m1','m2','m3','m4','m5','m6','m7','m8','m9','m10','m11','m12','m13','m14','m15','m16','m17','m18'])
  })

  it('uses the canonical seven bands covering 0..18 with no gaps/overlaps', () => {
    const bands = q.scoring.kind === 'correct-count' ? q.scoring.bands : []
    expect(bands.map((b) => b.resultId)).toEqual([
      'm90_rookie',
      'm90_familiar',
      'm90_cassette',
      'm90_disco',
      'm90_legend',
      'm90_era17',
      'm90_era18',
    ])
    const sorted = [...bands].sort((a, b) => a.min - b.min)
    expect(sorted[0].min).toBe(0)
    expect(sorted[sorted.length - 1].max).toBe(18)
    for (let i = 0; i < sorted.length - 1; i++) {
      expect(sorted[i].max + 1).toBe(sorted[i + 1].min)
    }
    expect(sorted[0]).toEqual({ min: 0, max: 4, resultId: 'm90_rookie' })
    expect(sorted[1]).toEqual({ min: 5, max: 7, resultId: 'm90_familiar' })
    expect(sorted[2]).toEqual({ min: 8, max: 10, resultId: 'm90_cassette' })
    expect(sorted[3]).toEqual({ min: 11, max: 13, resultId: 'm90_disco' })
    expect(sorted[4]).toEqual({ min: 14, max: 16, resultId: 'm90_legend' })
    expect(sorted[5]).toEqual({ min: 17, max: 17, resultId: 'm90_era17' })
    expect(sorted[6]).toEqual({ min: 18, max: 18, resultId: 'm90_era18' })
  })

  it('has globally namespaced result ids (m90_*) and 7 results', () => {
    expect(q.results).toHaveLength(7)
    for (const result of q.results) {
      expect(result.id).toMatch(/^m90_/)
    }
  })

  it('all result IDs remain globally unique', () => {
    const allResultIds = quizzes.flatMap((quiz) => quiz.results.map((r) => r.id))
    expect(new Set(allResultIds).size).toBe(allResultIds.length)
  })

  it('all wire codes remain valid and unique', () => {
    const codes = codesForQuiz('music90s')
    expect(codes).not.toBeNull()
    const vals = Object.values(codes!.results)
    expect(new Set(vals).size).toBe(vals.length)
    expect(codes!.results).toHaveProperty('m90_rookie')
    expect(codes!.results).toHaveProperty('m90_familiar')
    expect(codes!.results).toHaveProperty('m90_cassette')
    expect(codes!.results).toHaveProperty('m90_disco')
    expect(codes!.results).toHaveProperty('m90_legend')
    expect(codes!.results).toHaveProperty('m90_era17')
    expect(codes!.results).toHaveProperty('m90_era18')
    // legacy code 'lg' still maps to m90_legend
    expect(codes!.results['m90_legend']).toBe('lg')
  })

  it('question order and correct answers match the fixed 18 spec', () => {
    const expected: Array<{ id: string; correct: string }> = [
      { id: 'm1', correct: 'a' }, // Крошка моя
      { id: 'm2', correct: 'b' }, // Влад Сташевский
      { id: 'm3', correct: 'b' }, // Алёна Апина
      { id: 'm4', correct: 'a' }, // Одинокий голубь
      { id: 'm5', correct: 'd' }, // Я сошла с ума
      { id: 'm6', correct: 'c' }, // Натали — Мальчик хочет в Тамбов
      { id: 'm7', correct: 'b' }, // Ольга Шелест и Антон Комолов
      { id: 'm8', correct: 'b' }, // Cool Girl
      { id: 'm9', correct: 'c' }, // Mr. Credo
      { id: 'm10', correct: 'b' }, // Максим Фадеев
      { id: 'm11', correct: 'b' }, // Стрелки
      { id: 'm12', correct: 'b' }, // Тополиный пух
      { id: 'm13', correct: 'a' }, // Шура
      { id: 'm14', correct: 'b' }, // Лика Стар — Одинокая луна
      { id: 'm15', correct: 'a' }, // Ты меня не ищи
      { id: 'm16', correct: 'b' }, // Ветлицкая — Посмотри в глаза
      { id: 'm17', correct: 'b' }, // Андрей Губин
      { id: 'm18', correct: 'b' }, // На сахарную воду
    ]
    expected.forEach(({ id, correct }, i) => {
      expect(q.questions[i].id).toBe(id)
      expect(q.questions[i].correctAnswerId).toBe(correct)
    })
  })

  it('landing meta says 18 questions', () => {
    expect(q.subtitle).toContain('18 вопросов')
    expect(q.landing.meta.join(' ')).toContain('18 вопросов')
    expect(q.landing.paragraphs.join(' ')).toContain('Восемнадцать вопросов')
    expect(q.landing.meta.join(' ')).toContain('около 4 минут')
  })

  it('categories and difficulty are advisory and layout remains choice', () => {
    for (const qu of q.questions) {
      expect(qu.layout).toBe('choice')
      expect(typeof qu.category).toBe('string')
    }
  })
})

describe('Music90s: correct answers match the approved content', () => {
  it('m1 — Крошка моя = a', () => { expect(q.questions[0].correctAnswerId).toBe('a') })
  it('m2 — Влад Сташевский = b', () => { expect(q.questions[1].correctAnswerId).toBe('b') })
  it('m3 — Алёна Апина = b', () => { expect(q.questions[2].correctAnswerId).toBe('b') })
  it('m4 — Одинокий голубь = a', () => { expect(q.questions[3].correctAnswerId).toBe('a') })
  it('m5 — Я сошла с ума = d', () => { expect(q.questions[4].correctAnswerId).toBe('d') })
  it('m6 — mismatch Натали = c', () => { expect(q.questions[5].correctAnswerId).toBe('c') })
  it('m7 — Ольга Шелест и Антон Комолов = b', () => { expect(q.questions[6].correctAnswerId).toBe('b') })
  it('m8 — Cool Girl = b', () => { expect(q.questions[7].correctAnswerId).toBe('b') })
  it('m9 — Mr. Credo = c', () => { expect(q.questions[8].correctAnswerId).toBe('c') })
  it('m10 — Максим Фадеев = b', () => { expect(q.questions[9].correctAnswerId).toBe('b') })
  it('m11 — Стрелки = b', () => { expect(q.questions[10].correctAnswerId).toBe('b') })
  it('m12 — Тополиный пух = b', () => { expect(q.questions[11].correctAnswerId).toBe('b') })
  it('m13 — Шура = a', () => { expect(q.questions[12].correctAnswerId).toBe('a') })
  it('m14 — Лика Стар Одинокая луна = b', () => { expect(q.questions[13].correctAnswerId).toBe('b') })
  it('m15 — Ты меня не ищи = a', () => { expect(q.questions[14].correctAnswerId).toBe('a') })
  it('m16 — Ветлицкая Посмотри в глаза = b', () => { expect(q.questions[15].correctAnswerId).toBe('b') })
  it('m17 — Андрей Губин = b', () => { expect(q.questions[16].correctAnswerId).toBe('b') })
  it('m18 — На сахарную воду = b', () => { expect(q.questions[17].correctAnswerId).toBe('b') })
})

describe('Music90s: score → band → result mapping', () => {
  it.each([
    [0, 'm90_rookie'],
    [1, 'm90_rookie'],
    [2, 'm90_rookie'],
    [3, 'm90_rookie'],
    [4, 'm90_rookie'],
    [5, 'm90_familiar'],
    [6, 'm90_familiar'],
    [7, 'm90_familiar'],
    [8, 'm90_cassette'],
    [9, 'm90_cassette'],
    [10, 'm90_cassette'],
    [11, 'm90_disco'],
    [12, 'm90_disco'],
    [13, 'm90_disco'],
    [14, 'm90_legend'],
    [15, 'm90_legend'],
    [16, 'm90_legend'],
    [17, 'm90_era17'],
    [18, 'm90_era18'],
  ])('score %i → %s', (score, expected) => {
    expect(resolveBandResultId(q, score)).toBe(expected)
  })

  it('rejects scores outside 0..18 and non-integers', () => {
    expect(() => resolveBandResultId(q, -1)).toThrow()
    expect(() => resolveBandResultId(q, 19)).toThrow()
    expect(() => resolveBandResultId(q, NaN)).toThrow()
    expect(Number.isInteger(7.5)).toBe(false)
    expect(resolveBandResultId(q, 10)).toBe('m90_cassette')
    expect(resolveBandResultId(q, 10)).not.toBe('m90_rookie')
  })

  it('17 and 18 are dedicated standalone outcomes', () => {
    expect(resolveBandResultId(q, 17)).toBe('m90_era17')
    expect(resolveBandResultId(q, 18)).toBe('m90_era18')
    expect(resolveBandResultId(q, 17)).not.toBe(resolveBandResultId(q, 18))
    expect(resolveBandResultId(q, 16)).not.toBe(resolveBandResultId(q, 17))
  })
})

describe('Music90s: outcome boundary', () => {
  it('all-correct answers resolve to m90_era18 with correct=18/total=18', () => {
    const allCorrect = answerAll(q.questions.map((qu) => qu.correctAnswerId!))
    const outcome = resolveCorrectCountOutcome(q, allCorrect)
    expect(outcome).toEqual({
      kind: 'correct-count',
      resultId: 'm90_era18',
      correct: 18,
      total: 18,
    })
  })

  it('all-wrong answers resolve to m90_rookie with correct=0/total=18', () => {
    const allWrong = answerAll(
      q.questions.map((qu) => qu.answers.find((a) => a.id !== qu.correctAnswerId)!.id),
    )
    const outcome = resolveCorrectCountOutcome(q, allWrong)
    expect(outcome).toEqual({
      kind: 'correct-count',
      resultId: 'm90_rookie',
      correct: 0,
      total: 18,
    })
  })

  it('mixed answer set maps to the correct band (e.g. 6/18 → familiar)', () => {
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
      total: 18,
    })
  })

  it('17/18 → m90_era17 boundary', () => {
    const seventeen = q.questions.map((qu, i) => ({
      questionId: qu.id,
      answerId: i < 17 ? qu.correctAnswerId! : qu.answers.find((a) => a.id !== qu.correctAnswerId)!.id,
    }))
    expect(computeCorrectCount(q, seventeen)).toBe(17)
    expect(resolveOutcome(q, seventeen).resultId).toBe('m90_era17')
  })

  it('14/18 → m90_legend (Главред журнала Cool) boundary', () => {
    const fourteen = q.questions.map((qu, i) => ({
      questionId: qu.id,
      answerId: i < 14 ? qu.correctAnswerId! : qu.answers.find((a) => a.id !== qu.correctAnswerId)!.id,
    }))
    expect(computeCorrectCount(q, fourteen)).toBe(14)
    expect(resolveOutcome(q, fourteen).resultId).toBe('m90_legend')
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

describe('Music90s: share-card asset key encoding (quiz-scoped)', () => {
  it('two-digit zero-padded m90_score_XX', () => {
    expect(scoreCardAsset(q, 0)).toBe('m90_score_00')
    expect(scoreCardAsset(q, 7)).toBe('m90_score_07')
    expect(scoreCardAsset(q, 18)).toBe('m90_score_18')
  })
  it('covers 0..18 with quiz prefix', () => {
    for (let s = 0; s <= 18; s++) {
      expect(scoreCardAsset(q, s)).toBe(`m90_score_${String(s).padStart(2, '0')}`)
    }
  })
  it('boundary assets exist logically (resolver)', () => {
    expect(scoreCardAsset(q, 17)).toBe('m90_score_17')
    expect(scoreCardAsset(q, 18)).toBe('m90_score_18')
    expect(scoreCardAsset(q, 14)).toBe('m90_score_14')
    expect(scoreCardAsset(q, 0)).toBe('m90_score_00')
  })
  it('music90s 9 → m90_score_09 (9/18) and 18 → m90_score_18 (18/18)', () => {
    expect(scoreCardAsset(q, 9)).toBe('m90_score_09')
    expect(scoreCardAsset(q, 18)).toBe('m90_score_18')
    // via resolver
    const r9 = q.results.find((r) => r.id === resolveBandResultId(q, 9))!
    const r18 = q.results.find((r) => r.id === resolveBandResultId(q, 18))!
    expect(resolveShareCardAsset(q, r9, 9)).toBe('m90_score_09')
    expect(resolveShareCardAsset(q, r18, 18)).toBe('m90_score_18')
  })
})
