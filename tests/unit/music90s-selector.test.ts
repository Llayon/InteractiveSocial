import { describe, expect, it } from 'vitest'
import { music90sQuiz } from '@/content/quizzes/music90s/quiz'
import {
  MUSIC90_CATEGORY_BY_ID,
  MUSIC90_QUESTIONS_PER_RUN,
  MUSIC90_QUOTAS,
  createSeededRng,
  selectMusic90Questions,
} from '@/content/quizzes/music90s/select'

const bank = music90sQuiz.questions

describe('Music90s bank', () => {
  it('bank has 42 unique questions', () => {
    expect(bank).toHaveLength(42)
    const ids = bank.map((q) => q.id)
    expect(new Set(ids).size).toBe(42)
  })
  it('bank has 42 unique IDs stable (m1..m42)', () => {
    const ids = bank.map((q) => q.id)
    expect(ids).toEqual([
      'm1','m2','m3','m4','m5','m6','m7','m8','m9','m10','m11','m12','m13','m14','m15','m16','m17','m18',
      'm19','m20','m21','m22','m23','m24','m25','m26','m27','m28','m29','m30','m31','m32','m33','m34','m35','m36','m37','m38','m39','m40','m41','m42',
    ])
  })
  it('all questions have exactly 4 options and exactly 1 correct', () => {
    for (const q of bank) {
      expect(q.answers).toHaveLength(4)
      const ids = q.answers.map((a) => a.id)
      expect(new Set(ids).size).toBe(4)
      expect(ids).toContain(q.correctAnswerId!)
      expect(q.correctAnswerId).toBeTruthy()
    }
  })
  it('all have correct/wrong feedback diverse', () => {
    for (const q of bank) {
      expect(q.feedback?.correct).toBeTruthy()
      expect(q.feedback?.wrong).toBeTruthy()
      expect(q.feedback!.correct.length).toBeGreaterThan(1)
      expect(q.feedback!.wrong.length).toBeGreaterThan(1)
    }
    // not all same
    const corrects = new Set(bank.map((q) => q.feedback!.correct))
    const wrongs = new Set(bank.map((q) => q.feedback!.wrong))
    expect(corrects.size).toBeGreaterThan(5)
    expect(wrongs.size).toBeGreaterThan(5)
  })
  it('bank covers all categories for stratified selector', () => {
    const counts: Record<string, number> = {}
    for (const q of bank) {
      const cat = MUSIC90_CATEGORY_BY_ID[q.id]
      counts[cat] = (counts[cat] ?? 0) + 1
    }
    // expected distribution: song 16, artist 10, clip 6, mtv 3, culture 4, rebus 3
    expect(counts['rebus']).toBe(3)
    expect(counts['clip']).toBe(6)
    expect(counts['artist']).toBe(10)
    expect(counts['song']).toBe(16)
    expect(counts['mtv']).toBe(3)
    expect(counts['culture']).toBe(4)
  })
})

describe('Music90s selector', () => {
  it('returns exactly 18', () => {
    const rng = createSeededRng(42)
    const selected = selectMusic90Questions(bank, 18, rng)
    expect(selected).toHaveLength(18)
    expect(MUSIC90_QUESTIONS_PER_RUN).toBe(18)
  })
  it('no duplicate IDs', () => {
    const rng = createSeededRng(1)
    const sel = selectMusic90Questions(bank, 18, rng)
    const ids = sel.map((q) => q.id)
    expect(new Set(ids).size).toBe(18)
  })
  it('only questions from bank', () => {
    const rng = createSeededRng(2)
    const sel = selectMusic90Questions(bank, 18, rng)
    const bankIds = new Set(bank.map((q) => q.id))
    for (const q of sel) expect(bankIds.has(q.id)).toBe(true)
  })
  it('multiple categories represented (stratified)', () => {
    const rng = createSeededRng(3)
    const sel = selectMusic90Questions(bank, 18, rng)
    const cats = sel.map((q) => MUSIC90_CATEGORY_BY_ID[q.id])
    const uniq = new Set(cats)
    // must have at least 5 of 6 types per stratified quotas
    expect(uniq.size).toBeGreaterThanOrEqual(5)
    // check quotas roughly met (allow ±1)
    const counts: Record<string, number> = {}
    for (const c of cats) counts[c] = (counts[c] ?? 0) + 1
    for (const [cat, quota] of Object.entries(MUSIC90_QUOTAS)) {
      const have = counts[cat] ?? 0
      // allow ±1, and fallback if bank undersupplied (rebus only 3)
      expect(Math.abs(have - quota)).toBeLessThanOrEqual(1)
    }
  })
  it('stable within same initialized run (same rng sequence -> same result if re-run with same rng instance not, but deterministic with same seed)', () => {
    const rng1 = createSeededRng(123)
    const rng2 = createSeededRng(123)
    const a = selectMusic90Questions(bank, 18, rng1)
    const b = selectMusic90Questions(bank, 18, rng2)
    expect(a.map((q) => q.id)).toEqual(b.map((q) => q.id))
  })
  it('new run can produce different set (different seeds)', () => {
    const a = selectMusic90Questions(bank, 18, createSeededRng(10))
    const b = selectMusic90Questions(bank, 18, createSeededRng(20))
    // not guaranteed distinct, but highly likely; check not both exactly same by asserting at least one difference via deterministic known seeds
    // For seeds 10 and 20 we know they differ (empirically) — if they happen equal, test would flake but probability tiny
    const idsA = a.map((q) => q.id).join(',')
    const idsB = b.map((q) => q.id).join(',')
    expect(idsA).not.toBe(idsB)
  })
  it('selector is injected RNG driven, not using global Math.random for determinism', () => {
    let calls = 0
    const countingRng = () => { calls++; return 0.5 }
    const sel = selectMusic90Questions(bank, 18, countingRng)
    expect(calls).toBeGreaterThan(0)
    expect(sel).toHaveLength(18)
  })
  it('throws if bank smaller than count', () => {
    expect(() => selectMusic90Questions(bank.slice(0, 10), 18, createSeededRng(1))).toThrow()
  })
})
