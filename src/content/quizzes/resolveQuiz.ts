import { resolveResultByCode } from './codes.js'
import type { Quiz } from '../../features/quiz/schema.js'
import { activeQuiz, getQuizById, quizzes } from './index.js'

export interface QuizLaunchContext {
  /** Telegram start parameter (startapp), null outside Telegram. */
  startParam: string | null
  /** Browser query string, '' outside plain web. */
  search: string
}

/**
 * Lookup surface the resolver works against. The production default wires
 * into the real registry + code registry; tests inject a synthetic two-quiz
 * registry to PROVE multi-quiz routing (a single-quiz suite cannot — with one
 * quiz any fallback trivially equals the default).
 */
export interface QuizLaunchRegistry {
  /** Explicit quizById lookups (quiz_<id>, ?quiz=<id>). */
  findQuizById(id: string): Quiz | undefined
  /** Legacy share_<result> — resolves to the quiz owning that result id. */
  findQuizByResultId(resultId: string): Quiz | undefined
  /** v2 share codes — resolves a code pair to the owning quiz/result. */
  resolveV2(quizCode: string, resultCode: string): { quiz: Quiz; resultId: string } | null
  /** Deterministic fallback for unknown/malformed ids (never throws). */
  defaultQuiz(): Quiz
}

const defaultRegistry: QuizLaunchRegistry = {
  findQuizById: (id) => getQuizById(id),
  findQuizByResultId: (resultId) => quizzes.find((q) => q.results.some((r) => r.id === resultId)),
  resolveV2: resolveResultByCode,
  defaultQuiz: () => activeQuiz,
}

/**
 * The single canonical quiz resolver. Every entry point (App launch,
 * deep links, restarts) must obtain its quiz through here — direct
 * `quizzes[0]`/`activeQuiz` usage in feature code is forbidden.
 *
 * Selection precedence:
 *   1. Telegram start param `quiz_<quizId>`
 *   2. Shared-link start params — v2 codes (`s2_…`) resolved via the code
 *      registry, legacy `share_<result>` via the result-owner scan
 *   3. Wife/campaign start params — `post_*`, `channel_*`, `quiz_launch` with
 *      campaign `music90s_*` → music90s, etc. (so t.me/...?startapp=post_music90s_launch
 *      correctly opens music90s while still counting as wife_post attribution).
 *   4. Browser `?quiz=<quizId>` (dev / plain web)
 * Unknown ids never throw: they fall back to the default quiz with a
 * console warning so a malformed link can never blank the app.
 */
export function resolveQuizFromLaunch(
  ctx: QuizLaunchContext,
  registry: QuizLaunchRegistry = defaultRegistry,
): Quiz {
  const startParam = ctx.startParam?.trim() || null

  if (startParam) {
    if (startParam.startsWith('quiz_')) {
      const byExplicit = registry.findQuizById(startParam.slice('quiz_'.length))
      if (byExplicit) return byExplicit
      console.warn('[quiz] unknown quiz id in start param: %s', startParam)
    }

    const v2 = parseV2ShareParam(startParam)
    if (v2) {
      const resolved = registry.resolveV2(v2.quizCode, v2.resultCode)
      if (resolved) return resolved.quiz
      console.warn('[quiz] unknown v2 share target: %s', startParam)
      return registry.defaultQuiz()
    }

    const resultId = parseResultIdFromShareParam(startParam)
    if (resultId) {
      const owner = registry.findQuizByResultId(resultId)
      if (owner) return owner
      console.warn('[quiz] share param references unknown result: %s', startParam)
    }

    // Campaign / wife attribution params: post_*, channel_*, quiz_launch etc.
    // These carry campaign_id like music90s_launch but must still route to the correct quiz.
    // We infer quiz by matching campaign prefix against known quiz ids.
    const campaignQuiz = resolveQuizFromCampaignParam(startParam, registry)
    if (campaignQuiz) return campaignQuiz
  }

  const requested = new URLSearchParams(ctx.search).get('quiz')
  if (requested) {
    const byQuery = registry.findQuizById(requested)
    if (byQuery) return byQuery
    console.warn('[quiz] unknown ?quiz= value: %s', requested)
  }

  return registry.defaultQuiz()
}

