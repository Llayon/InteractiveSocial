import type { Answer, Quiz, Result, SelectedAnswer } from './schema'

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

export interface Resolution {
  resultId: string
  decidedBy: TieBreakStage
}

interface QuizIndex {
  answerById: Map<string, Answer>
}

function buildIndex(quiz: Quiz): QuizIndex {
  const answerById = new Map<string, Answer>()
  for (const question of quiz.questions) {
    for (const answer of question.answers) {
      answerById.set(answer.id, answer)
    }
  }
  return { answerById }
}

function resultIdsInFixedOrder(quiz: Quiz): string[] {
  return quiz.tieBreak.fixedResultOrder
}

/**
 * Stage 1 helper: deterministic summation of all weights.
 * Primary hits count every answer whose maximum positive weight went to
 * a result (in approved content that is the +2 "primary archetype").
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

  const { answerById } = buildIndex(quiz)
  for (const selected of answers) {
    const answer = answerById.get(selected.answerId)
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
  const entries = Object.entries(answer.scores).filter(([, w]) => w > 0)
  if (entries.length === 0) return []
  const max = Math.max(...entries.map(([, w]) => w))
  return entries.filter(([, w]) => w === max).map(([id]) => id)
}

/**
 * Approved deterministic resolution algorithm:
 *   1. maximum total score
 *   2. control question (q8) primary result if inside tied set
 *   3. highest count of primary (+2) hits
 *   4. ordered questions q1 → q7 → q5 primary result
 *   5. fixed fallback order quiet → paris → italian → collector → cottage → scandi
 * No randomness anywhere.
 */
export function resolveResultId(
  quiz: Quiz,
  answers: readonly SelectedAnswer[],
): Resolution {
  const { totals, primaryHits } = computeBreakdown(quiz, answers)

  // Stage 1
  let tied = tiedAtMax(quiz, totals)
  if (tied.length === 1) {
    return { resultId: tied[0], decidedBy: 'max-score' }
  }

  const byQuestionId = new Map(answers.map((a) => [a.questionId, a.answerId]))
  const { answerById } = buildIndex(quiz)

  // Stage 2 — control question
  const controlAnswer = answerById.get(byQuestionId.get(quiz.tieBreak.controlQuestionId) ?? '')
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
  for (const questionId of quiz.tieBreak.primaryOrderQuestionIds) {
    const answer = answerById.get(byQuestionId.get(questionId) ?? '')
    const primaries = primariesOfAnswer(answer)
    const winner = tied.find((id) => primaries.includes(id))
    if (winner) {
      return { resultId: winner, decidedBy: 'primary-order' }
    }
  }

  // Stage 5 — fixed fallback order (already sorted deterministically)
  return { resultId: tied[0], decidedBy: 'fixed-order' }
}

export function getResultById(quiz: Quiz, resultId: string): Result | undefined {
  return quiz.results.find((r) => r.id === resultId)
}

/** Convenience: full deterministic pipeline answers → Result. */
export function resolveResult(quiz: Quiz, answers: readonly SelectedAnswer[]): Result {
  const resolution = resolveResultId(quiz, answers)
  const result = getResultById(quiz, resolution.resultId)
  if (!result) {
    throw new Error(`Scoring produced unknown result "${resolution.resultId}"`)
  }
  return result
}
