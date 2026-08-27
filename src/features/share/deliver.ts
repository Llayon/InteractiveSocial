export type DeliverResult =
  | { ok: true; deliveredSelf: boolean; deliveredSharer: boolean }
  | { ok: false; code: string }

const DELIVER_TIMEOUT_MS = 10_000

/**
 * Fire-and-forget companion to prepareShareMessage: after a user completes
 * the quiz, asks the backend to send them their own result photo card and,
 * when the launch was attributed to a sharer, notify that sharer.
 * Failures are swallowed by the caller — this must never break the UX.
 */
export async function deliverCompletedResult(
  quizId: string,
  resultId: string,
  initDataRaw: string,
): Promise<DeliverResult> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), DELIVER_TIMEOUT_MS)
  try {
    const response = await fetch('/api/results/deliver', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ quizId, resultId, initDataRaw }),
      signal: controller.signal,
    })
    if (!response.ok) return { ok: false, code: `http_${response.status}` }
    const json: unknown = await response.json().catch(() => null)
    if (
      json !== null &&
      typeof json === 'object' &&
      (json as { ok?: unknown }).ok === true
    ) {
      return json as {
        ok: true
        deliveredSelf: boolean
        deliveredSharer: boolean
      }
    }
    return { ok: false, code: 'unexpected_response' }
  } catch {
    return { ok: false, code: 'network_error' }
  } finally {
    clearTimeout(timeout)
  }
}