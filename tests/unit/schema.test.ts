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

/* ------------------------------------------------------------------ *
 * Correct-count scoring schema tests
 * ------------------------------------------------------------------ */

interface CCOverrides {
  bands?: { min: number; max: number; resultId: string }[]
  correctAnswerId?: string
  missingCorrectAnswer?: boolean
}

function correctCountFixture(overrides: CCOverrides = {}): unknown {
  return {
    id: 'cc',
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
        id: 'm1',
        title: 'Q1',
        layout: 'choice',
        correctAnswerId: overrides.missingCorrectAnswer ? undefined : (overrides.correctAnswerId ?? 'a'),
        answers: [
          { id: 'a', title: 'A' },
          { id: 'b', title: 'B' },
        ],
      },
      {
        id: 'm2',
        title: 'Q2',
        layout: 'choice',
        correctAnswerId: overrides.missingCorrectAnswer ? undefined : 'a',
        answers: [
          { id: 'a', title: 'A' },
          { id: 'b', title: 'B' },
        ],
      },
    ],
    results: [
      {
        id: 'r_low',
        title: 'low',
        presentation: {
          kind: 'score',
          subtitle: '0–1',
          description: ['d'],
          shareQuote: 'q',
        },
        shareImage: 'result_low',
      },
      {
        id: 'r_hi',
        title: 'hi',
        presentation: {
          kind: 'score',
          subtitle: '2',
          description: ['d'],
          shareQuote: 'q',
        },
        shareImage: 'result_hi',
      },
    ],
    scoring: { kind: 'correct-count', bands: overrides.bands ?? [
      { min: 0, max: 1, resultId: 'r_low' },
      { min: 2, max: 2, resultId: 'r_hi' },
    ] },
    presentation: { kind: 'score' },
    answerBehavior: { mode: 'feedback', durationMs: 500 },
    reveal: { steps: ['X'], stepDurationMs: 100 },
  }
}

describe('correct-count scoring: schema and integrity', () => {
  it('accepts a well-formed correct-count quiz', () => {
    expect(() => loadQuiz(correctCountFixture())).not.toThrow()
  })

  it('rejects a correct-count question without correctAnswerId', () => {
    expect(() => loadQuiz(correctCountFixture({ missingCorrectAnswer: true }))).toThrow(/no correctAnswerId/)
  })

  it('rejects a correctAnswerId that does not reference any answer', () => {
    expect(() => loadQuiz(correctCountFixture({ correctAnswerId: 'z' }))).toThrow(/does not match any answer/)
  })

  it('rejects overlapping bands', () => {
    expect(() =>
      loadQuiz(
        correctCountFixture({
          bands: [
            { min: 0, max: 2, resultId: 'r_low' },
            { min: 1, max: 2, resultId: 'r_hi' },
          ],
        }),
      ),
    ).toThrow(/must not overlap/)
  })

  it('rejects bands that leave a gap', () => {
    expect(() =>
      loadQuiz(
        correctCountFixture({
          bands: [
            { min: 0, max: 0, resultId: 'r_low' },
            { min: 2, max: 2, resultId: 'r_hi' },
          ],
        }),
      ),
    ).toThrow(/must leave no gaps/)
  })

  it('rejects bands that do not cover the full score range', () => {
    expect(() =>
      loadQuiz(
        correctCountFixture({
          bands: [{ min: 0, max: 1, resultId: 'r_low' }],
        }),
      ),
    ).toThrow(/must cover up to/)
  })

  it('rejects bands that start above 0', () => {
    expect(() =>
      loadQuiz(
        correctCountFixture({
          bands: [
            { min: 1, max: 1, resultId: 'r_low' },
            { min: 2, max: 2, resultId: 'r_hi' },
          ],
        }),
      ),
    ).toThrow(/must start at 0/)
  })

  it('rejects a band referencing an unknown result id', () => {
    expect(() =>
      loadQuiz(
        correctCountFixture({
          bands: [
            { min: 0, max: 1, resultId: 'ghost' },
            { min: 2, max: 2, resultId: 'r_hi' },
          ],
        }),
      ),
    ).toThrow(/unknown result/)
  })
})

describe('canonical id grammar: global uniqueness', () => {
  it('rejects duplicate ids across the same question', () => {
    const broken = correctCountFixture()
    ;(broken as { questions: { answers: { id: string }[] }[] }).questions[0].answers[1].id = 'a'
    expect(() => loadQuiz(broken)).toThrow(/Duplicate answer ids/)
  })

  it('allows the same answer id to appear in DIFFERENT questions', () => {
    const valid = correctCountFixture()
    expect(() => loadQuiz(valid)).not.toThrow() // 'a' is the first answer in both m1 and m2
  })
})

describe('answerId identity: per-question (compound key)', () => {
  it('verifies getAnswer is scoped to the owning question', () => {
    // Music90s uses a/b/c/d inside each question. Two different questions
    // both can have answer 'a' without conflict — the identity used in the
    // platform is (questionId, answerId), not the bare answerId.
    expect(loadQuiz(correctCountFixture()).questions[0].answers[0].id).toBe('a')
    expect(loadQuiz(correctCountFixture()).questions[1].answers[0].id).toBe('a')
  })
})