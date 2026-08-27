import type { Quiz } from '../../features/quiz/schema.js'
import { activeQuiz, getQuizById, quizzes } from './index.js'

export interface QuizLaunchContext {
  /** Telegram start parameter (startapp), null outside Telegram. */
  startParam: string | null
  /** Browser query string, '' outside plain web. */
  search: string
}

/**
 * The single canonical quiz resolver. Every entry point (App launch,
 * deep links, restarts) must obtain its quiz through here — direct
 * `quizzes[0]`/`activeQuiz` usage in feature code is forbidden.
 *
 * Selection precedence:
 *   1. Telegram start param `quiz_<quizId>`
 *   2. Shared-link start params (`share_…`, `s2_…`) — the quiz owning
 *      the referenced result wins
 *   3. Browser `?quiz=<quizId>` (dev / plain web)
 * Unknown ids never throw: they fall back to the default quiz with a
 * console warning so a malformed link can never blank the app.
 */
export function resolveQuizFromLaunch(ctx: QuizLaunchContext): Quiz {
  const startParam = ctx.startParam?.trim() || null

  if (startParam) {
    if (startParam.startsWith('quiz_')) {
      const byExplicit = getQuizById(startParam.slice('quiz_'.length))
      if (byExplicit) return byExplicit
      console.warn('[quiz] unknown quiz id in start param: %s', startParam)
    }

    const resultId = parseResultIdFromShareParam(startParam)
    if (resultId) {
      const owner = quizzes.find((q) => q.results.some((r) => r.id === resultId))
      if (owner) return owner
      console.warn('[quiz] share param references unknown result: %s', startParam)
    }
  }

  const requested = new URLSearchParams(ctx.search).get('quiz')
  if (requested) {
    const byQuery = getQuizById(requested)
    if (byQuery) return byQuery
    console.warn('[quiz] unknown ?quiz= value: %s', requested)
  }

  return activeQuiz
}

/**
 * Extracts the result id portion of share-style start params WITHOUT
 * deciding the protocol version:
 *   legacy:  share_<resultId>-<uid> | share_<resultId>
 *   v2:      s2_<quizCode>_<resultCode>_<uid>   (introduced in 03)
 * v2 payloads return null here — they are resolved by the code registry,
 * not by internal result ids.
 */
function parseResultIdFromShareParam(startParam: string): string | null {
  if (startParam.startsWith('s2_')) return null
  const match = /^share_([a-z]+)(?:-[0-9]+)?$/.exec(startParam)
  return match?.[1] ?? null
}

/** The quiz every fallback resolves to (single active quiz today). */
export function getDefaultQuiz(): Quiz {
  return activeQuiz
}
