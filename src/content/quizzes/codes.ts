/**
 * External compact codes for the v2 share deep-link protocol.
 *
 * startapp charset allows only [A-Za-z0-9_-], and internal ids
 * (e.g. "interior-character") make positional parsing ambiguous — so the
 * wire format uses short opaque codes instead of internal ids:
 *
 *   s2_<quizCode>_<resultCode>_<sharerUserId>
 *   e.g. s2_ic_it_847291 or s2_m90_dc_847291
 *
 * Codes are decoupled from internal ids: renaming "interior-character" or a
 * result later must not break already-shared links. The maps below are the
 * ONLY place where internal ids and wire codes meet, and the module fails
 * fast at load on duplicates or coverage gaps. QuizDefinition carries no
 * wire codes — this registry is the transport boundary.
 */
import type { Quiz } from '../../features/quiz/schema.js'
import { quizzes } from './index.js'

interface RawQuizCodes {
  quizCode: string
  results: Record<string, string>
}

const RAW_CODES: Record<string, RawQuizCodes> = {
  'interior-character': {
    quizCode: 'ic',
    results: {
      quiet: 'qt',
      paris: 'pa',
      italian: 'it',
      collector: 'co',
      cottage: 'ct',
      scandi: 'sc',
    },
  },
  music90s: {
    quizCode: 'm90',
    results: {
      m90_rookie: 'rk',
      m90_familiar: 'fm',
      m90_cassette: 'cs',
      m90_disco: 'dc',
      m90_legend: 'lg',
    },
  },
  guess90s: {
    quizCode: 'g90',
    results: {
      g90_rookie: 'gr',
      g90_familiar: 'gf',
      g90_cassette: 'gc',
      g90_disco: 'gd',
      g90_legend: 'gl',
    },
  },
}

interface QuizCodeEntry {
  quiz: Quiz
  quizCode: string
  resultIdByCode: Map<string, string>
  resultCodeById: Map<string, string>
}

const byQuizId = new Map<string, QuizCodeEntry>()
const byQuizCode = new Map<string, QuizCodeEntry>()

function fail(message: string): never {
  throw new Error(`[quiz-codes] ${message}`)
}

{
  const usedQuizCodes = new Set<string>()
  for (const quiz of quizzes) {
    const raw = RAW_CODES[quiz.id]
    if (!raw) fail(`missing wire codes for quiz "${quiz.id}"`)
    if (usedQuizCodes.has(raw.quizCode)) fail(`duplicate quiz code "${raw.quizCode}"`)
    usedQuizCodes.add(raw.quizCode)

    const entry: QuizCodeEntry = {
      quiz,
      quizCode: raw.quizCode,
      resultIdByCode: new Map(),
      resultCodeById: new Map(),
    }
    const declaredResults = Object.keys(raw.results)
    for (const result of quiz.results) {
      const code = raw.results[result.id]
      if (!code) fail(`missing result code for "${quiz.id}/${result.id}"`)
      if (entry.resultIdByCode.has(code)) fail(`duplicate result code "${code}" in "${quiz.id}"`)
      entry.resultIdByCode.set(code, result.id)
      entry.resultCodeById.set(result.id, code)
    }
    const extra = declaredResults.filter((id) => !quiz.results.some((r) => r.id === id))
    if (extra.length > 0) {
      fail(`codes reference unknown results in "${quiz.id}": ${extra.join(', ')}`)
    }

    byQuizId.set(quiz.id, entry)
    byQuizCode.set(raw.quizCode, entry)
  }
  for (const id of Object.keys(RAW_CODES)) {
    if (!byQuizId.has(id)) fail(`codes declared for unregistered quiz "${id}"`)
  }
}

/** Wire code for a registered quiz id. Throws on unknown id (fail-fast). */
export function quizCodeFor(quizId: string): string {
  const entry = byQuizId.get(quizId)
  if (!entry) fail(`unknown quiz id "${quizId}"`)
  return entry.quizCode
}

/** Wire code for a result within its quiz. Throws on unknown pair. */
export function resultCodeFor(quizId: string, resultId: string): string {
  const entry = byQuizId.get(quizId)
  if (!entry) fail(`unknown quiz id "${quizId}"`)
  const code = entry.resultCodeById.get(resultId)
  if (!code) fail(`unknown result id "${resultId}" in "${quizId}"`)
  return code
}

/** Resolves a v2 code pair back to the owning quiz/result, null if unknown. */
export function resolveResultByCode(
  quizCode: string,
  resultCode: string,
): { quiz: Quiz; resultId: string } | null {
  const entry = byQuizCode.get(quizCode)
  if (!entry) return null
  const resultId = entry.resultIdByCode.get(resultCode)
  if (!resultId) return null
  return { quiz: entry.quiz, resultId }
}

/** Test/ops helper: the full id↔code mapping for a quiz, null if unknown. */
export function codesForQuiz(quizId: string): { quizCode: string; results: Record<string, string> } | null {
  const entry = byQuizId.get(quizId)
  if (!entry) return null
  return {
    quizCode: entry.quizCode,
    results: Object.fromEntries(entry.resultCodeById),
  }
}
