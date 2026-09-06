import { useCallback, useEffect, useMemo, useState } from 'react'
import { getAnalytics } from '@/analytics/analytics'
import type { MiniAppAdapter } from '@/platform/types'
import { beautifulShotsChallenge } from '../beautiful-shots/challenge'
import { useChallengeProgress } from '../engine/useChallenge'
import { challengeFeedbackStore } from '../engine/store'
import { ChallengeLanding } from './ChallengeLanding'
import { ChallengeHome } from './ChallengeHome'
import { ChallengeDayDetail } from './ChallengeDayDetail'
import { ChallengeCompletion } from './ChallengeCompletion'
import { ChallengeGrid } from './ChallengeGrid'
import { ChallengeFeedback } from './ChallengeFeedback'

type ChallengeScreen =
  | { kind: 'landing' }
  | { kind: 'home' }
  | { kind: 'day'; day: number }
  | { kind: 'completion'; day: number; mode: 'normal' | 'quick' }
  | { kind: 'grid' }
  | { kind: 'feedback'; day: number; mode: 'normal' | 'quick' }

export interface ChallengeAppProps {
  adapter?: MiniAppAdapter
}

export function ChallengeApp({ adapter }: ChallengeAppProps) {
  const definition = beautifulShotsChallenge
  const { progress, loading, availableDay, start, complete } = useChallengeProgress(definition)
  const [screen, setScreen] = useState<ChallengeScreen>({ kind: 'landing' })
  const [pendingCompletion, setPendingCompletion] = useState<{ day: number; mode: 'normal' | 'quick' } | null>(null)

  const platform = adapter?.platform ?? 'browser'

  // Decide initial screen after loading — sync from external store to internal screen
  useEffect(() => {
    if (loading) return
    if (progress) {
      setScreen({ kind: 'home' })
    } else {
      setScreen({ kind: 'landing' })
    }
  }, [loading, progress])

  // Analytics for view
  useEffect(() => {
    if (loading) return
    try {
      const base = { challenge_id: definition.id, platform }
      if (!progress) {
        getAnalytics().track('challenge_view', { ...base, day: 0 })
      } else {
        getAnalytics().track('challenge_view', { ...base, day: availableDay })
      }
    } catch {}
  }, [loading, progress, definition.id, platform, availableDay])

  const handleStart = useCallback(async () => {
    const p = await start()
    try {
      getAnalytics().track('challenge_start', { challenge_id: definition.id, platform })
    } catch {}
    setScreen({ kind: 'home' })
    void p
  }, [start, definition.id, platform])

  const handleOpenDay = useCallback(
    (dayNum: number) => {
      // guard locked
      if (dayNum > availableDay) return
      setScreen({ kind: 'day', day: dayNum })
      try {
        getAnalytics().track('challenge_day_view', { challenge_id: definition.id, platform, day: dayNum })
      } catch {}
    },
    [availableDay, definition.id, platform],
  )

  const handleComplete = useCallback(
    async (mode: 'normal' | 'quick') => {
      if (screen.kind !== 'day') return
      const dayNum = screen.day
      await complete(dayNum, mode)
      try {
        const ev = mode === 'quick' ? 'challenge_day_complete_quick' : 'challenge_day_complete'
        getAnalytics().track(ev, { challenge_id: definition.id, platform, day: dayNum })
      } catch {}
      setPendingCompletion({ day: dayNum, mode })
      // Go to feedback first? Spec says feedback after completion small optional
      // We'll go to feedback screen then completion, or direct completion if skip
      setScreen({ kind: 'feedback', day: dayNum, mode })
    },
    [screen, complete, definition.id, platform],
  )

  const handleHintOpen = useCallback(
    (dayNum: number) => {
      try {
        getAnalytics().track('challenge_day_hint_open', { challenge_id: definition.id, platform, day: dayNum })
      } catch {}
    },
    [definition.id, platform],
  )

  const handleFeedbackSubmit = useCallback(
    async (rating: 'easy' | 'normal' | 'hard', reasons?: string[]) => {
      if (screen.kind !== 'feedback') return
      const dayNum = screen.day
      try {
        await challengeFeedbackStore.submitFeedback(definition.id, { day: dayNum, rating, reasons })
        getAnalytics().track('challenge_feedback', { challenge_id: definition.id, platform, day: dayNum, rating, ...(reasons ? { reasons: reasons.join(',') } : {}) })
      } catch {}
      // Do not navigate here — let ChallengeFeedback show "Спасибо" and user clicks Продолжить
    },
    [screen, definition.id, platform],
  )

  const handleFeedbackSkip = useCallback(() => {
    if (screen.kind !== 'feedback') return
    setScreen({ kind: 'completion', day: screen.day, mode: screen.mode })
  }, [screen])

  const handleCompletionContinue = useCallback(() => {
    // After completion, decide where to go: if there's next available incomplete, go there or home
    setScreen({ kind: 'home' })
  }, [])

  const dayObj = useMemo(() => {
    if (screen.kind === 'day') return definition.days.find((d) => d.day === screen.day) ?? null
    return null
  }, [screen, definition.days])

  if (loading) {
    return (
      <div className="challenge-screen" data-testid="challenge-loading">
        <p style={{ textAlign: 'center', color: 'var(--muted)' }}>Загрузка…</p>
      </div>
    )
  }

  // If progress exists but we are still on landing due to async, show home
  if (screen.kind === 'landing' && progress) {
    return <ChallengeHome definition={definition} progress={progress} availableDay={availableDay} onOpenDay={handleOpenDay} onOpenGrid={() => setScreen({ kind: 'grid' })} />
  }

  switch (screen.kind) {
    case 'landing':
      return <ChallengeLanding onStart={handleStart} />
    case 'home':
      if (!progress) return <ChallengeLanding onStart={handleStart} />
      return (
        <ChallengeHome
          definition={definition}
          progress={progress}
          availableDay={availableDay}
          onOpenDay={handleOpenDay}
          onOpenGrid={() => setScreen({ kind: 'grid' })}
        />
      )
    case 'day':
      if (!dayObj) return <div>День не найден</div>
      return (
        <ChallengeDayDetail
          day={dayObj}
          onBack={() => setScreen({ kind: 'home' })}
          onComplete={handleComplete}
          onHintOpen={() => handleHintOpen(dayObj.day)}
          onQuickOpen={() => {
            try {
              getAnalytics().track('challenge_day_quick_open', { challenge_id: definition.id, platform, day: dayObj.day })
            } catch {}
          }}
        />
      )
    case 'feedback':
      return (
        <section className="challenge-screen" data-testid="challenge-feedback-screen">
          <ChallengeFeedback day={screen.day} onSubmit={handleFeedbackSubmit} onSkip={handleFeedbackSkip} />
          <button type="button" className="button button--ghost" data-testid="feedback-skip-inline" onClick={handleFeedbackSkip} style={{ display: 'none' }}>
            skip
          </button>
        </section>
      )
    case 'completion':
      if (!progress || !pendingCompletion) {
        return <ChallengeHome definition={definition} progress={progress!} availableDay={availableDay} onOpenDay={handleOpenDay} onOpenGrid={() => setScreen({ kind: 'grid' })} />
      }
      return (
        <ChallengeCompletion
          definition={definition}
          progress={progress}
          availableDay={availableDay}
          completedDay={screen.day}
          mode={screen.mode}
          onContinue={handleCompletionContinue}
          onHome={() => setScreen({ kind: 'home' })}
        />
      )
    case 'grid':
      return (
        <ChallengeGrid
          definition={definition}
          progress={progress}
          availableDay={availableDay}
          onSelectDay={handleOpenDay}
          onBack={() => setScreen(progress ? { kind: 'home' } : { kind: 'landing' })}
        />
      )
    default:
      return null
  }
}
