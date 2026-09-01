import type { VercelRequest, VercelResponse } from '@vercel/node'
import { maxGetMe } from '../_lib/maxApi.js'

function requireEnv(name: string): string | null {
  const v = process.env[name]
  return v && v.trim().length > 0 ? v.trim() : null
}

/**
 * GET /api/max/k0 — K0 connectivity check from production Vercel runtime
 * Returns sanitized fields from GET https://platform-api2.max.ru/me
 * Never returns token.
 */
export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'GET') {
    res.status(405).json({ ok: false, error: 'method_not_allowed' })
    return
  }

  const token = requireEnv('MAX_BOT_TOKEN')
  if (!token) {
    res.status(503).json({ ok: false, error: 'MAX_BOT_TOKEN not configured in Vercel env' })
    return
  }

  try {
    const me = await maxGetMe(token)
    // Only return sanitized fields
    res.status(200).json({
      ok: true,
      status: 200,
      user_id: (me as unknown as { user_id: unknown }).user_id,
      first_name: (me as unknown as { first_name: unknown }).first_name,
      username: (me as unknown as { username: unknown }).username,
      is_bot: (me as unknown as { is_bot: unknown }).is_bot,
      // Also include env presence check (not values)
      env: {
        MAX_BOT_USERNAME: requireEnv('MAX_BOT_USERNAME') ? 'set' : 'missing',
        VITE_MAX_BOT_USERNAME: requireEnv('VITE_MAX_BOT_USERNAME') ? 'set' : 'missing',
        APP_BASE_URL: requireEnv('APP_BASE_URL') ? 'set' : 'missing',
      },
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    const cause = error instanceof Error && (error as unknown as { cause?: unknown }).cause
    const causeMsg = cause instanceof Error ? cause.message : cause ? String(cause) : undefined
    // Try to extract HTTP status from error message like "http_401: ..."
    const m = /http_(\d+)/.exec(msg)
    const status = m ? Number(m[1]) : 500
    res.status(status).json({ ok: false, error: msg, cause: causeMsg, status })
  }
}
