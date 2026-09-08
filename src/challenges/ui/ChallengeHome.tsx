import type { ChallengeDefinition, ChallengeProgress } from '../engine/types'
import { getDayState, getNextAvailableIncompleteDay } from '../engine/unlock'

export interface ChallengeHomeProps {
  definition: ChallengeDefinition
  progress: ChallengeProgress
  availableDay: number
  onOpenDay: (day: number) => void
  onOpenGrid: () => void
}

export function ChallengeHome({ definition, progress, availableDay, onOpenDay, onOpenGrid }: ChallengeHomeProps) {
  const completedCount = progress.completed.length
  const total = definition.durationDays
  const nextIncomplete = getNextAvailableIncompleteDay(definition, progress, availableDay)

  const nextDay = nextIncomplete ? definition.days.find((d) => d.day === nextIncomplete) : null

  const allAvailableDone = nextIncomplete === null
  const nextLockedDay = allAvailableDone ? definition.days.find((d) => d.day === availableDay + 1) : null
  const progressPercent = total > 0 ? Math.round((completedCount / total) * 100) : 0

  const eyebrowLabel = `${total} дней красивых кадров`

  return (
    <section className="challenge-screen" data-testid="challenge-home">
      <div className="challenge-home__header">
        <p className="challenge-home__eyebrow">{eyebrowLabel}</p>
        <div className="challenge-home__progress" aria-label={`прогресс ${completedCount} из ${total}`}>
          <span className="challenge-home__count" data-testid="challenge-progress-count">
            {String(completedCount).padStart(2, '0')} / {String(total).padStart(2, '0')}
          </span>
          <div className="challenge-home__bar" role="progressbar" aria-valuenow={completedCount} aria-valuemin={0} aria-valuemax={total}>
            <div className="challenge-home__bar-fill" style={{ width: `${progressPercent}%` }} />
          </div>
        </div>
      </div>

      {nextDay ? (
        <div className="challenge-card" data-testid="challenge-next-card">
          <p className="challenge-card__label">ДЕНЬ {String(nextDay.day).padStart(2, '0')}</p>
          <h2 className="challenge-card__title">{nextDay.title}</h2>
          {nextDay.subtitle && <p className="challenge-card__meta">{nextDay.subtitle}</p>}
          <p className="challenge-card__meta">
            {nextDay.durationMinutes}–{nextDay.durationMinutes + 5} минут · дома
          </p>
          <button
            type="button"
            className="button button--primary challenge-card__cta"
            data-testid="challenge-continue-cta"
            onClick={() => onOpenDay(nextDay.day)}
          >
            ПРОДОЛЖИТЬ
          </button>
        </div>
      ) : allAvailableDone ? (
        <div className="challenge-card" data-testid="challenge-done-today">
          <p className="challenge-card__label">На сегодня всё готово</p>
          {nextLockedDay ? (
            <p className="challenge-card__meta">
              Завтра откроется:
              <br />
              <strong>
                День {nextLockedDay.day} — {nextLockedDay.title}
              </strong>
            </p>
          ) : (
            <p className="challenge-card__meta">Все {total} дней завершены — вы сделали это.</p>
          )}
          <button type="button" className="button button--ghost challenge-card__cta" data-testid="challenge-view-all" onClick={onOpenGrid}>
            Посмотреть программу
          </button>
        </div>
      ) : null}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${Math.min(total, 7)}, 1fr)`,
            gap: 8,
          }}
          data-testid="challenge-mini-grid"
        >
          {definition.days.map((d) => {
            const state = getDayState(d.day, progress, availableDay)
            const label = state === 'completed' ? '✓' : state === 'completed_quick' ? '○' : state === 'available' ? '○' : '·'
            return (
              <span
                key={d.day}
                style={{
                  textAlign: 'center',
                  fontSize: '0.78rem',
                  padding: '6px 0',
                  borderRadius: 8,
                  border: '1px solid var(--line)',
                  background: state === 'completed' ? 'var(--ink)' : state === 'completed_quick' ? 'var(--accent-soft)' : 'var(--surface)',
                  color: state === 'completed' ? '#fff' : 'var(--ink)',
                }}
                data-testid={`mini-day-${d.day}`}
                data-state={state}
                aria-label={`День ${d.day} ${state}`}
              >
                {String(d.day).padStart(2, '0')} {label}
              </span>
            )
          })}
        </div>
        <button type="button" className="challenge-home__gridlink" data-testid="challenge-open-grid" onClick={onOpenGrid}>
          Вся программа — {total} дней
        </button>
      </div>

      <p className="challenge-home__hint">Можно выполнять в любом порядке — открытые дни не сгорают.</p>
    </section>
  )
}
