import type { ChallengeCompletedDay, ChallengeFeedbackEntry, ChallengeFeedbackInput, ChallengeProgress } from './types'
import { formatLocalDate } from './unlock'

export interface ChallengeProgressStore {
  getProgress(challengeId: string): Promise<ChallengeProgress | null>
  startChallenge(challengeId: string, now?: Date): Promise<ChallengeProgress>
  completeDay(challengeId: string, day: number, mode: 'normal' | 'quick', now?: Date): Promise<void>
}

export interface ChallengeFeedbackStore {
  getFeedback(challengeId: string): Promise<ChallengeFeedbackEntry[]>
  submitFeedback(challengeId: string, input: ChallengeFeedbackInput, now?: Date): Promise<void>
}

function storageKey(challengeId: string): string {
  return `challenge-progress:${challengeId}`
}

function feedbackKey(challengeId: string): string {
  return `challenge-feedback:${challengeId}`
}

function safeParse(json: string | null): unknown {
  if (!json) return null
  try {
    return JSON.parse(json)
  } catch {
    return null
  }
}

function isValidProgress(obj: unknown): obj is ChallengeProgress {
  if (!obj || typeof obj !== 'object') return false
  const o = obj as Record<string, unknown>
  if (typeof o.challengeId !== 'string') return false
  if (typeof o.startedAt !== 'string') return false
  if (typeof o.startedAtLocalDate !== 'string') return false
  if (!Array.isArray(o.completed)) return false
  // startedAt should be valid ISO
  const d = new Date(o.startedAt as string)
  if (Number.isNaN(d.getTime())) return false
  // startedAtLocalDate should be YYYY-MM-DD
  if (!/^\d{4}-\d{2}-\d{2}$/.test(o.startedAtLocalDate as string)) return false
  for (const c of o.completed as unknown[]) {
    if (!c || typeof c !== 'object') return false
    const cc = c as Record<string, unknown>
    if (typeof cc.day !== 'number' || !Number.isInteger(cc.day) || cc.day < 1 || cc.day > 30) return false
    if (typeof cc.completedAt !== 'string') return false
    if (Number.isNaN(new Date(cc.completedAt as string).getTime())) return false
    if (cc.mode !== 'normal' && cc.mode !== 'quick') return false
  }
  return true
}

function isValidFeedbackArray(obj: unknown): obj is ChallengeFeedbackEntry[] {
  if (!Array.isArray(obj)) return false
  for (const e of obj) {
    if (!e || typeof e !== 'object') return false
    const ee = e as Record<string, unknown>
    if (typeof ee.challengeId !== 'string') return false
    if (typeof ee.day !== 'number') return false
    if (ee.rating !== 'easy' && ee.rating !== 'normal' && ee.rating !== 'hard') return false
    if (typeof ee.createdAt !== 'string') return false
    if (ee.reasons !== undefined && !Array.isArray(ee.reasons)) return false
  }
  return true
}

