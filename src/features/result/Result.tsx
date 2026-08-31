import { getResultById, type QuizOutcome } from '@/features/quiz/scoring'
import type { Quiz } from '@/features/quiz/schema'
import { ShareButton } from '@/features/share/ShareButton'
import type { MiniAppAdapter } from '@/platform/types'
import type { TelegramAdapter } from '@/platform/telegram'
import { ResultCard } from './ResultCard'

export interface ResultScreenProps {
  quiz: Quiz
  /** Canonical outcome — the screen never re-derives scoring itself. */
  outcome: QuizOutcome
  telegram?: TelegramAdapter
  adapter?: MiniAppAdapter
  onRestart: () => void
}

const CHANNEL_URL = 'https://t.me/takeiteasybefore'

/** Result screen: editorial reveal + share loop + restart + channel promo. */
export function ResultScreen({ quiz, outcome, telegram, adapter, onRestart }: ResultScreenProps) {
  const result = getResultById(quiz, outcome.resultId)
  if (!result) {
    throw new Error(`Cannot render unknown result "${outcome.resultId}"`)
  }
  const score = outcome.kind === 'correct-count' ? outcome.correct : undefined
  const platformAdapter = (adapter ?? telegram) as MiniAppAdapter | undefined

  // Channel promo: keep Telegram promo only for telegram/browser, not for MAX
  const showChannel = platformAdapter?.platform !== 'max'

  return (
    <section className="screen result" data-testid="result-screen">
      <ResultCard quiz={quiz} result={result} score={score}>
        <ShareButton
          quizId={quiz.id}
          resultId={result.id}
          shareCta={quiz.shareCta}
          shareCtaIntro={quiz.shareCtaIntro}
          score={score}
          result={result}
          telegram={telegram as TelegramAdapter}
          adapter={platformAdapter}
        />
        <button
          type="button"
          className="button button--ghost result__restart"
          data-testid="restart-button"
          onClick={onRestart}
        >
          {quiz.restartCta}
        </button>
        {showChannel && (
          <a
            className="button button--ghost result__channel"
            href={CHANNEL_URL}
            target="_blank"
            rel="noreferrer"
            data-testid="channel-link"
          >
            ✨ Бюро историй — читать канал
          </a>
        )}
      </ResultCard>
    </section>
  )
}
