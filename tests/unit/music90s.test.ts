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

  it('category distribution is honest: 2 emoji, 3 artist, 2 timeline, 2 title, 1 album', () => {
    // After the content pass (commit 3162c2a + this cleanup) the two
    // absurd-description prompts were replaced with factual album and
    // artist prompts. The distribution is no longer the symmetric 2×5
    // originally specified; runtime is now honest about what the user
    // actually sees. If we ever want two more absurd questions we
    // should add new ones rather than mislabel existing ones.
    const counts: Record<string, number> = {}
    for (const question of q.questions) {
      const cat = question.category ?? '(none)'
      counts[cat] = (counts[cat] ?? 0) + 1
    }
    expect(counts).toEqual({
      emoji: 2,
      artist: 3,
      timeline: 2,
      title: 2,
      album: 1,
    })
  })

  it('m9 (album) and m10 (artist) reflect the content fix, not the old label', () => {
    // The two questions that used to be tagged 'absurd-description' were
    // rewritten as factual prompts; their categories follow what the
    // user actually sees.
    expect(q.questions.find((x) => x.id === 'm9')?.category).toBe('album')
    expect(q.questions.find((x) => x.id === 'm10')?.category).toBe('artist')
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
  it('m5 (timeline) — Дискотека Авария 1990 = answer a', () => {
    // Per Wikipedia (Musical groups established in 1990), Дискотека Авария
    // (1990) is older than Иванушки International (1995), Руки Вверх!
    // (1996), and Отпетые мошенники (1996).
    expect(q.questions[4].correctAnswerId).toBe('a')
  })
  it('m6 (timeline) — «Тучи» 1996 = answer b', () => {
    // Per Wikipedia (article «Тучи (песня)»), the song was released 1996
    // on the debut album «Конечно он». «Владимирский централ» is 1998,
    // «Ариведерчи» and «Тополиный пух» are 1999.
    expect(q.questions[5].correctAnswerId).toBe('b')
  })
  it('m7 (title) — «Ариведерчи» = answer a', () => {
    // Per Wikipedia (Zemfira album tracklist), «Ариведерчи» is track 12
    // on the 1999 debut album. The other three titles are not on it.
    expect(q.questions[6].correctAnswerId).toBe('a')
  })
  it('m8 (title) — «Тополиный пух» = answer a', () => {
    // Per Wikipedia (Ivanushki International discography), the song appears
    // on the 1999 album «Об этом я буду кричать всю ночь». Distractors
    // «Колечко» and «Тучи» are 1996 («Конечно он»), «Кукла» is 1997
    // («Конечно он Remix»).
    expect(q.questions[7].correctAnswerId).toBe('a')
  })
  it('m9 (absurd) — дебютный альбом «Конечно он» 1996 = answer b', () => {
    // Per Wikipedia (Ivanushki International), the debut studio album is
    // «Конечно он» (1996). «Твои письма» is 1997, «Подожди меня…» is
    // 2000, «10 лет во вселенной» is a 2005 compilation.
    expect(q.questions[8].correctAnswerId).toBe('b')
  })
  it('m10 (absurd) — Михаил Круг = answer b', () => {
    // Per Wikipedia (Mikhail Krug), «Владимирский централ» is a signature
    // song of the Russian chanson singer Михаил Круг (Tver, 1990s).
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
