import { useCallback, useEffect, useReducer, useRef, useState } from 'react'

import { getAnalytics } from '@/analytics/analytics'
import { RUNTIME_IMAGE_MANIFEST } from '@/images/manifest'
import { QuizProgress } from './QuizProgress'
import { QuizQuestion } from './QuizQuestion'
import type { Answer, Quiz, SelectedAnswer } from './schema'
import type { QuizPhase } from './quizReducer'

export interface QuizProps {
  quiz: Quiz
  phase: QuizPhase
  currentIndex: number
  answers: readonly SelectedAnswer[]
  onAnswer: (selected: SelectedAnswer) => void
  onBack: () => void
  onNext: () => void
  onSkip?: (questionId: string) => void
  onAudioReplay?: (questionId: string) => void
  /** Fired by the reveal overlay when its sequence completes. */
  onRevealFinished: () => void
}

/** Deterministic reveal interlude between the last answer and the result. */
function RevealOverlay({
  steps,
  stepDurationMs,
  onFinished,
}: {
  steps: string[]
  stepDurationMs: number
  onFinished: () => void
}) {
  const [stepIndex, setStepIndex] = useState(0)
  const finishedRef = useRef(false)

  useEffect(() => {
    if (stepIndex >= steps.length) {
      if (!finishedRef.current) {
        finishedRef.current = true
        onFinished()
      }
      return
    }
    const timer = setTimeout(() => setStepIndex((i) => i + 1), stepDurationMs)
    return () => clearTimeout(timer)
  }, [stepIndex, steps.length, stepDurationMs, onFinished])

  return (
    <div className="reveal" data-testid="reveal-overlay" role="status">
      <div className="reveal__steps">
        {steps.map((step, i) => (
          <span key={step} className={'reveal__step' + (i <= stepIndex ? ' is-active' : '')}>
            {step}
          </span>
        ))}
      </div>
    </div>
  )
}

/**
 * Quiz screen. Renders every question purely from quiz config data —
 * no question-specific branching lives here.
 *
 * Answer behavior comes from quiz config (`answerBehavior.mode`):
 *  - instant  → selection advances immediately (interior, unchanged);
 *  - feedback → a generic UI barrier locks the options, shows ✓/✕ (and the
 *    correct answer when wrong) for `durationMs`, THEN advances. The reducer
 *    is untouched: the advance is the same single `answer` action, so the
 *    tested double-tap guard still applies.
 */
