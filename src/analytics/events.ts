import type { SelectedAnswer } from '@/features/quiz/schema'

/** Canonical analytics event names for the viral loop instrumentation. */
export type AnalyticsEvent =
  | 'app_open'
  | 'quiz_view'
  | 'quiz_start'
  | 'question_answered'
  | 'quiz_complete'
  | 'result_view'
  | 'share_click'
  | 'share_success'
  | 'share_failed'
  | 'restart'

export interface AnalyticsContext {
  quiz_id?: string
  result_id?: string
  question_id?: string
  answer_id?: string
  /** Telegram start parameter, e.g. post_aug25 / channel / share_quiet */
  start_param?: string
  source?: string
  platform?: string
}

export interface QuestionAnsweredPayload extends AnalyticsContext {
  primary_result: string
  secondary_result: string
}

export interface QuizCompletePayload extends AnalyticsContext {
  total_scores: Record<string, number>
}

export type { SelectedAnswer }

/**
 * Derive a coarse attribution category from a raw start parameter.
 * The start parameter is never treated as security-sensitive input.
 */
export function deriveSource(startParam?: string | null): string | undefined {
  if (!startParam) return undefined
  if (startParam.startsWith('share_')) return 'share'
  if (startParam === 'channel' || startParam.startsWith('channel')) return 'channel'
  if (startParam.startsWith('post')) return 'post'
  return 'other'
}
