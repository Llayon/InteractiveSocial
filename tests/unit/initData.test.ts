import { describe, expect, it } from 'vitest'
import { sign } from '@tma.js/init-data-node'
import { InitDataValidationError, validateInitData } from '../../api/_lib/initData'

const BOT_TOKEN = '7000000001:TEST_FAKE_TOKEN_FOR_UNIT_TESTS'
const FRESH_AUTH_DATE = new Date(Date.now() - 60 * 1000) // 1 minute ago
const STALE_AUTH_DATE = new Date(Date.now() - 48 * 3600 * 1000) // 48h ago

function buildRaw(authDate: Date, token = BOT_TOKEN, user = { id: 424242, first_name: 'Тест' }) {
  return sign({ user }, token, authDate)
}

describe('validateInitData (security boundary)', () => {
  it('accepts correctly signed fresh init data and extracts the validated user id', () => {
    const raw = buildRaw(FRESH_AUTH_DATE)
    const validated = validateInitData(raw, BOT_TOKEN)
    expect(validated.userId).toBe(424242)
  })

  it('rejects a tampered payload (signature mismatch)', () => {
    const raw = buildRaw(FRESH_AUTH_DATE)
    const tampered = raw.replace(/user=[^&]+/, 'user=' + encodeURIComponent('{"id":1}'))
    expect(() => validateInitData(tampered, BOT_TOKEN)).toThrow(InitDataValidationError)
  })

  it('rejects data signed with a different bot token', () => {
    const raw = buildRaw(FRESH_AUTH_DATE, '7000000002:ANOTHER_TOKEN')
    expect(() => validateInitData(raw, BOT_TOKEN)).toThrow(InitDataValidationError)
  })

  it('rejects stale auth_date (freshness check)', () => {
    const raw = buildRaw(STALE_AUTH_DATE)
    expect(() => validateInitData(raw, BOT_TOKEN)).toThrow(InitDataValidationError)
  })

  it('rejects empty input', () => {
    expect(() => validateInitData('', BOT_TOKEN)).toThrow(InitDataValidationError)
  })

  it('never trusts a user before signature verification succeeds', () => {
    // Unsigned garbage that still contains a user field must be rejected.
    const forged = `user=${encodeURIComponent('{"id":999}')}&auth_date=${Math.floor(
      Date.now() / 1000,
    )}&hash=deadbeef`
    expect(() => validateInitData(forged, BOT_TOKEN)).toThrow(InitDataValidationError)
  })
})
