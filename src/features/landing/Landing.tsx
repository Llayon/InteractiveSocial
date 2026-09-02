import type { Quiz } from '@/features/quiz/schema'

export interface LandingProps {
  quiz: Quiz
  onStart: () => void
}

/** Editorial landing screen — the entry point of the OPEN → START loop. */
export function Landing({ quiz, onStart }: LandingProps) {
  const isMusic90s = quiz.id === 'music90s'

  return (
    <section className="screen landing" aria-labelledby="landing-title">
      <p className="landing__eyebrow">{quiz.copy.eyebrow}</p>
      <h1 id="landing-title" className="landing__title">
        {quiz.title}
      </h1>
      <p className="landing__subtitle">{quiz.subtitle}</p>

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

