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
  const d = new Date(y, month - 1, day, 12, 0, 0, 0)
  if (d.getFullYear() !== y || d.getMonth() !== month - 1 || d.getDate() !== day) return null
  return d
}

export function differenceInCalendarDaysLocal(aLocalDate: string, bLocalDate: string): number {
  const a = parseLocalDate(aLocalDate)
  const b = parseLocalDate(bLocalDate)
  if (!a || !b) return 0
  const aUtc = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())
  const bUtc = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate())
  const msPerDay = 24 * 60 * 60 * 1000
  return Math.round((aUtc - bUtc) / msPerDay)
}

export function getAvailableDay(progress: ChallengeProgress | null, today: Date = new Date()): number {
  if (!progress) return 0
  const stored = parseLocalDate(progress.startedAtLocalDate)
  if (!stored) {
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

export function isDayPublished(day: number, definition: ChallengeDefinition): boolean;
export function isDayPublished(definition: ChallengeDefinition, day: number): boolean;
export function isDayPublished(a: number | ChallengeDefinition, b: number | ChallengeDefinition): boolean {
  let day: number
  let definition: ChallengeDefinition
  if (typeof a === 'number' && typeof b === 'object' && b !== null && 'days' in (b as unknown as Record<string, unknown>)) {
    day = a
    definition = b as ChallengeDefinition
  } else if (typeof b === 'number' && typeof a === 'object' && a !== null && 'days' in (a as unknown as Record<string, unknown>)) {
    definition = a as ChallengeDefinition
    day = b as number
  } else {
    return false
  }
  if (!Number.isInteger(day) || day < 1 || day > definition.durationDays) return false
  return definition.days.some((d) => d.day === day)
}

export function isDayUnlocked(day: number, _progress: ChallengeProgress | null, availableDay: number, definition: ChallengeDefinition): boolean {
  if (!isDayPublished(day, definition)) return false
  return day <= availableDay
}

export function isDayLocked(day: number, progress: ChallengeProgress | null, availableDay: number, definition: ChallengeDefinition): boolean {
  if (!isDayPublished(day, definition)) return true
  const state = getDayState(day, progress, availableDay)
  return state === 'locked'
}

export function getPublishedDayState(definition: ChallengeDefinition, dayNumber: number, progress: ChallengeProgress | null, availableDay: number): ReturnType<typeof getDayState> {
  if (!isDayPublished(dayNumber, definition)) return 'locked'
  return getDayState(dayNumber, progress, availableDay)
}

export function getDayState(dayNumber: number, progress: ChallengeProgress | null, availableDay: number): ChallengeDayState {
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

export function getNextAvailableIncompleteDay(definition: ChallengeDefinition, progress: ChallengeProgress | null, availableDay: number): number | null {
  for (let d = 1; d <= Math.min(availableDay, definition.durationDays); d++) {
    if (!isDayPublished(d, definition)) continue
    const st = getDayState(d, progress, availableDay)
    if (st === 'available') return d
  }
  return null
}

export function getNextLockedUnpublishedDay(definition: ChallengeDefinition, availableDay: number): number | null {
  for (let d = availableDay + 1; d <= definition.durationDays; d++) {
    if (!isDayPublished(d, definition)) {
      return d
    }
  }
  return null
}

export function getCompletedCount(progress: ChallengeProgress | null): number {
  if (!progress) return 0
  return progress.completed.length
}

export function isChallengeComplete(definition: ChallengeDefinition, progress: ChallengeProgress | null): boolean {
  if (!progress) return false
  return progress.completed.length >= definition.durationDays
}

export function getProgressSummary(definition: ChallengeDefinition, progress: ChallengeProgress | null, today: Date = new Date()): { availableDay: number; nextIncomplete: number | null; completedCount: number; total: number; isComplete: boolean } {
  const availableDay = getAvailableDay(progress, today)
  const nextIncomplete = getNextAvailableIncompleteDay(definition, progress, availableDay)
  const completedCount = getCompletedCount(progress)
  const isComplete = isChallengeComplete(definition, progress)
  return { availableDay, nextIncomplete, completedCount, total: definition.durationDays, isComplete }
}
