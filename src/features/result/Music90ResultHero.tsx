/**
 * Layered editorial collage hero for Music90s — now fully data-driven via Music90AssetSet.
 * No hardcoded asset maps in JSX; all paths flow through resultAssets.ts.
 * Graceful fallback: hero → hero fallback → objectFallback (music90s-objects).
 */

import type { Music90AssetSet } from '@/content/quizzes/music90s/resultAssets.js'
import { getMusic90AssetSet } from '@/content/quizzes/music90s/resultAssets.js'

export interface Music90HeroProps {
  resultId?: string
  assetSet?: Music90AssetSet
  score?: number
  total: number
}

// Backward compat — still used by tests that import getHeroObjectSrc
export function getHeroObjectSrc(resultId: string): string {
  return getMusic90AssetSet(resultId).hero.src
}

export function getHeroObjectFallback(resultId: string): string | undefined {
  return getMusic90AssetSet(resultId).hero.fallback
}

export function Music90ResultHero({ resultId, assetSet, score, total }: Music90HeroProps) {
  const set = assetSet ?? (resultId ? getMusic90AssetSet(resultId) : getMusic90AssetSet('m90_cassette'))
  const objectSrc = set.hero.src
  const objectFallback = set.hero.fallback
  const foil = set.foil
  const isCassette = set.id === 'm90_cassette'
  const showFoil = foil !== null && foil.variant !== 'hidden'
  const foilClass =
    foil?.variant === 'cassette' ? 'm90-foil--cassette' : foil?.variant === 'rare' ? 'm90-foil--rare' : 'm90-foil--generic'

  // Tapes & stickers are now driven by assetSet, but still bounded to 2–3 pieces for mobile density
  return (
    <div className={`m90-result-stage ${set.layout.heroClass}`} data-testid="result-hero" data-hero={set.id} data-range={set.rangeFolder} data-quiz="music90s" data-rare={set.layout.rare ? 'true' : undefined}>
      {/* Cream paper texture is CSS ::before, no image */}
      {showFoil && foil && (
        <img
          className={`m90-foil ${foilClass}`}
          src={foil.src}
          alt=""
          aria-hidden="true"
          decoding="async"
          loading="eager"
          onError={(e) => {
            const t = e.currentTarget
            if (t.src.endsWith('.webp')) t.src = foil.fallback
          }}
        />
      )}

      {/* Decorative tapes — position classes come from assetSet */}
      {set.tapes.map((tape) => (
        <img
          key={tape.positionClass}
          className={`m90-tape ${tape.positionClass}`}
          src={tape.src}
          alt=""
          aria-hidden="true"
          decoding="async"
          loading="eager"
          onError={(e) => {
            const t = e.currentTarget
            if (t.src.endsWith('.webp')) t.src = tape.fallback
          }}
        />
      ))}

      {/* Main object — hero is range-specific, with objectFallback chain for empty ranges */}
      <img
        className={`m90-object ${isCassette ? 'm90-object--cassette' : `m90-object--${set.id}`}`}
        src={objectSrc}
        alt=""
        decoding="async"
        loading="eager"
        onError={(e) => {
          const t = e.currentTarget
          // first fallback: webp → png
          if (t.src.endsWith('.webp') && objectFallback) {
            t.src = objectFallback
            return
          }
          // second fallback: png → music90s-objects graceful chain
          if (set.hero.objectFallback && t.src !== set.hero.objectFallback) {
            t.src = set.hero.objectFallback
          }
        }}
      />

      {/* Sticker pack — curated, not messy */}
      {set.stickers.map((sticker) => (
        <img
          key={sticker.positionClass}
          className={`m90-sticker ${sticker.positionClass}`}
          src={sticker.src}
          alt=""
          aria-hidden="true"
          decoding="async"
          loading="eager"
          onError={(e) => {
            const t = e.currentTarget
            if (t.src.endsWith('.webp')) t.src = sticker.fallback
          }}
        />
      ))}

      {/* Rare foil accent for 18 only — pearl/holographic extra */}
      {set.layout.rare && <span className="m90-foil-accent" aria-hidden="true" />}

      {/* Live score badge — HTML text, not baked into image */}
      {typeof score === 'number' && (
        <span className="m90-score-badge" data-testid="result-score" aria-label={`Счёт ${score} из ${total}`}>
          {score} / {total}
        </span>
      )}
    </div>
  )
}
