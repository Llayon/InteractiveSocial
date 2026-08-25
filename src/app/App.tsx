import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'

import { getAnalytics } from '@/analytics/analytics'
import { activeQuiz as defaultQuiz } from '@/content/quizzes'
import { Landing } from '@/features/landing/Landing'
import { Quiz } from '@/features/quiz/Quiz'
import { computeBreakdown, resolveResultId } from '@/features/quiz/scoring'
import {
  idleQuizState,
  quizReducer,
} from '@/features/quiz/quizReducer'
import type { SelectedAnswer } from '@/features/quiz/schema'
import { ResultScreen } from '@/features/result/Result'
import type { TelegramAdapter } from '@/platform/telegram'
import { initialScreen, screenAfterQuizStart, screenForCompletedQuiz, type Screen } from './routes'

export interface AppProps {
  /** Platform adapter; defaults to the environment-detected implementation. */
  telegram?: TelegramAdapter
}

export function App({ telegram }: AppProps) {
  const quiz = defaultQuiz
  const analytics = useMemo(() => getAnalytics(), [])
  const [screen, setScreen] = useState<Screen>(initialScreen)
  const [state, dispatch] = useReducer(
    (s: typeof idleQuizState, action: Parameters<typeof quizReducer>[1]) =>
      quizReducer(s, action, quiz),
    idleQuizState,
  )
  const [attempt, setAttempt] = useState(0)

  // Landing is visible → quiz view event (once per attempt).
  useEffect(() => {
    if (screen === 'landing') {
      analytics.trackOnce(`quiz_view:${attempt}`, 'quiz_view', { quiz_id: quiz.id })
    }
  }, [screen, attempt, analytics, quiz.id])

  const handleStart = useCallback(() => {
    dispatch({ type: 'start' })
    setScreen(screenAfterQuizStart())
    telegram?.haptic('light')
    analytics.trackOnce(`quiz_start:${attempt}`, 'quiz_start', { quiz_id: quiz.id })
  }, [analytics, attempt, quiz.id, telegram])

  const lastTrackedAnswer = useRef<string>('')
  const handleAnswer = useCallback(
    (selected: SelectedAnswer) => {
      dispatch({ type: 'answer', questionId: selected.questionId, answerId: selected.answerId })
      telegram?.haptic('light')

      const question = quiz.questions.find((q) => q.id === selected.questionId)
      const answer = question?.answers.find((a) => a.id === selected.answerId)
      const dedupeKey = `${attempt}:${selected.questionId}:${selected.answerId}`
      if (question && answer && lastTrackedAnswer.current !== dedupeKey) {
        lastTrackedAnswer.current = dedupeKey
        const entries = Object.entries(answer.scores).sort((a, b) => b[1] - a[1])
        analytics.track('question_answered', {
          quiz_id: quiz.id,
          question_id: selected.questionId,
          answer_id: selected.answerId,
          primary_result: entries[0]?.[0] ?? '',
          secondary_result: entries[1]?.[0] ?? '',
        })
      }
    },
    [analytics, attempt, quiz, telegram],
  )

  const handleBack = useCallback(() => {
    dispatch({ type: 'back' })
    telegram?.haptic('light')
  }, [telegram])

  const handleNext = useCallback(() => {
    dispatch({ type: 'next' })
    telegram?.haptic('light')
  }, [telegram])

  const revealFinishedRef = useRef<string>('')
  useEffect(() => {
    if (state.phase !== 'completed') return
    const key = `${attempt}`
    if (revealFinishedRef.current === key) return
    revealFinishedRef.current = key

    const resolution = resolveResultId(quiz, state.answers)
    const breakdown = computeBreakdown(quiz, state.answers)
    setScreen(screenForCompletedQuiz())
    window.scrollTo(0, 0)

    analytics.trackOnce(`result_view:${attempt}`, 'result_view', {
      quiz_id: quiz.id,
      result_id: resolution.resultId,
    })
    analytics.trackOnce(`quiz_complete:${attempt}`, 'quiz_complete', {
      quiz_id: quiz.id,
      result_id: resolution.resultId,
      total_scores: breakdown.totals,
    })
  }, [state.phase, state.answers, analytics, attempt, quiz])

  const handleRestart = useCallback(() => {
    dispatch({ type: 'restart' })
    setAttempt((a) => a + 1)
    setScreen(initialScreen())
    window.scrollTo(0, 0)
    analytics.track('restart', { quiz_id: quiz.id })
  }, [analytics, quiz.id])

  switch (screen) {
    case 'quiz':
      return (
        <Quiz
          quiz={quiz}
          phase={state.phase}
          currentIndex={state.currentIndex}
          answers={state.answers}
          onAnswer={handleAnswer}
          onBack={handleBack}
          onNext={handleNext}
          onRevealFinished={() => dispatch({ type: 'reveal-finished' })}
        />
      )
    case 'result': {
      const resolution = resolveResultId(quiz, state.answers)
      return (
        <ResultScreen
          quiz={quiz}
          resultId={resolution.resultId}
          telegram={telegram}
          onRestart={handleRestart}
        />
      )
    }
    case 'landing':
    default:
      return <Landing quiz={quiz} onStart={handleStart} />
  }
}
