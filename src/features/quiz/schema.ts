import { z } from 'zod'

/**
 * Generic quiz model.
 *
 * The engine knows nothing about interiors OR music: every quiz is pure
 * config validated by this schema at load time (fail-fast on build/startup).
 *
 * Mechanics are chosen by explicit discriminator config:
 *   - scoring.kind        = 'archetype' | 'correct-count'
 *   - presentation.kind   = 'personality' | 'score'
 *   - answerBehavior.mode = 'instant' | 'feedback'
 * Runtime dispatch depends on these discriminators, never on quiz.id.
 */

/** Canonical result-id grammar shared by every quiz (globally namespaced). */
export const RESULT_ID_REGEX = /^[a-z][a-z0-9_]{0,63}$/

/** Shared validator used by schema, registry, prepare/deliver and tests. */
export const resultIdSchema = z
  .string()
  .regex(RESULT_ID_REGEX, 'result id must match ^[a-z][a-z0-9_]{0,63}$')

export const answerScoresSchema = z.record(z.string().min(1), z.number().int().positive())

/**
 * Fixed visual weights of the four palette-strip segments. Identical across
 * every answer so no option gains attention through a larger bright area.
 */
export const PALETTE_SEGMENT_PROPORTIONS = [40, 25, 20, 15] as const

export const answerSchema = z.object({
  id: z.string().min(1),
  title: z.string(),
  image: z.string().optional(),
  /**
   * Archetype weights. Only meaningful for scoring.kind === 'archetype'.
   * Correct-count answers carry no weights: the correct answer is declared
   * per question via question.correctAnswerId.
   */
  scores: answerScoresSchema.optional(),
  /** Stable asset key, e.g. "q1_a" — maps approved imagery. */
  assetKey: z.string().optional(),
  paletteLabels: z.array(z.string()).optional(),
  paletteSwatches: z.array(z.string().regex(/^#[0-9a-fA-F]{6}$/)).optional(),
})

export type Answer = z.infer<typeof answerSchema>

export const questionLayoutSchema = z.enum([
  'image-cards',
  'palette',
  'text',
  'compact',
  'choice',
  'comparison',
])
export type QuestionLayout = z.infer<typeof questionLayoutSchema>

export const difficultySchema = z.enum(['easy', 'medium', 'hard'])
export type Difficulty = z.infer<typeof difficultySchema>

export const audioPreviewContentSchema = z.object({
  kind: z.literal('audio-preview'),
  provider: z.literal('apple-itunes'),
  trackId: z.number().int().positive(),
  previewUrl: z.string().url(),
  trackViewUrl: z.string().url(),
  startSeconds: z.number().nonnegative(),
  durationSeconds: z.literal(4),
  attribution: z.literal('Preview provided courtesy of Apple'),
  /** Display metadata revealed only after answer (never before to avoid spoilers). */
  trackTitle: z.string().min(1).optional(),
  artistName: z.string().min(1).optional(),
})

export type AudioPreviewContent = z.infer<typeof audioPreviewContentSchema>

export const questionContentSchema = z.discriminatedUnion('kind', [audioPreviewContentSchema])

export type QuestionContent = z.infer<typeof questionContentSchema>

export const questionFeedbackSchema = z.object({
  correct: z.string().min(1),
  wrong: z.string().min(1),
})
export type QuestionFeedback = z.infer<typeof questionFeedbackSchema>

export const questionSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  layout: questionLayoutSchema,
  /**
   * Content metadata category (e.g. 'emoji', 'artist', 'timeline').
   * Advisory only — rendering is driven by `layout`, never by category.
   */
  category: z.string().optional(),
  difficulty: difficultySchema.optional(),
  /**
   * The single correct answer for correct-count quizzes. Must reference an
   * answer of THIS question (validated). Answer ids are scoped per question,
   * so 'a'/'b'/'c'/'d' may repeat across different questions.
   */
  correctAnswerId: z.string().optional(),
  image: z.string().optional(),
  content: questionContentSchema.optional(),
  feedback: questionFeedbackSchema.optional(),
  answers: z.array(answerSchema).min(2),
})

export type Question = z.infer<typeof questionSchema>
/* ------------------------------------------------------------------ *
 * Presentation (result schema)
 * ------------------------------------------------------------------ */

export const personalityPresentationSchema = z.object({
  kind: z.literal('personality'),
  subtitle: z.string().min(1),
  /** First paragraph renders as the editorial hook. */
  description: z.array(z.string()).min(1),
  traits: z.array(z.string()).min(1),
  superpower: z.string().min(1),
  redFlag: z.string().min(1),
  recommendation: z.string().min(1),
  shareQuote: z.string().min(1),
})

export const scorePresentationSchema = z.object({
  kind: z.literal('score'),
  subtitle: z.string().min(1),
  description: z.array(z.string()).min(1),
  shareQuote: z.string().min(1),
  /** Result-screen CTA label (e.g. "Бросить вызов"). */
  shareCta: z.string().optional(),
})

