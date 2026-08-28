import {
  answerKey,
  type Answer,
  type Quiz,
  type Result,
  type SelectedAnswer,
} from './schema'

export type TieBreakStage =
  | 'max-score'
  | 'control-question'
  | 'primary-hits'
  | 'primary-order'
  | 'fixed-order'

export interface ScoreBreakdown {
  totals: Record<string, number>
  primaryHits: Record<string, number>
}

export interface ArchetypeResolution {
  resultId: string
  decidedBy: TieBreakStage
}

/**
 * Canonical completion/result/share boundary.
 *
 * App completion, the result screen, share preparation, delivery and
 * analytics all consume this shape — none of them need to know HOW the
 * outcome was computed. Dispatch happens on scoring.kind, never quiz.id.
 */
export type QuizOutcome =
  | ({ kind: 'archetype' } & ArchetypeResolution)
  | { kind: 'correct-count'; resultId: string; correct: number; total: number }

interface QuizIndex {
  /** Compound (questionId, answerId) → answer. Never a global answer id. */
  answerByKey: Map<string, Answer>
}

function buildIndex(quiz: Quiz): QuizIndex {
  const answerByKey = new Map<string, Answer>()
  for (const question of quiz.questions) {
    for (const answer of question.answers) {
      answerByKey.set(answerKey(question.id, answer.id), answer)
    }
  }
  return { answerByKey }
}

function lookupAnswer(
  answerByKey: Map<string, Answer>,
  questionId: string,
  answerId: string,
): Answer | undefined {
  return answerByKey.get(answerKey(questionId, answerId))
}

function resultIdsInFixedOrder(quiz: Quiz): string[] {
  return quiz.scoring.kind === 'archetype' ? quiz.scoring.tieBreak.fixedResultOrder : []
}
/**
 * Stage 1 helper: deterministic summation of all archetype weights.
 * Primary hits count every answer whose maximum positive weight went to a
 * result (in approved content that is the +2 "primary archetype").
 * Answers are resolved through the compound (question, answer) key.
 */
export function computeBreakdown(
  quiz: Quiz,
  answers: readonly SelectedAnswer[],
): ScoreBreakdown {
  const totals: Record<string, number> = {}
  const primaryHits: Record<string, number> = {}
  for (const id of resultIdsInFixedOrder(quiz)) {
    totals[id] = 0
    primaryHits[id] = 0
  }

  const { answerByKey } = buildIndex(quiz)
  for (const selected of answers) {
    const answer = lookupAnswer(answerByKey, selected.questionId, selected.answerId)
    if (!answer || !answer.scores) continue
    let maxWeight = 0
    for (const weight of Object.values(answer.scores)) {
      if (weight > maxWeight) maxWeight = weight
    }
    for (const [resultId, weight] of Object.entries(answer.scores)) {
      if (!(resultId in totals)) continue // defensive: schema already rejects unknown ids
      totals[resultId] += weight
      if (weight === maxWeight && maxWeight > 0) {
        primaryHits[resultId] += 1
      }
    }
  }

  return { totals, primaryHits }
}

/** Results tied at the given maximum score, in fixed deterministic order. */
function tiedAtMax(quiz: Quiz, totals: Record<string, number>): string[] {
  const max = Math.max(...resultIdsInFixedOrder(quiz).map((id) => totals[id]))
  return resultIdsInFixedOrder(quiz).filter((id) => totals[id] === max)
}

function primariesOfAnswer(answer: Answer | undefined): string[] {
  if (!answer) return []
  const entries = Object.entries(answer.scores ?? {}).filter(([, w]) => w > 0)
  if (entries.length === 0) return []
  const max = Math.max(...entries.map(([, w]) => w))
  return entries.filter(([, w]) => w === max).map(([id]) => id)
}

/**
 * Approved deterministic archetype resolution algorithm:
 *   1. maximum total score
 *   2. control question (q8) primary result if inside tied set
 *   3. highest count of primary (+2) hits
 *   4. ordered questions q1 → q7 → q5 primary result
 *   5. fixed fallback order quiet → paris → italian → collector → cottage → scandi
 * No randomness anywhere. Identical behaviour to the locked baseline.
 */
export function resolveResultId(
  quiz: Quiz,
  answers: readonly SelectedAnswer[],
): ArchetypeResolution {
  const { totals, primaryHits } = computeBreakdown(quiz, answers)

  // Stage 1
  let tied = tiedAtMax(quiz, totals)
  if (tied.length === 1) {
    return { resultId: tied[0], decidedBy: 'max-score' }
  }

  const byQuestionId = new Map(answers.map((a) => [a.questionId, a.answerId]))
  const { answerByKey } = buildIndex(quiz)
  const controlQuestionId =
    quiz.scoring.kind === 'archetype' ? quiz.scoring.tieBreak.controlQuestionId : ''

  // Stage 2 — control question
  const controlAnswer = lookupAnswer(
    answerByKey,
    controlQuestionId,
    byQuestionId.get(controlQuestionId) ?? '',
  )
  const controlPrimaries = primariesOfAnswer(controlAnswer)
  const stage2Winner = tied.find((id) => controlPrimaries.includes(id))
  if (stage2Winner) {
    return { resultId: stage2Winner, decidedBy: 'control-question' }
  }
  // Stage 3 — primary hit count
  const maxHits = Math.max(...tied.map((id) => primaryHits[id]))
  tied = tied.filter((id) => primaryHits[id] === maxHits)
  if (tied.length === 1) {
    return { resultId: tied[0], decidedBy: 'primary-hits' }
  }

  // Stage 4 — ordered questions q1 → q7 → q5
  const orderIds =
    quiz.scoring.kind === 'archetype' ? quiz.scoring.tieBreak.primaryOrderQuestionIds : []
  for (const questionId of orderIds) {
    const answer = lookupAnswer(answerByKey, questionId, byQuestionId.get(questionId) ?? '')
    const primaries = primariesOfAnswer(answer)
    const winner = tied.find((id) => primaries.includes(id))
    if (winner) {
      return { resultId: winner, decidedBy: 'primary-order' }
    }
  }

  // Stage 5 — fixed fallback order (already sorted deterministically)
  return { resultId: tied[0], decidedBy: 'fixed-order' }
}

