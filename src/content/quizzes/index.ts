import {
  loadQuiz,
  QuizIntegrityError,
  RESULT_ID_REGEX,
  type Quiz,
} from '../../features/quiz/schema.js'
import { interiorCharacterQuiz } from './interior-character/quiz.js'
import { music90sQuiz } from './music90s/quiz.js'
import { guess90sQuiz } from './guess90s/quiz.js'

/**
 * Active quiz registry. New quizzes are added here as pure configuration —
 * no engine, UI or share changes required. Registry-level invariants are
 * validated fail-fast at load time (build/startup failure on drift).
 */
const rawQuizzes = [interiorCharacterQuiz, music90sQuiz, guess90sQuiz]

/** Quiz id grammar: lowercase, digits and dashes. */
const QUIZ_ID_REGEX = /^[a-z][a-z0-9-]{0,63}$/

/**
 * Global registry invariants:
 *  - unique quiz ids;
 *  - quiz id grammar;
 *  - result ids obey the canonical grammar and are GLOBALLY unique across
 *    all registered quizzes (so a legacy `share_<result>` link or a share
 *    card asset can never be ambiguous between two quizzes).
 */
function validateGlobalRegistry(quizzes: Quiz[]): void {
  const quizIds = quizzes.map((q) => q.id)
  if (new Set(quizIds).size !== quizIds.length) {
    throw new QuizIntegrityError('Duplicate quiz ids: ' + quizIds.join(', '))
  }
  for (const quiz of quizzes) {
    if (!QUIZ_ID_REGEX.test(quiz.id)) {
      throw new QuizIntegrityError(`Quiz id "${quiz.id}" violates the canonical grammar`)
    }
  }
  const owner = new Map<string, string>()
  for (const quiz of quizzes) {
    for (const result of quiz.results) {
      if (!RESULT_ID_REGEX.test(result.id)) {
        throw new QuizIntegrityError(
          `Result id "${result.id}" in "${quiz.id}" violates the canonical grammar ^[a-z][a-z0-9_]{0,63}$`,
        )
      }
      const existing = owner.get(result.id)
      if (existing) {
        throw new QuizIntegrityError(
          `Duplicate GLOBAL result id "${result.id}": registered by "${existing}" and "${quiz.id}"`,
        )
      }
      owner.set(result.id, quiz.id)
    }
  }
}

/** All quizzes validated at module load: build fails on inconsistent content. */
export const quizzes: Quiz[] = (() => {
  const loaded = rawQuizzes.map((raw) => loadQuiz(raw))
  validateGlobalRegistry(loaded)
  return loaded
})()

/** Deterministic default quiz (the platform's first launched experience). */
export const activeQuiz: Quiz = quizzes[0]

export function getQuizById(id: string): Quiz | undefined {
  return quizzes.find((q) => q.id === id)
}
