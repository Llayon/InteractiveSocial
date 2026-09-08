import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'

import { getAnalytics } from '@/analytics/analytics'
import { deriveEntrySource, isChallengeAttributedParam } from '@/analytics/events'
import { resolveQuizFromLaunch } from '@/content/quizzes/resolveQuiz'
import { Landing } from '@/features/landing/Landing'
import { Quiz } from '@/features/quiz/Quiz'
import { questionAnsweredTelemetry, quizCompleteTelemetry, resolveOutcome } from '@/features/quiz/scoring'
import { idleQuizState, quizReducer } from '@/features/quiz/quizReducer'
import type { SelectedAnswer } from '@/features/quiz/schema'
import { ResultScreen } from '@/features/result/Result'
import { deliverCompletedResult, deliverCompletedResultForPlatform } from '@/features/share/deliver'
import type { MiniAppAdapter } from '@/platform/types'
import type { TelegramAdapter } from '@/platform/telegram'
import { maxShareTransport } from '@/platform/share/ShareTransport'
import { initialScreen, screenAfterQuizStart, screenForCompletedQuiz, type Screen } from './routes'

export interface QuizAppProps {
  telegram?: TelegramAdapter
  adapter?: MiniAppAdapter
}

function pushStage(s: string) {
  try {
    ;(window as unknown as { __pushStage?: (s: string) => void }).__pushStage?.(s)
  } catch {}
}