/* ------------------------------------------------------------------ *
 * Correct-count scoring
 * ------------------------------------------------------------------ */

/** Counts how many selected answers were the declared correct answer. */
export function computeCorrectCount(
  quiz: Quiz,
  answers: readonly SelectedAnswer[],
): number {
  let correct = 0
  for (const selected of answers) {
    const question = quiz.questions.find((q) => q.id === selected.questionId)
    if (!question || !question.correctAnswerId) continue
    if (selected.answerId === question.correctAnswerId) correct += 1
  }
  return correct
}

/** Maps a raw correct count to exactly one band result id (fail-fast). */
export function resolveBandResultId(quiz: Quiz, correct: number): string {
  if (quiz.scoring.kind !== 'correct-count') {
    throw new Error('resolveBandResultId requires a correct-count quiz')
  }
  const band = quiz.scoring.bands.find((b) => correct >= b.min && correct <= b.max)
  if (!band) {
    throw new Error(`No score band covers correct count ${correct}`)
  }
  return band.resultId
}

export function resolveCorrectCountOutcome(
  quiz: Quiz,
  answers: readonly SelectedAnswer[],
): Extract<QuizOutcome, { kind: 'correct-count' }> {
  const correct = computeCorrectCount(quiz, answers)
  const total = quiz.questions.length
  return { kind: 'correct-count', resultId: resolveBandResultId(quiz, correct), correct, total }
}

/* ------------------------------------------------------------------ *
 * Canonical outcome boundary
 * ------------------------------------------------------------------ */

/** The single entry point every consumer must use. Dispatch on scoring.kind. */
export function resolveOutcome(quiz: Quiz, answers: readonly SelectedAnswer[]): QuizOutcome {
  if (quiz.scoring.kind === 'correct-count') {
    return resolveCorrectCountOutcome(quiz, answers)
  }
  const { resultId, decidedBy } = resolveResultId(quiz, answers)
  return { kind: 'archetype', resultId, decidedBy }
}

export function getResultById(quiz: Quiz, resultId: string): Result | undefined {
  return quiz.results.find((r) => r.id === resultId)
}

/** Convenience: full deterministic archetype pipeline answers → Result. */
export function resolveResult(quiz: Quiz, answers: readonly SelectedAnswer[]): Result {
  const resolution = resolveResultId(quiz, answers)
  const result = getResultById(quiz, resolution.resultId)
  if (!result) {
    throw new Error(`Scoring produced unknown result "${resolution.resultId}"`)
  }
  return result
}
/* ------------------------------------------------------------------ *
 * Scoring-aware telemetry (keeps archetype internals out of the App)
 * ------------------------------------------------------------------ */

/** Per-answer telemetry payload. App calls this; it never reads scores. */
export function questionAnsweredTelemetry(
  quiz: Quiz,
  questionId: string,
  answerId: string,
  position: number,
): Record<string, unknown> {
  const question = quiz.questions.find((q) => q.id === questionId)
  const answer = question
    ? question.answers.find((a) => a.id === answerId)
    : undefined

  if (quiz.scoring.kind === 'archetype') {
    const entries = answer?.scores
      ? Object.entries(answer.scores).sort((a, b) => b[1] - a[1])
      : []
    return {
      primary_result: entries[0]?.[0] ?? '',
      secondary_result: entries[1]?.[0] ?? '',
    }
  }

  return {
    is_correct: Boolean(question?.correctAnswerId && answerId === question.correctAnswerId),
    category: question?.category ?? '',
    position,
  }
}

/** quiz_complete payload: archetype keeps breakdown, correct-count adds score. */
export function quizCompleteTelemetry(
  quiz: Quiz,
  answers: readonly SelectedAnswer[],
): { result_id: string } & Record<string, unknown> {
  const outcome = resolveOutcome(quiz, answers)
  if (outcome.kind === 'correct-count') {
    return { result_id: outcome.resultId, score: outcome.correct, total: outcome.total }
  }
  return { result_id: outcome.resultId, total_scores: computeBreakdown(quiz, answers).totals }
}

/** Two-digit zero-padded score key, e.g. 8 → "score_08". */
export function scoreCardAsset(score: number): string {
  return `score_${String(Math.max(0, score)).padStart(2, '0')}`
}

/**
 * Transport/share image key for an outcome. Correct-count quizzes use the
 * exact-score card set (score_00 … score_NN); personality quizzes keep the
 * per-result approved card.
 */
export function resolveShareCardAsset(quiz: Quiz, result: Result, score?: number): string {
  if (quiz.scoring.kind === 'correct-count' && typeof score === 'number') {
    return scoreCardAsset(score)
  }
  return result.shareImage
}
