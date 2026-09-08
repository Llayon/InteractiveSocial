import type { ChallengeDefinition, ChallengeProgress } from '../engine/types'
import { getPublishedDayState } from '../engine/unlock'

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
  const total = definition.durationDays
  return (
    <section className="challenge-screen" data-testid="challenge-grid">
      <button
        type="button"
        className="button button--ghost"
        style={{ alignSelf: 'flex-start' }}
        data-testid="challenge-grid-back"
        onClick={onBack}
      >
        ← Назад
      </button>
      <h1 style={{ margin: 0, fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: '1.4rem' }}>Программа — {total} дней</h1>
      <p style={{ margin: 0, color: 'var(--muted)', fontSize: '0.85rem' }}>Открытые дни доступны всегда. Будущие откроются по календарю.</p>

      <div className="challenge-grid" data-testid="challenge-grid-cells">
        {Array.from({ length: total }, (_, i) => i + 1).map((dayNum) => {
          const state = getPublishedDayState(definition, dayNum, progress, availableDay)
          const disabled = state === 'locked'
          return (
            <button
              key={dayNum}
              type="button"
              className={`challenge-grid__cell challenge-grid__cell--${state}`}
              data-testid={`challenge-grid-day-${dayNum}`}
              data-state={state}
              aria-label={`День ${dayNum} ${state}`}
              disabled={disabled}
              onClick={() => !disabled && onSelectDay(dayNum)}
            >
              <span className="challenge-grid__number">{String(dayNum).padStart(2, '0')}</span>
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
