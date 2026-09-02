import { useEffect } from 'react'

import type { Quiz } from '@/features/quiz/schema'

export interface LandingProps {
  quiz: Quiz
  onStart: () => void
}

/** Editorial landing screen — the entry point of the OPEN → START loop. */
export function Landing({ quiz, onStart }: LandingProps) {
  // Regression: ensure landing always opens at scrollTop 0 (no retained offset,
  // no Telegram chrome clipping). Blur any autofocus that could pull viewport.
  useEffect(() => {
    // Use manual restoration if available — prevents browser back/refresh
    // from restoring a mid-page offset.
    try {
      if ('scrollRestoration' in history) {
        history.scrollRestoration = 'manual'
      }
    } catch {}
    window.scrollTo(0, 0)
    document.documentElement.scrollTop = 0
    document.body.scrollTop = 0
    if (document.activeElement instanceof HTMLElement) {
      // Avoid stealing focus from CTA, but prevent off-screen focus pull
      const tag = document.activeElement.tagName.toLowerCase()
      if (tag !== 'button' && tag !== 'a') document.activeElement.blur()
    }
    // Ensure any async layout (images/font) doesn't leave us scrolled
    const id = requestAnimationFrame(() => window.scrollTo(0, 0))
    return () => cancelAnimationFrame(id)
  }, [])
  const isMusic90s = quiz.id === 'music90s'
  const attribution = quiz.channelPromotion?.landingAttribution

  return (
    <section className="screen landing" aria-labelledby="landing-title">
      <p className="landing__eyebrow">{quiz.copy.eyebrow}</p>
      <h1 id="landing-title" className="landing__title">
        {quiz.title}
      </h1>
      <p className="landing__subtitle">{quiz.subtitle}</p>

      {attribution && (
        <p className="landing__attribution" data-testid="landing-attribution">
          {attribution}
        </p>
      )}

      {isMusic90s && (
        <div className="m90-hero-collage" aria-hidden="true" data-testid="m90-hero-collage">
          <span className="m90-tape m90-tape--tl" />
          <span className="m90-tape m90-tape--tr" />
          <div className="m90-collage-stage">
            <div className="m90-collage-item m90-collage-item--cassette">
              <img src="/optimized/music90s/cassette.png" alt="" loading="eager" decoding="async" width={300} height={300} />
            </div>
            <div className="m90-collage-item m90-collage-item--cd">
              <img src="/optimized/music90s/cd-collage.png" alt="" loading="eager" decoding="async" width={300} height={300} />
            </div>
            <div className="m90-collage-item m90-collage-item--boombox">
              <img src="/optimized/music90s/boombox.png" alt="" loading="lazy" decoding="async" width={300} height={300} />
            </div>
            <div className="m90-collage-item m90-collage-item--tv">
              <img src="/optimized/music90s/tv.png" alt="" loading="lazy" decoding="async" width={300} height={300} />
            </div>
            <span className="m90-sticker-1999">1999</span>
            <span className="m90-tape m90-tape--mid" aria-hidden="true" />
          </div>
          <p className="m90-hero-caption">кассеты · диски · MTV · анкеты</p>
        </div>
      )}

      <div className="landing__copy">
        {quiz.landing.paragraphs.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
      </div>

      <div className="landing__meta">
        {quiz.landing.meta.map((item) => (
          <span key={item} className="landing__meta-item">
            {item}
          </span>
        ))}
      </div>

      <button
        type="button"
        className="button button--primary landing__cta"
        data-testid="start-cta"
        onClick={onStart}
      >
        {quiz.startCta}
      </button>
    </section>
  )
}

