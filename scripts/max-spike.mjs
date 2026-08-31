#!/usr/bin/env node
/**
 * K0 connectivity spike — server-only.
 *
 * Usage:
 *   MAX_BOT_TOKEN=... node scripts/max-spike.mjs
 *   # or with env file: node --env-file=.env.local scripts/max-spike.mjs
 *
 * Never commit token, never log token, never pass token to client.
 * TLS: uses system CA by default; if MAX_EXTRA_CA_PEM/_PATH is set, uses scoped CA.
 */

import { maxGetMe } from '../api/_lib/maxApi.ts'

const token = process.env.MAX_BOT_TOKEN?.trim() ?? ''

if (!token) {
  console.log('K0 REAL ENV: BLOCKED — credentials unavailable (MAX_BOT_TOKEN not set)')
  console.log('This is expected in local/agent without prod token. Proceed with mocks.')
  process.exit(0)
}

// Avoid logging token length/value
console.log('[k0] attempting GET https://platform-api2.max.ru/me with Authorization header (token not logged)')

try {
  const me = await maxGetMe(token)
  const username = typeof me.username === 'string' ? me.username : '(absent)'
  const isBot = typeof me.is_bot === 'boolean' ? me.is_bot : '(unknown)'
  const userId = typeof me.user_id === 'number' ? me.user_id : me.user_id ?? '(unknown)'
  const firstName = typeof me.first_name === 'string' ? me.first_name : ''

  console.log('MAX BOT:')
  console.log(`  user_id: ${String(userId)}`)
  console.log(`  first_name: ${firstName || '(empty)'}`)
  console.log(`  username: ${username}`)
  console.log(`  is_bot: ${String(isBot)}`)

  if (!username || username === '(absent)') {
    console.log('K0 FAIL — response.username absent')
    process.exit(1)
  }
  if (isBot !== true) {
    console.log('K0 FAIL — is_bot !== true')
    process.exit(1)
  }

  console.log(`Canonical MAX username: ${username}`)
  console.log(`Canonical Mini App link: https://max.ru/${username}?startapp=quiz_music90s`)
  console.log('K0 PASS')
} catch (error) {
  console.log(`K0 FAIL — ${error instanceof Error ? error.message : String(error)}`)
  // Distinguish TLS/network vs auth
  const msg = error instanceof Error ? error.message : String(error)
  if (/certificate|TLS|UNABLE_TO_VERIFY|self signed/i.test(msg)) {
    console.log('TLS: check MAX_EXTRA_CA_PEM / MINCIFRY CA — scoped agent required (see api/_lib/maxApi.ts)')
  }
  process.exit(1)
}