function generateCompletionId(): string {
  try {
    const c = (globalThis as unknown as { crypto?: { randomUUID?: () => string } }).crypto
    if (c && typeof c.randomUUID === 'function') return c.randomUUID()
  } catch {}
  return `cid_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

export function QuizApp({ telegram, adapter }: QuizAppProps) {
  const platformAdapter = (adapter ?? telegram) as MiniAppAdapter | undefined

  useEffect(() => {
    pushStage('APP_MOUNTED')
  }, [])

  const quiz = useMemo(() => {
    const q = resolveQuizFromLaunch({
      startParam: platformAdapter?.getStartParam() ?? null,
      search: typeof window === 'undefined' ? '' : window.location.search,
    })
    try {
      pushStage('QUIZ_RESOLVED:' + q.id)
    } catch {}
    return q
  }, [platformAdapter])

  const analytics = useMemo(() => getAnalytics(), [])
  const [screen, setScreen] = useState<Screen>(initialScreen)
  const [state, dispatch] = useReducer(
    (s: typeof idleQuizState, action: Parameters<typeof quizReducer>[1]) => quizReducer(s, action, quiz),
    idleQuizState,
  )
  const [attempt, setAttempt] = useState(0)
  const [completionId, setCompletionId] = useState<string>(() => generateCompletionId())
  const [maxSelfMid, setMaxSelfMid] = useState<string | null>(null)
  const [maxDeliverPending, setMaxDeliverPending] = useState(false)

  useEffect(() => {
    if (screen === 'landing') {
      const platform = platformAdapter?.platform ?? 'browser'
      const startParam = platformAdapter?.getStartParam() ?? undefined
      const entrySource = deriveEntrySource(startParam ?? null)
      const basePayload = {
        quiz_id: quiz.id,
        platform,
        question_count: quiz.questions.length,
        entry_source: entrySource,
        ...(startParam ? { start_param: startParam } : {}),
      }
      analytics.trackOnce(`quiz_view:${attempt}:${quiz.id}`, 'quiz_view', basePayload)
      analytics.trackOnce(`quiz_landing_view:${attempt}:${quiz.id}`, 'quiz_landing_view', basePayload)
      if (isChallengeAttributedParam(startParam ?? null)) {
        analytics.trackOnce(`challenge_attributed_open:${quiz.id}:${startParam}`, 'challenge_attributed_open', {
          quiz_id: quiz.id,
          platform,
          entry_source: entrySource,
          ...(startParam ? { start_param: startParam } : {}),
        })
      }
    }
  }, [screen, attempt, analytics, quiz.id, quiz.questions.length, platformAdapter])

  useEffect(() => {
    if (screen === 'landing') {
      try {
        if ('scrollRestoration' in history) history.scrollRestoration = 'manual'
      } catch {}
      const id = requestAnimationFrame(() => {
        window.scrollTo(0, 0)
        document.documentElement.scrollTop = 0
        document.body.scrollTop = 0
      })
      return () => cancelAnimationFrame(id)
    }
  }, [screen, attempt])

  const handleStart = useCallback(() => {
    dispatch({ type: 'start' })
    setScreen(screenAfterQuizStart())
    platformAdapter?.haptic('light')
    const platform = platformAdapter?.platform ?? 'browser'
    const startParam = platformAdapter?.getStartParam() ?? undefined
    analytics.trackOnce(`quiz_start:${attempt}:${quiz.id}`, 'quiz_start', {
      quiz_id: quiz.id,
      platform,
      question_count: quiz.questions.length,
      entry_source: deriveEntrySource(startParam ?? null),
      ...(startParam ? { start_param: startParam } : {}),
    })
  }, [analytics, attempt, quiz.id, quiz.questions.length, platformAdapter])

  const lastTrackedAnswer = useRef<string>('')
  const replayedQuestions = useRef<Set<string>>(new Set())
  const handleAudioReplay = useCallback(
    (questionId: string) => {
      replayedQuestions.current.add(questionId)
      const q = quiz.questions.find((qq) => qq.id === questionId)
      const trackId = q?.content?.kind === 'audio-preview' ? q.content.trackId : undefined
      analytics.track('audio_replay', {
        quiz_id: quiz.id,
        question_id: questionId,
        ...(trackId ? { track_id: trackId } : {}),
      })
    },
    [quiz, analytics],
  )

  const handleAnswer = useCallback(
    (selected: SelectedAnswer) => {
      dispatch({ type: 'answer', questionId: selected.questionId, answerId: selected.answerId })
      platformAdapter?.haptic('light')

      const position = quiz.questions.findIndex((q) => q.id === selected.questionId)
      const dedupeKey = `${attempt}:${selected.questionId}:${selected.answerId}`
      if (position >= 0 && lastTrackedAnswer.current !== dedupeKey) {
        lastTrackedAnswer.current = dedupeKey
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
    const key = `${attempt}:${completionId}`
    if (revealFinishedRef.current === key) return
    revealFinishedRef.current = key

    const outcome = resolveOutcome(quiz, state.answers)
    const score = outcome.kind === 'correct-count' ? outcome.correct : undefined
    setScreen(screenForCompletedQuiz())
    window.scrollTo(0, 0)

    const platform = platformAdapter?.platform ?? 'browser'
    const startParam = platformAdapter?.getStartParam() ?? undefined
    analytics.trackOnce(`result_view:${attempt}:${quiz.id}:${outcome.resultId}`, 'result_view', {
      quiz_id: quiz.id,
      result_id: outcome.resultId,
      platform,
      ...(score !== undefined ? { score } : {}),
      question_count: quiz.questions.length,
      entry_source: deriveEntrySource(startParam ?? null),
    })
    analytics.trackOnce(`quiz_complete:${attempt}:${quiz.id}`, 'quiz_complete', {
      quiz_id: quiz.id,
      platform,
      question_count: quiz.questions.length,
      entry_source: deriveEntrySource(startParam ?? null),
      ...(startParam ? { start_param: startParam } : {}),
      ...quizCompleteTelemetry(quiz, state.answers),
    })

    if (
      platformAdapter &&
      (platformAdapter.platform === 'telegram' || platformAdapter.platform === 'max') &&
      platformAdapter.getInitDataRaw()
    ) {
      const raw = platformAdapter.getInitDataRaw()
      if (raw) {
        if (platformAdapter.platform === 'max') {
          const cid = completionId
          // eslint-disable-next-line -- completion delivery state sync inside effect
          setMaxDeliverPending(true)
          setMaxSelfMid(null)
          void (async () => {
            try {
              const res = await deliverCompletedResultForPlatform('max', quiz.id, outcome.resultId, raw, score, cid)
              if (res.ok && res.deliveredSelf && res.selfMid) {
                setMaxSelfMid(res.selfMid)
                maxShareTransport.setPreparedMid({
                  quizId: quiz.id,
                  resultId: outcome.resultId,
                  score,
                  mid: res.selfMid,
                  completionId: cid,
                })
                analytics.track('max_result_delivery_success', {
                  quiz_id: quiz.id,
                  result_id: outcome.resultId,
                  platform: 'max',
                  ...(score !== undefined ? { score } : {}),
                })
                analytics.track('max_share_mid_ready', { quiz_id: quiz.id, result_id: outcome.resultId, platform: 'max' })
                setMaxDeliverPending(false)
              } else {
                const reason = res.ok ? 'no_mid' : (res as { code: string }).code
                analytics.track('max_result_delivery_failed', {
                  quiz_id: quiz.id,
                  result_id: outcome.resultId,
                  platform: 'max',
                  reason,
                } as unknown as Record<string, unknown>)
                try {
                  const fallbackMid = await maxShareTransport.prePrepare(quiz.id, outcome.resultId, raw, score, cid)
                  if (fallbackMid) {
                    setMaxSelfMid(fallbackMid)
                    analytics.track('max_share_mid_ready', {
                      quiz_id: quiz.id,
                      result_id: outcome.resultId,
                      platform: 'max',
                      fallback: true,
                    } as unknown as Record<string, unknown>)
                  }
                } catch {}
                setMaxDeliverPending(false)
              }
            } catch {
              analytics.track('max_result_delivery_failed', {
                quiz_id: quiz.id,
                result_id: outcome.resultId,
                platform: 'max',
                reason: 'exception',
              } as unknown as Record<string, unknown>)
              try {
                const fallbackMid = await maxShareTransport.prePrepare(quiz.id, outcome.resultId, raw, score, cid)
                if (fallbackMid) setMaxSelfMid(fallbackMid)
              } catch {}
              setMaxDeliverPending(false)
            }
          })()
        } else {
          void deliverCompletedResult(quiz.id, outcome.resultId, raw, score, completionId)
        }
      }
    }
  }, [state.phase, state.answers, analytics, attempt, completionId, quiz, platformAdapter])

  const handleRestart = useCallback(() => {
    dispatch({ type: 'restart' })
    setAttempt((a) => a + 1)
    const newCid = generateCompletionId()
    setCompletionId(newCid)
    setMaxSelfMid(null)
    setMaxDeliverPending(false)
    try {
      maxShareTransport.clearCache()
    } catch {}
    setScreen(initialScreen())
    window.scrollTo(0, 0)
    try {
      analytics.track('restart', { quiz_id: quiz.id, platform: platformAdapter?.platform ?? 'browser' })
    } catch {
      /* swallow */
    }
  }, [analytics, quiz.id, platformAdapter])

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
            completionId={completionId}
            maxMid={maxSelfMid}
            maxPending={maxDeliverPending}
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
