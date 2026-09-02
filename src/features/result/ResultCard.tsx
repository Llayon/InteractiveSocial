import { OptimizedImage } from '@/images/OptimizedImage'
import { scoreCardAsset } from '@/features/quiz/scoring'
import type { Quiz, Result } from '@/features/quiz/schema'

export interface ResultCardProps {
  quiz: Quiz
  result: Result
  /** Exact score for correct-count quizzes (drives hero asset + score line). */
  score?: number
  children?: React.ReactNode
}

/**
 * Presentation-aware result card.
 *  - personality: approved editorial reveal (traits + facts), unchanged;
 *  - score: band text + the EXACT score (e.g. 7/10), no personality fields.
 * Dispatch happens on result.presentation.kind — never on quiz.id.
 */
export function ResultCard({ quiz, result, score, children }: ResultCardProps) {
  const presentation = result.presentation
  const isScore = presentation.kind === 'score'
  // Hero identity: correct-count shows the exact-score card; personality
  // keeps the approved per-result artwork.
  const heroAsset = isScore && typeof score === 'number' ? scoreCardAsset(quiz, score) : result.id

  return (
    <article
      className="result-card"
      data-testid="result-card"
      data-result-id={result.id}
      data-presentation={presentation.kind}
    >
      <OptimizedImage
        bucket="results"
        asset={heroAsset}
        aspectRatio="4/5"
        layout="asset"
        loading="eager"
        fetchPriority="high"
        decoding="async"
        alt={`Обложка результата: ${result.title}`}
        data-testid="result-hero"
        className="result-card__hero-img"
        // borderRadius mirrors the editorial card language; maxWidth keeps the
        // approved 480px hero width when the column widens on desktop.
        style={{ borderRadius: '12px', maxWidth: '480px', marginInline: 'auto' }}
      />

      <header className="result-card__header">
        <h1 className="result-card__title" data-testid="result-title">
          {result.title}
        </h1>
        <p className="result-card__subtitle">{presentation.subtitle}</p>
      </header>

      {isScore && typeof score === 'number' && (
        <p
          className="result-card__score"
          data-testid="result-score"
          aria-label={`Счёт ${score} из ${quiz.questions.length}`}
        >
          {score} / {quiz.questions.length}
        </p>
      )}

      <div className="result-card__description" data-testid="result-description">
        {presentation.description.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
      </div>

      {presentation.kind === 'personality' && (
        <>
          <ul className="result-card__traits" data-testid="result-traits">
            {presentation.traits.map((trait) => (
              <li key={trait}>{trait}</li>
            ))}
          </ul>

          <dl className="result-card__facts">
            <div>
              <dt>Твоя суперсила</dt>
              <dd>{presentation.superpower}</dd>
            </div>
            <div>
              <dt>Зона риска</dt>
              <dd>{presentation.redFlag}</dd>
            </div>
            <div>
              <dt>Что тебе идёт</dt>
              <dd>{presentation.recommendation}</dd>
            </div>
          </dl>
        </>
      )}

      {children}

      <p className="result-card__quiz-title">{quiz.title}</p>
    </article>
  )
}
