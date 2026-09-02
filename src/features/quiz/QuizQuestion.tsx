import type { Answer, Question } from './schema'
import { PALETTE_SEGMENT_PROPORTIONS } from './schema'
import { OptimizedImage } from '@/images/OptimizedImage'
import { AudioPreviewPlayer } from './audio/AudioPreviewPlayer'

export interface QuizQuestionProps {
  question: Question
  quizId?: string
  selectedAnswerId?: string
  /** Feedback-mode lock: no further taps are accepted while set. */
  locked?: boolean
  /** When wrong feedback is shown, reveal the actual correct answer. */
  revealCorrectAnswerId?: string
  /** Quiz-owned feedback copy. */
  feedbackCorrectMessage?: string
  feedbackWrongMessage?: string
  onAnswer: (answer: Answer) => void
  onSkipAudio?: () => void
  onAudioReplay?: () => void
}

/**
 * Generic question renderer. Layout drives structure (cards / palette /
 * compact / comparison); `category` is content metadata only and never
 * selects a component. Feedback state is generic (✓/✕ marks), quiz-agnostic.
 */
export function QuizQuestion({
  question,
  quizId,
  selectedAnswerId,
  locked = false,
  revealCorrectAnswerId,
  feedbackCorrectMessage,
  feedbackWrongMessage,
  onAnswer,
  onSkipAudio,
  onAudioReplay,
}: QuizQuestionProps) {
  const layoutClass =
    question.layout === 'compact'
      ? ' answers--compact'
      : question.layout === 'image-cards'
        ? ' answers--cards'
        : question.layout === 'comparison'
          ? ' answers--comparison'
          : ''

  const feedbackActive = locked && (selectedAnswerId !== undefined || revealCorrectAnswerId !== undefined)

  const stateFor = (answerId: string): 'correct' | 'wrong' | undefined => {
    if (!feedbackActive) return undefined
    if (revealCorrectAnswerId && answerId === revealCorrectAnswerId) return 'correct'
    if (selectedAnswerId === answerId) {
      return revealCorrectAnswerId && revealCorrectAnswerId !== answerId ? 'wrong' : 'correct'
    }
    return undefined
  }

  const isAudioPreview = question.content?.kind === 'audio-preview'

  // Presentational split for emoji rebus: generic, not quiz-id branched.
  // Any question title containing a double-newline with emoji block is treated as:
  //   line 1 = question text
  //   line 2 = rebus (nowrap, no orphan)
  // This covers m1 "Какой хит зашифрован?\n\n💌 ➡️ 📭 😔 ❤️" without hardcoding quiz id.
  const rebused = (() => {
    const raw = question.title
    const parts = raw.split('\n\n')
    if (parts.length >= 2) {
      const tail = parts.slice(1).join('\n\n').trim()
      // Heuristic: tail contains emoji / arrow and is short (<= 40 chars)
      const hasEmoji =
        tail.includes('💌') ||
        tail.includes('📭') ||
        tail.includes('😔') ||
        tail.includes('❤') ||
        tail.includes('➡') ||
        tail.includes('→') ||
        /[^\x00-\x7F]/.test(tail)
      if (hasEmoji && tail.length <= 40) {
        return { head: parts[0].trim(), rebus: tail }
      }
    }
    return null
  })()

  return (
    <div className="question" data-testid="quiz-question" data-layout={question.layout} data-content-kind={question.content?.kind ?? 'default'}>
      {rebused ? (
        <>
          <h2 className="question__title">{rebused.head}</h2>
          <div className="m90-rebus" data-testid="m90-rebus" aria-hidden="true">
            {rebused.rebus}
          </div>
        </>
      ) : (
        <h2 className="question__title">{question.title}</h2>
      )}

      {isAudioPreview && question.content?.kind === 'audio-preview' && quizId && (
        <AudioPreviewPlayer
          content={question.content}
          quizId={quizId}
          questionId={question.id}
          onSkip={onSkipAudio}
          onReplayed={onAudioReplay}
          revealTrackInfo={Boolean(locked && (selectedAnswerId !== undefined || revealCorrectAnswerId !== undefined))}
          disabled={false}
        />
      )}

      {question.layout === 'palette' ? (
        <div className="answers answers--palette">
          {question.answers.map((answer) => (
            <button
              key={answer.id}
              type="button"
              className={
                'answer-palette' + (selectedAnswerId === answer.id ? ' is-selected' : '')
              }
              data-testid="answer-option"
              data-answer-id={answer.id}
              disabled={locked}
              aria-disabled={locked}
              onClick={() => {
                if (!locked) onAnswer(answer)
              }}
            >
              {/*
                Interior color story: four solid segments at the fixed 40/25/20/15
                structure (walls / second material / furniture / accent). Swatches
                are decorative content only — selection is communicated through
                the card border/state, never by color alone.
              */}
              <span className="answer-palette__swatches" aria-hidden="true">
                {(answer.paletteSwatches ?? []).map((hex, i) => (
                  <span
                    key={i}
                    style={{
                      background: hex,
                      width: `${PALETTE_SEGMENT_PROPORTIONS[i] ?? 25}%`,
                    }}
                  />
                ))}
              </span>
              <span className="answer-palette__labels">
                {(answer.paletteLabels ?? []).join(' · ')}
              </span>
            </button>
          ))}
        </div>
      ) : (
        <div className={'answers' + layoutClass}>
          {question.answers.map((answer, index) => {
            const state = stateFor(answer.id)
            return (
              <button
                key={answer.id}
                type="button"
                className={
                  'answer-card' +
                  (selectedAnswerId === answer.id ? ' is-selected' : '') +
                  (state ? ` is-${state}` : '')
                }
                data-testid="answer-option"
                data-answer-id={answer.id}
                disabled={locked}
                aria-disabled={locked}
                onClick={() => {
                  if (!locked) onAnswer(answer)
                }}
              >
                {question.layout === 'image-cards' && answer.assetKey && (
                  <span className="answer-card__media" aria-hidden="true" data-asset={answer.assetKey}>
                    <OptimizedImage
                      bucket="quiz"
                      asset={answer.assetKey}
                      aspectRatio="16/9"
                      layout="asset"
                      loading={index === 0 ? 'eager' : 'lazy'}
                      fetchPriority={index === 0 ? 'high' : 'auto'}
                      decoding="async"
                      data-testid="answer-media"
                      style={{ background: 'transparent' }}
                    />
                  </span>
                )}
                {answer.title && <span className="answer-card__title">{answer.title}</span>}
                {state && (
                  <span
                    className="answer-card__mark"
                    aria-hidden="true"
                    data-testid={state === 'correct' ? 'answer-mark-correct' : 'answer-mark-wrong'}
                  >
                    {state === 'correct' ? '✓' : '✕'}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      )}

      {locked && (
        <p
          className="question__feedback"
          role="status"
          aria-live="polite"
          data-testid="answer-feedback"
        >
          {revealCorrectAnswerId && selectedAnswerId !== revealCorrectAnswerId
            ? (feedbackWrongMessage ?? 'Не в этот раз.')
            : (feedbackCorrectMessage ?? 'Верно!')}
        </p>
      )}
    </div>
  )
}
