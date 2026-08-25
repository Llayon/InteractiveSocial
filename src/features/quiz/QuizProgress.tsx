interface QuizProgressProps {
  currentIndex: number
  total: number
}

/** Thin editorial progress indicator: "03 / 08" + hairline bar. */
export function QuizProgress({ currentIndex, total }: QuizProgressProps) {
  const currentNumber = Math.min(currentIndex + 1, total)
  const label = `${String(currentNumber).padStart(2, '0')} / ${String(total).padStart(2, '0')}`
  const percent = Math.round((currentNumber / total) * 100)

  return (
    <div className="progress" data-testid="progress" aria-label={`Вопрос ${currentNumber} из ${total}`}>
      <span className="progress__label">{label}</span>
      <div className="progress__track" role="presentation">
        <div className="progress__fill" style={{ width: `${percent}%` }} />
      </div>
    </div>
  )
}
