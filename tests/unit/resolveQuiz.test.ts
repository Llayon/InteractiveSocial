import { describe, expect, it, vi, afterEach } from 'vitest'
import { quizzes } from '@/content/quizzes'
import { getDefaultQuiz, resolveQuizFromLaunch } from '@/content/quizzes/resolveQuiz'

const interior = quizzes[0]

afterEach(() => {
  vi.restoreAllMocks()
})

describe('resolveQuizFromLaunch', () => {
  it('returns the default quiz when nothing is passed', () => {
    expect(resolveQuizFromLaunch({ startParam: null, search: '' })).toBe(interior)
  })

  it('resolves quiz_<quizId> start param', () => {
    const quiz = resolveQuizFromLaunch({
      startParam: `quiz_${interior.id}`,
      search: '',
    })
    expect(quiz.id).toBe(interior.id)
  })

  it('falls back to the default quiz on unknown quiz_ id (never throws)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const quiz = resolveQuizFromLaunch({ startParam: 'quiz_beauty-aesthetic', search: '' })
    expect(quiz.id).toBe(interior.id)
    expect(warn).toHaveBeenCalledOnce()
  })

  it('routes legacy share_<result>-<uid> to the quiz owning that result', () => {
    const quiz = resolveQuizFromLaunch({ startParam: 'share_italian-847291', search: '' })
    expect(quiz.id).toBe(interior.id)
    expect(quiz.results.some((r) => r.id === 'italian')).toBe(true)
  })

  it('ignores v2 share payloads here (they resolve via the code registry)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    // s2_ payloads must not be matched by result-id heuristics.
    const quiz = resolveQuizFromLaunch({ startParam: 's2_ic_it_847291', search: '' })
    expect(quiz.id).toBe(interior.id)
    expect(warn).not.toHaveBeenCalledWith(expect.stringContaining('s2_'))
  })

  it('supports browser ?quiz=<quizId> selection', () => {
    const quiz = resolveQuizFromLaunch({
      startParam: null,
      search: `?quiz=${interior.id}`,
    })
    expect(quiz.id).toBe(interior.id)
  })

  it('falls back to default on unknown ?quiz= value', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const quiz = resolveQuizFromLaunch({ startParam: null, search: '?quiz=nope' })
    expect(quiz.id).toBe(interior.id)
    expect(warn).toHaveBeenCalledOnce()
  })

  it('gives the Telegram start param precedence over ?quiz=', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const quiz = resolveQuizFromLaunch({
      startParam: `quiz_${interior.id}`,
      search: '?quiz=unknown-quiz',
    })
    expect(quiz.id).toBe(interior.id)
    expect(warn).not.toHaveBeenCalled()
  })
})

describe('getDefaultQuiz', () => {
  it('always returns a validated quiz from the registry', () => {
    expect(getDefaultQuiz().questions.length).toBeGreaterThan(0)
  })
})
