import type { Answer, Question } from './schema'

/** Tasteful placeholder swatches for palette questions until approved imagery. */
const PALETTE_SWATCHES = ['#EFE9DF', '#C8CFBE', '#B08968', '#27436B']

export interface QuizQuestionProps {
  question: Question
  selectedAnswerId?: string
  onAnswer: (answer: Answer) => void
}

export function QuizQuestion({ question, selectedAnswerId, onAnswer }: QuizQuestionProps) {
  return (
    <div className="question" data-testid="quiz-question" data-layout={question.layout}>
      <h2 className="question__title">{question.title}</h2>

      {question.layout === 'palette' ? (
        <div className="answers answers--palette">
          {question.answers.map((answer, index) => (
            <button
              key={answer.id}
              type="button"
              className={
                'answer-palette' + (selectedAnswerId === answer.id ? ' is-selected' : '')
              }
              data-testid="answer-option"
              data-answer-id={answer.id}
              onClick={() => onAnswer(answer)}
            >
              <span className="answer-palette__swatches" aria-hidden="true">
                {(answer.paletteLabels ?? []).map((_, i) => (
                  <span
                    key={i}
                    style={{ background: PALETTE_SWATCHES[(index + i) % PALETTE_SWATCHES.length] }}
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
        <div
          className={
            'answers' +
            (question.layout === 'compact' ? ' answers--compact' : '') +
            (question.layout === 'image-cards' ? ' answers--cards' : '')
          }
        >
          {question.answers.map((answer) => (
            <button
              key={answer.id}
              type="button"
              className={'answer-card' + (selectedAnswerId === answer.id ? ' is-selected' : '')}
              data-testid="answer-option"
              data-answer-id={answer.id}
              title={answer.assetKey ? `placeholder:${answer.assetKey}` : undefined}
              onClick={() => onAnswer(answer)}
            >
              {question.layout === 'image-cards' && (
                <span className="answer-card__media" aria-hidden="true" data-asset={answer.assetKey} />
              )}
              {answer.title && <span className="answer-card__title">{answer.title}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
