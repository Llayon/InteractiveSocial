import { useCallback, useEffect, useRef, useState } from 'react'
import { getAnalytics } from '@/analytics/analytics'
import type { AudioPreviewContent } from '../schema'

export type AudioState = 'ready' | 'loading' | 'playing' | 'played' | 'error'
export type AudioErrorType = 'preview_load_error' | 'preview_play_error' | 'preview_timeout' | null

let globalActiveAudio: HTMLAudioElement | null = null

function stopGlobalAudio(except: HTMLAudioElement | null) {
  if (globalActiveAudio && globalActiveAudio !== except) {
    try {
      globalActiveAudio.pause()
    } catch {}
    // do not clear src; just pause
  }
}

export interface UseAudioPreviewOptions {
  content?: AudioPreviewContent
  quizId: string
  questionId: string
}

export interface UseAudioPreviewReturn {
  state: AudioState
  errorType: AudioErrorType
  hasReplayed: boolean
  play: () => void
  replay: () => void
  retry: () => void
  reset: () => void
}

/**
 * Generic audio-preview playback hook.
 * Branches on content.kind only; knows nothing about quiz.id.
 * Guarantees:
 * - exactly 4s playback via timeout
 * - single active Audio at a time (global singleton)
 * - no overlapping playback on repeated play
 * - cleanup on unmount / content change
 */
