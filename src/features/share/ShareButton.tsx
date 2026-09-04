import { useCallback, useState } from 'react'

import { getAnalytics } from '@/analytics/analytics'
import type { Result } from '@/features/quiz/schema'
import type { MiniAppAdapter } from '@/platform/types'
import type { TelegramAdapter } from '@/platform/telegram'
import { getShareTransport, type ShareOutcome } from '@/platform/share/ShareTransport'

export interface ShareButtonProps {
  quizId: string
  resultId: string
  shareCta: string
  shareCtaIntro: string
  /** Exact score for correct-count quizzes (drives the score-card asset). */
  score?: number
  /** Total questions — forwarded to ShareTransport for correct fallback copy */
  total?: number
  /** Quiz title — forwarded to ShareTransport for correct fallback copy */
  quizTitle?: string
  result: Result
  telegram?: TelegramAdapter
  adapter?: MiniAppAdapter
}

const LABEL_IDLE = 'idle'

/** Primary result CTA — native share with graceful degradation (platform-aware). */
export function ShareButton({
  quizId,
  resultId,
  shareCta,
  shareCtaIntro,
  score,
  total,
  quizTitle,
  result,
  telegram,
  adapter,
}: ShareButtonProps) {
  const platformAdapter = (adapter ?? telegram) as MiniAppAdapter | undefined
  const [status, setStatus] = useState<'idle' | 'sharing' | ShareOutcome>(LABEL_IDLE)

  const handleClick = useCallback(async () => {
    if (!platformAdapter) return
    try {
      getAnalytics().track('challenge_click', {
        quiz_id: quizId,
        result_id: resultId,
        platform: platformAdapter.platform,
        ...(score !== undefined ? { score } : {}),
      })
    } catch {
      /* analytics must never block share */
    }
    setStatus('sharing')
    // Use platform-aware transport; fallback to legacy Telegram share for BC if needed
    const transport = getShareTransport(platformAdapter)
    const outcome = await transport.shareResult({
      adapter: platformAdapter,
      analytics: getAnalytics(),
      quizId,
      resultId,
      result,
      score,
      total,
      quizTitle,
    })
    // For Telegram legacy path, also keep shareResult behavior for tests that mock TelegramAdapter directly
    // If transport is Telegram and adapter was originally TelegramAdapter, behavior is equivalent.
    // We also support fallback to legacy shareResult for telegram mode when transport would use shareMessage
    // but adapter is mocked Telegram — both converge to same analytics.
    // To keep legacy share.ts working when called directly in tests, we don't remove it.
    setStatus(outcome)
  }, [platformAdapter, quizId, resultId, score, total, quizTitle, result])

  // User-visible labels must distinguish native (real prepared photo
  // card on the recipient's side) from fallback (Telegram deeplink /
  // raw URL on browsers) from failed (Bot API rejected the prepare or
  // the native share sheet never opened). Without this distinction a
  // silently-failing native share would be reported as "Готово" and the
  // regression would be invisible.
  const label =
    status === 'sharing'
      ? 'Отправляем…'
      : status === 'native'
        ? 'Отправлено ✓'
        : status === 'fallback'
          ? 'Скопировано — отправьте получателю'
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
