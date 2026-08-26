import type { Answer, Question } from './schema'
import { PALETTE_SEGMENT_PROPORTIONS } from './schema'

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
          {question.answers.map((answer) => (
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
                <span className="answer-card__media" aria-hidden="true" data-asset={answer.assetKey}>
                  {answer.assetKey && (
                    <img
                      src={`/answers/${answer.assetKey}.jpg`}
                      alt=""
                      loading="lazy"
                      draggable={false}
                    />
                  )}
                </span>
              )}
              {answer.title && <span className="answer-card__title">{answer.title}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
