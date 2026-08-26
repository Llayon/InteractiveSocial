import type { Quiz, Result } from '@/features/quiz/schema'

export interface ResultCardProps {
  quiz: Quiz
  result: Result
  children?: React.ReactNode
}

const SHARE_IMAGE_PATH = '/share-cards'

/**
 * Editorial personality reveal. Renders the approved content fields
 * in the locked order; the first description paragraph acts as the hook.
 */
export function ResultCard({ quiz, result, children }: ResultCardProps) {
  const [hook, ...body] = result.description

  return (
    <article className="result-card" data-testid="result-card" data-result-id={result.id}>
      <img
        className="result-card__hero"
        src={`${SHARE_IMAGE_PATH}/${result.shareImage}.jpg`}
        alt={`Обложка результата: ${result.title}`}
        data-testid="result-hero"
      />

      <header className="result-card__header">
        <h1 className="result-card__title" data-testid="result-title">
          {result.title}
        </h1>
        <p className="result-card__subtitle">{result.subtitle}</p>
      </header>

      {hook && <p className="result-card__hook">{hook}</p>}

      <div className="result-card__description">
        {body.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
      </div>

      <ul className="result-card__traits" data-testid="result-traits">
        {result.traits.map((trait) => (
          <li key={trait}>{trait}</li>
        ))}
      </ul>

      <dl className="result-card__facts">
        <div>
          <dt>Твоя суперсила</dt>
          <dd>{result.superpower}</dd>
        </div>
        <div>
          <dt>Зона риска</dt>
          <dd>{result.redFlag}</dd>
        </div>
        <div>
          <dt>Что тебе идёт</dt>
          <dd>{result.recommendation}</dd>
        </div>
      </dl>

      {children}

      <p className="result-card__quiz-title">{quiz.title}</p>
    </article>
  )
}
