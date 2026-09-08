import { useState } from 'react'

export interface ChallengeFeedbackProps {
  day: number
  onSubmit: (rating: 'easy' | 'normal' | 'hard', reasons?: string[]) => void
  onSkip: () => void
}

const REASONS = ['не поняла задание', 'не нашла место', 'не получился свет', 'не знаю, как встать', 'не было времени']

export function ChallengeFeedback({ day, onSubmit, onSkip }: ChallengeFeedbackProps) {
  const [rating, setRating] = useState<'easy' | 'normal' | 'hard' | null>(null)
  const [reasons, setReasons] = useState<Set<string>>(new Set())
  const [submitted, setSubmitted] = useState(false)

  const toggleReason = (r: string) => {
    setReasons((prev) => {
      const next = new Set(prev)
      if (next.has(r)) next.delete(r)
      else next.add(r)
      return next
    })
  }

  const handleSubmit = () => {
    if (!rating) return
    const finalReasons = rating !== 'easy' ? [...reasons] : undefined
    onSubmit(rating, finalReasons?.length ? finalReasons : undefined)
    setSubmitted(true)
  }

  if (submitted) {
    return (
      <div className="challenge-feedback" data-testid="challenge-feedback-done">
        <p style={{ margin: 0, textAlign: 'center' }}>Спасибо за обратную связь!</p>
        <button type="button" className="button button--ghost" data-testid="challenge-feedback-close" onClick={onSkip}>
          Продолжить
        </button>
      </div>
    )
  }

  return (
    <div className="challenge-feedback" data-testid="challenge-feedback">
      <p className="challenge-feedback__title">Как было? — День {day}</p>
      <div className="challenge-feedback__row">
        <button
          type="button"
          className={`button ${rating === 'easy' ? 'button--primary' : 'button--secondary'}`}
          data-testid="feedback-easy"
          onClick={() => setRating('easy')}
        >
          ЛЕГКО
        </button>
        <button
          type="button"
          className={`button ${rating === 'normal' ? 'button--primary' : 'button--secondary'}`}
          data-testid="feedback-normal"
          onClick={() => setRating('normal')}
        >
          НОРМАЛЬНО
        </button>
        <button
          type="button"
          className={`button ${rating === 'hard' ? 'button--primary' : 'button--secondary'}`}
          data-testid="feedback-hard"
          onClick={() => setRating('hard')}
        >
          СЛОЖНО
        </button>
      </div>

      {(rating === 'normal' || rating === 'hard') && (
        <div className="challenge-feedback__reasons" data-testid="feedback-reasons">
          {REASONS.map((r) => (
            <label key={r} data-testid={`feedback-reason-${r}`}>
              <input type="checkbox" checked={reasons.has(r)} onChange={() => toggleReason(r)} />
              {r}
            </label>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" className="button button--ghost" style={{ flex: 1 }} data-testid="feedback-skip" onClick={onSkip}>
          Пропустить
        </button>
        <button
          type="button"
          className="button button--primary"
          style={{ flex: 1 }}
          data-testid="feedback-submit"
          disabled={!rating}
          onClick={handleSubmit}
        >
          Отправить
        </button>
      </div>
    </div>
  )
}