export class LocalStorageChallengeProgressStore implements ChallengeProgressStore {
  private getStorage(): Storage | null {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return null
      return window.localStorage
    } catch {
      return null
    }
  }

  async getProgress(challengeId: string): Promise<ChallengeProgress | null> {
    const storage = this.getStorage()
    if (!storage) return null
    try {
      const raw = storage.getItem(storageKey(challengeId))
      const parsed = safeParse(raw)
      if (!isValidProgress(parsed)) {
        // corrupted -> treat as null and optionally clear
        if (raw !== null) {
          try {
            storage.removeItem(storageKey(challengeId))
          } catch {}
        }
        return null
      }
      // Ensure challengeId matches
      if (parsed.challengeId !== challengeId) return null
      // Deduplicate completed by day, keep first occurrence
      const seen = new Map<number, ChallengeCompletedDay>()
      for (const c of parsed.completed) {
        if (!seen.has(c.day)) seen.set(c.day, c)
      }
      // sort for deterministic
      const deduped = [...seen.values()].sort((a, b) => a.day - b.day)
      return { ...parsed, completed: deduped }
    } catch {
      return null
    }
  }

  async startChallenge(challengeId: string, now: Date = new Date()): Promise<ChallengeProgress> {
    const existing = await this.getProgress(challengeId)
    if (existing) return existing
    const startedAt = now.toISOString()
    const startedAtLocalDate = formatLocalDate(now)
    const progress: ChallengeProgress = {
      challengeId,
      startedAt,
      startedAtLocalDate,
      completed: [],
    }
    const storage = this.getStorage()
    if (storage) {
      try {
        storage.setItem(storageKey(challengeId), JSON.stringify(progress))
      } catch {}
    }
    return progress
  }

  async completeDay(challengeId: string, day: number, mode: 'normal' | 'quick', now: Date = new Date()): Promise<void> {
    if (!Number.isInteger(day) || day < 1 || day > 30) return
    if (mode !== 'normal' && mode !== 'quick') return
    const storage = this.getStorage()
    if (!storage) return
    const current = await this.getProgress(challengeId)
    if (!current) {
      // If no progress, auto-start then complete
      const started = await this.startChallenge(challengeId, now)
      // Now add completion
      const completedAt = now.toISOString()
      const updated: ChallengeProgress = {
        ...started,
        completed: [{ day, completedAt, mode }],
      }
      try {
        storage.setItem(storageKey(challengeId), JSON.stringify(updated))
      } catch {}
      return
    }
    // duplicate handling
    const idx = current.completed.findIndex((c) => c.day === day)
    if (idx >= 0) {
      const existing = current.completed[idx]
      if (existing.mode === mode) {
        // exact duplicate -> no-op
        return
      }
      // Different mode -> update to new mode (allow upgrade)
      const updatedCompleted = [...current.completed]
      updatedCompleted[idx] = { day, completedAt: now.toISOString(), mode }
      const updated: ChallengeProgress = { ...current, completed: updatedCompleted.sort((a, b) => a.day - b.day) }
      try {
        storage.setItem(storageKey(challengeId), JSON.stringify(updated))
      } catch {}
      return
    }
    const completedAt = now.toISOString()
    const next: ChallengeProgress = {
      ...current,
      completed: [...current.completed, { day, completedAt, mode }].sort((a, b) => a.day - b.day),
    }
    try {
      storage.setItem(storageKey(challengeId), JSON.stringify(next))
    } catch {}
  }
}

export class LocalStorageChallengeFeedbackStore implements ChallengeFeedbackStore {
  private getStorage(): Storage | null {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return null
      return window.localStorage
    } catch {
      return null
    }
  }

  async getFeedback(challengeId: string): Promise<ChallengeFeedbackEntry[]> {
    const storage = this.getStorage()
    if (!storage) return []
    try {
      const raw = storage.getItem(feedbackKey(challengeId))
      const parsed = safeParse(raw)
      if (!isValidFeedbackArray(parsed)) {
        if (raw !== null) {
          try {
            storage.removeItem(feedbackKey(challengeId))
          } catch {}
        }
        return []
      }
      return parsed.filter((e) => e.challengeId === challengeId)
    } catch {
      return []
    }
  }

  async submitFeedback(challengeId: string, input: ChallengeFeedbackInput, now: Date = new Date()): Promise<void> {
    const storage = this.getStorage()
    if (!storage) return
    if (!Number.isInteger(input.day) || input.day < 1 || input.day > 30) return
    if (input.rating !== 'easy' && input.rating !== 'normal' && input.rating !== 'hard') return
    const entry: ChallengeFeedbackEntry = {
      challengeId,
      day: input.day,
      rating: input.rating,
      reasons: input.reasons,
      createdAt: now.toISOString(),
    }
    const existing = await this.getFeedback(challengeId)
    // Keep only latest per day (replace if exists)
    const filtered = existing.filter((e) => e.day !== input.day)
    const next = [...filtered, entry]
    try {
      storage.setItem(feedbackKey(challengeId), JSON.stringify(next))
    } catch {}
  }
}

// Singleton convenience for beta — local storage impl
export const challengeProgressStore = new LocalStorageChallengeProgressStore()
export const challengeFeedbackStore = new LocalStorageChallengeFeedbackStore()
