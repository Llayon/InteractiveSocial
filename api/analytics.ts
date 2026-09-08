import type { VercelRequest, VercelResponse } from '@vercel/node'

const MAX_EVENT_LENGTH = 100
const MAX_PAYLOAD_BYTES = 32 * 1024
const MAX_PROPERTIES_KEYS = 100
const MAX_STRING_VALUE_LENGTH = 4096
const MAX_DEPTH = 5
const POSTHOG_TIMEOUT_MS = 4000

const FORBIDDEN_EXACT = new Set([
  'telegram_user_id',
  'max_user_id',
  'username',
  'first_name',
  'last_name',
  'phone',
  'email',
  'initdata',
  'initdataraw',
  'raw_init_data',
  'chat_id',
  'chatid',
  'ip',
  '$ip',
  'question_text',
  'answer_text',
  'user_id',
  'userid',
])

function isForbiddenKey(key: string): boolean {
  const lower = key.toLowerCase()
  if (FORBIDDEN_EXACT.has(lower)) return true
  if (lower.includes('token')) return true
  if (lower.includes('initdata')) return true
  return false
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.prototype.toString.call(value) === '[object Object]'
  )
}

function getDepth(value: unknown, current = 0): number {
  if (current > MAX_DEPTH) return current
  if (isPlainObject(value)) {
    let max = current
    for (const v of Object.values(value)) {
      const d = getDepth(v, current + 1)
      if (d > max) max = d
      if (max > MAX_DEPTH) return max
    }
    return max
  }
  if (Array.isArray(value)) {
    let max = current
    for (const v of value) {
      const d = getDepth(v, current + 1)
      if (d > max) max = d
    }
    return max
  }
  return current
}

export function sanitizeProperties(properties: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(properties)) {
    if (isForbiddenKey(key)) continue
    if (isPlainObject(value)) {
      out[key] = sanitizeProperties(value as Record<string, unknown>)
    } else if (Array.isArray(value)) {
      // Filter nested objects inside arrays
      out[key] = value.map((item) =>
        isPlainObject(item) ? sanitizeProperties(item as Record<string, unknown>) : item,
      )
    } else {
      out[key] = value
    }
  }
  return out
}

export function validateAnalyticsPayload(body: unknown): { ok: true; event: string; properties: Record<string, unknown> } | { ok: false; error: string; status: number } {
  if (!isPlainObject(body)) {
    return { ok: false, error: 'invalid_request', status: 400 }
  }

  const event = (body as Record<string, unknown>).event
  const properties = (body as Record<string, unknown>).properties

  if (typeof event !== 'string' || event.trim().length === 0) {
    return { ok: false, error: 'invalid_event', status: 400 }
  }
  if (event.length > MAX_EVENT_LENGTH) {
    return { ok: false, error: 'event_too_long', status: 400 }
  }
  // Allow alphanumeric, underscore, dot, hyphen, colon, $, but keep permissive — only reject control chars
  if (/[\u0000-\u001F\u007F]/.test(event)) {
    return { ok: false, error: 'invalid_event', status: 400 }
  }

  let props: Record<string, unknown>
  if (properties === undefined) {
    props = {}
  } else if (!isPlainObject(properties)) {
    return { ok: false, error: 'invalid_properties', status: 400 }
  } else {
    props = properties as Record<string, unknown>
  }

  if (Object.keys(props).length > MAX_PROPERTIES_KEYS) {
    return { ok: false, error: 'too_many_properties', status: 400 }
  }

  const depth = getDepth(props)
  if (depth > MAX_DEPTH) {
    return { ok: false, error: 'properties_too_deep', status: 400 }
  }

  // Check string value lengths
  const checkStringLengths = (obj: unknown): boolean => {
    if (typeof obj === 'string') return obj.length <= MAX_STRING_VALUE_LENGTH
    if (Array.isArray(obj)) return obj.every(checkStringLengths)
    if (isPlainObject(obj)) return Object.values(obj).every(checkStringLengths)
    return true
  }
  if (!checkStringLengths(props)) {
    return { ok: false, error: 'property_value_too_large', status: 400 }
  }

  // Total payload size guard
  try {
    const serialized = JSON.stringify({ event, properties: props })
    if (serialized.length > MAX_PAYLOAD_BYTES) {
      return { ok: false, error: 'payload_too_large', status: 413 }
    }
  } catch {
    return { ok: false, error: 'invalid_request', status: 400 }
  }

  return { ok: true, event: event.trim(), properties: props }
}