export function Quiz({
  quiz,
  phase,
  currentIndex,
  answers,
  onAnswer,
  onBack,
  onNext,
  onSkip,
  onAudioReplay,
  onRevealFinished,
}: QuizProps) {
  const total = quiz.questions.length
  const question = quiz.questions[Math.min(currentIndex, total - 1)]
  const selectedAnswerId = answers.find((a) => a.questionId === question?.id)?.answerId

  // --- generic feedback barrier (answerBehavior.mode === 'feedback') ---
  const behavior = quiz.answerBehavior
  type FeedbackState = { answerId: string; correct: boolean } | null
  const [feedback, dispatchFeedback] = useReducer(
    (_state: FeedbackState, action: FeedbackState | { type: 'reset' }) =>
      action && 'type' in action ? null : action,
    null,
  )
  const feedbackRef = useRef<FeedbackState>(null)
  feedbackRef.current = feedback
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const onAnswerRef = useRef(onAnswer)
  useEffect(() => {
    onAnswerRef.current = onAnswer
  }, [onAnswer])

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  // Timer cleanup on unmount (and never leaks across question/phase changes).
  useEffect(() => clearTimer, [clearTimer])
  // Reset feedback state when leaving a question or the active phase. The
  // derived-value pattern (no setState inside an effect) keeps the state
  // reset in lock-step with the props that own it.
  const lastIndexRef = useRef<number>(-1)
  const lastPhaseRef = useRef<QuizPhase | null>(null)
  if (lastIndexRef.current !== currentIndex || lastPhaseRef.current !== phase) {
    lastIndexRef.current = currentIndex
    lastPhaseRef.current = phase
    if (feedbackRef.current !== null) {
      clearTimer()
      dispatchFeedback(null)
    }
  }

  const locked = behavior.mode === 'feedback' && feedback !== null

  const handleAnswer = useCallback(
    (answer: Answer) => {
      if (!question) return
      if (behavior.mode === 'instant') {
        onAnswer({ questionId: question.id, answerId: answer.id })
        return
      }
      // Locked while feedback is on screen: second taps are ignored.
      if (timerRef.current !== null) return
      const correct = question.correctAnswerId === answer.id
      dispatchFeedback({ answerId: answer.id, correct })
      const durationMs = behavior.mode === 'feedback' ? behavior.durationMs : 0
      timerRef.current = setTimeout(() => {
        timerRef.current = null
        // Always read the latest callback — no stale closure.
        onAnswerRef.current({ questionId: question.id, answerId: answer.id })
      }, durationMs)
    },
    [behavior, question, onAnswer],
  )
  // Controlled prefetch: once the current question paints and the browser is
  // idle, warm the NEXT question's runtime images (low priority; results and
  // share assets are never prefetched). The preload itself is delayed inside
  // the idle callback so the critical load of the visible question is never
  // contended and E2E network phases stay deterministic.
  // Audio-preview prefetch: prepare N+1 preview conservatively (single Audio, low priority).
  useEffect(() => {
    const next = quiz.questions[currentIndex + 1]
    if (!next) return
    if (next.layout === 'image-cards') {
      const w = window as Window & {
        requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number
        cancelIdleCallback?: (id: number) => void
      }
      let timer: ReturnType<typeof setTimeout> | undefined
      let cancelIdle: (() => void) | undefined
      const preload = () => {
        for (const answer of next.answers) {
          if (!answer.assetKey || !RUNTIME_IMAGE_MANIFEST.quiz[answer.assetKey]) continue
          const img = new Image()
          img.src = `/optimized/quiz/${answer.assetKey}-480.webp`
        }
      }
      const schedule = () => {
        timer = setTimeout(preload, 250)
      }
      if (typeof w.requestIdleCallback === 'function') {
        const id = w.requestIdleCallback(schedule, { timeout: 2_000 })
        cancelIdle = () => w.cancelIdleCallback?.(id)
      } else {
        const id = window.setTimeout(schedule, 300)
        cancelIdle = () => window.clearTimeout(id)
      }
      return () => {
        cancelIdle?.()
        if (timer !== undefined) clearTimeout(timer)
      }
    }
    if (next.content?.kind === 'audio-preview') {
      const w = window as Window & {
        requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number
        cancelIdleCallback?: (id: number) => void
      }
      let timer: ReturnType<typeof setTimeout> | undefined
      let cancelIdle: (() => void) | undefined
      const nextPreviewUrl = next.content.previewUrl
      const preload = () => {
        try {
          const audio = new Audio(nextPreviewUrl)
          audio.preload = 'auto'
          // trigger load without playing
          audio.load()
        } catch {}
      }
      const schedule = () => {
        timer = setTimeout(preload, 300)
      }
      if (typeof w.requestIdleCallback === 'function') {
        const id = w.requestIdleCallback(schedule, { timeout: 2_000 })
        cancelIdle = () => w.cancelIdleCallback?.(id)
      } else {
        const id = window.setTimeout(schedule, 350)
        cancelIdle = () => window.clearTimeout(id)
      }
      return () => {
        cancelIdle?.()
        if (timer !== undefined) clearTimeout(timer)
      }
    }
  }, [currentIndex, quiz])

  const handleSkipAudio = useCallback(() => {
    if (!question) return
    // Analytics for skip - must include trackId where available
    if (question.content?.kind === 'audio-preview') {
      try {
        getAnalytics().track('preview_skip', {
          quiz_id: quiz.id,
          question_id: question.id,
          track_id: question.content.trackId,
        })
      } catch {}
    }
    if (onSkip) {
      onSkip(question.id)
    } else {
      // Fallback: advance via next if no skip handler (should not happen in audio quiz)
      onNext()
    }
  }, [question, quiz.id, onSkip, onNext])

  const handleAudioReplay = useCallback(() => {
    if (!question) return
    onAudioReplay?.(question.id)
  }, [question, onAudioReplay])

  if (phase === 'revealing') {
    return (
      <RevealOverlay
        steps={quiz.reveal.steps}
        stepDurationMs={quiz.reveal.stepDurationMs}
        onFinished={onRevealFinished}
      />
    )
  }

  if (!question) return null

  const displayedAnswerId = feedback?.answerId ?? selectedAnswerId
  const revealCorrectAnswerId =
    feedback && !feedback.correct ? (question.correctAnswerId ?? undefined) : undefined

  const isMusic90s = quiz.id === 'music90s'
  const rubricLabels: Record<string, string> = {
    emoji: 'ребус',
    'music-video': 'клип',
    'artist-history': 'история',
    timeline: 'таймлайн',
    mismatch: 'найди ошибку',
    'tv-culture': 'MTV',
    'pop-culture': 'журналы',
    artist: 'артист',
    producer: 'продюсер',
    'group-history': 'группы',
    'absurd-description': 'мем',
    'artist-image': 'образ',
    'era-culture': 'школьная дискотека',
    'song-recognition': 'узнай хит',
  }
  const rubric = isMusic90s ? (question.category ? (rubricLabels[question.category] ?? question.category) : undefined) : undefined

  return (
    <section className="screen quiz" data-testid="quiz-screen">
      <QuizProgress currentIndex={currentIndex} total={total} />
      {rubric && <span className="m90-rubric" data-testid="m90-rubric">{rubric}</span>}

      <QuizQuestion
        question={question}
        quizId={quiz.id}
        selectedAnswerId={displayedAnswerId}
        locked={locked}
        revealCorrectAnswerId={revealCorrectAnswerId}
        feedbackCorrectMessage={behavior.mode === 'feedback' ? behavior.correctMessage : undefined}
        feedbackWrongMessage={behavior.mode === 'feedback' ? behavior.wrongMessage : undefined}
        onAnswer={handleAnswer}
        onSkipAudio={handleSkipAudio}
        onAudioReplay={handleAudioReplay}
      />

      <div className="quiz__nav">
        <button
          type="button"
          className="button button--ghost"
          data-testid="back-button"
          onClick={onBack}
          disabled={currentIndex === 0 || locked}
        >
          Назад
        </button>
        <button
          type="button"
          className="button button--secondary"
          data-testid="next-button"
          onClick={onNext}
          disabled={!displayedAnswerId || locked || currentIndex === total - 1}
        >
          Далее
        </button>
      </div>
    </section>
  )
}

