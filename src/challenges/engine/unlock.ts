import type { ChallengeDayState, ChallengeDefinition, ChallengeProgress } from './types'

export function formatLocalDate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function parseLocalDate(dateString: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateString)
  if (!m) return null
  const y = Number(m[1])
  const month = Number(m[2])
  const day = Number(m[3])
  if (month < 1 || month > 12) return null
  if (day < 1 || day > 31) return null
  // Local midnight
  const d = new Date(y, month - 1, day, 12, 0, 0, 0) // noon to avoid DST edge
  // Validate that conversion is consistent (avoid 2026-02-31 etc)
  if (d.getFullYear() !== y || d.getMonth() !== month - 1 || d.getDate() !== day) return null
  // return at noon but calendar diff only cares about date part via string
  return d
}

/**
 * Difference in calendar days between two local YYYY-MM-DD strings.
 * Result is (a - b) in days. Uses UTC noon trick to avoid DST issues.
 */
export function differenceInCalendarDaysLocal(aLocalDate: string, bLocalDate: string): number {
  const a = parseLocalDate(aLocalDate)
  const b = parseLocalDate(bLocalDate)
  if (!a || !b) return 0
  // Normalize both to UTC midnight via their Y/M/D components interpreted as UTC noon then diff
  // Use Date.UTC at noon to avoid DST:
  const aUtc = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())
  const bUtc = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate())
  const msPerDay = 24 * 60 * 60 * 1000
  return Math.round((aUtc - bUtc) / msPerDay)
}

export function getAvailableDay(
  progress: ChallengeProgress | null,
  today: Date = new Date(),
): number {
  if (!progress) return 0
  // Validate stored date
  const stored = parseLocalDate(progress.startedAtLocalDate)
  if (!stored) {
    // Fallback: derive from startedAt instant's local date; then available is 1 at minimum
    const fallback = formatLocalDate(new Date(progress.startedAt))
    const todayStr = formatLocalDate(today)
    const diff = differenceInCalendarDaysLocal(todayStr, fallback)
    return Math.min(30, Math.max(1, diff + 1))
  }
  const todayStr = formatLocalDate(today)
  const diff = differenceInCalendarDaysLocal(todayStr, progress.startedAtLocalDate)
  const raw = diff + 1
  if (raw < 1) return 1
  if (raw > 30) return 30
  return raw
}

export function clampDay(day: number, max: number): number {
  if (day < 1) return 1
  if (day > max) return max
  return day
}

export function getDayState(
  dayNumber: number,
  progress: ChallengeProgress | null,
  availableDay: number,
): ChallengeDayState {
  if (!progress) {
    return dayNumber <= availableDay ? 'available' : 'locked'
  }
  const completed = progress.completed.find((c) => c.day === dayNumber)
  if (completed) {
    return completed.mode === 'quick' ? 'completed_quick' : 'completed'
  }
  if (dayNumber <= availableDay) return 'available'
  return 'locked'
}

export function getNextAvailableIncompleteDay(
  definition: ChallengeDefinition,
  progress: ChallengeProgress | null,
  availableDay: number,
): number | null {
  for (let d = 1; d <= Math.min(availableDay, definition.durationDays); d++) {
    const st = getDayState(d, progress, availableDay)
    if (st === 'available') return d
  }
  return null
}

export function getCompletedCount(progress: ChallengeProgress | null): number {
  if (!progress) return 0
  return progress.completed.length
}

export function isChallengeComplete(
  definition: ChallengeDefinition,
  progress: ChallengeProgress | null,
): boolean {
  if (!progress) return false
  return progress.completed.length >= definition.durationDays
}

export function getProgressSummary(
  definition: ChallengeDefinition,
  progress: ChallengeProgress | null,
  today: Date = new Date(),
): {
  availableDay: number
  nextIncomplete: number | null
  completedCount: number
  total: number
  isComplete: boolean
} {
  const availableDay = getAvailableDay(progress, today)
  const nextIncomplete = getNextAvailableIncompleteDay(definition, progress, availableDay)
  const completedCount = getCompletedCount(progress)
  const isComplete = isChallengeComplete(definition, progress)
  return {
    availableDay,
    nextIncomplete,
    completedCount,
    total: definition.durationDays,
    isComplete,
  }
}
