/**
 * MAX Bot API client — server-only.
 *
 * Domain: https://platform-api2.max.ru
 * Auth:   Authorization: <MAX_BOT_TOKEN>  (never query param)
 *
 * Assumptions verified 2026-08-31 against https://dev.max.ru/docs-api
 * and sub-agents docs fetch. If MAX revokes platform-api2, update here.
 *
 * TLS: By default uses Node/Vercel system CA. If environment requires
 * Russian Trusted CA (Mинцифры), provide MAX_EXTRA_CA_PEM (full PEM string)
 * or MAX_EXTRA_CA_PATH (file path). The custom CA is scoped ONLY to
 * platform-api2.max.ru via a dedicated dispatcher/agent — never global
 * NODE_TLS_REJECT_UNAUTHORIZED and never process-wide https.globalAgent.
 */

const MAX_API_BASE = 'https://platform-api2.max.ru'
const DEFAULT_TIMEOUT_MS = 8_000

function requireEnv(name: string): string | null {
  const v = process.env[name]
  return v && v.trim().length > 0 ? v.trim() : null
}

export interface MaxMeResponse {
  user_id: number
  first_name?: string
  username?: string
  is_bot?: boolean
  // other fields may exist; we only use these for K0 canonical check
  [k: string]: unknown
}

export interface MaxApiError {
  code?: string
  message?: string
  status?: number
}

function buildScopedFetchOptions(): RequestInit & { dispatcher?: unknown; agent?: unknown } {
  // Scoped CA handling: only if env provides extra CA.
  // We use undici Agent if available; otherwise fallback to https.Agent for Node fetch.
  const pem = requireEnv('MAX_EXTRA_CA_PEM')
  const caPath = requireEnv('MAX_EXTRA_CA_PATH')
  if (!pem && !caPath) return {}
  try {
    // Lazy import to avoid bundling fs in browser tests (server-only anyway)
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require('node:fs') as typeof import('node:fs')
    const ca = pem ?? (caPath ? fs.readFileSync(caPath, 'utf-8') : undefined)
    if (!ca) return {}
    // Try undici Dispatcher first (Node 20+ fetch uses undici)
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const undici = require('undici') as unknown as { Agent: new (opts: unknown) => unknown }
      const dispatcher = new undici.Agent({ connect: { ca } })
      return { dispatcher } as unknown as RequestInit
    } catch {
      // Fallback to https.Agent
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const https = require('node:https') as typeof import('node:https')
      const agent = new https.Agent({ ca })
      return { agent } as unknown as RequestInit
    }
  } catch {
    return {}
  }
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit & { dispatcher?: unknown; agent?: unknown },
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    // Merge scoped CA options into fetch init; cast to any because dispatcher/agent aren't standard yet
    const merged = { ...buildScopedFetchOptions(), ...init, signal: controller.signal } as RequestInit
    return await fetch(url, merged)
  } finally {
    clearTimeout(timer)
  }
}

function safeLog(operation: string, status: number | string, ok: unknown, extra?: string): void {
  // Never log token, hash, initData, or full payload — only operation/status/ids
  const suffix = extra ? ` ${extra}` : ''
  console.info(`[max] operation=${operation} status=${status} ok=${String(ok)}${suffix}`)
}

/**
 * K0 spike: GET /me — canonical source for MAX bot username.
 * Returns parsed JSON on 200, throws on non-200/network.
 * Safe logging, no token leakage.
 */
export async function maxGetMe(
  token: string,
  opts?: { timeoutMs?: number },
): Promise<MaxMeResponse> {
  if (!token) throw new Error('maxGetMe: token missing')
  const timeoutMs = opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const url = `${MAX_API_BASE}/me`
  let response: Response
  try {
    response = await fetchWithTimeout(
      url,
      {
        method: 'GET',
        headers: { Authorization: token },
      },
      timeoutMs,
    )
  } catch (error) {
    safeLog('me', 'network_error', false)
    throw new Error(`maxGetMe network_error: ${error instanceof Error ? error.message : String(error)}`)
  }
  const text = await response.text().catch(() => '')
  let json: unknown = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    json = null
  }
  const ok = response.ok && json !== null && typeof json === 'object'
  safeLog('me', response.status, ok)
  if (!response.ok) {
    const msg = json && typeof json === 'object' && 'message' in json ? String((json as { message?: unknown }).message) : text.slice(0, 200)
    throw new Error(`maxGetMe http_${response.status}: ${msg}`)
  }
  if (!json || typeof json !== 'object') throw new Error('maxGetMe: invalid JSON')
  return json as MaxMeResponse
}

