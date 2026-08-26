import { z } from 'zod'

/**
 * Data-driven personality quiz model.
 *
 * The engine knows nothing about interior design: every quiz is pure config
 * validated by this schema at load time (fail-fast on build/startup).
 */

export const answerScoresSchema = z.record(z.string().min(1), z.number().int().positive())

/**
 * Fixed visual weights of the four palette-strip segments (walls / second
 * material / furniture & textile / accent). Identical across every answer so
 * no option gains attention purely through a larger bright area.
 */
export const PALETTE_SEGMENT_PROPORTIONS = [40, 25, 20, 15] as const

export const answerSchema = z.object({
  id: z.string().min(1),
  title: z.string(),
  image: z.string().optional(),
  scores: answerScoresSchema,
  /** Stable asset key, e.g. "q1_a" — used to map future approved imagery. */
  assetKey: z.string().optional(),
  /** Palette cards for visual questions (e.g. q3). */
  paletteLabels: z.array(z.string()).optional(),
  /** Solid hex colors of the strip in left-to-right visual order. */
  paletteSwatches: z.array(z.string().regex(/^#[0-9a-fA-F]{6}$/)).optional(),
})

export type Answer = z.infer<typeof answerSchema>

export const questionLayoutSchema = z.enum(['image-cards', 'palette', 'text', 'compact'])
export type QuestionLayout = z.infer<typeof questionLayoutSchema>

export const questionSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  layout: questionLayoutSchema,
  image: z.string().optional(),
  answers: z.array(answerSchema).min(2),
})

export type Question = z.infer<typeof questionSchema>

export const resultSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  subtitle: z.string().min(1),
  /** Description paragraphs; the first one is rendered as an editorial hook. */
  description: z.array(z.string()).min(1),
  traits: z.array(z.string()).min(1),
  superpower: z.string().min(1),
  redFlag: z.string().min(1),
  recommendation: z.string().min(1),
  shareQuote: z.string().min(1),
  /** Asset key of the pre-generated share card, e.g. "result_quiet". */
  shareImage: z.string().min(1),
})

export type Result = z.infer<typeof resultSchema>

export const tieBreakConfigSchema = z.object({
  /** Stage 2 control question, e.g. "q8". */
  controlQuestionId: z.string().min(1),
  /** Stage 4 ordered fallback questions, e.g. ["q1", "q7", "q5"]. */
  primaryOrderQuestionIds: z.array(z.string().min(1)),
  /** Stage 5 deterministic final order over result ids. */
  fixedResultOrder: z.array(z.string().min(1)),
})

export const revealConfigSchema = z.object({
  steps: z.array(z.string()).min(1),
  stepDurationMs: z.number().int().positive(),
})

export const quizSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  subtitle: z.string().min(1),
  landing: z.object({
    paragraphs: z.array(z.string()).min(1),
    meta: z.array(z.string()),
  }),
  startCta: z.string().min(1),
  shareCtaIntro: z.string().min(1),
  shareCta: z.string().min(1),
  restartCta: z.string().min(1),
  questions: z.array(questionSchema).min(1),
  results: z.array(resultSchema).min(1),
  tieBreak: tieBreakConfigSchema,
  reveal: revealConfigSchema,
})

export type Quiz = z.infer<typeof quizSchema>

/** A single user choice in order of selection. */
export interface SelectedAnswer {
  questionId: string
  answerId: string
}

export class QuizIntegrityError extends Error {}

/**
 * Cross-reference validation: no dangling result ids, unique ids,
 * every result referenced at least once, tie-break config consistent.
 */
export function validateQuizIntegrity(quiz: Quiz): void {
  const resultIds = quiz.results.map((r) => r.id)
  const resultSet = new Set(resultIds)
  if (resultSet.size !== resultIds.length) {
    throw new QuizIntegrityError('Duplicate result ids: ' + resultIds.join(', '))
  }

  const referenced = new Set<string>()
  for (const question of quiz.questions) {
    const answerIds = question.answers.map((a) => a.id)
    if (new Set(answerIds).size !== answerIds.length) {
      throw new QuizIntegrityError(`Duplicate answer ids in ${question.id}`)
    }
    for (const answer of question.answers) {
      for (const resultId of Object.keys(answer.scores)) {
        if (!resultSet.has(resultId)) {
          throw new QuizIntegrityError(
            `Answer ${question.id}/${answer.id} references unknown result "${resultId}"`,
          )
        }
        referenced.add(resultId)
      }
    }
  }

  for (const resultId of resultIds) {
    if (!referenced.has(resultId)) {
      throw new QuizIntegrityError(`Result "${resultId}" is never referenced by any answer`)
    }
  }

  const questionIds = new Set(quiz.questions.map((q) => q.id))
  const tieRefs = [quiz.tieBreak.controlQuestionId, ...quiz.tieBreak.primaryOrderQuestionIds]
  for (const ref of tieRefs) {
    if (!questionIds.has(ref)) {
      throw new QuizIntegrityError(`Tie-break references unknown question "${ref}"`)
    }
  }
  if (new Set(quiz.tieBreak.fixedResultOrder).size !== quiz.tieBreak.fixedResultOrder.length) {
    throw new QuizIntegrityError('fixedResultOrder contains duplicates')
  }
  for (const resultId of quiz.tieBreak.fixedResultOrder) {
    if (!resultSet.has(resultId)) {
      throw new QuizIntegrityError(`fixedResultOrder references unknown result "${resultId}"`)
    }
  }
  if (quiz.tieBreak.fixedResultOrder.length !== resultIds.length) {
    throw new QuizIntegrityError('fixedResultOrder must cover all results')
  }
}

/** Parse + integrity-check a quiz definition. Throws on any inconsistency. */
export function loadQuiz(raw: unknown): Quiz {
  const quiz = quizSchema.parse(raw)
  validateQuizIntegrity(quiz)
  return quiz
}
