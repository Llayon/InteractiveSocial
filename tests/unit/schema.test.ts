import { describe, expect, it } from 'vitest'
import { loadQuiz, quizSchema, validateQuizIntegrity, QuizIntegrityError } from '@/features/quiz/schema'
import type { Quiz } from '@/features/quiz/schema'

const validQuiz: Quiz = {
  id: 'test',
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
      id: 'q1',
      title: 'Question 1',
      layout: 'text',
      answers: [
        { id: 'a', title: 'A', scores: { r1: 2, r2: 1 } },
        { id: 'b', title: 'B', scores: { r2: 2 } },
      ],
    },
    {
      id: 'q2',
      title: 'Question 2',
      layout: 'text',
      answers: [
        { id: 'c', title: 'C', scores: { r1: 2 } },
        { id: 'd', title: 'D', scores: { r2: 2 } },
      ],
    },
  ],
  results: [
    {
      id: 'r1',
      title: 'R1',
      presentation: {
        kind: 'personality',
        subtitle: 's',
        description: ['d'],
        traits: ['t'],
        superpower: 'sp',
        redFlag: 'rf',
        recommendation: 'rec',
        shareQuote: 'q',
      },
      shareImage: 'img_r1',
    },
    {
      id: 'r2',
      title: 'R2',
      presentation: {
        kind: 'personality',
        subtitle: 's',
        description: ['d'],
        traits: ['t'],
        superpower: 'sp',
        redFlag: 'rf',
        recommendation: 'rec',
        shareQuote: 'q',
      },
      shareImage: 'img_r2',
    },
  ],
  scoring: {
    kind: 'archetype',
    tieBreak: {
      controlQuestionId: 'q2',
      primaryOrderQuestionIds: ['q1'],
      fixedResultOrder: ['r1', 'r2'],
    },
  },
  presentation: { kind: 'personality' },
  answerBehavior: { mode: 'instant' },
  reveal: { steps: ['X'], stepDurationMs: 100 },
}

describe('quizSchema', () => {
  it('accepts a well-formed quiz', () => {
    expect(() => quizSchema.parse(validQuiz)).not.toThrow()
  })

  it('rejects a quiz without questions or results', () => {
    expect(quizSchema.safeParse({ ...validQuiz, questions: [] }).success).toBe(false)
    expect(quizSchema.safeParse({ ...validQuiz, results: [] }).success).toBe(false)
  })

  it('rejects non-positive score weights', () => {
    const broken = structuredClone(validQuiz)
    broken.questions[0].answers[0].scores = { r1: -1 }
    expect(quizSchema.safeParse(broken).success).toBe(false)
  })

  it('allows an answer without scores (correct-count quizzes)', () => {
    const quiz = structuredClone(validQuiz)
    delete (quiz.questions[0].answers[0] as { scores?: unknown }).scores
    expect(quizSchema.safeParse(quiz).success).toBe(true)
  })

  it('rejects result ids violating the canonical grammar', () => {
    const broken = structuredClone(validQuiz)
    ;(broken.results[0] as { id: string }).id = 'Bad-Id'
    expect(quizSchema.safeParse(broken).success).toBe(false)
    ;(broken.results[0] as { id: string }).id = 'm90_rookie'
    expect(quizSchema.safeParse(broken).success).toBe(true)
  })
})

describe('validateQuizIntegrity / loadQuiz', () => {
  it('passes for consistent content', () => {
    expect(() => loadQuiz(validQuiz)).not.toThrow()
  })

  it('fails on dangling result reference in answer scores', () => {
    const broken = structuredClone(validQuiz)
    broken.questions[0].answers[0].scores = { ghost: 2 }
    expect(() => loadQuiz(broken)).toThrow(QuizIntegrityError)
    expect(() => validateQuizIntegrity(broken)).toThrow(/unknown result "ghost"/)
  })

  it('fails on duplicate result ids', () => {
    const broken = structuredClone(validQuiz)
    broken.results[1].id = 'r1'
    expect(() => loadQuiz(broken)).toThrow(/Duplicate result ids/)
  })

  it('fails on duplicate answer ids within one question', () => {
    const broken = structuredClone(validQuiz)
    broken.questions[0].answers[1].id = 'a'
    expect(() => loadQuiz(broken)).toThrow(/Duplicate answer ids/)
  })

  it('fails when a result is never referenced by answers', () => {
    const broken = structuredClone(validQuiz)
    broken.questions[0].answers[0].scores = { r2: 2 }
    broken.questions[1].answers[0].scores = { r2: 2 }
    expect(() => loadQuiz(broken)).toThrow(/never referenced/)
  })

  it('fails when tie-break references an unknown question', () => {
    const broken = structuredClone(validQuiz)
    if (broken.scoring.kind !== 'archetype') throw new Error('fixture must be archetype')
    broken.scoring.tieBreak.controlQuestionId = 'q99'
    expect(() => loadQuiz(broken)).toThrow(/unknown question "q99"/)
  })

  it('fails when fixedResultOrder does not cover all results', () => {
    const broken = structuredClone(validQuiz)
    if (broken.scoring.kind !== 'archetype') throw new Error('fixture must be archetype')
    broken.scoring.tieBreak.fixedResultOrder = ['r1']
    expect(() => loadQuiz(broken)).toThrow(/must cover all results/)
  })
})
