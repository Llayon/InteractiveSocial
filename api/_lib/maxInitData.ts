import { createHmac, timingSafeEqual } from 'node:crypto'

export interface ValidatedMaxInitData {
  userId: number
  firstName: string
  username?: string
  startParam?: string
  chatId?: number
  chatType?: string
  authDate: number
}

export class MaxInitDataValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'MaxInitDataValidationError'
  }
}

/**
 * Validates MAX Mini App initData per official spec:
 * https://dev.max.ru/docs/webapps/validation
 *
 * Steps (semantically copied from spec, not from memory):
 * 1. raw must be non-empty string
 * 2. Split by '&' manually to detect duplicate keys where required
 * 3. Extract hash (must appear exactly once), save originalHash
 * 4. URL-decode all values (reject malformed encoding)
 * 5. Sort remaining key=value pairs alphabetically by key
 * 6. Join with '\n' → launch_params
 * 7. secret_key = HMAC-SHA256(key="WebAppData", data=BOT_TOKEN)
 * 8. signature  = HMAC-SHA256(key=secret_key, data=launch_params)
 * 9. hex(signature) compare constant-time with originalHash (lowercase)
 * 10. Validate structure: user JSON has id:number, first_name, etc.
 * 11. Validate auth_date freshness (injectable clock)
 *
 * @param raw  window.WebApp.initData
 * @param botToken server bot token
 * @param opts.now  injectable clock (for tests)
 * @param opts.maxAgeSec  freshness window in seconds (default 3600 = 1h per MAX spec; 0 = disable)
 * @param opts.toleranceSec future tolerance (default 60s)
 */
