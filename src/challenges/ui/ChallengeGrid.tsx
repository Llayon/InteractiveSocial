import type { ChallengeDefinition, ChallengeProgress } from '../engine/types'
import { getDayState } from '../engine/unlock'

export interface ChallengeGridProps {
  definition: ChallengeDefinition
  progress: ChallengeProgress | null
  availableDay: number
  onSelectDay: (day: number) => void
  onBack: () => void
}

function labelForState(state: string): string {
  if (state === 'completed') return '✓'
  if (state === 'completed_quick') return '◐'
  if (state === 'available') return '○'
  return '🔒'
}

export function ChallengeGrid({ definition, progress, availableDay, onSelectDay, onBack }: ChallengeGridProps) {
  return (
    <section className="challenge-screen" data-testid="challenge-grid">
      <button type="button" className="button button--ghost" style={{ alignSelf: 'flex-start' }} data-testid="challenge-grid-back" onClick={onBack}>
        ← Назад
      </button>
      <h1 style={{ margin: 0, fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: '1.4rem' }}>Программа — 30 дней</h1>
      <p style={{ margin: 0, color: 'var(--muted)', fontSize: '0.85rem' }}>Открытые дни доступны всегда. Будущие откроются по календарю.</p>

      <div className="challenge-grid" data-testid="challenge-grid-cells">
        {definition.days.map((d) => {
          const state = getDayState(d.day, progress, availableDay)
          const disabled = state === 'locked'
          return (
            <button
              key={d.day}
              type="button"
              className={`challenge-grid__cell challenge-grid__cell--${state}`}
              data-testid={`challenge-grid-day-${d.day}`}
              data-state={state}
              aria-label={`День ${d.day} ${state}`}
              disabled={disabled}
              onClick={() => !disabled && onSelectDay(d.day)}
            >
              <span className="challenge-grid__number">{String(d.day).padStart(2, '0')}</span>
              <span className="challenge-grid__state" aria-hidden>
                {labelForState(state)}
              </span>
            </button>
          )
        })}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: '0.8rem', color: 'var(--muted)' }}>
        <span>○ — доступно</span>
        <span>✓ — выполнено</span>
        <span>◐ — быстрая версия</span>
        <span>🔒 — откроется по календарю</span>
      </div>
    </section>
  )
}
