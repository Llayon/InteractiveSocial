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

const CHANNEL_URL = 'https://t.me/takeiteasybefore'

/** Result screen: editorial reveal + share loop + restart + channel promo. */
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
        <a
          className="button button--ghost result__channel"
          href={CHANNEL_URL}
          target="_blank"
          rel="noreferrer"
          data-testid="channel-link"
        >
          ✨ Бюро историй — читать канал
        </a>
      </ResultCard>
    </section>
  )
}
