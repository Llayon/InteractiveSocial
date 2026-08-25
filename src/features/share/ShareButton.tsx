import { useCallback, useState } from 'react'

import { getAnalytics } from '@/analytics/analytics'
import type { Quiz, Result } from '@/features/quiz/schema'
import type { TelegramAdapter } from '@/platform/telegram'
import { shareResult, type ShareOutcome } from './share'

export interface ShareButtonProps {
  quiz: Quiz
  result: Result
  telegram?: TelegramAdapter
}

const LABEL_IDLE = 'idle'

/** Primary result CTA — native Telegram share with graceful degradation. */
export function ShareButton({ quiz, result, telegram }: ShareButtonProps) {
  const [status, setStatus] = useState<'idle' | 'sharing' | ShareOutcome>(LABEL_IDLE)

  const handleClick = useCallback(async () => {
    if (!telegram) return
    setStatus('sharing')
    const outcome = await shareResult({
      telegram,
      analytics: getAnalytics(),
      quiz,
      result,
    })
    setStatus(outcome)
  }, [telegram, quiz, result])

  const label =
    status === 'sharing'
      ? 'Отправляем…'
      : status === 'native'
        ? 'Отправлено ✓'
        : status === 'failed'
          ? 'Не получилось — попробовать ещё раз'
          : quiz.shareCta

  return (
    <div className="share">
      <p className="share__intro">{quiz.shareCtaIntro}</p>
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
