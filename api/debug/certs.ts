import type { VercelRequest, VercelResponse } from '@vercel/node'
import fs from 'node:fs'

export default async function handler(_req: VercelRequest, res: VercelResponse): Promise<void> {
  const paths = [
    '/var/task/certs/russian-trusted-ca.pem',
    '/vercel/path0/certs/russian-trusted-ca.pem',
    'certs/russian-trusted-ca.pem',
    './certs/russian-trusted-ca.pem',
  ]
  const results: Record<string, string> = {}
  for (const p of paths) {
    try {
      const exists = fs.existsSync(p)
      results[p] = exists ? `exists, size=${fs.statSync(p).size}` : 'missing'
    } catch (e) {
      results[p] = `error: ${e instanceof Error ? e.message : String(e)}`
    }
  }
  res.status(200).json({
    ok: true,
    cwd: process.cwd(),
    env: process.env.NODE_EXTRA_CA_CERTS,
    results,
    maxExtraCaPem: process.env.MAX_EXTRA_CA_PEM ? `set len=${process.env.MAX_EXTRA_CA_PEM.length}` : 'missing',
  })
}
