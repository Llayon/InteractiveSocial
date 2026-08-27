import { describe, expect, it, vi, afterEach } from 'vitest'
import type { Quiz } from '@/features/quiz/schema'
import { quizzes } from '@/content/quizzes'
import {
  getDefaultQuiz,
  resolveQuizFromLaunch,
  type QuizLaunchContext,
  type QuizLaunchRegistry,
} from '@/content/quizzes/resolveQuiz'

const interior = quizzes[0]

afterEach(() => {
  vi.restoreAllMocks()
})

/**
 * Synthetic two-quiz registry proving real multi-quiz routing. A suite that
 * only ever sees ONE quiz cannot demonstrate this: any fallback trivially
 * equals the default. With two quizzes we assert that a v2 link for quiz B
 * MUST return B and MUST NOT fall through to the default A.
 */
function twoQuizRegistry(): { registry: QuizLaunchRegistry } {
  const makeMini = (id: string): Quiz =>
    ({ id, results: [] }) as unknown as Quiz
  const quizA = makeMini('interior-character')
  const quizB = makeMini('beauty-aesthetic')
  const all = [quizA, quizB]
  const registry: QuizLaunchRegistry = {
    findQuizById: (id) => all.find((q) => q.id === id),
    findQuizByResultId: (resultId) =>
      all.find((q) => q.results.some((r) => r.id === resultId)),
    resolveV2: (quizCode, resultCode) =>
      quizCode === 'be' && resultCode === 'gl'
        ? { quiz: quizB, resultId: 'glow' }
        : quizCode === 'ic' && resultCode === 'it'
          ? { quiz: quizA, resultId: 'italian' }
          : null,
    defaultQuiz: () => quizA,
  }
  return { registry }
}

function launch(startParam: string | null, search = '') {
  return resolveQuizFromLaunch({ startParam, search })
}

describe('resolveQuizFromLaunch (production registry)', () => {
  it('returns the default quiz when nothing is passed', () => {
    expect(launch(null)).toBe(interior)
  })

  it('resolves quiz_<quizId> start param', () => {
    expect(launch(`quiz_${interior.id}`).id).toBe(interior.id)
  })

  it('falls back to the default quiz on unknown quiz_ id (never throws)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(launch('quiz_beauty-aesthetic').id).toBe(interior.id)
    expect(warn).toHaveBeenCalledOnce()
  })

  it('routes legacy share_<result>-<uid> to the quiz owning that result', () => {
    const quiz = launch('share_italian-847291')
    expect(quiz.id).toBe(interior.id)
    expect(quiz.results.some((r) => r.id === 'italian')).toBe(true)
  })

  it('routes v2 s2_ share payload to the owning quiz via the code registry', () => {
    expect(launch('s2_ic_it_847291').id).toBe(interior.id)
  })

  it('falls back to default on an unknown v2 target, with a warning', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(launch('s2_zz_zz_847291').id).toBe(interior.id)
    expect(warn).toHaveBeenCalledTimes(1)
    expect(String(warn.mock.calls[0][0])).toContain('v2')
  })

  it('supports browser ?quiz=<quizId> selection', () => {
    expect(launch(null, `?quiz=${interior.id}`).id).toBe(interior.id)
  })

  it('falls back to default on unknown ?quiz= value', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(launch(null, '?quiz=nope').id).toBe(interior.id)
    expect(warn).toHaveBeenCalledOnce()
  })

  it('gives the Telegram start param precedence over ?quiz=', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(launch(`quiz_${interior.id}`, '?quiz=unknown-quiz').id).toBe(interior.id)
    expect(warn).not.toHaveBeenCalled()
  })
})

describe('resolveQuizFromLaunch with a two-quiz registry', () => {
  function resolveWith(ctx: QuizLaunchContext) {
    const { registry } = twoQuizRegistry()
    return resolveQuizFromLaunch(ctx, registry)
  }

  it('routes v2 beauty link to B, never to the default A', () => {
    const quiz = resolveWith({ startParam: 's2_be_gl_123', search: '' })
    expect(quiz.id).toBe('beauty-aesthetic')
    expect(quiz.id).not.toBe('interior-character')
  })

  it('routes v2 interior link to A', () => {
    expect(resolveWith({ startParam: 's2_ic_it_123', search: '' }).id).toBe('interior-character')
  })

  it('routes quiz_<B-id> to B (independent of codes)', () => {
    expect(resolveWith({ startParam: 'quiz_beauty-aesthetic', search: '' }).id).toBe(
      'beauty-aesthetic',
    )
  })

  it('falls back to default A for an unknown v2 target', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(resolveWith({ startParam: 's2_zz_zz_123', search: '' }).id).toBe(
      'interior-character',
    )
    expect(warn).toHaveBeenCalledOnce()
  })
})

describe('getDefaultQuiz', () => {
  it('always returns a validated quiz from the registry', () => {
    expect(getDefaultQuiz().questions.length).toBeGreaterThan(0)
  })
})
