import { describe, expect, it } from 'vitest'
import {
  codesForQuiz,
  quizCodeFor,
  resolveResultByCode,
  resultCodeFor,
} from '@/content/quizzes/codes'
import { resolveQuizRequest } from '../../api/_lib/quizRequest.js'

describe('quiz wire codes (v2 protocol registry)', () => {
  it('maps interior-character ids to their approved wire codes', () => {
    expect(codesForQuiz('interior-character')).toEqual({
      quizCode: 'ic',
      results: {
        quiet: 'qt',
        paris: 'pa',
        italian: 'it',
        collector: 'co',
        cottage: 'ct',
        scandi: 'sc',
      },
    })
  })

  it('resolves v2 code pairs back to quiz/result', () => {
    const resolved = resolveResultByCode('ic', 'ct')
    expect(resolved?.quiz.id).toBe('interior-character')
    expect(resolved?.resultId).toBe('cottage')
    expect(resolveResultByCode('zz', 'zz')).toBeNull()
    expect(resolveResultByCode('ic', 'zz')).toBeNull()
  })

  it('throws on unknown ids (fail-fast, never silent)', () => {
    expect(() => quizCodeFor('nope')).toThrow()
    expect(() => resultCodeFor('interior-character', 'nope')).toThrow()
    expect(codesForQuiz('nope')).toBeNull()
  })

  it('keeps every registered result covered by codes', () => {
    const codes = codesForQuiz('interior-character')
    expect(Object.keys(codes?.results ?? {})).toHaveLength(6)
  })
})

describe('resolveQuizRequest (server-side api resolution)', () => {
  it('resolves an explicit quizId + resultId pair', () => {
    const resolved = resolveQuizRequest('interior-character', 'paris')
    expect(resolved.ok).toBe(true)
    if (resolved.ok) {
      expect(resolved.selection.quiz.id).toBe('interior-character')
      expect(resolved.selection.result.id).toBe('paris')
    }
  })

  it('rejects unknown quiz ids with invalid_quiz', () => {
    const resolved = resolveQuizRequest('beauty-aesthetic', 'paris')
    expect(resolved).toEqual({ ok: false, error: 'invalid_quiz' })
  })

  it('rejects a result that belongs to another quiz with missing_result', () => {
    const resolved = resolveQuizRequest('interior-character', 'not-a-result')
    expect(resolved).toEqual({ ok: false, error: 'missing_result' })
  })

  it('falls back to the default quiz when quizId is omitted (legacy clients)', () => {
    const resolved = resolveQuizRequest(undefined, 'quiet')
    expect(resolved.ok).toBe(true)
    if (resolved.ok) expect(resolved.selection.quiz.id).toBe('interior-character')
  })
})