export function getPostHogConfig(): { apiKey: string | null; host: string } {
  const apiKey = process.env.POSTHOG_API_KEY?.trim() || null
  const hostRaw = process.env.POSTHOG_HOST?.trim() || 'https://us.i.posthog.com'
  const host = hostRaw.replace(/\/+$/, '')
  return { apiKey, host }
}

function getCaptureUrl(host: string): string {
  if (host.includes('/capture') || host.includes('/i/v0/e')) return host
  return `${host}/capture/`
}

export async function forwardToPostHog(
  event: string,
  properties: Record<string, unknown>,
  distinctId: string,
): Promise<{ ok: boolean; status: number }> {
  const { apiKey, host } = getPostHogConfig()
  if (!apiKey) {
    console.warn('[analytics] not configured: POSTHOG_API_KEY missing — event not forwarded')
    return { ok: false, status: 204 }
  }

  const captureUrl = getCaptureUrl(host)
  const sanitized = sanitizeProperties(properties)

  // Derive distinct_id — privacy: never use Telegram/MAX id, only anonymous_id
  const safeDistinctId = typeof distinctId === 'string' && distinctId.length > 0 ? distinctId : 'anonymous'

  const payload = {
    api_key: apiKey,
    event,
    distinct_id: safeDistinctId,
    properties: {
      ...sanitized,
      // Privacy: explicitly disable IP capture so Vercel server IP is not stored as user IP
      $ip: null,
      $geoip_disable: true,
    },
    timestamp: new Date().toISOString(),
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), POSTHOG_TIMEOUT_MS)

  try {
    const response = await fetch(captureUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })
    if (!response.ok) {
      console.warn(`[analytics] posthog forward failed status=${response.status} event=${event}`)
      return { ok: false, status: response.status }
    }
    console.info(`[analytics] forwarded event=${event}`)
    return { ok: true, status: response.status }
  } catch (error) {
    const msg = error instanceof Error ? error.name : 'unknown'
    console.warn(`[analytics] posthog forward error=${msg} event=${event}`)
    return { ok: false, status: 502 }
  } finally {
    clearTimeout(timeout)
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'method_not_allowed' })
    return
  }

  // Early body size guard via header if available
  const contentLength = req.headers['content-length']
  if (typeof contentLength === 'string') {
    const len = Number(contentLength)
    if (!Number.isNaN(len) && len > MAX_PAYLOAD_BYTES) {
      res.status(413).json({ ok: false, error: 'payload_too_large' })
      return
    }
  }

  let body: unknown = req.body

  // Vercel may give body as string if parsing failed or not yet parsed
  if (typeof body === 'string') {
    if (body.length > MAX_PAYLOAD_BYTES) {
      res.status(413).json({ ok: false, error: 'payload_too_large' })
      return
    }
    try {
      body = body.trim() ? JSON.parse(body) : null
    } catch {
      res.status(400).json({ ok: false, error: 'invalid_json' })
      return
    }
  }

  // Also handle case where body is undefined but rawBody exists (future)
  if (body === undefined || body === null) {
    res.status(400).json({ ok: false, error: 'invalid_request' })
    return
  }

  const validated = validateAnalyticsPayload(body)
  if (!validated.ok) {
    res.status(validated.status).json({ ok: false, error: validated.error })
    return
  }

  const { event, properties } = validated

  // Extract distinct_id from properties.anonymous_id (preferred) or anonymousId
  const distinctId =
    (typeof properties.anonymous_id === 'string' && properties.anonymous_id) ||
    (typeof (properties as Record<string, unknown>).anonymousId === 'string' &&
      (properties as Record<string, unknown>).anonymousId as string) ||
    'anonymous'

  // Fire posthog forward but never block client UX on failure
  try {
    await forwardToPostHog(event, properties, distinctId)
  } catch {
    // swallow: analytics must never throw to client
    console.warn(`[analytics] forward exception event=${event}`)
  }

  // Always ack client as success (fire-and-forget). Do not expose PostHog response.
  // 204 has no body; use 200 with tiny JSON for broader client compatibility if needed
  // We use 204 as primary per spec.
  res.status(204).end()
}
