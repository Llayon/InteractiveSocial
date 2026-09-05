import { useEffect, useRef } from 'react'

import { getAnalytics } from '@/analytics/analytics'
import { resolvePromotionDestination } from '@/features/quiz/promotion'
import { getResultById, type QuizOutcome } from '@/features/quiz/scoring'
import type { Quiz } from '@/features/quiz/schema'
import { ShareButton } from '@/features/share/ShareButton'
import type { MiniAppAdapter } from '@/platform/types'
import type { TelegramAdapter } from '@/platform/telegram'
import { ResultCard } from './ResultCard'
import { Music90ResultLayout } from './Music90ResultLayout'
import { getMusic90AssetSet } from '@/content/quizzes/music90s/resultAssets.js'

export interface ResultScreenProps {
  quiz: Quiz
  /** Canonical outcome — the screen never re-derives scoring itself. */
  outcome: QuizOutcome
  telegram?: TelegramAdapter
  adapter?: MiniAppAdapter
  onRestart: () => void
  /** Attempt-aware idempotency key for MAX */
  completionId?: string
  /** MAX selfMid cached from automatic delivery (null while pending) */
  maxMid?: string | null
  maxPending?: boolean
}

/** Result screen: editorial reveal + share loop + author promo + restart. */
export function ResultScreen({ quiz, outcome, telegram, adapter, onRestart, completionId, maxMid, maxPending }: ResultScreenProps) {
  const result = getResultById(quiz, outcome.resultId)
  if (!result) {
    throw new Error(`Cannot render unknown result "${outcome.resultId}"`)
  }
  const score = outcome.kind === 'correct-count' ? outcome.correct : undefined
  const platformAdapter = (adapter ?? telegram) as MiniAppAdapter | undefined
  const platform = (platformAdapter?.platform ?? 'browser') as import('@/platform/types').PlatformKind

  const promo = quiz.channelPromotion
  const channelUrl = resolvePromotionDestination(promo, platform)
  const showPromo = Boolean(promo && channelUrl && promo.resultIntro && promo.resultCta)

  const analytics = getAnalytics()
  const impressionFiredRef = useRef(false)
  useEffect(() => {
    if (!showPromo) return
    if (impressionFiredRef.current) return
    impressionFiredRef.current = true
    try {
      analytics.trackOnce(
        `channel_promo_impression:${quiz.id}:${result.id}:${platform}`,
        'channel_promo_impression',
        {
          quiz_id: quiz.id,
          result_id: result.id,
          platform,
          ...(score !== undefined ? { score } : {}),
          question_count: quiz.questions.length,
        },
      )
    } catch {
      /* analytics must never block */
    }
  }, [showPromo, analytics, quiz.id, result.id, platform, score, quiz.questions.length])

  const handleChannelClick = () => {
    try {
      analytics.track('channel_click', {
        quiz_id: quiz.id,
        result_id: result.id,
        platform,
        ...(score !== undefined ? { score } : {}),
      })
    } catch {
      /* swallow */
    }
  }

  const handleRestart = () => {
    try {
      analytics.track('quiz_restart_click', {
        quiz_id: quiz.id,
        result_id: result.id,
        platform,
        ...(score !== undefined ? { score } : {}),
      })
    } catch {
      /* swallow */
    }
    onRestart()
  }

  const isMusic90sScore = quiz.id === 'music90s' && result.presentation.kind === 'score'

  if (isMusic90sScore) {
    const assetSet = getMusic90AssetSet(result.id)
    return (
      <section className="screen result" data-testid="result-screen">
        <Music90ResultLayout
          quiz={quiz}
          result={result}
          score={score}
          assetSet={assetSet}
          showPromo={showPromo}
          promoIntro={promo?.resultIntro ?? null}
          promoCta={promo?.resultCta ?? null}
          channelUrl={channelUrl}
          onChannelClick={handleChannelClick}
          onRestart={handleRestart}
          shareSlot={
            <ShareButton
              quizId={quiz.id}
              resultId={result.id}
              shareCta={quiz.shareCta}
              shareCtaIntro={quiz.shareCtaIntro}
              score={score}
              total={quiz.questions.length}
              quizTitle={quiz.title}
              result={result}
              telegram={telegram as TelegramAdapter}
              adapter={platformAdapter}
              completionId={completionId}
              maxMid={maxMid}
              maxPending={maxPending}
            />
          }
        />
      </section>
    )
  }

  return (
    <section className="screen result" data-testid="result-screen">
      <ResultCard quiz={quiz} result={result} score={score}>
        <ShareButton
          quizId={quiz.id}
          resultId={result.id}
          shareCta={quiz.shareCta}
          shareCtaIntro={quiz.shareCtaIntro}
          score={score}
          total={quiz.questions.length}
          quizTitle={quiz.title}
          result={result}
          telegram={telegram as TelegramAdapter}
          adapter={platformAdapter}
          completionId={completionId}
          maxMid={maxMid}
          maxPending={maxPending}
        />
        {showPromo && promo && channelUrl && (
          <>
            <p className="result__promo-note" data-testid="channel-promo-note">
              {promo.resultIntro}
            </p>
            <a
              className="button button--secondary result__channel"
              href={channelUrl}
              target="_blank"
              rel="noreferrer"
              data-testid="channel-link"
              onClick={handleChannelClick}
            >
              {promo.resultCta}
            </a>
          </>
        )}
        <button
          type="button"
          className="button button--ghost result__restart"
          data-testid="restart-button"
          onClick={handleRestart}
        >
          {quiz.restartCta}
        </button>
      </ResultCard>
    </section>
  )
}
