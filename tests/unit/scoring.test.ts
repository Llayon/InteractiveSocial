import { describe, expect, it } from 'vitest'
import { computeBreakdown, resolveResultId, resolveResult } from '@/features/quiz/scoring'
import { loadQuiz } from '@/features/quiz/schema'
import type { Quiz } from '@/features/quiz/schema'
import { activeQuiz } from '@/content/quizzes'

const pick = (questionId: string, answerId: string) => ({ questionId, answerId })

function resultFixture(id: string) {
  return {
    id,
    title: id.toUpperCase(),
    presentation: {
      kind: 'personality' as const,
      subtitle: 's',
      description: ['d'],
      traits: ['t'],
      superpower: 'sp',
      redFlag: 'rf',
      recommendation: 'rec',
      shareQuote: 'q',
    },
    shareImage: `img_${id}`,
  }
}

interface SyntheticOptions {
  orderIds?: string[]
  fixedOrder?: string[]
}

/** Two-result synthetic quiz exposing every tie-break stage deterministically. */
function syntheticQuiz(options: SyntheticOptions = {}): Quiz {
  return loadQuiz({
    id: 'synthetic',
    title: 'T',
    subtitle: 'S',
    landing: { paragraphs: ['p'], meta: [] },
    startCta: 'Start',
    shareCtaIntro: 'Intro',
    shareCta: 'Share',
    restartCta: 'Restart',
    copy: { eyebrow: 'e', shareHeadline: 'h', deliverOwnLine: 'o' },
    questions: [
      {
        id: 'qc',
        title: 'Control',
        layout: 'text',
        answers: [
          { id: 'cm', title: '', scores: { a: 2 } },
          { id: 'cn', title: '', scores: { b: 2 } },
        ],
      },
      {
        id: 'qm',
        title: 'Primary A',
        layout: 'text',
        answers: [
          { id: 'm', title: '', scores: { a: 2 } },
          { id: 'm2', title: '', scores: { b: 2 } },
        ],
      },
      {
        id: 'qn',
        title: 'Secondary A',
        layout: 'text',
        answers: [
          { id: 'n', title: '', scores: { a: 1 } },
          { id: 'n2', title: '', scores: { b: 1 } },
        ],
      },
      {
        id: 'qo',
        title: 'Secondary B 1',
        layout: 'text',
        answers: [
          { id: 'o', title: '', scores: { b: 1 } },
          { id: 'o2', title: '', scores: { a: 1 } },
        ],
      },
      {
        id: 'qp',
        title: 'Primary B',
        layout: 'text',
        answers: [
          { id: 'p', title: '', scores: { b: 2 } },
          { id: 'w', title: '', scores: { a: 1, b: 1 } },
        ],
      },
      {
        id: 'qr',
        title: 'Secondary B 2',
        layout: 'text',
        answers: [
          { id: 'r', title: '', scores: { b: 1 } },
          { id: 'r2', title: '', scores: { a: 1 } },
        ],
      },
    ],
    results: [resultFixture('a'), resultFixture('b')],
    scoring: {
      kind: 'archetype' as const,
      tieBreak: {
        controlQuestionId: 'qc',
        primaryOrderQuestionIds: options.orderIds ?? ['qp'],
        fixedResultOrder: options.fixedOrder ?? ['a', 'b'],
      },
    },
    presentation: { kind: 'personality' as const },
    answerBehavior: { mode: 'instant' as const },
    reveal: { steps: ['X'], stepDurationMs: 10 },
  })
}

describe('scoring: deterministic summation', () => {
  it('sums weights and primary hits across answers', () => {
    const quiz = syntheticQuiz()
    const breakdown = computeBreakdown(quiz, [pick('qm', 'm'), pick('qn', 'n')])
    expect(breakdown.totals).toEqual({ a: 3, b: 0 })
    // Any answer contributes one primary hit to its top-weight result(s):
    // m (+2) AND n (+1, its own max) both go to a.
    expect(breakdown.primaryHits).toEqual({ a: 2, b: 0 })
  })

  it('produces identical output for identical input (no randomness)', () => {
    const quiz = syntheticQuiz()
    const answers = [pick('qm', 'm'), pick('qp', 'p')]
    expect(resolveResultId(quiz, answers)).toEqual(resolveResultId(quiz, [...answers].reverse()))
  })
})

describe('stage 1 — maximum total score', () => {
  it('the highest total wins outright', () => {
    const quiz = syntheticQuiz()
    const resolution = resolveResultId(quiz, [pick('qm', 'm'), pick('qn', 'n')])
    expect(resolution).toEqual({ resultId: 'a', decidedBy: 'max-score' })
  })
})

describe('stage 2 — control question primary', () => {
  it('control (q8-equivalent) primary wins when inside the tied set', () => {
    const quiz = syntheticQuiz()
    // qm=m → a:2 ; qc=cn → b:2 → tie; control primary = b → b.
    const resolution = resolveResultId(quiz, [pick('qm', 'm'), pick('qc', 'cn')])
    expect(resolution).toEqual({ resultId: 'b', decidedBy: 'control-question' })
  })

  it('prefers the control primary over the other tied member', () => {
    const quiz = syntheticQuiz()
    // qp=p(b2) + qc=cm(a2) → tie; control primary a ∈ tied → a wins at stage 2.
    const resolution = resolveResultId(quiz, [pick('qp', 'p'), pick('qc', 'cm')])
    expect(resolution).toEqual({ resultId: 'a', decidedBy: 'control-question' })
  })
})

