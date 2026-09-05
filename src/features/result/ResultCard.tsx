import { OptimizedImage } from '@/images/OptimizedImage'
import { scoreCardAsset } from '@/features/quiz/scoring'
import type { Quiz, Result } from '@/features/quiz/schema'
import { Music90Hook } from './Music90Hook'
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
 * Music90s override: collectible magazine-insert hierarchy (title hero, score badge, hook, object).
 */

export const M90_HOOKS: Record<string, string> = {
  m90_rookie: 'И, кажется, быстро вышла.',
  m90_familiar: 'Что-то смутно всплывает в памяти.',
  m90_cassette: 'База на месте.',
  m90_disco: 'Сразу видно человека с опытом.',
  m90_legend: 'Первый медляк помнишь до сих пор.',
  m90_era17: 'На одном всё-таки срезалась.',
  m90_era18: 'Я с тобой про попсу даже спорить не буду.',
}

export const M90_HERO_CLASS: Record<string, string> = {
  m90_rookie: 'm90-result-hero--rookie',
  m90_familiar: 'm90-result-hero--familiar',
  m90_cassette: 'm90-result-hero--cassette',
  m90_disco: 'm90-result-hero--disco',
  m90_legend: 'm90-result-hero--legend',
  m90_era17: 'm90-result-hero--era17',
  m90_era18: 'm90-result-hero--era18',
}

export const M90_OBJECT_SRC: Record<string, string> = {
  m90_rookie: '/optimized/music90s/tv.png',
  m90_familiar: '/optimized/music90s/boombox.png',
  // Reference implementation for 8–10 uses layered transparent cassette asset
  m90_cassette: '/optimized/music90s/result/m90-cassette.webp',
  m90_disco: '/optimized/music90s/cd-collage.png',
  m90_legend: '/optimized/music90s/magazines.png',
  m90_era17: '/optimized/music90s/magazines.png',
  m90_era18: '/optimized/music90s/magazines.png',
}

export const M90_STICKER: Record<string, { label: string; mod?: string }> = {
  m90_rookie: { label: '0—4' },
  m90_familiar: { label: '5—7' },
  m90_cassette: { label: 'кассета' },
  m90_disco: { label: 'дискотека', mod: 'm90-sticker-title--cyan' },
  m90_legend: { label: 'дискотека', mod: 'm90-sticker-title--lime' },
  m90_era17: { label: '17/18' },
  m90_era18: { label: 'редкая', mod: 'm90-sticker-title--lime m90-sticker-title--rare' },
}

export function ResultCard({ quiz, result, score, children }: ResultCardProps) {
  const presentation = result.presentation
  const isScore = presentation.kind === 'score'
  const isMusic90s = quiz.id === 'music90s'
  // Hero identity: correct-count shows the exact-score card; personality keeps the approved per-result artwork.
  // For music90s we render a collectible object hero instead of the large share-card artwork.
  const heroAsset = isScore && typeof score === 'number' ? scoreCardAsset(quiz, score) : result.id

  if (isMusic90s && isScore) {
    const hook = M90_HOOKS[result.id] ?? ''
    const sticker = M90_STICKER[result.id]
    return (
      <article
        className="result-card"
        data-testid="result-card"
        data-result-id={result.id}
        data-presentation={presentation.kind}
        data-quiz="music90s"
      >
        {/* Layered editorial collage hero — separate transparent assets + CSS */}
        <Music90ResultHero resultId={result.id} score={score} total={quiz.questions.length} />

        <header className="result-card__header">
          {sticker && <span className={`m90-sticker-title ${sticker.mod ?? ''}`.trim()}>{sticker.label}</span>}
          <h1 className="result-card__title" data-testid="result-title">
            {result.title}
          </h1>
        </header>

        {/* Hook on torn pink paper strip — strip is decorative, text is live HTML */}
        <Music90Hook hook={hook} />

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
