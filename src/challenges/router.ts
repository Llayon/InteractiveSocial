const CHALLENGE_SLUG = 'beautiful-shots'
const CHALLENGE_START_PREFIX = 'challenge_'

function normalizeChallengeSlug(s: string): string | null {
  const t = s.trim().toLowerCase()
  if (t === CHALLENGE_SLUG) return CHALLENGE_SLUG
  if (t === 'beautiful_shots') return CHALLENGE_SLUG
  if (t === `${CHALLENGE_START_PREFIX}${CHALLENGE_SLUG}`) return CHALLENGE_SLUG
  if (t === `${CHALLENGE_START_PREFIX}beautiful_shots`) return CHALLENGE_SLUG
  return null
}

export function isChallengeStartParam(startParam: string | null | undefined): boolean {
  if (!startParam) return false
  const p = startParam.trim()
  if (!p) return false
  if (p === `${CHALLENGE_START_PREFIX}${CHALLENGE_SLUG}`) return true
  if (p === `${CHALLENGE_START_PREFIX}beautiful_shots`) return true
  if (p === CHALLENGE_SLUG) return true
  if (p === 'beautiful_shots') return true
  if (p.startsWith(`${CHALLENGE_START_PREFIX}${CHALLENGE_SLUG}`)) return true
  return false
}

export interface ChallengeRouteCheck {
  pathname?: string
  search?: string
  hash?: string
  startParam?: string | null
}

export function isChallengeRoute(options?: ChallengeRouteCheck | null): boolean {
  const pathname = options?.pathname ?? (typeof window !== 'undefined' ? window.location.pathname || '' : '')
  const search = options?.search ?? (typeof window !== 'undefined' ? window.location.search || '' : '')
  const hash = options?.hash ?? (typeof window !== 'undefined' ? window.location.hash || '' : '')
  const startParam = options?.startParam ?? null

  if (pathname === '/beautiful-shots' || pathname.startsWith('/beautiful-shots/')) return true
  if (hash.includes('beautiful-shots')) return true
  const params = new URLSearchParams(search)
  const challengeParam = params.get('challenge') ?? params.get('product') ?? params.get('quiz')
  if (challengeParam && normalizeChallengeSlug(challengeParam)) return true
  if (isChallengeStartParam(startParam)) return true
  return false
}

export function getChallengeSlug(options?: ChallengeRouteCheck | null): string | null {
  if (!isChallengeRoute(options)) return null
  return CHALLENGE_SLUG
}

export function resolveChallengeProduct(opts: {
  pathname?: string
  search?: string
  hash?: string
  startParam?: string | null
}): { kind: 'challenge'; slug: string } | { kind: 'quiz' } {
  if (isChallengeRoute(opts)) return { kind: 'challenge', slug: CHALLENGE_SLUG }
  return { kind: 'quiz' }
}
