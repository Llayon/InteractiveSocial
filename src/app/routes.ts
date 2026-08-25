import type { Quiz } from '@/features/quiz/schema'

/**
 * Minimal application screens. The app is a linear narrative
 * (landing → quiz → result), so a typed screen union replaces a router
 * dependency while keeping navigation explicit and testable.
 */
export type Screen = 'landing' | 'quiz' | 'result'

export function initialScreen(): Screen {
  return 'landing'
}

export function screenAfterQuizStart(): Screen {
  return 'quiz'
}

export function screenForCompletedQuiz(): Screen {
  return 'result'
}

export function isValidScreen(value: unknown): value is Screen {
  return value === 'landing' || value === 'quiz' || value === 'result'
}

/** Deep-linkable screen hash (e.g. #quiz) — used to restore state on reload. */
export function screenFromHash(hash: string, quiz?: Quiz): Screen | null {
  const normalized = hash.replace(/^#/, '')
  if (!isValidScreen(normalized)) return null
  if (normalized === 'quiz' && !quiz) return null
  return normalized
}
