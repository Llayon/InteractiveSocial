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

import fs from 'node:fs'
import path from 'node:path'
import * as undici from 'undici'

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
// Note: /var/task is read-only in Vercel, so write to /tmp and update env to point there if needed
try {
  const pemEarlyRaw = process.env.MAX_EXTRA_CA_PEM
  const caPathEarly = process.env.NODE_EXTRA_CA_CERTS
  if (pemEarlyRaw && caPathEarly) {
    const pemEarly = pemEarlyRaw.includes('\\n') ? pemEarlyRaw.replace(/\\n/g, '\n') : pemEarlyRaw
    try {
      // fs/path imported statically
      // Try to write to original path if writable, else /tmp
      const tryPaths = [caPathEarly, '/tmp/russian-trusted-ca.pem']
      for (const p of tryPaths) {
        try {
          if (!fs.existsSync(p)) {
            try {
              fs.mkdirSync(path.dirname(p), { recursive: true })
            } catch {}
            fs.writeFileSync(p, pemEarly, 'utf-8')
            // If we wrote to /tmp, update env so Node's tls can pick it up on next connection if it checks env again
            if (p !== caPathEarly) {
              try {
                process.env.NODE_EXTRA_CA_CERTS = p
              } catch {}
            }
            break
          }
        } catch {}
      }
    } catch {}
  }
} catch {}

let cachedCa: string | null | undefined

function normalizePem(pem: string): string {
  // Vercel env may store PEM with literal \n or base64; normalize to real PEM
  let out = pem
  if (out.includes('\\n')) out = out.replace(/\\n/g, '\n')
  // If still no BEGIN but looks like base64, try decode
  if (!out.includes('BEGIN CERTIFICATE') && /^[A-Za-z0-9+/=\s]+$/.test(out.trim()) && out.trim().length > 1000) {
    try {
      const decoded = Buffer.from(out.trim(), 'base64').toString('utf-8')
      if (decoded.includes('BEGIN CERTIFICATE')) out = decoded
    } catch {}
  }
  return out
}

