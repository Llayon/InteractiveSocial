import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'

import { getAnalytics } from '@/analytics/analytics'
import { resolveQuizFromLaunch } from '@/content/quizzes/resolveQuiz'
import { Landing } from '@/features/landing/Landing'
import { Quiz } from '@/features/quiz/Quiz'
import {
  questionAnsweredTelemetry,
  quizCompleteTelemetry,
  resolveOutcome,
} from '@/features/quiz/scoring'
import {
  idleQuizState,
  quizReducer,
} from '@/features/quiz/quizReducer'
import type { SelectedAnswer } from '@/features/quiz/schema'
import { ResultScreen } from '@/features/result/Result'
import { deliverCompletedResult } from '@/features/share/deliver'
import type { TelegramAdapter } from '@/platform/telegram'
import { initialScreen, screenAfterQuizStart, screenForCompletedQuiz, type Screen } from './routes'

export interface AppProps {
  /** Platform adapter; defaults to the environment-detected implementation. */
  telegram?: TelegramAdapter
}

export function App({ telegram }: AppProps) {
  // Canonical quiz resolution — never `quizzes[0]` directly. Unknown or
  // malformed launch ids deterministically fall back to the default quiz.
  const quiz = useMemo(
    () =>
      resolveQuizFromLaunch({
        startParam: telegram?.getStartParam() ?? null,
        search: typeof window === 'undefined' ? '' : window.location.search,
      }),
    [telegram],
  )
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

      const position = quiz.questions.findIndex((q) => q.id === selected.questionId)
      const dedupeKey = `${attempt}:${selected.questionId}:${selected.answerId}`
      if (position >= 0 && lastTrackedAnswer.current !== dedupeKey) {
        lastTrackedAnswer.current = dedupeKey
        // Scoring-aware telemetry: the App NEVER inspects answer weights or
        // correctness itself — the scoring module owns that knowledge.
        const payload = questionAnsweredTelemetry(quiz, selected.questionId, selected.answerId, position + 1)
        analytics.track('question_answered', {
          quiz_id: quiz.id,
          question_id: selected.questionId,
          answer_id: selected.answerId,
          ...payload,
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

    // Canonical outcome boundary — App completion, result screen, share and
    // analytics all derive from this single value.
    const outcome = resolveOutcome(quiz, state.answers)
    const score = outcome.kind === 'correct-count' ? outcome.correct : undefined
    setScreen(screenForCompletedQuiz())
    window.scrollTo(0, 0)

    analytics.trackOnce(`result_view:${attempt}`, 'result_view', {
      quiz_id: quiz.id,
      result_id: outcome.resultId,
    })
    analytics.trackOnce(`quiz_complete:${attempt}`, 'quiz_complete', {
      quiz_id: quiz.id,
      ...quizCompleteTelemetry(quiz, state.answers),
    })

    // Fire-and-forget: inside Telegram, ask the backend to send the user
    // their own result card and (if launched via a friend's share link)
    // notify the sharer. Must never block or break the reveal UX.
    if (telegram?.mode === 'telegram' && telegram.getInitDataRaw()) {
      void deliverCompletedResult(quiz.id, outcome.resultId, telegram.getInitDataRaw(), score)
    }
  }, [state.phase, state.answers, analytics, attempt, quiz, telegram])

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
      const outcome = resolveOutcome(quiz, state.answers)
      return (
        <ResultScreen
          quiz={quiz}
          outcome={outcome}
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
