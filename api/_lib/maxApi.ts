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

// Ensure NODE_EXTRA_CA_CERTS file exists if MAX_EXTRA_CA_PEM is set — fixes Vercel startup warning
try {
  const pemEarly = process.env.MAX_EXTRA_CA_PEM
  const caPathEarly = process.env.NODE_EXTRA_CA_CERTS
  if (pemEarly && caPathEarly) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const fs = require('node:fs') as typeof import('node:fs')
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const path = require('node:path') as typeof import('node:path')
      if (!fs.existsSync(caPathEarly)) {
        try {
          fs.mkdirSync(path.dirname(caPathEarly), { recursive: true })
        } catch {}
        try {
          fs.writeFileSync(caPathEarly, pemEarly, 'utf-8')
        } catch {}
      }
    } catch {}
  }
} catch {}

let cachedCa: string | null | undefined

function getPemCa(): string | null {
  if (cachedCa !== undefined) return cachedCa
  const pem = requireEnv('MAX_EXTRA_CA_PEM')
  const caPath = requireEnv('MAX_EXTRA_CA_PATH')
  if (pem) {
    cachedCa = pem
    return pem
  }
  if (caPath) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const fs = require('node:fs') as typeof import('node:fs')
      const content = fs.readFileSync(caPath, 'utf-8')
      if (content && content.includes('BEGIN CERTIFICATE')) {
        cachedCa = content
        return content
      }
    } catch {
      // ignore
    }
  }
  // fallback: try local cert file shipped with repo (for Vercel runtime with includeFiles)
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require('node:fs') as typeof import('node:fs')
    const fallbackPaths = [
      '/var/task/certs/russian-trusted-ca.pem',
      '/vercel/path0/certs/russian-trusted-ca.pem',
      'certs/russian-trusted-ca.pem',
      './certs/russian-trusted-ca.pem',
    ]
    for (const p of fallbackPaths) {
      try {
        if (fs.existsSync(p)) {
          const c = fs.readFileSync(p, 'utf-8')
          if (c.includes('BEGIN CERTIFICATE')) {
            cachedCa = c
            return c
          }
        }
      } catch {}
    }
  } catch {}
  cachedCa = null
  return null
}

function buildScopedFetchOptions(): RequestInit & { dispatcher?: unknown; agent?: unknown } {
  const ca = getPemCa()
  if (!ca) return {}
  try {
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
    const scoped = buildScopedFetchOptions()
    // Merge scoped CA options into fetch init; dispatcher/agent aren't standard yet
    const merged = { ...scoped, ...init, signal: controller.signal } as unknown as RequestInit & { dispatcher?: unknown; agent?: unknown }
    // Prefer undici fetch with dispatcher when CA is present; otherwise global fetch.
    // In Vitest, use global fetch so vi.stubGlobal('fetch', ...) works.
    const ca = getPemCa()
    const isVitest = Boolean(process.env.VITEST) || Boolean((globalThis as unknown as { __vitest_worker__?: unknown }).__vitest_worker__)
    if (ca && Object.keys(scoped).length > 0 && !isVitest) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const undici = require('undici') as unknown as { fetch: typeof fetch }
        if (undici && typeof undici.fetch === 'function') {
          return await undici.fetch(url, merged as RequestInit)
        }
      } catch {}
    }
    return await fetch(url, merged as RequestInit)
  } finally {
    clearTimeout(timer)
  }
}

function safeLog(operation: string, status: number | string, ok: unknown, extra?: string): void {
  // Never log token, hash, initData, or full payload — only operation/status/ids
  const suffix = extra ? ` ${extra}` : ''
  console.info(`[max] operation=${operation} status=${status} ok=${String(ok)}${suffix}`)
}

function safeErrorLog(operation: string, status: number | string, error: unknown, extra?: string): void {
  const msg = error instanceof Error ? error.message.slice(0, 200) : String(error).slice(0, 200)
  const suffix = extra ? ` ${extra}` : ''
  console.warn(`[max] operation=${operation} status=${status} ok=false error=${msg}${suffix}`)
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
    safeErrorLog('me', 'network_error', error)
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
): Promise<{ ok: boolean; mid?: string; status: number; raw?: unknown; errorCode?: string; errorMessage?: string }> {
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
  } catch (error) {
    safeErrorLog(
      'messages',
      'network_error',
      error,
      `quizId=${opts?.quizId ?? 'n/a'} resultId=${opts?.resultId ?? 'n/a'}`,
    )
    return { ok: false, status: 0, errorCode: 'network_error', errorMessage: error instanceof Error ? error.message.slice(0, 200) : String(error).slice(0, 200) }
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
  // Extract safe error code/message from MAX response for diagnostics (redacted)
  let errorCode: string | undefined
  let errorMessage: string | undefined
  if (!ok && json && typeof json === 'object') {
    const j = json as Record<string, unknown>
    if (typeof j.code === 'string') errorCode = j.code.slice(0, 80)
    if (typeof j.message === 'string') errorMessage = j.message.slice(0, 200)
    // Some MAX errors use description field
    if (!errorMessage && typeof (j as { description?: unknown }).description === 'string') {
      errorMessage = String((j as { description?: unknown }).description).slice(0, 200)
    }
  }
  if (!ok) {
    const extra = `quizId=${opts?.quizId ?? 'n/a'} resultId=${opts?.resultId ?? 'n/a'} mid=${parsed.mid ? 'present' : 'none'} code=${errorCode ?? 'n/a'} msg=${errorMessage ?? text.slice(0, 150)}`
    safeLog('messages', response.status, ok, extra)
  } else {
    safeLog(
      'messages',
      response.status,
      ok,
      `quizId=${opts?.quizId ?? 'n/a'} resultId=${opts?.resultId ?? 'n/a'} mid=${parsed.mid ? 'present' : 'none'}`,
    )
  }
  return { ok, mid: parsed.mid, status: response.status, raw: json, errorCode, errorMessage }
}

