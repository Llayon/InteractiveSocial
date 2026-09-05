import { OptimizedImage } from '@/images/OptimizedImage'
import { scoreCardAsset } from '@/features/quiz/scoring'
import type { Quiz, Result } from '@/features/quiz/schema'
import { MUSIC90_RESULT_ASSETS, getMusic90AssetSet } from '@/content/quizzes/music90s/resultAssets.js'
import { Music90ResultHero } from './Music90ResultHero'

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
 * Music90s override: now data-driven via resultAssets.ts — no hardcoded paths in JSX.
 * Reusable layout: hero/badge/title/hook/body are live HTML; decor is bounded CSS layers.
 */

// Backward-compatible re-exports — source of truth is resultAssets.ts
// Keeps legacy imports (Music90ShareCard, unit tests) working without duplication.
export const M90_HOOKS: Record<string, string> = Object.fromEntries(
  Object.entries(MUSIC90_RESULT_ASSETS).map(([k, v]) => [k, v.hook]),
) as Record<string, string>

export const M90_HERO_CLASS: Record<string, string> = Object.fromEntries(
  Object.entries(MUSIC90_RESULT_ASSETS).map(([k, v]) => [k, v.layout.heroClass]),
) as Record<string, string>

export const M90_OBJECT_SRC: Record<string, string> = Object.fromEntries(
  Object.entries(MUSIC90_RESULT_ASSETS).map(([k, v]) => [k, v.hero.src]),
) as Record<string, string>

export const M90_STICKER: Record<string, { label: string; mod?: string }> = Object.fromEntries(
  Object.entries(MUSIC90_RESULT_ASSETS).map(([k, v]) => [k, { label: v.label.text, mod: v.label.mod }]),
) as Record<string, { label: string; mod?: string }>

export function ResultCard({ quiz, result, score, children }: ResultCardProps) {
  const presentation = result.presentation
  const isScore = presentation.kind === 'score'
  const isMusic90s = quiz.id === 'music90s'
  const heroAsset = isScore && typeof score === 'number' ? scoreCardAsset(quiz, score) : result.id

  if (isMusic90s && isScore) {
    const assetSet = getMusic90AssetSet(result.id)
    return (
      <article
        className="result-card"
        data-testid="result-card"
        data-result-id={result.id}
        data-presentation={presentation.kind}
        data-quiz="music90s"
        data-range={assetSet.rangeFolder}
        data-rare={assetSet.layout.rare ? 'true' : undefined}
      >
        {/* Layered editorial collage hero — data-driven, graceful fallback to objects */}
        <Music90ResultHero assetSet={assetSet} score={score} total={quiz.questions.length} />

        <header className="result-card__header">
          <span className={`m90-sticker-title ${assetSet.label.mod ?? ''}`.trim()}>{assetSet.label.text}</span>
          <h1 className="result-card__title" data-testid="result-title">
            {result.title}
          </h1>
        </header>

        {/* Hook on torn pink paper strip — strip is decorative, text is live HTML */}
        <div className="m90-hook-wrap" data-testid="result-hook-wrap">
          <img
            className="m90-hook-bg"
            src={assetSet.hookStrip.src}
            alt=""
            aria-hidden="true"
            decoding="async"
            loading="eager"
            onError={(e) => {
              const t = e.currentTarget
              if (t.src.endsWith('.webp')) t.src = assetSet.hookStrip.fallback
            }}
          />
          <div className="m90-hook-text" data-testid="result-hook">
            {assetSet.hook}
          </div>
        </div>

        <div className="result-card__description" data-testid="result-description">
          {presentation.description.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>

        {children}

        <p className="result-card__quiz-title">{quiz.title}</p>
      </article>
    )
  }

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
