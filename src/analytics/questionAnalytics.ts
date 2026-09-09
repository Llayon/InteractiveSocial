import type { Question, Quiz } from '@/features/quiz/schema'
import { MUSIC90_CATEGORY_BY_ID } from '@/content/quizzes/music90s/select'

/** Cap for elapsed_ms to avoid distorting averages when tab left open. Documented value: 10 minutes. */
export const ELAPSED_MS_CAP = 600_000

export function generateRunId(): string {
  try {
    const c = globalThis.crypto as unknown as { randomUUID?: () => string } | undefined
    if (c && typeof c.randomUUID === 'function') return c.randomUUID()
  } catch {}
  return `run_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

/**
 * Resolve analytics category for a question in a data-driven way.
 * - For music90s, uses canonical MUSIC90_CATEGORY_BY_ID (stratified taxonomy: song/artist/clip/mtv/culture/rebus)
 *   rather than the advisory `question.category` which carries legacy values (emoji, music-video, etc.)
 * - For other quizzes, falls back to `question.category` if present
 * - Returns undefined when no category semantics are meaningful (e.g. archetype interiors)
 */
export function getQuestionAnalyticsCategory(quiz: Quiz, question: Question): string | undefined {
  if (quiz.id === 'music90s') {
    const canonical = MUSIC90_CATEGORY_BY_ID[question.id]
    if (canonical) return canonical
  }
  // Generic fallback: use question.category when it exists and is not empty
  // For guess90s, category is 'audio' — that is meaningful
  // For interior-character, category is undefined — we return undefined (no is_correct semantics)
  if (typeof question.category === 'string' && question.category.length > 0) {
    // Normalize legacy music90s advisory categories to canonical? Already handled above.
    // For generic quizzes, return as-is.
    return question.category
  }
  return undefined
}

/**
 * Monotonic now — prefers performance.now(), falls back to Date.now().
 * Returns milliseconds as number.
 */
export function nowMs(): number {
  try {
    if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
      return performance.now()
    }
  } catch {}
  return Date.now()
}

/**
 * Compute elapsed_ms from start timestamp and cap to ELAPSED_MS_CAP.
 * Guarantees >=0 and <=600_000, never NaN.
 */
export function computeElapsedMs(startMs: number | undefined, endMs: number = nowMs()): number {
  if (typeof startMs !== 'number' || !Number.isFinite(startMs)) return 0
  const raw = endMs - startMs
  if (!Number.isFinite(raw) || raw < 0) return 0
  if (raw > ELAPSED_MS_CAP) return ELAPSED_MS_CAP
  return Math.round(raw)
}
