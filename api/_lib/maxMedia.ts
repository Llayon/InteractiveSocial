/**
 * MAX media helper — server-only, shared by prepare & deliver.
 *
 * Responsibilities:
 * - preflight external image URL (HEAD/GET) before asking MAX to fetch it
 * - fetch image bytes (local FS first, then HTTP)
 * - obtain MAX upload token via POST /uploads?type=image + multipart upload
 * - build unified attachment {type:'image', payload:{token}} or fallback {url}
 * - structured logs [max-media] for forensic diagnostics
 */

import fs from 'node:fs'
import path from 'node:path'
import { fetchWithTimeout, maxGetUploadUrl, maxUploadFile } from './maxApi.js'

const PREFLIGHT_TIMEOUT_MS = 5_000
const IMAGE_FETCH_TIMEOUT_MS = 8_000

export interface PreflightResult {
  ok: boolean
  status?: number
  contentType?: string
  contentLength?: number
  host?: string
  errorCode?: string
}

function getHost(url: string): string {
  try {
    return new URL(url).host
  } catch {
    return 'invalid_url'
  }
}

function assetFromUrl(url: string): string {
  try {
    const u = new URL(url)
    const last = u.pathname.split('/').pop() ?? ''
    return last.replace(/\.jpg$/, '') || 'unknown'
  } catch {
    return 'unknown'
  }
}