/**
 * Upload image for attachment via official token flow.
 * Step 1: POST /uploads?type=image -> { url }
 * Step 2: POST {url} with multipart data -> { token }
 * Token is then used in attachments.payload.token
 */
export interface MaxUploadUrlResponse {
  url: string
  token?: string
}

export async function maxGetUploadUrl(
  token: string,
  type: 'image' | 'video' | 'audio' | 'file' = 'image',
  opts?: { timeoutMs?: number },
): Promise<{ ok: boolean; url?: string; status: number; raw?: unknown; errorCode?: string; errorMessage?: string }> {
  const timeoutMs = opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const url = `${MAX_API_BASE}/uploads?type=${encodeURIComponent(type)}`
  let response: Response
  try {
    response = await fetchWithTimeout(
      url,
      {
        method: 'POST',
        headers: { Authorization: token },
      },
      timeoutMs,
    )
  } catch (error) {
    safeErrorLog('uploads', 'network_error', error, `type=${type}`)
    return { ok: false, status: 0, errorCode: 'network_error', errorMessage: error instanceof Error ? error.message.slice(0, 200) : String(error).slice(0, 200) }
  }
  const text = await response.text().catch(() => '')
  let json: unknown = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    json = null
  }
  if (!response.ok || !json || typeof json !== 'object') {
    let code: string | undefined
    let msg: string | undefined
    if (json && typeof json === 'object') {
      const j = json as Record<string, unknown>
      if (typeof j.code === 'string') code = j.code.slice(0, 80)
      if (typeof j.message === 'string') msg = j.message.slice(0, 200)
    }
    safeLog('uploads', response.status, false, `type=${type} code=${code ?? 'n/a'} msg=${msg ?? text.slice(0, 120)}`)
    return { ok: false, status: response.status, raw: json ?? text, errorCode: code, errorMessage: msg ?? text.slice(0, 200) }
  }
  const j = json as Record<string, unknown>
  const uploadUrl = typeof j.url === 'string' ? j.url : undefined
  if (!uploadUrl) {
    safeLog('uploads', response.status, false, `type=${type} missing url`)
    return { ok: false, status: response.status, raw: json }
  }
  safeLog('uploads', response.status, true, `type=${type} url_host=${(() => { try { return new URL(uploadUrl).host } catch { return 'invalid' } })()}`)
  return { ok: true, url: uploadUrl, status: response.status, raw: json }
}

export async function maxUploadFile(
  uploadUrl: string,
  token: string,
  bytes: Uint8Array | Buffer,
  filename: string,
  contentType = 'image/jpeg',
  opts?: { timeoutMs?: number },
): Promise<{ ok: boolean; token?: string; status: number; raw?: unknown; errorCode?: string; errorMessage?: string }> {
  const timeoutMs = opts?.timeoutMs ?? 15_000
  // Build multipart form
  const form = new FormData()
  const blob = new Blob([bytes as unknown as BlobPart], { type: contentType })
  form.append('data', blob, filename)
  let response: Response
  try {
    response = await fetchWithTimeout(
      uploadUrl,
      {
        method: 'POST',
        headers: { Authorization: token },
        body: form as unknown as BodyInit,
      },
      timeoutMs,
    )
  } catch (error) {
    safeErrorLog('upload', 'network_error', error, `file=${filename}`)
    return { ok: false, status: 0, errorCode: 'network_error', errorMessage: error instanceof Error ? error.message.slice(0, 200) : String(error).slice(0, 200) }
  }
  const text = await response.text().catch(() => '')
  let json: unknown = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    json = null
  }
  if (!response.ok || !json || typeof json !== 'object') {
    let code: string | undefined
    let msg: string | undefined
    if (json && typeof json === 'object') {
      const j = json as Record<string, unknown>
      if (typeof j.code === 'string') code = j.code.slice(0, 80)
      if (typeof j.message === 'string') msg = j.message.slice(0, 200)
    }
    safeLog('upload', response.status, false, `file=${filename} code=${code ?? 'n/a'} msg=${msg ?? text.slice(0, 120)}`)
    return { ok: false, status: response.status, raw: json ?? text, errorCode: code, errorMessage: msg ?? text.slice(0, 200) }
  }
  const j = json as Record<string, unknown>
  const fileToken = typeof j.token === 'string' ? j.token : undefined
  if (!fileToken) {
    safeLog('upload', response.status, false, `file=${filename} missing token`)
    return { ok: false, status: response.status, raw: json }
  }
  safeLog('upload', response.status, true, `file=${filename} token_present`)
  return { ok: true, token: fileToken, status: response.status, raw: json }
}

// Re-export fetchWithTimeout and CA helpers for media preflight reuse
export { fetchWithTimeout, getPemCa }

export const MAX_API_BASE_URL = MAX_API_BASE
