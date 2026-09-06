import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ChallengeDefinition, ChallengeProgress } from './types'
import { challengeProgressStore } from './store'
import { getAvailableDay } from './unlock'

export function useChallengeProgress(definition: ChallengeDefinition) {
  const [progress, setProgress] = useState<ChallengeProgress | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    const p = await challengeProgressStore.getProgress(definition.id)
    setProgress(p)
    setLoading(false)
  }, [definition.id])

  // load initial progress from external storage (localStorage)
  useEffect(() => {
    void refresh()
  }, [refresh])

  // availableDay recomputes every minute and on visibility change to handle midnight rollovers while app open
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000)
    const onVisibility = () => {
      if (document.visibilityState === 'visible') setNow(new Date())
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  const availableDay = useMemo(() => getAvailableDay(progress, now), [progress, now])

  const start = useCallback(async () => {
    const p = await challengeProgressStore.startChallenge(definition.id, new Date())
    setProgress(p)
    return p
  }, [definition.id])

  const complete = useCallback(
    async (day: number, mode: 'normal' | 'quick') => {
      await challengeProgressStore.completeDay(definition.id, day, mode, new Date())
      await refresh()
    },
    [definition.id, refresh],
  )

  return { progress, loading, availableDay, now, start, complete, refresh }
}
