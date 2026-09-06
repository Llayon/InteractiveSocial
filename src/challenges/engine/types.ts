export type ChallengeDayState = 'locked' | 'available' | 'completed' | 'completed_quick'

export interface ChallengeDay {
  day: number
  title: string
  subtitle?: string
  heroImage?: string
  durationMinutes: number
  difficulty: 1 | 2 | 3
  task: string
  tips: {
    light?: string
    camera?: string
    pose?: string
    composition?: string
  }
  quickVersion?: {
    title: string
    task: string
  }
  troubleshooting?: string[]
  nextDayPreview?: string
}

export interface ChallengeDefinition {
  id: string
  slug: string
  title: string
  subtitle: string
  durationDays: number
  unlockStrategy: 'calendar-daily'
  days: ChallengeDay[]
}

export interface ChallengeCompletedDay {
  day: number
  completedAt: string // ISO instant
  mode: 'normal' | 'quick'
}

export interface ChallengeProgress {
  challengeId: string
  startedAt: string // ISO instant
  startedAtLocalDate: string // YYYY-MM-DD local calendar date at start
  completed: ChallengeCompletedDay[]
}

export interface ChallengeFeedbackEntry {
  challengeId: string
  day: number
  rating: 'easy' | 'normal' | 'hard'
  reasons?: string[]
  createdAt: string
}

export interface ChallengeFeedbackInput {
  day: number
  rating: 'easy' | 'normal' | 'hard'
  reasons?: string[]
}
