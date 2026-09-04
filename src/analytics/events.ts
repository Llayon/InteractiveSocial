import type { SelectedAnswer } from '@/features/quiz/schema'

/** Canonical analytics event names for the viral loop instrumentation. */
export type AnalyticsEvent =
  | 'app_open'
  | 'quiz_view'
  | 'quiz_landing_view'
  | 'quiz_start'
  | 'question_answered'
  | 'quiz_complete'
  | 'result_view'
  | 'share_click'
  | 'challenge_click'
  | 'channel_promo_impression'
  | 'channel_click'
  | 'quiz_restart_click'
  | 'challenge_attributed_open'
  | 'share_success'
  | 'share_failed'
  | 'share_prepare_failed'
  | 'share_native_failed'
  | 'share_fallback_native'
  | 'share_fallback_clipboard'
  | 'share_fallback_text'
  | 'max_prepare_success'
  | 'max_prepare_failed'
  | 'max_share_mid_ready'
  | 'max_share_bridge_invoked'
  | 'max_share_fallback_text'
  | 'restart'
  | 'audio_play'
  | 'audio_started'
  | 'audio_complete_4s'
  | 'audio_replay'
  | 'audio_error'
  | 'preview_load_error'
  | 'preview_play_error'
  | 'preview_timeout'
  | 'preview_skip'

export interface AnalyticsContext {
  quiz_id?: string
  result_id?: string
  question_id?: string
  answer_id?: string
  /** Telegram start parameter, e.g. post_aug25 / channel / share_quiet */
  start_param?: string
  source?: string
  platform?: string
  entry_source?: string
  score?: number
  question_count?: number
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
  if (startParam.startsWith('s2_')) return 'challenge'
  if (startParam.startsWith('share_')) return 'share'
  if (startParam.startsWith('quiz_')) return 'quiz_launch'
  if (startParam === 'channel' || startParam.startsWith('channel')) return 'channel'
  if (startParam.startsWith('post')) return 'post'
  return 'other'
}

/**
 * Whether a start param is an attributed challenge deeplink (v2 or legacy).
 * Used to decide challenge_attributed_open.
 */
export function isChallengeAttributedParam(startParam?: string | null): boolean {
  if (!startParam) return false
  if (/^s2_[a-z0-9]{1,12}_[a-z0-9]{1,12}_\d{1,15}$/.test(startParam)) return true
  if (/^share_[a-z][a-z0-9_]{0,63}(?:[.-]\d{1,15})?$/.test(startParam)) return true
  return false
}

export function deriveEntrySource(startParam?: string | null): string | undefined {
  if (!startParam) return 'direct'
  if (/^s2_[a-z0-9]{1,12}_[a-z0-9]{1,12}_\d{1,15}$/.test(startParam)) return 'challenge'
  if (/^share_[a-z][a-z0-9_]{0,63}(?:[.-]\d{1,15})?$/.test(startParam)) return 'legacy_share'
  if (startParam.startsWith('quiz_')) return 'quiz_launch'
  if (startParam === 'channel' || startParam.startsWith('channel')) return 'channel'
  if (startParam.startsWith('post')) return 'post'
  if (deriveSource(startParam) === undefined) return 'direct'
  return deriveSource(startParam) ?? 'unknown'
}
