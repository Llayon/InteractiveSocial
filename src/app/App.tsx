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
import { deliverCompletedResult, deliverCompletedResultForPlatform } from '@/features/share/deliver'
import type { MiniAppAdapter } from '@/platform/types'
import type { TelegramAdapter } from '@/platform/telegram'
import { initialScreen, screenAfterQuizStart, screenForCompletedQuiz, type Screen } from './routes'

export interface AppProps {
  /** Platform adapter; defaults to the environment-detected implementation. */
  telegram?: TelegramAdapter
  adapter?: MiniAppAdapter
}

function pushStage(s: string) {
  try {
    ;(window as unknown as { __pushStage?: (s:string)=>void }).__pushStage?.(s)
  } catch {}
}
export function App({ telegram, adapter }: AppProps) {
  const platformAdapter = (adapter ?? telegram) as MiniAppAdapter | undefined
  // Expose for E2E bootstrap tests (not for production logic)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      ;(window as unknown as Record<string, unknown>).__platform = platformAdapter?.platform ?? 'none'
      ;(window as unknown as Record<string, unknown>).__startParam = platformAdapter?.getStartParam() ?? null
    }
  }, [platformAdapter])
  useEffect(() => {
    pushStage('APP_MOUNTED')
  }, [])
  // Canonical quiz resolution — never `quizzes[0]` directly. Unknown or
  // malformed launch ids deterministically fall back to the default quiz.
  const quiz = useMemo(() => {
    const q = resolveQuizFromLaunch({
      startParam: platformAdapter?.getStartParam() ?? null,
      search: typeof window === 'undefined' ? '' : window.location.search,
    })
    // Diagnostic: quiz resolved (no private data)
    try {
      pushStage('QUIZ_RESOLVED:' + q.id)
    } catch {}
    return q
  }, [platformAdapter])
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
    platformAdapter?.haptic('light')
    analytics.trackOnce(`quiz_start:${attempt}`, 'quiz_start', { quiz_id: quiz.id })
  }, [analytics, attempt, quiz.id, platformAdapter])

  const lastTrackedAnswer = useRef<string>('')
  const replayedQuestions = useRef<Set<string>>(new Set())
  const handleAudioReplay = useCallback((questionId: string) => {
    replayedQuestions.current.add(questionId)
    const q = quiz.questions.find((qq) => qq.id === questionId)
    const trackId = q?.content?.kind === 'audio-preview' ? q.content.trackId : undefined
    analytics.track('audio_replay', { quiz_id: quiz.id, question_id: questionId, ...(trackId ? { track_id: trackId } : {}) })
  }, [quiz, analytics])

  const handleAnswer = useCallback(
    (selected: SelectedAnswer) => {
      dispatch({ type: 'answer', questionId: selected.questionId, answerId: selected.answerId })
      platformAdapter?.haptic('light')

      const position = quiz.questions.findIndex((q) => q.id === selected.questionId)
      const dedupeKey = `${attempt}:${selected.questionId}:${selected.answerId}`
      if (position >= 0 && lastTrackedAnswer.current !== dedupeKey) {
        lastTrackedAnswer.current = dedupeKey
        // Scoring-aware telemetry: the App NEVER inspects answer weights or
        // correctness itself — the scoring module owns that knowledge.
        const isAudio = quiz.questions.find((qq) => qq.id === selected.questionId)?.content?.kind === 'audio-preview'
        const payload = questionAnsweredTelemetry(
          quiz,
          selected.questionId,
          selected.answerId,
          position + 1,
          isAudio ? { replayed: replayedQuestions.current.has(selected.questionId) } : undefined,
        )
        analytics.track('question_answered', {
          quiz_id: quiz.id,
          question_id: selected.questionId,
          answer_id: selected.answerId,
          ...payload,
        })
      }
    },
    [analytics, attempt, quiz, platformAdapter],
  )

  const handleSkip = useCallback(
    (questionId: string) => {
      dispatch({ type: 'skip', questionId })
      platformAdapter?.haptic('light')
      // Skipped questions are not counted as wrong; analytics already tracked preview_skip in Quiz
    },
    [platformAdapter],
  )

  const handleBack = useCallback(() => {
    dispatch({ type: 'back' })
    platformAdapter?.haptic('light')
  }, [platformAdapter])

  const handleNext = useCallback(() => {
    dispatch({ type: 'next' })
    platformAdapter?.haptic('light')
  }, [platformAdapter])

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

    // Fire-and-forget: inside messenger, ask the backend to send the user
    // their own result card and (if launched via a friend's share link)
    // notify the sharer. Must never block or break the reveal UX.
    // Platform-scoped: MAX uses /api/max/results/deliver, Telegram uses /api/results/deliver.
    // Mock never triggers real deliver (E2E would 404), but real MAX/Telegram do.
    if (
      platformAdapter &&
      (platformAdapter.platform === 'telegram' || platformAdapter.platform === 'max') &&
      platformAdapter.getInitDataRaw()
    ) {
      const raw = platformAdapter.getInitDataRaw()
      if (raw) {
        if (platformAdapter.platform === 'max') {
          void deliverCompletedResultForPlatform('max', quiz.id, outcome.resultId, raw, score)
        } else {
          void deliverCompletedResult(quiz.id, outcome.resultId, raw, score)
        }
      }
    }
  }, [state.phase, state.answers, analytics, attempt, quiz, platformAdapter])

  const handleRestart = useCallback(() => {
    dispatch({ type: 'restart' })
    setAttempt((a) => a + 1)
    setScreen(initialScreen())
    window.scrollTo(0, 0)
    analytics.track('restart', { quiz_id: quiz.id })
  }, [analytics, quiz.id])

  const quizThemeAttr = { 'data-quiz': quiz.id } as const

  switch (screen) {
    case 'quiz':
      return (
        <div {...quizThemeAttr}>
          <Quiz
            quiz={quiz}
            phase={state.phase}
            currentIndex={state.currentIndex}
            answers={state.answers}
            onAnswer={handleAnswer}
            onBack={handleBack}
            onNext={handleNext}
            onSkip={handleSkip}
            onAudioReplay={handleAudioReplay}
            onRevealFinished={() => dispatch({ type: 'reveal-finished' })}
          />
        </div>
      )
    case 'result': {
      const outcome = resolveOutcome(quiz, state.answers)
      return (
        <div {...quizThemeAttr}>
          <ResultScreen
            quiz={quiz}
            outcome={outcome}
            telegram={platformAdapter as unknown as import('@/platform/telegram').TelegramAdapter}
            adapter={platformAdapter}
            onRestart={handleRestart}
          />
        </div>
      )
    }
    case 'landing':
    default:
      return (
        <div {...quizThemeAttr}>
          <Landing quiz={quiz} onStart={handleStart} />
        </div>
      )
  }
}
