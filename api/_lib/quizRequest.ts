import type { Quiz } from '../../src/features/quiz/schema.js'
import { getQuizById } from '../../src/content/quizzes/index.js'
import { getDefaultQuiz } from '../../src/content/quizzes/resolveQuiz.js'

export interface QuizResultSelection {
  quiz: Quiz
  result: Quiz['results'][number]
}

export type QuizRequestError = 'invalid_quiz' | 'missing_result'

/**
 * Canonical server-side quiz/result resolution for API endpoints.
 * quizId is authoritative when present; omitting it is a documented
 * legacy-client path that resolves to the default quiz (never a positional
 * quizzes[0] guess). The result must belong to the selected quiz — a valid
 * resultId under a different quiz is `missing_result`, making cross-quiz
 * confusion impossible.
 */
export function resolveQuizRequest(
  quizId: string | undefined,
  resultId: string,
): { ok: true; selection: QuizResultSelection } | { ok: false; error: QuizRequestError } {
  const quiz = (quizId ? getQuizById(quizId) : undefined) ?? (quizId ? undefined : getDefaultQuiz())
  if (!quiz) return { ok: false, error: 'invalid_quiz' }
  const result = quiz.results.find((r) => r.id === resultId)
  if (!result) return { ok: false, error: 'missing_result' }
  return { ok: true, selection: { quiz, result } }
}
