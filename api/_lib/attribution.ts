/**
 * Share attribution encoding for Telegram startapp parameters.
 *
 * v2 (current):  s2_<quizCode>_<resultCode>_<sharerUserId>
 *                e.g. s2_ic_it_847291
 * Wire codes come from src/content/quizzes/codes.ts and are decoupled from
 * internal ids, so the protocol survives id renames and multi-quiz growth.
 *
 * v1 (legacy):   share_<resultId>-<sharerUserId> | share_<resultId>
 *                (and the historic dot-separated share_<resultId>.<uid>)
 * Still parsed forever - links already sitting in chat history cannot be
 * rewritten. v1 resolves back to a quiz via the result-id registry scan.
 *
 * NOTE: Telegram deep-link startapp values allow ONLY [A-Za-z0-9_-]; dots,
 * colons or slashes make the link fail to open, hence the underscore/dash
 * separators throughout.
 */
import { resolveResultByCode } from '../../src/content/quizzes/codes.js'
import { quizzes } from '../../src/content/quizzes/index.js'

export interface ShareParamV2 {
  version: 2
  quizCode: string
  resultCode: string
  sharerUserId: number
}

export interface ShareParamV1 {
  version: 1
  resultId: string
  /** null when the link carries no attribution (bare legacy format). */
  sharerUserId: number | null
}

export type ParsedShareParam = ShareParamV2 | ShareParamV1

const V2_RE = /^s2_([a-z0-9]{1,12})_([a-z0-9]{1,12})_(\d{1,15})$/
const V1_RE = /^share_([a-z]+)(?:[.-](\d{1,15}))?$/

/** Builds the current (v2) share startapp parameter carrying attribution. */
export function buildShareStartParam(
  quizCode: string,
  resultCode: string,
  sharerUserId: number,
): string {
  return `s2_${quizCode}_${resultCode}_${sharerUserId}`
}

/** Legacy v1 builder - kept only for tests and one-release fallback paths. */
export function buildLegacyShareStartParam(resultId: string, sharerUserId: number): string {
  return `share_${resultId}-${sharerUserId}`
}

/** Parses either protocol version; null on malformed input. */
export function parseShareStartParam(param: string | null | undefined): ParsedShareParam | null {
  if (!param) return null

  const v2 = V2_RE.exec(param)
  if (v2) {
    return {
      version: 2,
      quizCode: v2[1],
      resultCode: v2[2],
      sharerUserId: Number(v2[3]),
    }
  }

  const v1 = V1_RE.exec(param)
  if (v1) {
    return {
      version: 1,
      resultId: v1[1],
      sharerUserId: v1[2] !== undefined ? Number(v1[2]) : null,
    }
  }

  return null
}

export interface ResolvedAttribution {
  /** Protocol version of the link (1 legacy, 2 v2 codes). */
  version: 1 | 2
  /** Quiz the link points at (from wire codes, or owner scan for v1). */
  quizId: string
  resultId: string
  sharerUserId: number | null
}

/**
 * Full protocol resolution against the code registry. Unknown v2 codes or a
 * v1 result id that no registered quiz owns yield null — callers must treat
 * that as "no attribution" and never fail the request because of it.
 */
export function resolveAttribution(param: string | null | undefined): ResolvedAttribution | null {
  const parsed = parseShareStartParam(param)
  if (!parsed) return null

  if (parsed.version === 2) {
    const resolved = resolveResultByCode(parsed.quizCode, parsed.resultCode)
    if (!resolved) return null
    return {
      version: 2,
      quizId: resolved.quiz.id,
      resultId: resolved.resultId,
      sharerUserId: parsed.sharerUserId,
    }
  }

  const owner = quizzes.find((quiz) => quiz.results.some((r) => r.id === parsed.resultId))
  if (!owner) return null
  return {
    version: 1,
    quizId: owner.id,
    resultId: parsed.resultId,
    sharerUserId: parsed.sharerUserId,
  }
}
