import type { PlatformKind } from '@/platform/types'

export type DeliverResult =
  | { ok: true; deliveredSelf: boolean; deliveredSharer: boolean; selfMid?: string | null }
  | { ok: false; code: string }

const DELIVER_TIMEOUT_MS = 10_000

function endpointForPlatform(platform: PlatformKind): string {
  if (platform === 'max') return '/api/max/results/deliver'
  return '/api/results/deliver'
}

export async function deliverCompletedResultForPlatform(
  platform: PlatformKind,
  quizId: string,
  resultId: string,
  initDataRaw: string,
  score?: number,
  completionId?: string,
): Promise<DeliverResult> {
  const endpoint = endpointForPlatform(platform)
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), DELIVER_TIMEOUT_MS)
  try {
    const body: Record<string, unknown> = score === undefined ? { quizId, resultId, initDataRaw } : { quizId, resultId, score, initDataRaw }
    if (completionId) body.completionId = completionId
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    if (!response.ok) return { ok: false, code: `http_${response.status}` }
    const json: unknown = await response.json().catch(() => null)
    if (json !== null && typeof json === 'object' && (json as { ok?: unknown }).ok === true) {
      const j = json as { deliveredSelf?: unknown; deliveredSharer?: unknown; selfMid?: unknown }
      return {
        ok: true,
        deliveredSelf: Boolean(j.deliveredSelf),
        deliveredSharer: Boolean(j.deliveredSharer),
        selfMid: typeof j.selfMid === 'string' && j.selfMid.length > 0 ? j.selfMid : null,
      }
    }
    return { ok: false, code: 'unexpected_response' }
  } catch {
    return { ok: false, code: 'network_error' }
  } finally {
    clearTimeout(timeout)
  }
}

/**
 * Fire-and-forget companion to prepareShareMessage: after a user completes
 * the quiz, asks the backend to send them their own result photo card and,
 * when the launch was attributed to a sharer, notify that sharer.
 * Failures are swallowed by the caller — this must never break the UX.
 * @param completionId - optional attempt-aware idempotency key (MAX prefers crypto.randomUUID)
 */
export async function deliverCompletedResult(
  quizId: string,
  resultId: string,
  initDataRaw: string,
  score?: number,
  completionId?: string,
): Promise<DeliverResult> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), DELIVER_TIMEOUT_MS)
  try {
    const body: Record<string, unknown> =
      score === undefined
        ? { quizId, resultId, initDataRaw }
        : { quizId, resultId, score, initDataRaw }
    if (completionId) (body as Record<string, unknown>).completionId = completionId
    const response = await fetch('/api/results/deliver', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    if (!response.ok) return { ok: false, code: `http_${response.status}` }
    const json: unknown = await response.json().catch(() => null)
    if (
      json !== null &&
      typeof json === 'object' &&
      (json as { ok?: unknown }).ok === true
    ) {
      const j = json as { deliveredSelf?: unknown; deliveredSharer?: unknown; selfMid?: unknown }
      return {
        ok: true,
        deliveredSelf: Boolean(j.deliveredSelf),
        deliveredSharer: Boolean(j.deliveredSharer),
        selfMid: typeof j.selfMid === 'string' && j.selfMid.length > 0 ? (j.selfMid as string) : null,
      }
    }
    return { ok: false, code: 'unexpected_response' }
  } catch {
    return { ok: false, code: 'network_error' }
  } finally {
    clearTimeout(timeout)
  }
}
