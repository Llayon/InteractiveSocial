import { useEffect } from 'react'

import { isChallengeRoute, isChallengeStartParam } from '@/challenges/router'
import { ChallengeApp } from '@/challenges/ui/ChallengeApp'
import type { MiniAppAdapter } from '@/platform/types'
import type { TelegramAdapter } from '@/platform/telegram'
import { QuizApp } from './QuizApp'

export interface AppProps {
  telegram?: TelegramAdapter
  adapter?: MiniAppAdapter
}

export function App({ telegram, adapter }: AppProps) {
  const platformAdapter = (adapter ?? telegram) as MiniAppAdapter | undefined
  const startParam = platformAdapter?.getStartParam() ?? null
  const isChallenge =
    typeof window !== 'undefined'
      ? isChallengeRoute({
          pathname: window.location.pathname,
          search: window.location.search,
          hash: window.location.hash,
          startParam,
        })
      : isChallengeStartParam(startParam)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      ;(window as unknown as Record<string, unknown>).__platform = platformAdapter?.platform ?? 'none'
      ;(window as unknown as Record<string, unknown>).__startParam = platformAdapter?.getStartParam() ?? null
    }
  }, [platformAdapter])

  useEffect(() => {
    try {
      ;(window as unknown as { __pushStage?: (s: string) => void }).__pushStage?.('APP_MOUNTED')
    } catch {}
  }, [])

  if (isChallenge) {
    return <ChallengeApp adapter={platformAdapter} />
  }

  return <QuizApp telegram={telegram} adapter={platformAdapter} />
}
