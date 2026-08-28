import type { Quiz } from '@/features/quiz/schema'

export interface LandingProps {
  quiz: Quiz
  onStart: () => void
}

/** Editorial landing screen — the entry point of the OPEN → START loop. */
export function Landing({ quiz, onStart }: LandingProps) {
  return (
    <section className="screen landing" aria-labelledby="landing-title">
      <p className="landing__eyebrow">{quiz.copy.eyebrow}</p>
      <h1 id="landing-title" className="landing__title">
        {quiz.title}
      </h1>
      <p className="landing__subtitle">{quiz.subtitle}</p>

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

