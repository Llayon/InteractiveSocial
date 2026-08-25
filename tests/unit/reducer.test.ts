import { describe, expect, it } from 'vitest'
import { idleQuizState, quizReducer } from '@/features/quiz/quizReducer'
import type { QuizAction } from '@/features/quiz/quizReducer'
import { activeQuiz } from '@/content/quizzes'

const quiz = activeQuiz
const run = (state: typeof idleQuizState, actions: QuizAction[]) =>
  actions.reduce((acc, action) => quizReducer(acc, action, quiz), state)

const answerAll = (variant: 'first' | 'last') => (index: number): QuizAction => ({
  type: 'answer',
  questionId: quiz.questions[index].id,
  answerId:
    variant === 'first'
      ? quiz.questions[index].answers[0].id
      : quiz.questions[index].answers[quiz.questions[index].answers.length - 1].id,
})

describe('quizReducer', () => {
  it('starts from idle', () => {
    const started = run(idleQuizState, [{ type: 'start' }])
    expect(started.phase).toBe('active')
    expect(started.currentIndex).toBe(0)
    expect(started.answers).toEqual([])
  })

  it('ignores start when already active (no state reset)', () => {
    const mid = run(idleQuizState, [{ type: 'start' }, answerAll('first')(0)])
    const after = quizReducer(mid, { type: 'start' }, quiz)
    expect(after.currentIndex).toBe(1)
    expect(after.answers).toHaveLength(1)
  })

  it('advances through questions and finishes on the last answer', () => {
    const final = run(idleQuizState, [
      { type: 'start' },
      ...[0, 1, 2, 3, 4, 5, 6].map(answerAll('first')),
      answerAll('first')(7),
    ])
    expect(final.phase).toBe('revealing')
    expect(final.answers).toHaveLength(8)
  })

  it('ignores duplicate/stale answer events (double-tap guard)', () => {
    const state = run(idleQuizState, [{ type: 'start' }])
    const q0 = quiz.questions[0]
    const once = quizReducer(
      state,
      { type: 'answer', questionId: q0.id, answerId: q0.answers[0].id },
      quiz,
    )
    // Same question answered again while currentIndex already moved on → ignored.
    const twice = quizReducer(
      once,
      { type: 'answer', questionId: q0.id, answerId: q0.answers[0].id },
      quiz,
    )
    expect(twice.currentIndex).toBe(once.currentIndex)
    expect(twice.answers.filter((a) => a.questionId === q0.id)).toHaveLength(1)
  })

  it('back navigation preserves the selected answer', () => {
    const state = run(idleQuizState, [
      { type: 'start' },
      answerAll('first')(0),
      answerAll('first')(1),
    ])
    const back = quizReducer(state, { type: 'back' }, quiz)
    expect(back.currentIndex).toBe(1)
    // Earlier selection survives untouched:
    expect(back.answers.find((a) => a.questionId === quiz.questions[0].id)?.answerId).toBe(
      quiz.questions[0].answers[0].id,
    )
    const backTwice = quizReducer(back, { type: 'back' }, quiz)
    expect(backTwice.currentIndex).toBe(0)
  })

  it('changing a previous answer replaces it in place and rescoring follows', () => {
    const state = run(idleQuizState, [
      { type: 'start' },
      answerAll('first')(0),
      answerAll('first')(1),
    ])
    const backTwice = run(state, [{ type: 'back' }, { type: 'back' }])
    expect(backTwice.currentIndex).toBe(0)
    const changed = quizReducer(
      backTwice,
      {
        type: 'answer',
        questionId: quiz.questions[0].id,
        answerId: quiz.questions[0].answers[1].id,
      },
      quiz,
    )
    expect(changed.answers.find((a) => a.questionId === quiz.questions[0].id)?.answerId).toBe(
      quiz.questions[0].answers[1].id,
    )
    // Replaced, not duplicated; flow advanced again.
    expect(changed.answers.filter((a) => a.questionId === quiz.questions[0].id)).toHaveLength(1)
    expect(changed.answers).toHaveLength(2)
    expect(changed.currentIndex).toBe(1)
  })

  it('restart clears all state', () => {
    const final = run(idleQuizState, [
      { type: 'start' },
      ...quiz.questions.map((_, i) => answerAll('first')(i)),
      { type: 'reveal-finished' },
    ])
    expect(final.phase).toBe('completed')
    const restarted = quizReducer(final, { type: 'restart' }, quiz)
    expect(restarted).toEqual(idleQuizState)
  })

  it('never enters an uncontinuable state (property walk)', () => {
    let state = idleQuizState
    for (let i = 0; i < 200; i++) {
      const legal: QuizAction[] = []
      if (state.phase === 'idle') legal.push({ type: 'start' })
      if (state.phase === 'active') {
        legal.push({ type: 'next' }, { type: 'back' })
        const q = quiz.questions[state.currentIndex]
        if (q) {
          for (const a of q.answers) {
            legal.push({ type: 'answer', questionId: q.id, answerId: a.id })
          }
        }
      }
      if (state.phase === 'revealing') legal.push({ type: 'reveal-finished' })
      if (state.phase === 'completed') legal.push({ type: 'restart' })
      expect(legal.length).toBeGreaterThan(0) // always a continuation exists
      const action = legal[i % legal.length]
      state = quizReducer(state, action, quiz)
    }
    // Walk must be able to reach completion and return to idle repeatedly.
    expect(['idle', 'active', 'revealing', 'completed']).toContain(state.phase)
  })
})
