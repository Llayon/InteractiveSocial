import type { VercelRequest, VercelResponse } from '@vercel/node'

// In-memory rate limit: max 30 requests per 10s per IP (best-effort, serverless)
const hits = new Map<string, { count: number; reset: number }>()
const WINDOW_MS = 10_000
const MAX_HITS = 30

function isRateLimited(ip: string): boolean {
  const now = Date.now()
  const rec = hits.get(ip)
  if (!rec || now > rec.reset) {
    hits.set(ip, { count: 1, reset: now + WINDOW_MS })
    return false
  }
  rec.count++
  return rec.count > MAX_HITS
}

// Strict allowlist — never accept private launch data
const ALLOWED_FIELDS = new Set([
  'buildSha',
  'stage',
  'platformHint',
  'userAgent',
  'errorName',
  'errorMessage',
  'file',
  'line',
  'column',
])

function sanitize(payload: unknown): Record<string, unknown> | null {
  if (!payload || typeof payload !== 'object') return null
  const src = payload as Record<string, unknown>
  const out: Record<string, unknown> = {}
  for (const k of Object.keys(src)) {
    if (!ALLOWED_FIELDS.has(k)) continue
    const v = src[k]
    if (typeof v === 'string') out[k] = v.slice(0, 300)
    else if (typeof v === 'number') out[k] = v
    else out[k] = String(v).slice(0, 300)
  }
  // Require buildSha and stage
  if (typeof out.buildSha !== 'string' || typeof out.stage !== 'string') return null
  // Enforce small payload
  if (JSON.stringify(out).length > 2000) return null
  return out
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'method_not_allowed' })
    return
  }

  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || (req.headers['x-real-ip'] as string) || 'unknown'
  if (isRateLimited(ip)) {
    res.status(429).json({ ok: false, error: 'rate_limited' })
    return
  }

  const body = req.body as unknown
  // body may be string if sendBeacon sends text/plain
  let payload: unknown = body
  if (typeof body === 'string') {
    try {
      payload = JSON.parse(body)
    } catch {
      payload = null
    }
  }

  const clean = sanitize(payload)
  if (!clean) {
    res.status(400).json({ ok: false, error: 'invalid_payload' })
    return
  }

  // Structured logging only — never log private launch data (we already stripped)
  console.info(`[boot-diag] sha=${clean.buildSha} stage=${clean.stage} platformHint=${clean.platformHint ?? 'n/a'} ua=${String(clean.userAgent ?? '').slice(0,80)} ${clean.errorName ? `error=${clean.errorName}:${String(clean.errorMessage ?? '').slice(0,120)}` : ''} ${clean.file ? `file=${clean.file}` : ''}`)

  res.status(200).json({ ok: true })
}
