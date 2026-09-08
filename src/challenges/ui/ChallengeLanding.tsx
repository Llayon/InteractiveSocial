export interface ChallengeLandingProps {
  onStart: () => void
  disabled?: boolean
}

export function ChallengeLanding({ onStart, disabled }: ChallengeLandingProps) {
  return (
    <section className="challenge-screen challenge-landing" aria-labelledby="challenge-landing-title" data-testid="challenge-landing">
      <p className="challenge-landing__kicker">30 дней</p>
      <h1 id="challenge-landing-title" className="challenge-landing__title">
        КРАСИВЫХ
        <br />
        КАДРОВ
      </h1>
      <p className="challenge-landing__subtitle">
        Красивые фотографии
        <br />
        из обычной жизни.
      </p>
      <p className="challenge-landing__subtitle" style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>
        Телефон.
        <br />
        5–10 минут в день.
        <br />
        Без фотографа и студии.
      </p>

      <div className="challenge-landing__bullets" aria-label="преимущества">
        <span className="challenge-landing__bullet">30 заданий</span>
        <span className="challenge-landing__bullet">5–10 минут</span>
        <span className="challenge-landing__bullet">ничего покупать не нужно</span>
      </div>

      <button
        type="button"
        className="button button--primary challenge-landing__cta"
        data-testid="challenge-start-cta"
        onClick={onStart}
        disabled={disabled}
        aria-busy={disabled ? 'true' : undefined}
      >
        НАЧАТЬ
      </button>
      <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--muted)' }}>Бесплатно · без регистрации</p>
    </section>
  )
}