/**
 * POST /messages — send a message from bot to user (text/photo etc).
 * Used by share prepare (to get mid) and results deliver (own card + sharer notify).
 *
 * Payload shape per MAX docs: see https://dev.max.ru/docs-api/methods/POST/messages
 * Minimal contract we need: { user_id, text?, link?, format?, attachments? }
 * We implement a thin wrapper; callers provide validated payload.
 */
export interface MaxSendMessagePayload {
  user_id: number
  text?: string
  // For photo sharing: attachments with image token OR link etc — per official upload flow.
  // For MVP we use link+attachments if MAX supports remote URL; otherwise upload token path.
  // The exact attachment contract is resolved per docs; we keep payload generic.
  [k: string]: unknown
}

export interface MaxSendMessageResult {
  message?: { body?: { mid?: string; [k: string]: unknown }; [k: string]: unknown }
  body?: { mid?: string; [k: string]: unknown }
  [k: string]: unknown
}

/**
 * Strict parser for POST /messages response per official docs:
 * https://dev.max.ru/docs-api/methods/POST/messages → result `message` object Message
 * https://dev.max.ru/docs-api/objects/Message → `body.mid`
 * Official TS client: `const message = await bot.api.sendMessageToUser(...); message.body.mid`
 *
 * Supports both:
 * - wrapped: `{ message: { body: { mid } } }`  (as documented `message` field)
 * - direct:  `{ body: { mid } }`               (if API returns Message directly)
 * Missing `body.mid` is a structured failure — never synthesize success.
 */
export function parseMaxMessageResponse(json: unknown): { ok: boolean; mid?: string; body?: unknown } {
  if (!json || typeof json !== 'object') return { ok: false }
  const j = json as Record<string, unknown>
  // wrapped form
  if (j.message && typeof j.message === 'object') {
    const msg = j.message as Record<string, unknown>
    if (msg.body && typeof msg.body === 'object') {
      const body = msg.body as Record<string, unknown>
      if (typeof body.mid === 'string' && body.mid.length > 0) return { ok: true, mid: body.mid, body }
      return { ok: false }
    }
    return { ok: false }
  }
  // direct Message form
  if (j.body && typeof j.body === 'object') {
    const body = j.body as Record<string, unknown>
    if (typeof body.mid === 'string' && body.mid.length > 0) return { ok: true, mid: body.mid, body }
    return { ok: false }
  }
  return { ok: false }
}

export async function maxSendMessage(
  token: string,
  payload: MaxSendMessagePayload,
  opts?: { timeoutMs?: number; quizId?: string; resultId?: string },
): Promise<{ ok: boolean; mid?: string; status: number; raw?: unknown }> {
  const timeoutMs = opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS
  // Official contract: POST /messages?user_id=... or ?chat_id=... with body = NewMessageBody
  // Payload may contain user_id/chat_id for backward compat; move to query.
  const bodyPayload = { ...payload } as Record<string, unknown>
  const userId = bodyPayload.user_id as number | undefined
  const chatId = bodyPayload.chat_id as number | undefined
  delete bodyPayload.user_id
  delete bodyPayload.chat_id
  const params = new URLSearchParams()
  if (typeof userId === 'number') params.set('user_id', String(userId))
  if (typeof chatId === 'number') params.set('chat_id', String(chatId))
  const query = params.toString() ? `?${params.toString()}` : ''
  const url = `${MAX_API_BASE}/messages${query}`
  let response: Response
  try {
    response = await fetchWithTimeout(
      url,
      {
        method: 'POST',
        headers: { Authorization: token, 'content-type': 'application/json' },
        body: JSON.stringify(bodyPayload),
      },
      timeoutMs,
    )
  } catch {
    safeLog(
      'messages',
      'network_error',
      false,
      `quizId=${opts?.quizId ?? 'n/a'} resultId=${opts?.resultId ?? 'n/a'}`,
    )
    return { ok: false, status: 0 }
  }
  const text = await response.text().catch(() => '')
  let json: unknown = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    json = null
  }
  const parsed = parseMaxMessageResponse(json)
  const ok = response.ok && parsed.ok
  safeLog(
    'messages',
    response.status,
    ok,
    `quizId=${opts?.quizId ?? 'n/a'} resultId=${opts?.resultId ?? 'n/a'} mid=${parsed.mid ? 'present' : 'none'}`,
  )
  return { ok, mid: parsed.mid, status: response.status, raw: json }
}

/**
 * Upload image for attachment (if MAX requires upload token flow).
 * Placeholder for future: POST /uploads with Authorization.
 * Currently we try direct image URL in sendMessage; if MAX rejects, caller may fallback to upload.
 */
export const MAX_API_BASE_URL = MAX_API_BASE
