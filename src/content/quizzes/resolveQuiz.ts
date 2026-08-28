import { resolveResultByCode } from './codes.js'
import type { Quiz } from '../../features/quiz/schema.js'
import { activeQuiz, getQuizById, quizzes } from './index.js'

export interface QuizLaunchContext {
  /** Telegram start parameter (startapp), null outside Telegram. */
  startParam: string | null
  /** Browser query string, '' outside plain web. */
  search: string
}

/**
 * Lookup surface the resolver works against. The production default wires
 * into the real registry + code registry; tests inject a synthetic two-quiz
 * registry to PROVE multi-quiz routing (a single-quiz suite cannot — with one
 * quiz any fallback trivially equals the default).
 */
export interface QuizLaunchRegistry {
  /** Explicit quizById lookups (quiz_<id>, ?quiz=<id>). */
  findQuizById(id: string): Quiz | undefined
  /** Legacy share_<result> — resolves to the quiz owning that result id. */
  findQuizByResultId(resultId: string): Quiz | undefined
  /** v2 share codes — resolves a code pair to the owning quiz/result. */
  resolveV2(quizCode: string, resultCode: string): { quiz: Quiz; resultId: string } | null
  /** Deterministic fallback for unknown/malformed ids (never throws). */
  defaultQuiz(): Quiz
}

const defaultRegistry: QuizLaunchRegistry = {
  findQuizById: (id) => getQuizById(id),
  findQuizByResultId: (resultId) => quizzes.find((q) => q.results.some((r) => r.id === resultId)),
  resolveV2: resolveResultByCode,
  defaultQuiz: () => activeQuiz,
}

/**
 * The single canonical quiz resolver. Every entry point (App launch,
 * deep links, restarts) must obtain its quiz through here — direct
 * `quizzes[0]`/`activeQuiz` usage in feature code is forbidden.
 *
 * Selection precedence:
 *   1. Telegram start param `quiz_<quizId>`
 *   2. Shared-link start params — v2 codes (`s2_…`) resolved via the code
 *      registry, legacy `share_<result>` via the result-owner scan
 *   3. Browser `?quiz=<quizId>` (dev / plain web)
 * Unknown ids never throw: they fall back to the default quiz with a
 * console warning so a malformed link can never blank the app.
 */
export function resolveQuizFromLaunch(
  ctx: QuizLaunchContext,
  registry: QuizLaunchRegistry = defaultRegistry,
): Quiz {
  const startParam = ctx.startParam?.trim() || null

  if (startParam) {
    if (startParam.startsWith('quiz_')) {
      const byExplicit = registry.findQuizById(startParam.slice('quiz_'.length))
      if (byExplicit) return byExplicit
      console.warn('[quiz] unknown quiz id in start param: %s', startParam)
    }

    const v2 = parseV2ShareParam(startParam)
    if (v2) {
      const resolved = registry.resolveV2(v2.quizCode, v2.resultCode)
      if (resolved) return resolved.quiz
      console.warn('[quiz] unknown v2 share target: %s', startParam)
      return registry.defaultQuiz()
    }

    const resultId = parseResultIdFromShareParam(startParam)
    if (resultId) {
      const owner = registry.findQuizByResultId(resultId)
      if (owner) return owner
      console.warn('[quiz] share param references unknown result: %s', startParam)
    }
  }

  const requested = new URLSearchParams(ctx.search).get('quiz')
  if (requested) {
    const byQuery = registry.findQuizById(requested)
    if (byQuery) return byQuery
    console.warn('[quiz] unknown ?quiz= value: %s', requested)
  }

  return registry.defaultQuiz()
}

/** Splits `s2_<quizCode>_<resultCode>_<uid>`; null for non-v2 or malformed. */
function parseV2ShareParam(startParam: string): { quizCode: string; resultCode: string } | null {
  const match = /^s2_([a-z0-9]{1,12})_([a-z0-9]{1,12})_\d{1,15}$/.exec(startParam)
  return match ? { quizCode: match[1], resultCode: match[2] } : null
}

/**
 * Extracts the result id of a legacy `share_<resultId>-<uid>` payload.
 * Accepts the canonical result-id grammar (namespaced ids like
 * `m90_rookie` are legal); the stricter historical `[a-z]+` shape still
 * matches, so no existing link can break.
 */
function parseResultIdFromShareParam(startParam: string): string | null {
  const match = /^share_([a-z][a-z0-9_]{0,63})(?:-[0-9]+)?$/.exec(startParam)
  return match?.[1] ?? null
}

/** The quiz every fallback resolves to (default quiz of the registry). */
export function getDefaultQuiz(): Quiz {
  return activeQuiz
}