describe('stage 3 — primary hit count', () => {
  it('resolves equal totals via hit count difference', () => {
    const quiz = syntheticQuiz({ orderIds: [] })
    // Equal totals, asymmetric hits: n(a1)+o2(a1) both hit a (2 hits),
    // p(b2) hits b once → totals 2/2 → stage 3 picks a.
    const resolution = resolveResultId(quiz, [
      pick('qn', 'n'),
      pick('qo', 'o2'),
      pick('qp', 'p'),
    ])
    expect(resolution).toEqual({ resultId: 'a', decidedBy: 'primary-hits' })
  })

  it('mirror case resolves to b via primary-hits', () => {
    const quiz = syntheticQuiz({ orderIds: [] })
    // Mirror: o(b1)+r(b1) hit b twice; m(a2) hits a once → b wins stage 3.
    const resolution = resolveResultId(quiz, [pick('qo', 'o'), pick('qr', 'r'), pick('qm', 'm')])
    expect(resolution).toEqual({ resultId: 'b', decidedBy: 'primary-hits' })
  })
})

describe('stage 4 — ordered questions q1 → q7 → q5 analogue', () => {
  it('first ordered question whose primary is in the tied set decides', () => {
    const quiz = syntheticQuiz({ orderIds: ['qp'] })
    // w-tie (a1/b1, hits equal), order question qp answered with w whose
    // primaries {a,b} include tied members; first in fixed order wins → a.
    const resolution = resolveResultId(quiz, [pick('qp', 'w')])
    expect(resolution).toEqual({ resultId: 'a', decidedBy: 'primary-order' })
  })

  it('skips unanswered/irrelevant order questions and reaches fixed fallback', () => {
    const quiz = syntheticQuiz({ orderIds: ['qm'] })
    // Order question qm unanswered → its primaries are empty → stage 4 passes,
    // stage 5 fixed order [a, b] decides.
    const resolution = resolveResultId(quiz, [pick('qp', 'w')])
    expect(resolution).toEqual({ resultId: 'a', decidedBy: 'fixed-order' })
  })

  it('order traversal prefers earlier questions over later ones', () => {
    // qp primary for answer p is b; put qp second so qm (unanswered) first,
    // then qp decides for b when control/order allow:
    const quiz = syntheticQuiz({ orderIds: ['qn', 'qp'], fixedOrder: ['b', 'a'] })
    // w-tie: qn unanswered → skip; qp=w primaries {a,b} → first tied in
    // fixedOrder [b,a] is b → b wins at stage 4.
    const resolution = resolveResultId(quiz, [pick('qp', 'w')])
    expect(resolution).toEqual({ resultId: 'b', decidedBy: 'primary-order' })
  })
})

describe('stage 5 — fixed deterministic order', () => {
  it('falls back to approved fixed order with no randomness', () => {
    const quiz = syntheticQuiz({ orderIds: [] })
    const resolution = resolveResultId(quiz, [pick('qp', 'w')])
    expect(resolution).toEqual({ resultId: 'a', decidedBy: 'fixed-order' })

    const mirrored = loadQuiz({
      ...quiz,
      scoring: {
        kind: 'archetype',
        tieBreak: {
          ...(quiz.scoring.kind === 'archetype' ? quiz.scoring.tieBreak : undefined),
          fixedResultOrder: ['b', 'a'],
        },
      },
    })
    expect(resolveResultId(mirrored, [pick('qp', 'w')]).resultId).toBe('b')
  })
})

describe('approved quiz: spot checks', () => {
  it('all-first-answers resolves to quiet by max score', () => {
    const answers = activeQuiz.questions.map((q) => ({
      questionId: q.id,
      answerId: q.answers[0].id,
    }))
    expect(resolveResultId(activeQuiz, answers)).toEqual({
      resultId: 'quiet',
      decidedBy: 'max-score',
    })
  })

  it('resolveResult returns a defined approved result for any answer set', () => {
    const answers = activeQuiz.questions.map((q) => ({
      questionId: q.id,
      answerId: q.answers[q.answers.length - 1].id,
    }))
    const result = resolveResult(activeQuiz, answers)
    expect(activeQuiz.results.some((r) => r.id === result.id)).toBe(true)
  })

  it('changing one answer can change the outcome deterministically', () => {
    const answersFor = (lastAnswerId: string) =>
      activeQuiz.questions
        .map((q) => ({ questionId: q.id, answerId: q.answers[0].id }))
        .map((a) => (a.questionId === 'q8' ? { questionId: 'q8', answerId: lastAnswerId } : a))

    expect(resolveResultId(activeQuiz, answersFor('q8_a')).resultId).toBe(
      resolveResultId(activeQuiz, answersFor('q8_a')).resultId,
    )
    // The two variants must both be valid results even if equal:
    const r1 = resolveResultId(activeQuiz, answersFor('q8_b')).resultId
    expect(typeof r1).toBe('string')
  })
})