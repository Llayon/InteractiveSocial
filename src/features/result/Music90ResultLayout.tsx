import type { Quiz, Result } from '@/features/quiz/schema'
import { getMusic90AssetSet, type Music90AssetSet } from '@/content/quizzes/music90s/resultAssets.js'
import { Music90ResultHero } from './Music90ResultHero'
import { Music90Hook } from './Music90Hook'

export interface Music90ResultLayoutProps {
  quiz: Quiz
  result: Result
  score?: number
  /** Optional override — otherwise resolved via getMusic90AssetSet(result.id) */
  assetSet?: Music90AssetSet
  /** Share CTA block — caller passes <ShareButton .../> to keep transport logic untouched */
  shareSlot: React.ReactNode
  /** Channel funnel props — passed from Result.tsx boundary */
  promoIntro?: string | null
  promoCta?: string | null
  channelUrl?: string | null
  showPromo: boolean
  onChannelClick?: () => void
  onRestart: () => void
}

/**
 * Single reusable layout for all 7 music90s result bands.
 * Physical-editorial 90s language is driven by `assetSet` (hero, foil, tapes, stickers),
 * not by 7 manually assembled screens. Title/hook/body are live HTML for readability.
 * Decor is bounded: no elongation after Share, CTA stays in sane first-scroll.
 */
export function Music90ResultLayout({
  quiz,
  result,
  score,
  assetSet,
  shareSlot,
  promoIntro,
  promoCta,
  channelUrl,
  showPromo,
  onChannelClick,
  onRestart,
}: Music90ResultLayoutProps) {
  const set = assetSet ?? getMusic90AssetSet(result.id)
  const presentation = result.presentation
  if (presentation.kind !== 'score') return null

  return (
    <article
      className="result-card"
      data-testid="result-card"
      data-result-id={result.id}
      data-presentation={presentation.kind}
      data-quiz="music90s"
      data-range={set.rangeFolder}
      data-rare={set.layout.rare ? 'true' : undefined}
    >
      {/* Hero collage — data-driven per band, graceful fallback internally */}
      <Music90ResultHero assetSet={set} score={score} total={quiz.questions.length} />

      <header className="result-card__header">
        <span className={`m90-sticker-title ${set.label.mod ?? ''}`.trim()}>{set.label.text}</span>
        <h1 className="result-card__title" data-testid="result-title">
          {result.title}
        </h1>
      </header>

      {/* Hook on torn pink paper strip — live text, decorative bg from assetSet */}
      <Music90Hook hook={set.hook} strip={set.hookStrip} />

      <div className="result-card__description" data-testid="result-description">
        {presentation.description.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
      </div>

      {shareSlot}

      {showPromo && promoIntro && promoCta && channelUrl && (
        <>
          <p className="result__promo-note" data-testid="channel-promo-note">
            {promoIntro}
          </p>
          <a
            className="button button--secondary result__channel"
            href={channelUrl}
            target="_blank"
            rel="noreferrer"
            data-testid="channel-link"
            onClick={onChannelClick}
          >
            {promoCta}
          </a>
        </>
      )}
      <button
        type="button"
        className="button button--ghost result__restart"
        data-testid="restart-button"
        onClick={onRestart}
      >
        {quiz.restartCta}
      </button>

      <p className="result-card__quiz-title">{quiz.title}</p>
    </article>
  )
}
