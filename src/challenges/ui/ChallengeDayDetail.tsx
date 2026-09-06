import { useState } from 'react'
import type { ChallengeDay } from '../engine/types'

export interface ChallengeDayDetailProps {
  day: ChallengeDay
  onBack: () => void
  onComplete: (mode: 'normal' | 'quick') => void
  onHintOpen?: () => void
  onQuickOpen?: () => void
}

export function ChallengeDayDetail({ day, onBack, onComplete, onHintOpen, onQuickOpen }: ChallengeDayDetailProps) {
  const [hintOpen, setHintOpen] = useState(false)
  const [quickOpen, setQuickOpen] = useState(false)

  const openHint = () => {
    setHintOpen(true)
    onHintOpen?.()
  }
  const openQuick = () => {
    setQuickOpen(true)
    onQuickOpen?.()
  }

  return (
    <section className="challenge-screen" data-testid="challenge-day-detail">
      <button type="button" className="button button--ghost" style={{ alignSelf: 'flex-start' }} data-testid="challenge-day-back" onClick={onBack}>
        ← Назад
      </button>

      <div className="challenge-day__header">
        <p className="challenge-day__eyebrow">ДЕНЬ {String(day.day).padStart(2, '0')}</p>
        <h1 className="challenge-day__title" data-testid="challenge-day-title">
          {day.title}
        </h1>
        {day.subtitle && <p style={{ margin: 0, color: 'var(--muted)', fontSize: '0.9rem' }}>{day.subtitle}</p>}
      </div>

      <div className="challenge-day__hero" data-testid="challenge-day-hero">
        {day.heroImage ? (
          <img src={day.heroImage} alt="" loading="lazy" />
        ) : (
          <span>
            место для reference image
            <br />
            <span style={{ fontSize: '0.75rem' }}>добавьте /public/challenges/beautiful-shots/day{String(day.day).padStart(2, '0')}.jpg</span>
          </span>
        )}
      </div>

      <p className="challenge-day__task" data-testid="challenge-day-task">
        <strong>Сегодня снимаем:</strong>
        <br />
        {day.task}
      </p>

      {day.tips.light && (
        <div className="challenge-day__section">
          <h2 className="challenge-day__section-title">СВЕТ</h2>
          <p>{day.tips.light}</p>
        </div>
      )}
      {day.tips.camera && (
        <div className="challenge-day__section">
          <h2 className="challenge-day__section-title">КАМЕРА</h2>
          <p>{day.tips.camera}</p>
        </div>
      )}
      {day.tips.pose && (
        <div className="challenge-day__section">
          <h2 className="challenge-day__section-title">РУКА / ПОЗА</h2>
          <p>{day.tips.pose}</p>
        </div>
      )}
      {day.tips.composition && (
        <div className="challenge-day__section">
          <h2 className="challenge-day__section-title">КОМПОЗИЦИЯ</h2>
          <p>{day.tips.composition}</p>
        </div>
      )}

      <p style={{ margin: 0, textAlign: 'center', color: 'var(--muted)', fontSize: '0.85rem' }}>{day.durationMinutes}–10 минут</p>

      <div className="challenge-day__actions">
        <button
          type="button"
          className="button button--ghost challenge-day__secondary"
          data-testid="challenge-hint-cta"
          onClick={openHint}
        >
          ПОКАЗАТЬ ПОДСКАЗКУ
        </button>
        <button
          type="button"
          className="button button--primary"
          data-testid="challenge-complete-cta"
          onClick={() => onComplete('normal')}
        >
          Я СНЯЛА
        </button>
      </div>

      {hintOpen && (
        <div className="challenge-sheet-backdrop" data-testid="challenge-hint-sheet" onClick={() => setHintOpen(false)}>
          <div className="challenge-sheet" role="dialog" aria-modal="true" aria-labelledby="hint-title" onClick={(e) => e.stopPropagation()}>
            <h2 id="hint-title" className="challenge-sheet__title">
              Если не получается
            </h2>
            {day.troubleshooting && day.troubleshooting.length > 0 && (
              <ul className="challenge-sheet__list">
                {day.troubleshooting.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            )}
            {day.quickVersion && (
              <div className="challenge-sheet__quick">
                <p className="challenge-sheet__quick-title">Есть только 2 минуты?</p>
                <p className="challenge-sheet__quick-task">{day.quickVersion.task}</p>
                <button
                  type="button"
                  className="button button--secondary"
                  data-testid="challenge-quick-complete-cta"
                  onClick={() => {
                    setHintOpen(false)
                    onComplete('quick')
                  }}
                >
                  ЗАСЧИТАТЬ БЫСТРУЮ ВЕРСИЮ
                </button>
                <button type="button" className="button button--ghost" data-testid="challenge-hint-close" onClick={() => setHintOpen(false)}>
                  Закрыть
                </button>
              </div>
            )}
            {!day.quickVersion && (
              <button type="button" className="button button--ghost" data-testid="challenge-hint-close" onClick={() => setHintOpen(false)}>
                Закрыть
              </button>
            )}
            {/* Also allow explicit quick open tracking */}
            {day.quickVersion && (
              <button type="button" className="button button--ghost" data-testid="challenge-quick-open" onClick={openQuick} style={{ display: 'none' }} aria-hidden>
                quick
              </button>
            )}
          </div>
        </div>
      )}

      {/* Quick sheet separate if desired via hint */}
      {quickOpen && (
        <div className="challenge-sheet-backdrop" data-testid="challenge-quick-sheet" onClick={() => setQuickOpen(false)}>
          <div className="challenge-sheet" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <h2 className="challenge-sheet__title">{day.quickVersion?.title ?? 'Быстрая версия'}</h2>
            <p className="challenge-sheet__quick-task">{day.quickVersion?.task}</p>
            <button type="button" className="button button--primary" data-testid="challenge-quick-complete-cta-2" onClick={() => onComplete('quick')}>
              ЗАСЧИТАТЬ БЫСТРУЮ ВЕРСИЮ
            </button>
            <button type="button" className="button button--ghost" onClick={() => setQuickOpen(false)}>
              Закрыть
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
