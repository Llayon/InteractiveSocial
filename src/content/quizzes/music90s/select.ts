import type { Question } from '../../../features/quiz/schema.js'

export const MUSIC90_QUESTIONS_PER_RUN = 18

export type Music90QuestionCategory =
  | 'song'
  | 'artist'
  | 'clip'
  | 'mtv'
  | 'culture'
  | 'rebus'

/**
 * Data-driven category mapping for stratified selection.
 * Existing 18 keep their original advisory `question.category` for UI rubric,
 * but selector uses this taxonomy to balance types.
 */
export const MUSIC90_CATEGORY_BY_ID: Record<string, Music90QuestionCategory> = {
  // existing 18
  m1: 'rebus',
  m2: 'clip',
  m3: 'artist',
  m4: 'song',
  m5: 'song',
  m6: 'song',
  m7: 'mtv',
  m8: 'culture',
  m9: 'artist',
  m10: 'artist',
  m11: 'artist',
  m12: 'song',
  m13: 'artist',
  m14: 'clip',
  m15: 'song',
  m16: 'clip',
  m17: 'artist',
  m18: 'culture',
  // new 24
  m19: 'rebus',
  m20: 'song',
  m21: 'song',
  m22: 'clip',
  m23: 'song',
  m24: 'song',
  m25: 'mtv',
  m26: 'clip',
  m27: 'mtv',
  m28: 'song',
  m29: 'song',
  m30: 'artist',
  m31: 'song',
  m32: 'artist',
  m33: 'song',
  m34: 'song',
  m35: 'clip',
  m36: 'culture',
  m37: 'rebus',
  m38: 'song',
  m39: 'artist',
  m40: 'song',
  m41: 'artist',
  m42: 'culture',
}

/** Balanced quotas per run: ~6 songs, 3 artists, 3 clips, 2 mtv, 2 culture, 2 rebus =18 (allow ±1 via fallback). */
export const MUSIC90_QUOTAS: Record<Music90QuestionCategory, number> = {
  song: 6,
  artist: 3,
  clip: 3,
  mtv: 2,
  culture: 2,
  rebus: 2,
}

function shuffleInPlace<T>(arr: T[], rng: () => number): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    const tmp = arr[i]
    arr[i] = arr[j]
    arr[j] = tmp
  }
}

function groupByCategory(bank: readonly Question[]): Map<Music90QuestionCategory, Question[]> {
  const map = new Map<Music90QuestionCategory, Question[]>()
  const cats: Music90QuestionCategory[] = ['song', 'artist', 'clip', 'mtv', 'culture', 'rebus']
  for (const c of cats) map.set(c, [])
  for (const q of bank) {
    const cat = MUSIC90_CATEGORY_BY_ID[q.id] ?? 'song'
    const list = map.get(cat)
    if (list) list.push(q)
  }
  return map
}

/**
 * Stratified selector: returns exactly `count` questions (default 18) balanced across types.
 * - Works purely on data (bank + category map), no UI branching.
 * - Injected `rng` enables deterministic unit tests (no flaky notEqual).
 * - Stable within run: caller must memoize result for the attempt.
 */
export function selectMusic90Questions(
  bank: readonly Question[],
  count: number = MUSIC90_QUESTIONS_PER_RUN,
  rng: () => number = Math.random,
): Question[] {
  if (bank.length < count) throw new Error(`Bank size ${bank.length} < requested ${count}`)
  if (count !== MUSIC90_QUESTIONS_PER_RUN) {
    // Generic fallback: random shuffle slice (used only if caller asks non-standard count)
    const copy = [...bank]
    shuffleInPlace(copy, rng)
    return copy.slice(0, count)
  }

  const byCat = groupByCategory(bank)
  // Shuffle each category bucket deterministically via rng
  for (const list of byCat.values()) shuffleInPlace(list, rng)

  const selected: Question[] = []
  const usedIds = new Set<string>()

  // Primary quota fill
  for (const cat of Object.keys(MUSIC90_QUOTAS) as Music90QuestionCategory[]) {
    const quota = MUSIC90_QUOTAS[cat]
    const bucket = byCat.get(cat) ?? []
    const take = Math.min(quota, bucket.length)
    for (let i = 0; i < take; i++) {
      const q = bucket[i]
      selected.push(q)
      usedIds.add(q.id)
    }
  }

  // If quotas underfilled due to small bucket (e.g. rebus only 3 but quota 2 ok, but handle general)
  // Fill remaining from leftover pool shuffled
  if (selected.length < count) {
    const leftovers: Question[] = []
    for (const list of byCat.values()) {
      for (const q of list) if (!usedIds.has(q.id)) leftovers.push(q)
    }
    shuffleInPlace(leftovers, rng)
    const need = count - selected.length
    for (let i = 0; i < need && i < leftovers.length; i++) {
      selected.push(leftovers[i])
    }
  }

  // Edge: still not enough? (bank 42 always enough)
  // Final shuffle to avoid category clustering
  shuffleInPlace(selected, rng)

  // Ensure exactly count and no duplicates
  if (selected.length !== count) throw new Error(`Selector produced ${selected.length} != ${count}`)
  if (new Set(selected.map((q) => q.id)).size !== selected.length) throw new Error('Duplicate IDs in selection')

  // Defensive: only from bank
  const bankIds = new Set(bank.map((q) => q.id))
  for (const q of selected) if (!bankIds.has(q.id)) throw new Error(`Selected unknown id ${q.id}`)

  return selected
}

/** Helper for tests: deterministic RNG from seed */
export function createSeededRng(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    // mulberry32
    s += 0x6d2b79f5
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