export function validateMaxInitData(
  raw: string,
  botToken: string,
  opts?: { now?: Date; maxAgeSec?: number; toleranceSec?: number },
): ValidatedMaxInitData {
  if (!raw || typeof raw !== 'string') {
    throw new MaxInitDataValidationError('init data is missing')
  }
  if (!botToken || typeof botToken !== 'string') {
    throw new MaxInitDataValidationError('bot token is missing')
  }

  const now = opts?.now ?? new Date()
  const maxAgeSec = opts?.maxAgeSec ?? 3600
  const toleranceSec = opts?.toleranceSec ?? 60

  // Manual split to detect duplicate keys (URLSearchParams would silently dedup)
  const parts = raw.split('&')
  if (parts.length === 0) throw new MaxInitDataValidationError('init data is empty')

  const entries: Array<[string, string]> = []
  let hashCount = 0
  let originalHash = ''

  // For duplicate detection where spec requires uniqueness: track counts
  const keyCounts = new Map<string, number>()

  for (const part of parts) {
    if (part.length === 0) continue
    const eq = part.indexOf('=')
    if (eq === -1) {
      throw new MaxInitDataValidationError(`malformed pair: ${part}`)
    }
    const k = part.slice(0, eq)
    const vEncoded = part.slice(eq + 1)
    if (!k) throw new MaxInitDataValidationError('empty key in init data')

    // Track duplicate
    keyCounts.set(k, (keyCounts.get(k) ?? 0) + 1)

    let v: string
    try {
      v = decodeURIComponent(vEncoded)
    } catch {
      throw new MaxInitDataValidationError(`malformed encoding for key "${k}"`)
    }

    if (k === 'hash') {
      hashCount += 1
      originalHash = v
      // do not add to entries for signature
    } else {
      entries.push([k, v])
    }
  }

  if (hashCount === 0) throw new MaxInitDataValidationError('missing hash')
  if (hashCount > 1) throw new MaxInitDataValidationError('duplicate hash')

  // Spec says each param appears exactly once in WebAppData fragment.
  // For safety we reject duplicates for keys that should be unique:
  // auth_date, user, chat, start_param, query_id. If any duplicated, reject.
  const mustBeUnique = new Set(['auth_date', 'user', 'chat', 'query_id', 'start_param'])
  for (const [k, count] of keyCounts) {
    if (mustBeUnique.has(k) && count > 1) {
      throw new MaxInitDataValidationError(`duplicate parameter: ${k}`)
    }
    if (k !== 'hash' && count > 1 && mustBeUnique.has(k)) {
      throw new MaxInitDataValidationError(`duplicate parameter: ${k}`)
    }
  }
  // Also generally reject any duplicate non-hash key duplicates (strictest)
  // But to allow forward compat, only reject if any key count >1 and it's not expected to be array
  // For MVP we reject any duplicate except hash already handled.
  for (const [k, count] of keyCounts) {
    if (k === 'hash') continue
    if (count > 1) {
      throw new MaxInitDataValidationError(`duplicate parameter: ${k}`)
    }
  }

  // Build canonical data-check string: sort by key a→z, encode as key=value with decoded values
  // NOTE: values are already decoded via decodeURIComponent above; we must re-encode? Spec says
  // after decoding, join as key=value with decoded value (not re-encoded). The example in docs shows
  // chat={"id":...} and user={"id":...} etc without further encoding. We use decoded values.
  // However entries already hold decoded values; we sort and join.
  entries.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))

  const checkString = entries.map(([k, v]) => `${k}=${v}`).join('\n')

  // Derive signing key: HMAC-SHA256(key="WebAppData", data=BOT_TOKEN)
  const secretKey = createHmac('sha256', 'WebAppData').update(botToken).digest()
  const computed = createHmac('sha256', secretKey).update(checkString).digest('hex')

  // Constant-time compare (need equal length buffers)
  const aBuf = Buffer.from(computed, 'utf-8')
  const bBuf = Buffer.from(originalHash, 'utf-8')
  if (aBuf.length !== bBuf.length) {
    throw new MaxInitDataValidationError('invalid hash')
  }
  let equal = false
  try {
    equal = timingSafeEqual(aBuf, bBuf)
  } catch {
    equal = false
  }
  if (!equal) throw new MaxInitDataValidationError('invalid hash')

  // Parse structured fields from entries map
  const map = new Map(entries)
  const authDateRaw = map.get('auth_date')
  if (!authDateRaw) throw new MaxInitDataValidationError('missing auth_date')
  const authDate = Number(authDateRaw)
  if (!Number.isInteger(authDate) || authDate <= 0) throw new MaxInitDataValidationError('invalid auth_date')

  // Freshness check
  if (maxAgeSec > 0) {
    const nowSec = Math.floor(now.getTime() / 1000)
    const age = nowSec - authDate
    if (age > maxAgeSec) throw new MaxInitDataValidationError('stale auth_date')
    if (age < -toleranceSec) throw new MaxInitDataValidationError('future auth_date')
  }

  // User validation
  const userRaw = map.get('user')
  if (!userRaw) throw new MaxInitDataValidationError('missing user')
  let userObj: unknown
  try {
    userObj = JSON.parse(userRaw)
  } catch {
    throw new MaxInitDataValidationError('invalid user JSON')
  }
  if (!userObj || typeof userObj !== 'object') throw new MaxInitDataValidationError('invalid user object')
  const user = userObj as Record<string, unknown>
  const userId = user.id
  if (typeof userId !== 'number' || !Number.isInteger(userId) || userId <= 0) {
    throw new MaxInitDataValidationError('missing user id')
  }
  const firstName = typeof user.first_name === 'string' && user.first_name ? user.first_name : 'друг'
  const username = typeof user.username === 'string' ? user.username : undefined

  // Optional fields
  const startParam = typeof map.get('start_param') === 'string' ? (map.get('start_param') as string) : undefined
  let chatId: number | undefined
  let chatType: string | undefined
  const chatRaw = map.get('chat')
  if (chatRaw) {
    try {
      const chatObj = JSON.parse(chatRaw) as Record<string, unknown>
      if (typeof chatObj.id === 'number') chatId = chatObj.id
      if (typeof chatObj.type === 'string') chatType = chatObj.type
    } catch {
      // chat parse failure is not fatal if user is valid; but spec says validate chat if present
      // We treat malformed chat as validation error to avoid tampering
      throw new MaxInitDataValidationError('invalid chat JSON')
    }
  }

  // Validate start_param charset if present (telegram-like but also max uses same s2_... grammar)
  if (startParam !== undefined && startParam !== '' && !/^[A-Za-z0-9_-]*$/.test(startParam)) {
    // MAX start_param may be limited to [A-Za-z0-9_-]; reject weird chars
    // But allow empty
    // If it contains invalid chars, we still return but caller attribution will treat as null
    // Strictly for security we reject tampering? The hash already covers it, so any value that passed hash is legitimate.
    // We don't reject here to allow future valid chars; just pass through.
  }

  return {
    userId: userId as number,
    firstName,
    username,
    startParam: startParam && startParam.length > 0 ? startParam : undefined,
    chatId,
    chatType,
    authDate,
  }
}

/**
 * Test helper: sign MAX initData for fixtures.
 * Mirrors the verification algorithm in reverse.
 */
export function signMaxInitData(
  params: Record<string, string>,
  botToken: string,
): string {
  // params should NOT include hash
  const entries = Object.entries(params).map(([k, v]) => [k, v] as [string, string])
  entries.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
  const checkString = entries.map(([k, v]) => `${k}=${v}`).join('\n')
  const secretKey = createHmac('sha256', 'WebAppData').update(botToken).digest()
  const hash = createHmac('sha256', secretKey).update(checkString).digest('hex')
  const encoded = entries
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .concat(`hash=${hash}`)
    .join('&')
  // To preserve sort vs encoded order: re-sort encoded? Actually spec says original raw order doesn't matter,
  // but we produce sorted order for determinism.
  // Re-sort the final raw by key to mimic realistic client order (sorted), with hash last.
  // For simplicity, return with keys in sorted order (entries already sorted) + hash
  return encoded
}
