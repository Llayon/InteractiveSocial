import { useEffect, useRef, useState } from 'react'

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
 */
export function Quiz({
  quiz,
  phase,
  currentIndex,
  answers,
  onAnswer,
  onBack,
  onNext,
  onRevealFinished,
}: QuizProps) {
  const total = quiz.questions.length
  const question = quiz.questions[Math.min(currentIndex, total - 1)]
  const selectedAnswerId = answers.find((a) => a.questionId === question?.id)?.answerId

  // Controlled prefetch: once the current question paints and the browser is
  // idle, warm the NEXT question's runtime images (low priority; results and
  // share assets are never prefetched). The preload itself is delayed inside
  // the idle callback so the critical load of the visible question is never
  // contended and E2E network phases stay deterministic.
  useEffect(() => {
    const next = quiz.questions[currentIndex + 1]
    if (!next || next.layout !== 'image-cards') return
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
  }, [currentIndex, quiz])

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

  return (
    <section className="screen quiz" data-testid="quiz-screen">
      <QuizProgress currentIndex={currentIndex} total={total} />

      <QuizQuestion
        question={question}
        selectedAnswerId={selectedAnswerId}
        onAnswer={(answer: Answer) =>
          onAnswer({ questionId: question.id, answerId: answer.id })
        }
      />

      <div className="quiz__nav">
        <button
          type="button"
          className="button button--ghost"
          data-testid="back-button"
          onClick={onBack}
          disabled={currentIndex === 0}
        >
          Назад
        </button>
        <button
          type="button"
          className="button button--secondary"
          data-testid="next-button"
          onClick={onNext}
          disabled={!selectedAnswerId || currentIndex === total - 1}
        >
          Далее
        </button>
      </div>
    </section>
  )
}
