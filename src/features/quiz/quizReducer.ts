import type { Quiz, SelectedAnswer } from './schema.js'

export type QuizPhase = 'idle' | 'active' | 'revealing' | 'completed'

export interface QuizMachineState {
  phase: QuizPhase
  currentIndex: number
  /** Ordered by first selection; re-answering replaces in place. */
  answers: SelectedAnswer[]
}

export type QuizAction =
  | { type: 'start' }
  | { type: 'answer'; questionId: string; answerId: string }
  | { type: 'skip'; questionId: string }
  | { type: 'back' }
  | { type: 'next' }
  | { type: 'reveal-finished' }
  | { type: 'restart' }

export function createInitialQuizState(): QuizMachineState {
  return { phase: 'idle', currentIndex: 0, answers: [] }
}

export const idleQuizState: QuizMachineState = createInitialQuizState()

/**
 * Quiz state machine.
 *
 * Guarantees:
 * - `answer` only applies when it matches the current question → stale events
 *   and double-taps are ignored (UI cannot desync or double-advance).
 * - `back` preserves previously selected answers.
 * - Changing an answer replaces it in place, so final scoring is always
 *   recomputed from the full answer list.
 * - No state exists without a legal continuation:
 *   idle→start, active→answer/next/back, revealing→reveal-finished,
 *   completed→restart.
 */
export function quizReducer(
  state: QuizMachineState,
  action: QuizAction,
  quiz: Quiz,
): QuizMachineState {
  switch (action.type) {
    case 'start': {
      if (state.phase !== 'idle') return state
      return { phase: 'active', currentIndex: 0, answers: [] }
    }

    case 'answer': {
      if (state.phase !== 'active') return state
      const question = quiz.questions[state.currentIndex]
      if (!question || question.id !== action.questionId) return state // stale / double-tap guard

      const existingIndex = state.answers.findIndex(
        (a) => a.questionId === action.questionId,
      )
      const selected: SelectedAnswer = {
        questionId: action.questionId,
        answerId: action.answerId,
      }
      const answers =
        existingIndex >= 0
          ? state.answers.map((a, i) => (i === existingIndex ? selected : a))
          : [...state.answers, selected]

      const isLast = state.currentIndex === quiz.questions.length - 1
      if (isLast) {
        return { ...state, answers, phase: 'revealing' }
      }
      return { ...state, answers, currentIndex: state.currentIndex + 1 }
    }

    case 'back': {
      if (state.phase !== 'active') return state
      if (state.currentIndex === 0) return state
      return { ...state, currentIndex: state.currentIndex - 1 }
    }

    case 'skip': {
      if (state.phase !== 'active') return state
      const question = quiz.questions[state.currentIndex]
      if (!question || question.id !== action.questionId) return state
      // Infrastructure failure skip: advance without counting as wrong. Record a
      // sentinel so answers.length still covers the question for completion,
      // but scoring ignores it (see computeCorrectCount).
      const existingIndex = state.answers.findIndex((a) => a.questionId === action.questionId)
      const skipped: SelectedAnswer = { questionId: action.questionId, answerId: '__skipped__' }
      const answers =
        existingIndex >= 0
          ? state.answers.map((a, i) => (i === existingIndex ? skipped : a))
          : [...state.answers, skipped]
      const isLast = state.currentIndex === quiz.questions.length - 1
      if (isLast) {
        return { ...state, answers, phase: 'revealing' }
      }
      return { ...state, answers, currentIndex: state.currentIndex + 1 }
    }

    case 'next': {
      if (state.phase !== 'active') return state
      const question = quiz.questions[state.currentIndex]
      if (!question) return state
      const answered = state.answers.some((a) => a.questionId === question.id)
      if (!answered) return state
      if (state.currentIndex === quiz.questions.length - 1) {
        return { ...state, phase: 'revealing' }
      }
      return { ...state, currentIndex: state.currentIndex + 1 }
    }

    case 'reveal-finished': {
      if (state.phase !== 'revealing') return state
      if (state.answers.length !== quiz.questions.length) return state
      return { ...state, phase: 'completed' }
    }

    case 'restart':
      return idleQuizState

    default:
      return state
  }
}
