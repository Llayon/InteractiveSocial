/**
 * Share attribution encoding for Telegram startapp parameters.
 *
 * Format: share_<resultId>[.<sharerUserId>]
 * - resultId    — quiz result allowlist key ([a-z]+)
 * - sharerUserId — optional Telegram user id of the person who shared;
 *   lets the backend notify them when their friend completes the quiz.
 * The trailing .<userId> part is optional so legacy links without
 * attribution keep working.
 */

const SHARE_PARAM_RE = /^share_([a-z]+)(?:\.(\d{1,15}))?$/

/** Encodes a share startapp parameter carrying attribution. */
export function buildShareStartParam(resultId: string, sharerUserId: number): string {
  return `share_${resultId}.${sharerUserId}`
}

export interface ParsedShareParam {
  resultId: string
  /** null when the link carries no attribution (legacy format). */
  sharerUserId: number | null
}

/** Parses and validates a share startapp parameter; null on malformed input. */
export function parseShareStartParam(param: string | null | undefined): ParsedShareParam | null {
  if (!param) return null
  const match = SHARE_PARAM_RE.exec(param)
  if (!match) return null
  return {
    resultId: match[1],
    sharerUserId: match[2] !== undefined ? Number(match[2]) : null,
  }
}