/** Splits `s2_<quizCode>_<resultCode>_<uid>`; null for non-v2 or malformed. */
function parseV2ShareParam(startParam: string): { quizCode: string; resultCode: string } | null {
  const match = /^s2_([a-z0-9]{1,12})_([a-z0-9]{1,12})_\d{1,15}$/.exec(startParam)
  return match ? { quizCode: match[1], resultCode: match[2] } : null
}

/**
 * Extracts the result id of a legacy `share_<resultId>-<uid>` payload.
 * Accepts the canonical result-id grammar (namespaced ids like
 * `m90_rookie` are legal); the stricter historical `[a-z]+` shape still
 * matches, so no existing link can break.
 */
function parseResultIdFromShareParam(startParam: string): string | null {
  const match = /^share_([a-z][a-z0-9_]{0,63})(?:-[0-9]+)?$/.exec(startParam)
  return match?.[1] ?? null
}

/**
 * Infer quiz from wife/campaign params like post_music90s_launch, channel_music90s_launch,
 * channel_tg_music90s_launch, quiz_music90s_launch, or bare post/channel campaign.
 * Returns null if campaign does not map to a known quiz id.
 */
function resolveQuizFromCampaignParam(
  startParam: string,
  registry: QuizLaunchRegistry,
): Quiz | null {
  let campaign: string | null = null

  if (startParam === 'post' || startParam.startsWith('post_')) {
    campaign = startParam === 'post' ? null : startParam.slice('post_'.length)
  } else if (startParam === 'channel' || startParam.startsWith('channel')) {
    if (startParam === 'channel') campaign = null
    else if (startParam.startsWith('channel_')) {
      campaign = startParam.slice('channel_'.length)
      // strip legacy tg_/max_ prefix so channel_tg_music90s_launch → music90s_launch
      if (campaign.startsWith('tg_')) campaign = campaign.slice(3)
      else if (campaign.startsWith('max_')) campaign = campaign.slice(4)
    } else {
      campaign = null
    }
  } else if (startParam === 'quiz' || startParam.startsWith('quiz_')) {
    // quiz_music90s or quiz_music90s_launch etc. — try to extract quiz id prefix
    // For quiz_ the remainder is already handled above for exact match; this is fallback for campaign variants
    campaign = startParam === 'quiz' ? null : startParam.slice('quiz_'.length)
  } else if (startParam.startsWith('quiz_launch')) {
    campaign = null
  }

  if (!campaign) return null

  // Normalize campaign to lowercase for matching
  const lower = campaign.toLowerCase()

  // Direct match or prefix match against known quiz ids.
  // We check longest quiz ids first to avoid prefix collision (e.g. music90s vs music).
  const candidates = (() => {
    try {
      // Prefer registry enumeration if available; fallback to direct lookups
      const ids = ['music90s', 'guess90s', 'interior-character']
      return ids
        .map((id) => registry.findQuizById(id))
        .filter((q): q is NonNullable<typeof q> => Boolean(q))
        .map((q) => q.id)
    } catch {
      return []
    }
  })()

  // Sort by length desc for longest-prefix wins
  candidates.sort((a, b) => b.length - a.length)

  for (const quizId of candidates) {
    if (lower === quizId || lower.startsWith(quizId + '_') || lower.startsWith(quizId + '-')) {
      const quiz = registry.findQuizById(quizId)
      if (quiz) return quiz
    }
  }

  // Also handle campaign that is exactly quiz launch id like music90s_launch where quizId=music90s
  // Already covered above via prefix, but keep fallback for non-standard separators
  return null
}

/** The quiz every fallback resolves to (default quiz of the registry). */
export function getDefaultQuiz(): Quiz {
  return activeQuiz
}
