import { getResultById } from '@/features/quiz/scoring'
import type { Quiz } from '@/features/quiz/schema'
import { ShareButton } from '@/features/share/ShareButton'
import type { TelegramAdapter } from '@/platform/telegram'
import { ResultCard } from './ResultCard'

export interface ResultScreenProps {
  quiz: Quiz
  resultId: string
  telegram?: TelegramAdapter
  onRestart: () => void
}

/** Result screen: editorial reveal + share loop + restart. */
export function ResultScreen({ quiz, resultId, telegram, onRestart }: ResultScreenProps) {
  const result = getResultById(quiz, resultId)
  if (!result) {
    throw new Error(`Cannot render unknown result "${resultId}"`)
  }

  return (
    <section className="screen result" data-testid="result-screen">
      <ResultCard quiz={quiz} result={result}>
        <ShareButton quiz={quiz} result={result} telegram={telegram} />
        <button
          type="button"
          className="button button--ghost result__restart"
          data-testid="restart-button"
          onClick={onRestart}
        >
          {quiz.restartCta}
        </button>
      </ResultCard>
    </section>
  )
}
