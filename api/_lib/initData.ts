import { parse, validate } from '@tma.js/init-data-node'

export interface ValidatedInitData {
  userId: number
  startParam?: string
  /** Display name of the validated user (from signed initData). */
  firstName?: string
}

export class InitDataValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'InitDataValidationError'
  }
}

/**
 * Security boundary: validates Telegram initData signature server-side using
 * @tma.js/init-data-node (constant-time comparison, official algorithm).
 * The user id is only trustworthy after this function returns successfully.
 *
 * @param raw        raw initData string as passed by the Telegram client
 * @param botToken   bot token (server-side env only)
 * @param expiresInSeconds freshness window for auth_date (default 24h, 0 = off)
 */
export function validateInitData(
  raw: string,
  botToken: string,
  expiresInSeconds = 86_400,
): ValidatedInitData {
  if (!raw || typeof raw !== 'string') {
    throw new InitDataValidationError('init data is missing')
  }
  try {
    // expiresIn = 0 disables the check; anything positive enforces freshness.
    validate(raw, botToken, { expiresIn: Math.max(0, expiresInSeconds) })
    const parsed = parse(raw)
    const user = parsed.user
    if (!user || typeof user.id !== 'number') {
      throw new InitDataValidationError('init data contains no user')
    }
    return { userId: user.id, startParam: parsed.start_param, firstName: user.first_name }
  } catch (error) {
    if (error instanceof InitDataValidationError) throw error
    throw new InitDataValidationError(
      error instanceof Error ? error.message : 'init data validation failed',
    )
  }
}