function getVersionFromUrl(url: string): string {
  try {
    const u = new URL(url)
    const m = u.pathname.match(/\/share-cards\/(v\d+)\//)
    if (m) return m[1]
    if (u.pathname.includes('/share-cards/')) return 'v1'
    return 'unknown'
  } catch {
    return 'unknown'
  }
}

/**
 * Lightweight preflight: HEAD, fallback to GET if HEAD not allowed.
 * Validates 2xx, image/* content-type, non-zero length when available.
 * Logs [max-media] preflight summary; never throws.
 */
export async function preflightMaxImageUrl(url: string): Promise<PreflightResult> {
  const host = getHost(url)
  const asset = assetFromUrl(url)
  const version = getVersionFromUrl(url)
  const tryFetch = async (method: 'HEAD' | 'GET'): Promise<Response | null> => {
    try {
      const res = await fetchWithTimeout(
        url,
        { method, headers: { 'user-agent': 'MAX-preflight/1.0' } },
        PREFLIGHT_TIMEOUT_MS,
      )
      return res
    } catch {
      return null
    }
  }

  let res = await tryFetch('HEAD')
  // Some CDNs block HEAD → retry with GET
  if (!res || res.status === 405 || res.status === 501) {
    res = await tryFetch('GET')
    // For GET we abort body reading after headers check; still need to consume minimal?
    // We'll read only headers, but ensure we close body to avoid hanging.
    try {
      const body = res?.body as unknown as { cancel?: () => Promise<void> }
      if (body?.cancel) await body.cancel().catch(() => {})
    } catch {}
  }

  if (!res) {
    console.warn(`[max-media] preflight_failed status=network_error type=unknown asset=${asset} host=${host} version=${version}`)
    return { ok: false, host, errorCode: 'network_error' }
  }

  const ct = res.headers.get('content-type')?.toLowerCase() ?? ''
  const clHeader = res.headers.get('content-length')
  const cl = clHeader ? Number(clHeader) : undefined
  const isImage = ct.includes('image/jpeg') || ct.includes('image/png') || ct.includes('image/')
  const ok = res.ok && isImage && (cl === undefined || cl > 0)

  if (ok) {
    console.info(`[max-media] preflight status=${res.status} type=${ct} asset=${asset} host=${host} version=${version} len=${cl ?? 'unknown'}`)
  } else {
    const reason = !res.ok ? `http_${res.status}` : !isImage ? `bad_type:${ct}` : 'zero_len'
    console.warn(`[max-media] preflight_failed status=${res.status} type=${ct} asset=${asset} host=${host} version=${version} reason=${reason}`)
  }

  // Ensure GET body drained if we did GET
  try {
    if (res.body) await res.arrayBuffer().catch(() => {})
  } catch {}

  return {
    ok,
    status: res.status,
    contentType: ct || undefined,
    contentLength: cl,
    host,
    errorCode: ok ? undefined : `http_${res.status}`,
  }
}

/**
 * Fetch image bytes server-side.
 * Strategy: try local filesystem first (fast, no network), then HTTP GET.
 * Returns Buffer on success, null on failure.
 */
async function fetchImageBytes(imageUrl: string): Promise<{ bytes: Buffer; contentType: string } | null> {
  const asset = assetFromUrl(imageUrl)
  const version = getVersionFromUrl(imageUrl)
  const host = getHost(imageUrl)

  // 1. Try local FS: map /share-cards/v2/m90_score_10.jpg -> public/share-cards/v2/m90_score_10.jpg
  try {
        const u = new URL(imageUrl)
    // u.pathname = /share-cards/v2/m90_score_10.jpg
    const relative = u.pathname.replace(/^\//, '')
    const candidates = [
      path.join(process.cwd(), 'public', relative),
      path.join(process.cwd(), relative),
      path.join('/var/task/public', relative),
      path.join('/var/task', relative),
    ]
    for (const p of candidates) {
      try {
        if (fs.existsSync(p)) {
          const buf = fs.readFileSync(p)
          if (buf.length > 0) {
            console.info(`[max-media] fetch_bytes source=fs asset=${asset} host=${host} version=${version} bytes=${buf.length}`)
            return { bytes: buf, contentType: 'image/jpeg' }
          }
        }
      } catch {}
    }
  } catch {}

  // 2. HTTP fetch
  try {
    const res = await fetchWithTimeout(imageUrl, { method: 'GET' }, IMAGE_FETCH_TIMEOUT_MS)
    if (!res.ok) {
      console.warn(`[max-media] fetch_bytes_failed source=http status=${res.status} asset=${asset} host=${host}`)
      return null
    }
    const ct = res.headers.get('content-type') ?? 'image/jpeg'
    if (!ct.includes('image/')) {
      console.warn(`[max-media] fetch_bytes_failed source=http bad_type=${ct} asset=${asset} host=${host}`)
      return null
    }
    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.length === 0) {
      console.warn(`[max-media] fetch_bytes_failed source=http zero_bytes asset=${asset} host=${host}`)
      return null
    }
    console.info(`[max-media] fetch_bytes source=http asset=${asset} host=${host} version=${version} bytes=${buf.length} type=${ct}`)
    return { bytes: buf, contentType: ct }
  } catch (e) {
    console.warn(`[max-media] fetch_bytes_failed source=http network_error asset=${asset} host=${host} error=${e instanceof Error ? e.message.slice(0, 80) : String(e).slice(0, 80)}`)
    return null
  }
}

/**
 * Unified helper: create image attachment for MAX.
 * Preferred: token upload flow (reliable, no external fetch by MAX).
 * Fallback: URL attachment if preflight passes and token flow fails.
 * Logs each phase with [max-media] and returns attachment + diagnostics.
 */
export interface CreateMaxImageAttachmentOpts {
  token: string
  imageUrl: string
  assetKey: string // e.g. m90_score_10
}

export interface MaxImageAttachment {
  type: 'image'
  payload: { token: string } | { url: string }
}

export async function createMaxImageAttachment(
  opts: CreateMaxImageAttachmentOpts,
): Promise<{ attachment: MaxImageAttachment | null; via: 'token' | 'url' | 'none'; preflight?: PreflightResult; errorCode?: string }> {
  const { token, imageUrl, assetKey } = opts
  const host = getHost(imageUrl)
  const version = getVersionFromUrl(imageUrl)

  // Phase 1: preflight (diagnostic, does not block token flow but logs)
  const preflight = await preflightMaxImageUrl(imageUrl)
  console.info(`[max-media] phase=preflight asset=${assetKey} host=${host} version=${version} ok=${preflight.ok} status=${preflight.status ?? 'n/a'}`)

  // Phase 2: try token flow — fetch bytes server-side
  const fetched = await fetchImageBytes(imageUrl)
  if (fetched) {
    console.info(`[max-media] phase=upload-request asset=${assetKey} host=${host} version=${version}`)
    const uploadUrlRes = await maxGetUploadUrl(token, 'image')
    if (uploadUrlRes.ok && uploadUrlRes.url) {
      console.info(`[max-media] phase=upload asset=${assetKey} host=${host} version=${version} upload_host=${getHost(uploadUrlRes.url)}`)
      const uploadRes = await maxUploadFile(uploadUrlRes.url, token, fetched.bytes, `${assetKey}.jpg`, fetched.contentType)
      if (uploadRes.ok && uploadUrlRes.url && uploadRes.token) {
        console.info(`[max-media] phase=upload-success asset=${assetKey} host=${host} version=${version} via=token`)
        return { attachment: { type: 'image', payload: { token: uploadRes.token } }, via: 'token', preflight }
      }
      // Some image uploads return token via URL query? Handle fallback: if upload succeeded but token in URL, extract?
      // For image, token may be in upload URL itself; try to extract token from uploadUrl query if upload didn't return token but succeeded
      if (uploadRes.ok) {
        // upload succeeded but no token field — still try to use token from uploadUrl if present
        try {
          const upUrl = new URL(uploadUrlRes.url)
          const tokenFromUrl = upUrl.searchParams.get('token')
          if (tokenFromUrl) {
            console.info(`[max-media] phase=upload-success-token-from-url asset=${assetKey} host=${host}`)
            return { attachment: { type: 'image', payload: { token: tokenFromUrl } }, via: 'token', preflight }
          }
        } catch {}
      }
      console.warn(`[max-media] phase=upload_failed asset=${assetKey} host=${host} version=${version} code=${uploadRes.errorCode ?? 'n/a'} msg=${uploadRes.errorMessage?.slice(0, 80) ?? 'n/a'}`)
      // fall through to URL fallback if preflight ok
    } else {
      console.warn(`[max-media] phase=upload-request_failed asset=${assetKey} host=${host} version=${version} code=${uploadUrlRes.errorCode ?? 'n/a'}`)
    }
  } else {
    console.warn(`[max-media] phase=fetch_bytes_failed asset=${assetKey} host=${host} version=${version}`)
  }

  // Phase 3: fallback to URL attachment if preflight passed or at least imageUrl looks valid
  if (preflight.ok) {
    console.info(`[max-media] phase=fallback_url asset=${assetKey} host=${host} version=${version}`)
    return { attachment: { type: 'image', payload: { url: imageUrl } }, via: 'url', preflight }
  }

  // If preflight failed but we still have image bytes, we attempted token and it failed → no attachment
  console.warn(`[max-media] phase=failed_no_attachment asset=${assetKey} host=${host} version=${version}`)
  // As last resort, still try URL attachment even if preflight failed — MAX might still fetch? But log it.
  // Return URL attachment anyway to give MAX a chance, unless host invalid.
  if (host !== 'invalid_url') {
    return { attachment: { type: 'image', payload: { url: imageUrl } }, via: 'url', preflight, errorCode: 'preflight_failed_fallback_url' }
  }
  return { attachment: null, via: 'none', preflight, errorCode: 'no_attachment' }
}

/**
 * Helper to build attachments array including image + keyboard.
 * Kept here for single shared usage.
 */
export function buildMaxAttachments(imageAttachment: MaxImageAttachment | null, deepLink: string): Array<Record<string, unknown>> {
  const list: Array<Record<string, unknown>> = []
  if (imageAttachment) list.push(imageAttachment as unknown as Record<string, unknown>)
  list.push({
    type: 'inline_keyboard',
    payload: { buttons: [[{ type: 'link', text: 'Пройти тест', url: deepLink }]] },
  })
  return list
}
