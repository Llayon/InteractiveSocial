import type { ChallengeDefinition, ChallengeProgress } from '../engine/types'
import { getDayState } from '../engine/unlock'

export interface ChallengeCompletionProps {
  definition: ChallengeDefinition
  progress: ChallengeProgress
  availableDay: number
  completedDay: number
  mode: 'normal' | 'quick'
  onContinue: () => void
  onHome: () => void
}

export function ChallengeCompletion({
  definition,
  progress,
  availableDay,
  completedDay,
  mode,
  onContinue,
  onHome,
}: ChallengeCompletionProps) {
  const completedCount = progress.completed.length
  const total = definition.durationDays
  let nextDayNumber: number | null = null
  for (let d = 1; d <= Math.min(availableDay, total); d++) {
    const st = getDayState(d, progress, availableDay)
    if (st === 'available') {
      nextDayNumber = d
      break
    }
  }
  const nextDay = nextDayNumber ? definition.days.find((d) => d.day === nextDayNumber) : null
  const lockedNext = !nextDay && availableDay < total ? definition.days.find((d) => d.day === availableDay + 1) : null
  const isQuick = mode === 'quick'

  return (
    <section className="challenge-screen challenge-completion" data-testid="challenge-completion">
      <p className="challenge-completion__number" data-testid="challenge-completion-number">
        {String(completedDay).padStart(2, '0')}
      </p>
      <h1 className="challenge-completion__title">{isQuick ? 'ЗАСЧИТАНО' : 'ГОТОВО'}</h1>
      <p className="challenge-completion__subtitle">{isQuick ? 'Быстрая версия — тоже шаг' : `Первый кадр из ${total}`}</p>
      <p className="challenge-completion__progress" data-testid="challenge-completion-progress">
        {String(completedCount).padStart(2, '0')} / {String(total).padStart(2, '0')}
      </p>

      {nextDay ? (
        <div className="challenge-completion__next" data-testid="challenge-completion-next">
          Дальше: <strong>День {nextDay.day} — {nextDay.title}</strong>
        </div>
      ) : lockedNext ? (
        <div className="challenge-completion__next" data-testid="challenge-completion-next-locked">
          Завтра откроется: <strong>День {lockedNext.day} — {lockedNext.title}</strong>
        </div>
      ) : completedCount >= total ? (
        <div className="challenge-completion__next">Вы прошли все {total} дней — поздравляем!</div>
      ) : (
        <div className="challenge-completion__next">На сегодня всё — вернитесь завтра.</div>
      )}

      <button type="button" className="button button--primary" data-testid="challenge-completion-cta" onClick={onContinue}>
        ГОТОВО
      </button>
      <button type="button" className="button button--ghost" data-testid="challenge-completion-home" onClick={onHome}>
        На главную
      </button>
    </section>
  )
}
