import { useEffect, useRef, useState } from 'react'

import { getAnalytics } from '@/analytics/analytics'
import { copyCommentText, formatCommentResultText, openTelegramPostUrl } from './commentShare'

export interface CommentShareButtonProps {
  quizId: string
  resultId: string
  resultTitle: string
  score: number
  total: number
  campaignId: string
  telegramPostUrl: string
  cta: string
  copiedLabel: string
  platform: string
}

const COPY_FAILURE_TEXT = 'Не удалось скопировать. Попробуйте ещё раз.'
const OPENING_TEXT = 'Скопировано ✓ Открываем пост…'

/**
 * Secondary CTA for Telegram post comments: copy short result → open source post.
 * Never emits challenge/share analytics; never publishes automatically.
 */
export function CommentShareButton({
  quizId,
  resultId,
  resultTitle,
  score,
  total,
  campaignId,
  telegramPostUrl,
  cta,
  copiedLabel,
  platform,
}: CommentShareButtonProps) {
  const [status, setStatus] = useState<'idle' | 'copied' | 'failed'>('idle')
  const impressionFiredRef = useRef(false)

  const commentText = formatCommentResultText(score, total, resultTitle)

  useEffect(() => {
    if (impressionFiredRef.current) return
    impressionFiredRef.current = true
    try {
      getAnalytics().trackOnce(
        `comment_share_impression:${quizId}:${resultId}:${campaignId}`,
        'comment_share_impression',
        {
          quiz_id: quizId,
          result_id: resultId,
          score,
          question_count: total,
          platform,
          campaign_id: campaignId,
        },
      )
    } catch {
      /* analytics must never block */
    }
  }, [quizId, resultId, campaignId, score, total, platform])

  const handleClick = async () => {
    try {
      getAnalytics().track('comment_share_click', {
        quiz_id: quizId,
        result_id: resultId,
        score,
        question_count: total,
        platform,
        campaign_id: campaignId,
      })
    } catch {
      /* swallow */
    }

    let copied = false
    try {
      copied = await copyCommentText(commentText)
    } catch {
      copied = false
    }

    if (copied) {
      try {
        getAnalytics().track('comment_copy_success', {
          quiz_id: quizId,
          result_id: resultId,
          score,
          question_count: total,
          platform,
          campaign_id: campaignId,
        })
      } catch {
        /* swallow */
      }
      setStatus('copied')
      try {
        openTelegramPostUrl(telegramPostUrl)
      } catch {
        /* ignore */
      }
      try {
        getAnalytics().track('comment_post_open', {
          quiz_id: quizId,
          result_id: resultId,
          score,
          question_count: total,
          platform,
          campaign_id: campaignId,
        })
      } catch {
        /* swallow */
      }
    } else {
      try {
        getAnalytics().track('comment_copy_failed', {
          quiz_id: quizId,
          result_id: resultId,
          score,
          question_count: total,
          platform,
          campaign_id: campaignId,
        })
      } catch {
        /* swallow */
      }
      // Do NOT navigate away when copy failed — user must retry with text available.
      setStatus('failed')
    }
  }

  const buttonLabel = status === 'copied' ? OPENING_TEXT : cta

  return (
    <div className="comment-share">
      <button
        type="button"
        className="button button--secondary comment-share__cta"
        data-testid="comment-share-button"
        onClick={handleClick}
      >
        {buttonLabel}
      </button>
      <span className="visually-hidden" role="status" data-testid="comment-share-status">
        {status}
      </span>
      {status === 'copied' && (
        <p className="comment-share__hint" data-testid="comment-share-hint">
          {copiedLabel}
        </p>
      )}
      {status === 'failed' && (
        <p className="comment-share__hint comment-share__hint--error" data-testid="comment-share-hint">
          {COPY_FAILURE_TEXT}
        </p>
      )}
    </div>
  )
}

export { COPY_FAILURE_TEXT }