export const presentationSchema = z.discriminatedUnion('kind', [
  personalityPresentationSchema,
  scorePresentationSchema,
])
export type QuizPresentation = z.infer<typeof presentationSchema>
export type PersonalityPresentation = z.infer<typeof personalityPresentationSchema>
export type ScorePresentation = z.infer<typeof scorePresentationSchema>

export const resultSchema = z.object({
  id: resultIdSchema,
  title: z.string().min(1),
  presentation: presentationSchema,
  /** Pre-generated share/transport image key (e.g. "result_quiet"). */
  shareImage: z.string().min(1),
})

export type Result = z.infer<typeof resultSchema>

/* ------------------------------------------------------------------ *
 * Scoring config
 * ------------------------------------------------------------------ */

export const tieBreakConfigSchema = z.object({
  /** Stage 2 control question, e.g. "q8". */
  controlQuestionId: z.string().min(1),
  /** Stage 4 ordered fallback questions, e.g. ["q1", "q7", "q5"]. */
  primaryOrderQuestionIds: z.array(z.string().min(1)),
  /** Stage 5 deterministic final order over result ids. */
  fixedResultOrder: z.array(z.string().min(1)),
})

export const archetypeScoringSchema = z.object({
  kind: z.literal('archetype'),
  tieBreak: tieBreakConfigSchema,
})

export const scoreBandSchema = z.object({
  /** Inclusive lower bound. */
  min: z.number().int().nonnegative(),
  /** Inclusive upper bound. */
  max: z.number().int().nonnegative(),
  resultId: z.string().min(1),
})
export type ScoreBand = z.infer<typeof scoreBandSchema>

export const correctCountScoringSchema = z.object({
  kind: z.literal('correct-count'),
  /** Maps raw correct count to exactly one result id; validated to cover
   *  0..total with no gaps/overlaps at load time. */
  bands: z.array(scoreBandSchema).min(1),
})

export const scoringConfigSchema = z.discriminatedUnion('kind', [
  archetypeScoringSchema,
  correctCountScoringSchema,
])
export type ScoringConfig = z.infer<typeof scoringConfigSchema>

/** Result-card presentation mode for the whole quiz. */
export const quizPresentationConfigSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('personality') }),
  z.object({ kind: z.literal('score') }),
])
export type QuizPresentationConfig = z.infer<typeof quizPresentationConfigSchema>

/** Instant = immediate advance; feedback = locked ✓/✕ barrier then advance. */
export const answerBehaviorSchema = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('instant') }),
  z.object({
    mode: z.literal('feedback'),
    durationMs: z.number().int().positive(),
    /** Quiz-owned feedback copy (kept out of generic runtime). */
    correctMessage: z.string().min(1).optional(),
    wrongMessage: z.string().min(1).optional(),
  }),
])
export type AnswerBehavior = z.infer<typeof answerBehaviorSchema>

export const revealConfigSchema = z.object({
  steps: z.array(z.string()).min(1),
  stepDurationMs: z.number().int().positive(),
})

/* ------------------------------------------------------------------ *
 * Channel promotion — optional generic author/channel funnel config
 * ------------------------------------------------------------------ */

export const channelPromotionSchema = z.object({
  authorName: z.string().min(1),
  landingAttribution: z.string().min(1).optional(),
  resultIntro: z.string().min(1).optional(),
  resultCta: z.string().min(1).optional(),
  shareFooter: z
    .object({
      title: z.string().min(1),
      handle: z.string().min(1).optional(),
    })
    .optional(),
  destinations: z.object({
    telegram: z.object({ url: z.string().url() }).optional(),
    max: z.object({ url: z.string().url() }).optional(),
  }),
})

export type ChannelPromotionConfig = z.infer<typeof channelPromotionSchema>

export const quizShareConfigSchema = z.object({
  assetPrefix: z.string().min(1).regex(/^[a-z0-9]+$/, 'asset prefix must be lowercase alphanumeric'),
  assetVersion: z.string().min(1).optional(),
})

export type QuizShareConfig = z.infer<typeof quizShareConfigSchema>
/* ------------------------------------------------------------------ *
 * Quiz
 * ------------------------------------------------------------------ */

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
  channelPromotion: channelPromotionSchema.optional(),
  share: quizShareConfigSchema.optional(),
  /**
   * Quiz-aware copy consumed by shared/transport plumbing (landing eyebrow,
   * prepared share caption, delivered own-card line). Only what the second
   * quiz proved we need — not a CMS.
   */
  copy: z.object({
    eyebrow: z.string().min(1),
    shareHeadline: z.string().min(1),
    deliverOwnLine: z.string().min(1),
  }),
  questions: z.array(questionSchema).min(1),
  results: z.array(resultSchema).min(1),
  scoring: scoringConfigSchema,
  presentation: quizPresentationConfigSchema,
  answerBehavior: answerBehaviorSchema,
  reveal: revealConfigSchema,
})

