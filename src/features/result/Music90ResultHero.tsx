/**
 * Layered editorial collage hero for Music90s.
 * Separate transparent assets + CSS — no flattened poster.
 * Reference implementation for m90_cassette (8–10 / 18), reusable for all 7 bands by swapping config.
 */

export interface Music90HeroProps {
  resultId: string
  score?: number
  total: number
}

// Central asset map — stage swaps object family, decorative arrangement, optional rare treatment.
// All assets are transparent PNG/WebP with soft shadows, optimized for runtime.
const HERO_OBJECT_SRC: Record<string, string> = {
  m90_rookie: '/optimized/music90s/tv.png',
  m90_familiar: '/optimized/music90s/boombox.png',
  // 8–10 reference — high-fidelity cassette with pink tapes & stickers baked + foil separation
  m90_cassette: '/optimized/music90s/result/m90-cassette.webp',
  m90_disco: '/optimized/music90s/cd-collage.png',
  m90_legend: '/optimized/music90s/magazines.png',
  m90_era17: '/optimized/music90s/magazines.png',
  m90_era18: '/optimized/music90s/magazines.png',
}

const HERO_OBJECT_FALLBACK: Record<string, string> = {
  m90_cassette: '/optimized/music90s/result/m90-cassette.png',
}

export function getHeroObjectSrc(resultId: string): string {
  return HERO_OBJECT_SRC[resultId] ?? '/optimized/music90s/result/m90-cassette.webp'
}

export function getHeroObjectFallback(resultId: string): string | undefined {
  return HERO_OBJECT_FALLBACK[resultId]
}

export function Music90ResultHero({ resultId, score, total }: Music90HeroProps) {
  const objectSrc = getHeroObjectSrc(resultId)
  const objectFallback = getHeroObjectFallback(resultId)
  const isCassette = resultId === 'm90_cassette'
  // Foil is hero for cassette, subtle for disco/legend/era, hidden for rookie/familiar
  const showFoil = resultId === 'm90_cassette' || resultId === 'm90_disco' || resultId === 'm90_legend' || resultId === 'm90_era17' || resultId === 'm90_era18'
  const foilClass = isCassette ? 'm90-foil--cassette' : 'm90-foil--generic'

  return (
    <div className="m90-result-stage" data-testid="result-hero" data-hero={resultId} data-quiz="music90s">
      {/* Cream paper texture is CSS ::before, no image */}
      {showFoil && (
        <img
          className={`m90-foil ${foilClass}`}
          src="/optimized/music90s/result/m90-foil.webp"
          srcSet="/optimized/music90s/result/m90-foil.webp 1x"
          alt=""
          aria-hidden="true"
          decoding="async"
          loading="eager"
          // PNG fallback for older browsers handled via onError or <picture>; webp is primary
          onError={(e) => {
            const t = e.currentTarget
            if (t.src.endsWith('.webp')) t.src = '/optimized/music90s/result/m90-foil.png'
          }}
        />
      )}

      {/* Pink tape assets — 2 pieces pinning the collage, irregular */}
      <img
        className="m90-tape m90-tape--a"
        src="/optimized/music90s/result/m90-tape-gingham-1.webp"
        alt=""
        aria-hidden="true"
        decoding="async"
        loading="eager"
        onError={(e) => {
          const t = e.currentTarget
          if (t.src.endsWith('.webp')) t.src = '/optimized/music90s/result/m90-tape-gingham-1.png'
        }}
      />
      <img
        className="m90-tape m90-tape--b"
        src="/optimized/music90s/result/m90-tape-pale-1.webp"
        alt=""
        aria-hidden="true"
        decoding="async"
        loading="eager"
        onError={(e) => {
          const t = e.currentTarget
          if (t.src.endsWith('.webp')) t.src = '/optimized/music90s/result/m90-tape-pale-1.png'
        }}
      />

      {/* Main object — cassette for 8–10, TV/boombox/CD/magazine for other bands */}
      <img
        className={`m90-object ${isCassette ? 'm90-object--cassette' : `m90-object--${resultId}`}`}
        src={objectSrc}
        alt=""
        decoding="async"
        loading="eager"
        onError={(e) => {
          if (objectFallback) {
            const t = e.currentTarget
            if (t.src.endsWith('.webp')) t.src = objectFallback
          }
        }}
      />

      {/* Sticker pack — curated, not messy: 3 small stickers around hero */}
      <img
        className="m90-sticker m90-sticker--heart"
        src="/optimized/music90s/result/m90-sticker-heart-glitter.webp"
        alt=""
        aria-hidden="true"
        decoding="async"
        loading="eager"
        onError={(e) => {
          const t = e.currentTarget
          if (t.src.endsWith('.webp')) t.src = '/optimized/music90s/result/m90-sticker-heart-glitter.png'
        }}
      />
      <img
        className="m90-sticker m90-sticker--star"
        src="/optimized/music90s/result/m90-sticker-star-gold.webp"
        alt=""
        aria-hidden="true"
        decoding="async"
        loading="eager"
        onError={(e) => {
          const t = e.currentTarget
          if (t.src.endsWith('.webp')) t.src = '/optimized/music90s/result/m90-sticker-star-gold.png'
        }}
      />
      <img
        className="m90-sticker m90-sticker--lips"
        src="/optimized/music90s/result/m90-sticker-lips.webp"
        alt=""
        aria-hidden="true"
        decoding="async"
        loading="eager"
        onError={(e) => {
          const t = e.currentTarget
          if (t.src.endsWith('.webp')) t.src = '/optimized/music90s/result/m90-sticker-lips.png'
        }}
      />

      {/* Rare foil accent for 18 only — pearl/holographic extra */}
      {resultId === 'm90_era18' && <span className="m90-foil-accent" aria-hidden="true" />}

      {/* Live score badge — HTML text, not baked into image */}
      {typeof score === 'number' && (
        <span className="m90-score-badge" data-testid="result-score" aria-label={`Счёт ${score} из ${total}`}>
          {score} / {total}
        </span>
      )}
    </div>
  )
}
