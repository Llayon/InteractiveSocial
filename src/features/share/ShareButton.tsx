import { useCallback, useState } from 'react'

import { getAnalytics } from '@/analytics/analytics'
import type { Result } from '@/features/quiz/schema'
import type { TelegramAdapter } from '@/platform/telegram'
import { shareResult, type ShareOutcome } from './share'

export interface ShareButtonProps {
  quizId: string
  resultId: string
  shareCta: string
  shareCtaIntro: string
  /** Exact score for correct-count quizzes (drives the score-card asset). */
  score?: number
  result: Result
  telegram?: TelegramAdapter
}

const LABEL_IDLE = 'idle'

/** Primary result CTA — native Telegram share with graceful degradation. */
export function ShareButton({
  quizId,
  resultId,
  shareCta,
  shareCtaIntro,
  score,
  result,
  telegram,
}: ShareButtonProps) {
  const [status, setStatus] = useState<'idle' | 'sharing' | ShareOutcome>(LABEL_IDLE)

  const handleClick = useCallback(async () => {
    if (!telegram) return
    setStatus('sharing')
    const outcome = await shareResult({
      telegram,
      analytics: getAnalytics(),
      quizId,
      resultId,
      result,
      score,
    })
    setStatus(outcome)
  }, [telegram, quizId, resultId, shareCta, score, result])

  const label =
    status === 'sharing'
      ? 'Отправляем…'
      : status === 'native'
        ? 'Отправлено ✓'
        : status === 'failed'
          ? 'Не получилось — попробовать ещё раз'
          : shareCta

  return (
    <div className="share">
      <p className="share__intro">{shareCtaIntro}</p>
      <button
        type="button"
        className="button button--primary share__cta"
        data-testid="share-button"
        onClick={handleClick}
        disabled={status === 'sharing'}
      >
        {label}
      </button>
      <span className="visually-hidden" role="status" data-testid="share-status">
        {status}
      </span>
    </div>
  )
}
