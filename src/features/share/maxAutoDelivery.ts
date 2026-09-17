import type { Analytics } from '@/analytics/analytics'
import {
  maxShareTransport,
  shouldSkipMaxPrePrepare,
  type MaxShareReadiness,
} from '@/platform/share/ShareTransport'
import { deliverCompletedResultForPlatform, type DeliverResult } from './deliver'

export interface MaxAutoDeliveryOutcome {
  readiness: MaxShareReadiness
  mid: string | null
  /** True when the redundant prePrepare roundtrip was skipped (terminal error). */
  skippedPrePrepare: boolean
  deliveryElapsedMs: number
}

type DeliverFn = typeof deliverCompletedResultForPlatform
type TransportSubset = Pick<typeof maxShareTransport, 'setPreparedMid' | 'prePrepare'>

/**
 * MAX automatic result-delivery orchestration (single canonical place).
 *
 * - success with mid → media-ready (no extra prepare)
 * - terminal error (dialog.not.found) → fallback-ready IMMEDIATELY,
 *   no redundant prePrepare roundtrip (same POST /messages would 404 again)
 * - other failures → one controlled prePrepare attempt, then media/fallback
 * - deliver throw → best-effort prePrepare, then media/fallback
 *
 * Analytics (no PII):
 * - max_result_delivery_success / max_result_delivery_failed (with
 *   reason/status/media_via when known)
 * - max_share_mid_ready (with fallback:true when mid came from prePrepare)
 * - max_share_fallback_ready (button became usable via text/link fallback)
 */
export async function runMaxAutoDelivery(args: {
  quizId: string
  resultId: string
  score?: number
  initDataRaw: string
  completionId: string
  analytics: Analytics
  deliverFn?: DeliverFn
  transport?: TransportSubset
}): Promise<MaxAutoDeliveryOutcome> {
  const { quizId, resultId, score, initDataRaw, completionId, analytics } = args
  const deliverFn: DeliverFn = args.deliverFn ?? deliverCompletedResultForPlatform
  const transport: TransportSubset = args.transport ?? maxShareTransport
  const base = { quiz_id: quizId, result_id: resultId, platform: 'max' }

  const safePrePrepare = async (): Promise<string | null> => {
    try {
      return await transport.prePrepare(quizId, resultId, initDataRaw, score, completionId)
    } catch {
      return null
    }
  }

  const finishFallback = (reason: string, deliveryElapsedMs: number): MaxAutoDeliveryOutcome => {
    analytics.track('max_share_fallback_ready', {
      ...base,
      reason,
      delivery_elapsed_ms: deliveryElapsedMs,
    })
    return { readiness: 'fallback-ready', mid: null, skippedPrePrepare: false, deliveryElapsedMs }
  }

  let res: DeliverResult
  const t0 = Date.now()
  try {
    res = await deliverFn('max', quizId, resultId, initDataRaw, score, completionId)
  } catch {
    const deliveryElapsedMs = Date.now() - t0
    analytics.track('max_result_delivery_failed', { ...base, reason: 'exception' })
    const mid = await safePrePrepare()
    if (mid) {
      transport.setPreparedMid({ quizId, resultId, score, mid, completionId })
      return { readiness: 'media-ready', mid, skippedPrePrepare: false, deliveryElapsedMs }
    }
    return finishFallback('exception', deliveryElapsedMs)
  }
  const deliveryElapsedMs = Date.now() - t0

  if (res.ok && res.deliveredSelf && res.selfMid) {
    transport.setPreparedMid({ quizId, resultId, score, mid: res.selfMid, completionId })
    analytics.track('max_result_delivery_success', {
      ...base,
      ...(score !== undefined ? { score } : {}),
    })
    analytics.track('max_share_mid_ready', { ...base })
    return { readiness: 'media-ready', mid: res.selfMid, skippedPrePrepare: false, deliveryElapsedMs }
  }

  const reason = res.ok ? (res.selfErrorCode ?? 'no_mid') : res.code
  analytics.track('max_result_delivery_failed', {
    ...base,
    reason,
    ...(res.ok && res.selfStatus !== undefined ? { status: res.selfStatus } : {}),
    ...(res.ok && res.selfVia ? { media_via: res.selfVia } : {}),
  })

  if (shouldSkipMaxPrePrepare(reason)) {
    analytics.track('max_share_fallback_ready', {
      ...base,
      reason,
      delivery_elapsed_ms: deliveryElapsedMs,
    })
    return { readiness: 'fallback-ready', mid: null, skippedPrePrepare: true, deliveryElapsedMs }
  }

  const mid = await safePrePrepare()
  if (mid) {
    analytics.track('max_share_mid_ready', { ...base, fallback: true })
    return { readiness: 'media-ready', mid, skippedPrePrepare: false, deliveryElapsedMs }
  }
  return finishFallback(reason, deliveryElapsedMs)
}
