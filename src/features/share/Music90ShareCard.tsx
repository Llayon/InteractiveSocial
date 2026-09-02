import { getResultById, resolveBandResultId } from '@/features/quiz/scoring'
import type { Quiz } from '@/features/quiz/schema'
import { M90_HERO_CLASS, M90_HOOKS, M90_OBJECT_SRC } from '@/features/result/ResultCard'
import '@/features/share/Music90ShareCard.css'

export interface Music90ShareCardProps {
  quiz: Quiz
  score: number
}

/**
 * Canonical Music90s share-card renderer — single source of truth for both
 * in-app preview (via Playwright screenshot) and production JPEGs.
 * Uses the same visual tokens as runtime ResultCard (hero class, object, hook)
 * to prevent drift between runtime and Telegram shares.
 */
export function Music90ShareCard({ quiz, score }: Music90ShareCardProps) {
  const resultId = resolveBandResultId(quiz, score)
  const result = getResultById(quiz, resultId)
  if (!result) throw new Error(`unknown result for score ${score}: ${resultId}`)

  const hook = M90_HOOKS[resultId] ?? ''
  const heroClass = M90_HERO_CLASS[resultId] ?? 'm90-result-hero--cassette'
  const objectSrc = M90_OBJECT_SRC[resultId] ?? '/optimized/music90s/cassette.png'

  const total = quiz.questions.length

  return (
    <div className="m90-share-card" data-score={score} data-result-id={resultId} data-testid="m90-share-card">
      {/* Hero with object and small score badge */}
      <div className={`m90-share-card__hero ${heroClass}`}>
        <span className="m90-share-card__badge" data-testid="share-card-badge">
          {score} / {total}
        </span>
        <img className="m90-share-card__object" src={objectSrc} alt="" decoding="sync" loading="eager" />
        <span className="m90-tape m90-tape--tl" aria-hidden="true" />
        <span className="m90-tape m90-tape--tr" aria-hidden="true" />
        {resultId === 'm90_era18' && <span className="m90-foil-accent" aria-hidden="true" />}
      </div>

      <div className="m90-share-card__body">
        <h1 className="m90-share-card__title" data-testid="share-card-title">
          {result.title}
        </h1>
        {hook && (
          <p className="m90-share-card__hook" data-testid="share-card-hook">
            {hook}
          </p>
        )}
      </div>

      <footer className="m90-share-card__footer" data-testid="share-card-footer">
        <div className="m90-share-card__footer-title">Бюро историй</div>
        <div className="m90-share-card__footer-handle">@takeiteasybefore</div>
      </footer>
    </div>
  )
}
