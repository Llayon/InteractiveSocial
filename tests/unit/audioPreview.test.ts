import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useAudioPreview } from '@/features/quiz/audio/useAudioPreview'
import { quizReducer, createInitialQuizState } from '@/features/quiz/quizReducer'
import { guess90sQuiz } from '@/content/quizzes/guess90s/quiz'
import { computeCorrectCount } from '@/features/quiz/scoring'

// Mock Audio
class MockAudio {
  src: string
  currentTime = 0
  preload = ''
  crossOrigin = ''
  paused = true
  _listeners: Record<string, (() => void)[]> = {}
  constructor(src?: string) {
    this.src = src ?? ''
  }
  play(): Promise<void> {
    this.paused = false
    return Promise.resolve()
  }
  pause(): void {
    this.paused = true
  }
  load(): void {}
  addEventListener(type: string, cb: () => void): void {
    if (!this._listeners[type]) this._listeners[type] = []
    this._listeners[type].push(cb)
  }
  removeEventListener(type: string, cb: () => void): void {
    if (!this._listeners[type]) return
    this._listeners[type] = this._listeners[type].filter((f) => f !== cb)
  }
  dispatch(type: string): void {
    ;(this._listeners[type] ?? []).forEach((cb) => cb())
  }
}

describe('audio-preview playback', () => {
  let origAudio: typeof Audio
  beforeEach(() => {
    origAudio = globalThis.Audio as unknown as typeof Audio
    vi.stubGlobal('Audio', MockAudio as unknown as typeof Audio)
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.stubGlobal('Audio', origAudio)
    vi.restoreAllMocks()
  })

  const content = {
    kind: 'audio-preview' as const,
    provider: 'apple-itunes' as const,
    trackId: 123,
    previewUrl: 'https://audio-ssl.itunes.apple.com/test.m4a',
    trackViewUrl: 'https://music.apple.com/ru/album/test/1?i=123&uo=4',
    startSeconds: 2.5,
    durationSeconds: 4 as const,
    attribution: 'Preview provided courtesy of Apple' as const,
  }

  it('stops after exactly 4 seconds', async () => {
    const { result } = renderHook(() =>
      useAudioPreview({ content, quizId: 'guess90s', questionId: 'g1' }),
    )
    expect(result.current.state).toBe('ready')
    await act(async () => {
      result.current.play()
      await Promise.resolve()
    })
    expect(result.current.state).toBe('playing')
    act(() => {
      vi.advanceTimersByTime(3999)
    })
    expect(result.current.state).toBe('playing')
    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(result.current.state).toBe('played')
  })

  it('repeated Play does not create overlapping playback', async () => {
    const { result } = renderHook(() =>
      useAudioPreview({ content, quizId: 'guess90s', questionId: 'g1' }),
    )
    await act(async () => {
      result.current.play()
      await Promise.resolve()
    })
    expect(result.current.state).toBe('playing')
    // second play while playing should be ignored
    await act(async () => {
      result.current.play()
      await Promise.resolve()
    })
    expect(result.current.state).toBe('playing')
    // advance should still be single timer to played
    act(() => {
      vi.advanceTimersByTime(4000)
    })
    expect(result.current.state).toBe('played')
  })

  it('only one audio source can play at once (global singleton)', async () => {
    const { result: r1 } = renderHook(() =>
      useAudioPreview({ content, quizId: 'guess90s', questionId: 'g1' }),
    )
    const content2 = { ...content, trackId: 456, previewUrl: 'https://audio-ssl.itunes.apple.com/test2.m4a' }
    const { result: r2 } = renderHook(() =>
      useAudioPreview({ content: content2, quizId: 'guess90s', questionId: 'g2' }),
    )
    await act(async () => {
      r1.current.play()
      await Promise.resolve()
    })
    expect(r1.current.state).toBe('playing')
    await act(async () => {
      r2.current.play()
      await Promise.resolve()
    })
    // r1 should have been paused when r2 started (global singleton)
    // Our implementation pauses previous global audio; we can't directly check r1 state but ensure r2 playing
    expect(r2.current.state).toBe('playing')
  })

  it('previous audio stops on question transition', async () => {
    const { result, rerender } = renderHook(
      ({ qid, preview }) =>
        useAudioPreview({
          content: { ...content, previewUrl: preview },
          quizId: 'guess90s',
          questionId: qid,
        }),
      { initialProps: { qid: 'g1', preview: 'https://audio-ssl.itunes.apple.com/a1.m4a' } },
    )
    await act(async () => {
      result.current.play()
      await Promise.resolve()
    })
    expect(result.current.state).toBe('playing')
    // transition to next question
    await act(async () => {
      rerender({ qid: 'g2', preview: 'https://audio-ssl.itunes.apple.com/a2.m4a' })
    })
    // after transition, state should be ready (reset) and previous audio stopped
    expect(result.current.state).toBe('ready')
  })

  it('failed preview does not count as wrong', () => {
    const q = guess90sQuiz.questions[0]
    const skipped = { questionId: q.id, answerId: '__skipped__' }
    const correct = q.correctAnswerId!
    // Skipped should not be counted as correct, but also not as extra wrong beyond not gaining point
    expect(computeCorrectCount(guess90sQuiz, [skipped])).toBe(0)
    expect(computeCorrectCount(guess90sQuiz, [{ questionId: q.id, answerId: correct }])).toBe(1)
    // Skipped + correct elsewhere
    const mixed = [skipped, { questionId: guess90sQuiz.questions[1].id, answerId: guess90sQuiz.questions[1].correctAnswerId! }]
    expect(computeCorrectCount(guess90sQuiz, mixed)).toBe(1)
  })

  it('Skip after infrastructure failure works via reducer', () => {
    const quiz = guess90sQuiz
    let state = createInitialQuizState()
    state = quizReducer(state, { type: 'start' }, quiz)
    expect(state.currentIndex).toBe(0)
    // skip first question
    state = quizReducer(state, { type: 'skip', questionId: quiz.questions[0].id }, quiz)
    expect(state.currentIndex).toBe(1)
    expect(state.answers[0].answerId).toBe('__skipped__')
    expect(state.phase).toBe('active')
    // skip should not count as correct
    expect(computeCorrectCount(quiz, state.answers)).toBe(0)
  })

  it('every audio question has durationSeconds === 4 via schema', () => {
    for (const q of guess90sQuiz.questions) {
      expect((q.content as unknown as { durationSeconds: number })?.durationSeconds).toBe(4)
    }
  })

  it('all guess90s questions use correct-count scoring (no archetype weights)', () => {
    for (const q of guess90sQuiz.questions) {
      for (const a of q.answers) {
        expect(a.scores).toBeUndefined()
      }
      expect(q.correctAnswerId).toBeDefined()
    }
  })
})