function getPemCa(): string | null {
  if (cachedCa !== undefined) return cachedCa
  const pemRaw = requireEnv('MAX_EXTRA_CA_PEM')
  const caPath = requireEnv('MAX_EXTRA_CA_PATH')
  if (pemRaw) {
    const pem = normalizePem(pemRaw)
    if (pem.includes('BEGIN CERTIFICATE')) {
      cachedCa = pem
      console.info(`[max] CA loaded from MAX_EXTRA_CA_PEM len=${pem.length} certs=${(pem.match(/BEGIN CERTIFICATE/g) || []).length}`)
      return pem
    }
    console.warn(`[max] CA from env invalid, no BEGIN CERTIFICATE, len=${pemRaw.length}`)
    cachedCa = pemRaw
    return pemRaw
  }
  if (caPath) {
    try {
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

/**
 * Transport policy split (MAX media upload hardening).
 *
 * - 'max-api': requests to the canonical MAX API host. May use
 *   undici.fetch + undici.Agent with the scoped custom CA.
 * - 'default': everything else (iu.oneme.ru, fu.oneme.ru, *.okcdn.ru,
 *   Vercel asset URLs, arbitrary external hosts). Plain transport only —
 *   the MAX CA dispatcher must NEVER reach these hosts, and an npm-undici
 *   Agent must NEVER be passed to the global fetch.
 */
export type MaxFetchPolicy = 'max-api' | 'default'

/** Canonical MAX API hostname, derived from MAX_API_BASE (never hard-coded twice). */
export function getMaxApiHost(): string {
  try {
    return new URL(MAX_API_BASE).hostname.toLowerCase()
  } catch {
    return 'platform-api2.max.ru'
  }
}

export function getFetchPolicy(url: string): MaxFetchPolicy {
  try {
    const host = new URL(String(url)).hostname.toLowerCase()
    return host === getMaxApiHost() ? 'max-api' : 'default'
  } catch {
    return 'default'
  }
}

/** Hostname only — never log query strings, tokens, or full URLs. */
function safeHost(url: string): string {
  try {
    return new URL(String(url)).hostname
  } catch {
    return 'invalid_url'
  }
}

/** Explicit test seam: vitest stubs global fetch, so the undici branch is
 *  production-only. Deterministic per environment — never a silent
 *  mid-request fallback between implementations. */
function isTestTransport(): boolean {
  return Boolean(process.env.VITEST) || Boolean((globalThis as unknown as { __vitest_worker__?: unknown }).__vitest_worker__)
}

/** Single source of truth for "would this runtime use undici for MAX API". */
function shouldUseUndiciForMaxApi(): boolean {
  if (isTestTransport()) return false
  return getPemCa() !== null
}

/** Transport label for operation logs — truthful per above decision. */
function maxApiTransportLabel(): 'max-api' | 'default' {
  return shouldUseUndiciForMaxApi() ? 'max-api' : 'default'
}

/**
 * Build the scoped undici dispatcher for MAX API only.
 * Returns undefined when no custom CA is configured (plain fetch path).
 * The dispatcher is an npm-undici Agent and is ONLY ever passed to
 * undici.fetch — never to the global fetch.
 */
export function buildMaxApiDispatcher(): unknown {
  const ca = getPemCa()
  if (!ca) return undefined
  try {
    const AgentCtor = (undici as unknown as { Agent?: new (opts: unknown) => unknown }).Agent
    if (typeof AgentCtor !== 'function') return undefined
    return new AgentCtor({ connect: { ca } })
  } catch {
    return undefined
  }
}

function logTransportError(url: string, transport: string, timeoutMs: number, error: unknown): void {
  const msg = error instanceof Error ? error.message.slice(0, 200) : String(error).slice(0, 200)
  const cause = (error as unknown as { cause?: unknown })?.cause
  const causeMsg = cause
    ? cause instanceof Error
      ? cause.message.slice(0, 150)
      : String(cause).slice(0, 150)
    : 'none'
  const aborted = error instanceof Error && error.name === 'AbortError'
  console.warn(
    `[max] operation=transport_fetch host=${safeHost(url)} transport=${transport} status=network_error aborted=${aborted} timeout_ms=${timeoutMs} error=${msg} cause=${causeMsg}`,
  )
}

/**
 * MAX API transport: undici.fetch + scoped dispatcher. No fallback to the
 * global fetch — on failure we log (hostname only) and rethrow so callers
 * classify network_error. The dispatcher is always created by the same
 * undici package that performs the fetch.
 */
export async function fetchViaMaxApi(
  url: string,
  init: RequestInit,
  timeoutMs: number,
  dispatcher: unknown,
): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const undiciFetch = (undici as unknown as { fetch?: typeof fetch }).fetch
    if (typeof undiciFetch !== 'function') throw new Error('undici.fetch unavailable')
    return await undiciFetch(url, { ...init, dispatcher, signal: controller.signal } as unknown as RequestInit)
  } catch (error) {
    logTransportError(url, 'undici', timeoutMs, error)
    throw error
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Default transport for all non-MAX-API hosts: plain globalThis.fetch.
 * Any dispatcher/agent smuggled into init is stripped defensively —
 * foreign dispatchers (e.g. npm-undici Agent) break the global fetch
 * with "invalid onRequestStart method".
 */
export async function fetchViaDefault(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  const { dispatcher: _dropDispatcher, agent: _dropAgent, ...clean } = (init ?? {}) as Record<string, unknown>
  void _dropDispatcher
  void _dropAgent
  try {
    return await globalThis.fetch(url, { ...clean, signal: controller.signal } as RequestInit)
  } catch (error) {
    logTransportError(url, 'default', timeoutMs, error)
    throw error
  } finally {
    clearTimeout(timer)
  }
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const policy = getFetchPolicy(url)
  if (policy === 'max-api' && shouldUseUndiciForMaxApi()) {
    const dispatcher = buildMaxApiDispatcher()
    // Dispatcher construction can theoretically fail even with CA present;
    // plain global fetch is the compatible no-CA path (never a foreign
    // dispatcher handed to the wrong fetch).
    if (dispatcher !== undefined) {
      return fetchViaMaxApi(url, init, timeoutMs, dispatcher)
    }
  }
  return fetchViaDefault(url, init, timeoutMs)
}

function safeLog(operation: string, status: number | string, ok: unknown, extra?: string): void {
  // Never log token, hash, initData, or full payload — only operation/status/ids
  const suffix = extra ? ` ${extra}` : ''
  console.info(`[max] operation=${operation} status=${status} ok=${String(ok)}${suffix}`)
}

function safeErrorLog(operation: string, status: number | string, error: unknown, extra?: string): void {
  let msg = error instanceof Error ? error.message.slice(0, 200) : String(error).slice(0, 200)
  // Include cause if present (Node fetch wraps TLS errors in cause)
  const cause = (error as unknown as { cause?: unknown })?.cause
  if (cause) {
    const causeMsg = cause instanceof Error ? cause.message.slice(0, 150) : String(cause).slice(0, 150)
    msg = `${msg} cause=${causeMsg}`
  }
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
      `quizId=${opts?.quizId ?? 'n/a'} resultId=${opts?.resultId ?? 'n/a'} transport=${maxApiTransportLabel()}`,
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
    const extra = `quizId=${opts?.quizId ?? 'n/a'} resultId=${opts?.resultId ?? 'n/a'} mid=${parsed.mid ? 'present' : 'none'} code=${errorCode ?? 'n/a'} msg=${errorMessage ?? text.slice(0, 150)} transport=${maxApiTransportLabel()}`
    safeLog('messages', response.status, ok, extra)
  } else {
    safeLog(
      'messages',
      response.status,
      ok,
      `quizId=${opts?.quizId ?? 'n/a'} resultId=${opts?.resultId ?? 'n/a'} mid=${parsed.mid ? 'present' : 'none'} transport=${maxApiTransportLabel()}`,
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
    safeErrorLog('uploads', 'network_error', error, `type=${type} transport=${maxApiTransportLabel()}`)
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
    safeLog('uploads', response.status, false, `type=${type} code=${code ?? 'n/a'} msg=${msg ?? text.slice(0, 120)} transport=${maxApiTransportLabel()}`)
    return { ok: false, status: response.status, raw: json ?? text, errorCode: code, errorMessage: msg ?? text.slice(0, 200) }
  }
  const j = json as Record<string, unknown>
  const uploadUrl = typeof j.url === 'string' ? j.url : undefined
  if (!uploadUrl) {
    safeLog('uploads', response.status, false, `type=${type} missing url transport=${maxApiTransportLabel()}`)
    return { ok: false, status: response.status, raw: json }
  }
  safeLog('uploads', response.status, true, `type=${type} url_host=${(() => { try { return new URL(uploadUrl).host } catch { return 'invalid' } })()} transport=${maxApiTransportLabel()}`)
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
    safeErrorLog('upload', 'network_error', error, `file=${filename} upload_host=${safeHost(uploadUrl)} transport=default`)
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
    safeLog('upload', response.status, false, `file=${filename} upload_host=${safeHost(uploadUrl)} code=${code ?? 'n/a'} msg=${msg ?? text.slice(0, 120)} transport=default`)
    return { ok: false, status: response.status, raw: json ?? text, errorCode: code, errorMessage: msg ?? text.slice(0, 200) }
  }
  const j = json as Record<string, unknown>
  const fileToken = typeof j.token === 'string' ? j.token : undefined
  if (!fileToken) {
    safeLog('upload', response.status, false, `file=${filename} upload_host=${safeHost(uploadUrl)} missing token transport=default`)
    return { ok: false, status: response.status, raw: json }
  }
  safeLog('upload', response.status, true, `file=${filename} upload_host=${safeHost(uploadUrl)} token_present transport=default`)
  return { ok: true, token: fileToken, status: response.status, raw: json }
}

// Re-export fetch helpers for media preflight reuse
export { fetchWithTimeout, getPemCa }

export const MAX_API_BASE_URL = MAX_API_BASE
