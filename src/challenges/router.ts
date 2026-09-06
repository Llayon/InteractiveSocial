export function isChallengeRoute(): boolean {
  if (typeof window === 'undefined') return false
  const pathname = window.location.pathname || ''
  if (pathname === '/beautiful-shots' || pathname.startsWith('/beautiful-shots/')) return true
  // Hash fallback for hash routing (if ever needed)
  const hash = window.location.hash || ''
  if (hash.includes('beautiful-shots')) return true
  const search = window.location.search || ''
  const params = new URLSearchParams(search)
  const challengeParam = params.get('challenge') ?? params.get('product') ?? params.get('quiz')
  if (challengeParam === 'beautiful-shots') return true
  // Also support view param ?
  return false
}

export function getChallengeSlug(): string | null {
  if (!isChallengeRoute()) return null
  return 'beautiful-shots'
}
