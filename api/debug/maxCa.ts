import type { VercelRequest, VercelResponse } from '@vercel/node'
import { fetchWithTimeout } from '../_lib/maxApi.js'

function getPemInfo(): { len: number; certs: number; hasBegin: boolean; preview: string } {
  const pem = process.env.MAX_EXTRA_CA_PEM
  if (!pem) return { len: 0, certs: 0, hasBegin: false, preview: 'missing' }
  // Normalize check
  const normalized = pem.includes('\\n') ? pem.replace(/\\n/g, '\n') : pem
  const hasBegin = normalized.includes('BEGIN CERTIFICATE')
  const certs = (normalized.match(/BEGIN CERTIFICATE/g) || []).length
  const preview = hasBegin ? normalized.slice(0, 80).replace(/\n/g, '\\n') : pem.slice(0, 80)
  return { len: pem.length, certs, hasBegin, preview }
}

export default async function handler(_req: VercelRequest, res: VercelResponse): Promise<void> {
  const info = getPemInfo()
  let fetchResult: Record<string, unknown> = { attempted: false }
  try {
    // Try to fetch platform-api2 with CA handling (invalid token should give 401 if TLS ok)
    const controller = new AbortController()
    const t = setTimeout(() => controller.abort(), 5000)
    try {
      const response = await fetchWithTimeout(
        'https://platform-api2.max.ru/me',
        {
          method: 'GET',
          headers: { Authorization: 'invalid_test_token' },
          signal: controller.signal as unknown as AbortSignal,
        } as unknown as RequestInit,
        5000,
      )
      const text = await response.text().catch(() => '')
      fetchResult = {
        attempted: true,
        status: response.status,
        ok: response.ok,
        bodyPreview: text.slice(0, 200),
        hasCa: info.hasBegin,
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message.slice(0, 200) : String(e).slice(0, 200)
      const cause = (e as unknown as { cause?: unknown })?.cause
      const causeMsg = cause instanceof Error ? cause.message.slice(0, 150) : cause ? String(cause).slice(0, 150) : undefined
      fetchResult = { attempted: true, error: msg, cause: causeMsg, hasCa: info.hasBegin }
    } finally {
      clearTimeout(t)
    }
  } catch (e) {
    fetchResult = { error: String(e).slice(0, 200) }
  }

  res.status(200).json({
    ok: true,
    env: {
      MAX_EXTRA_CA_PEM: info,
      NODE_EXTRA_CA_CERTS: process.env.NODE_EXTRA_CA_CERTS ?? 'missing',
      hasUndici: (() => {
        try {
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          require('undici')
          return true
        } catch {
          return false
        }
      })(),
    },
    fetchResult,
  })
}