export function useAudioPreview(options: UseAudioPreviewOptions): UseAudioPreviewReturn {
  const { content, quizId, questionId } = options
  const [state, setState] = useState<AudioState>('ready')
  const [errorType, setErrorType] = useState<AudioErrorType>(null)
  const [hasReplayed, setHasReplayed] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const timeoutRef = useRef<number | null>(null)
  const loadTimeoutRef = useRef<number | null>(null)

  const clearTimers = useCallback(() => {
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    if (loadTimeoutRef.current !== null) {
      clearTimeout(loadTimeoutRef.current)
      loadTimeoutRef.current = null
    }
  }, [])

  const stopAndCleanup = useCallback(() => {
    clearTimers()
    if (audioRef.current) {
      try {
        audioRef.current.pause()
      } catch {}
      // keep element for replay but remove global reference if ours
      if (globalActiveAudio === audioRef.current) {
        globalActiveAudio = null
      }
    }
  }, [clearTimers])

  // Stop on content change / unmount / quiz exit
  useEffect(() => {
    return () => {
      stopAndCleanup()
    }
  }, [stopAndCleanup])

  // When question or content changes, reset state and stop previous audio
  useEffect(() => {
    stopAndCleanup()
    // abort previous audio element if question changed - do NOT set src='' as it triggers error event
    if (audioRef.current) {
      try {
        audioRef.current.pause()
        // detach error listener to prevent stale error after unmount
        // (listeners are per-element, discarding element is enough)
      } catch {}
      audioRef.current = null
    }
    if (globalActiveAudio) {
      try { globalActiveAudio.pause() } catch {}
      globalActiveAudio = null
    }
    // Reset to ready on question change - intentional state reset
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState('ready')
    setErrorType(null)
    setHasReplayed(false)
  }, [questionId, content?.previewUrl, stopAndCleanup])

  const getOrCreateAudio = useCallback(() => {
    if (!content) return null
    if (audioRef.current) return audioRef.current
    const audio = new Audio(content.previewUrl)
    audio.preload = 'auto'
    audio.crossOrigin = 'anonymous'
    // error handling
    const onError = () => {
      clearTimers()
      setState('error')
      setErrorType('preview_load_error')
      try {
        getAnalytics().track('audio_error', {
          quiz_id: quizId,
          question_id: questionId,
          track_id: content.trackId,
          error_type: 'preview_load_error',
        })
      } catch {}
    }
    audio.addEventListener('error', onError)
    audioRef.current = audio
    return audio
  }, [content, quizId, questionId, clearTimers])

  const startPlayback = useCallback(
    (isReplay: boolean) => {
      if (!content) return
      if (state === 'playing') return // prevent duplicate playback
      // stop previous global audio before starting new
      if (globalActiveAudio && globalActiveAudio !== audioRef.current) {
        try { globalActiveAudio.pause() } catch {}
      }
      const audio = getOrCreateAudio()
      if (!audio) return

      // If we already have an audio that is playing, don't create overlapping
      // Ensure only one audio source can play at once
      stopGlobalAudio(audio)
      globalActiveAudio = audio

      setState('loading')
      setErrorType(null)
      try {
        getAnalytics().track(isReplay ? 'audio_replay' : 'audio_play', {
          quiz_id: quizId,
          question_id: questionId,
          track_id: content.trackId,
        })
      } catch {}

      // loading timeout: if not playing within 8s, error
      loadTimeoutRef.current = window.setTimeout(() => {
        // use DOM state instead of React state (avoid stale closure)
        if (audio.paused) {
          setState('error')
          setErrorType('preview_timeout')
          try {
            getAnalytics().track('audio_error', {
              quiz_id: quizId,
              question_id: questionId,
              track_id: content.trackId,
              error_type: 'preview_timeout',
            })
          } catch {}
          try { audio.pause() } catch {}
        }
      }, 8000) as unknown as number

      const doPlay = () => {
        try {
          audio.currentTime = content.startSeconds
        } catch {}
        const playPromiseInner = audio.play()
        if (playPromiseInner && typeof playPromiseInner.then === 'function') {
          playPromiseInner
            .then(() => {
              clearTimers()
              // ensure startSeconds still applied after play started (some browsers reset)
              try { if (Math.abs(audio.currentTime - content.startSeconds) > 0.5) audio.currentTime = content.startSeconds } catch {}
              setState('playing')
              try {
                getAnalytics().track('audio_started', {
                  quiz_id: quizId,
                  question_id: questionId,
                  track_id: content.trackId,
                })
              } catch {}
              // Exactly 4s window
              timeoutRef.current = window.setTimeout(() => {
                try { audio.pause() } catch {}
                try { audio.currentTime = content.startSeconds } catch {}
                setState('played')
                if (globalActiveAudio === audio) globalActiveAudio = null
                try {
                  getAnalytics().track('audio_complete_4s', {
                    quiz_id: quizId,
                    question_id: questionId,
                    track_id: content.trackId,
                  })
                } catch {}
              }, 4000) as unknown as number
              if (isReplay) setHasReplayed(true)
            })
            .catch(() => {
              clearTimers()
              setState('error')
              setErrorType('preview_play_error')
              try {
                getAnalytics().track('audio_error', {
                  quiz_id: quizId,
                  question_id: questionId,
                  track_id: content.trackId,
                  error_type: 'preview_play_error',
                })
              } catch {}
            })
        } else {
          clearTimers()
          setState('playing')
          timeoutRef.current = window.setTimeout(() => {
            try { audio.pause() } catch {}
            try { audio.currentTime = content.startSeconds } catch {}
            setState('played')
          }, 4000) as unknown as number
          if (isReplay) setHasReplayed(true)
        }
      }

      // If metadata not yet loaded, wait for it before seeking/playing to avoid InvalidStateError
      // readyState: 0=HAVE_NOTHING, 1=HAVE_METADATA
      if (audio.readyState === 0) {
        const onLoaded = () => {
          audio.removeEventListener('loadedmetadata', onLoaded)
          audio.removeEventListener('canplay', onLoaded)
          doPlay()
        }
        audio.addEventListener('loadedmetadata', onLoaded)
        audio.addEventListener('canplay', onLoaded)
        // Trigger load if needed
        try { audio.load() } catch {}
        return
      }
      doPlay()
    },
    [content, quizId, questionId, state, getOrCreateAudio, clearTimers],
  )

  const play = useCallback(() => startPlayback(false), [startPlayback])
  const replay = useCallback(() => startPlayback(true), [startPlayback])
  const retry = useCallback(() => {
    setState('ready')
    setErrorType(null)
    // reset audio element to allow fresh load
    if (audioRef.current) {
      try { audioRef.current.pause(); audioRef.current.currentTime = content?.startSeconds ?? 0 } catch {}
    }
    startPlayback(false)
  }, [content, startPlayback])

  const reset = useCallback(() => {
    stopAndCleanup()
    setState('ready')
    setErrorType(null)
    setHasReplayed(false)
  }, [stopAndCleanup])

  return { state, errorType, hasReplayed, play, replay, retry, reset }
}