export type Quiz = z.infer<typeof quizSchema>

/** A single user choice in order of selection. */
export interface SelectedAnswer {
  questionId: string
  answerId: string
}

export class QuizIntegrityError extends Error {}

/** Answer identity is (questionId, answerId) — never a global answer id. */
export function answerKey(questionId: string, answerId: string): string {
  return `${questionId}/${answerId}`
}

/** Lookup an answer within its owning question (per-question id scope). */
export function getAnswer(question: Question, answerId: string): Answer | undefined {
  return question.answers.find((a) => a.id === answerId)
}

/** Lookup a question by id. */
export function getQuestion(quiz: Quiz, questionId: string): Question | undefined {
  return quiz.questions.find((q) => q.id === questionId)
}
/**
 * Cross-reference validation: unique ids, no dangling references, tie-break
 * consistency (archetype), correct/answer/band invariants (correct-count).
 */
export function validateQuizIntegrity(quiz: Quiz): void {
  const resultIds = quiz.results.map((r) => r.id)
  const resultSet = new Set(resultIds)
  if (resultSet.size !== resultIds.length) {
    throw new QuizIntegrityError('Duplicate result ids: ' + resultIds.join(', '))
  }

  const questionIds = quiz.questions.map((q) => q.id)
  if (new Set(questionIds).size !== questionIds.length) {
    throw new QuizIntegrityError('Duplicate question ids: ' + questionIds.join(', '))
  }

  for (const question of quiz.questions) {
    const answerIds = question.answers.map((a) => a.id)
    if (new Set(answerIds).size !== answerIds.length) {
      throw new QuizIntegrityError(`Duplicate answer ids in ${question.id}`)
    }
  }

  if (quiz.scoring.kind === 'archetype') {
    const referenced = new Set<string>()
    for (const question of quiz.questions) {
      for (const answer of question.answers) {
        // Hardening: archetype answers MUST carry non-empty scores. An
        // answer without `scores` in an archetype quiz is almost always
        // a copy-paste bug (e.g. a future city quiz author reusing
        // correct-count answer shape by mistake), so we fail-fast at
        // load time instead of silently dropping the answer.
        if (!answer.scores) {
          throw new QuizIntegrityError(
            `Archetype answer ${question.id}/${answer.id} is missing scores`,
          )
        }
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

    const tie = quiz.scoring.tieBreak
    const tieRefs = [tie.controlQuestionId, ...tie.primaryOrderQuestionIds]
    for (const ref of tieRefs) {
      if (!new Set(questionIds).has(ref)) {
        throw new QuizIntegrityError(`Tie-break references unknown question "${ref}"`)
      }
    }
    if (new Set(tie.fixedResultOrder).size !== tie.fixedResultOrder.length) {
      throw new QuizIntegrityError('fixedResultOrder contains duplicates')
    }
    for (const resultId of tie.fixedResultOrder) {
      if (!resultSet.has(resultId)) {
        throw new QuizIntegrityError(`fixedResultOrder references unknown result "${resultId}"`)
      }
    }
    if (tie.fixedResultOrder.length !== resultIds.length) {
      throw new QuizIntegrityError('fixedResultOrder must cover all results')
    }
  }

  if (quiz.scoring.kind === 'correct-count') {
    const total = quiz.questions.length
    for (const question of quiz.questions) {
      if (!question.correctAnswerId) {
        throw new QuizIntegrityError(
          `correct-count question "${question.id}" has no correctAnswerId`,
        )
      }
      if (!question.answers.some((a) => a.id === question.correctAnswerId)) {
        throw new QuizIntegrityError(
          `question "${question.id}" correctAnswerId "${question.correctAnswerId}" does not match any answer`,
        )
      }
    }
    for (const band of quiz.scoring.bands) {
      if (!resultSet.has(band.resultId)) {
        throw new QuizIntegrityError(`Score band references unknown result "${band.resultId}"`)
      }
      if (band.min > band.max) {
        throw new QuizIntegrityError(`Score band ${band.min}-${band.max} is inverted`)
      }
    }
    const sorted = [...quiz.scoring.bands].sort((a, b) => a.min - b.min)
    if (sorted[0].min !== 0) throw new QuizIntegrityError('Score bands must start at 0')
    if (sorted[sorted.length - 1].max !== total) {
      throw new QuizIntegrityError(`Score bands must cover up to ${total} (total questions)`)
    }
    for (let i = 0; i < sorted.length - 1; i++) {
      if (sorted[i].max >= sorted[i + 1].min) {
        throw new QuizIntegrityError('Score bands must not overlap')
      }
      if (sorted[i].max + 1 !== sorted[i + 1].min) {
        throw new QuizIntegrityError('Score bands must leave no gaps')
      }
    }
  }
}

/** Parse + integrity-check a quiz definition. Throws on any inconsistency. */
export function loadQuiz(raw: unknown): Quiz {
  const quiz = quizSchema.parse(raw)
  validateQuizIntegrity(quiz)
  return quiz
}
