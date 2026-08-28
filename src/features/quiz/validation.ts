import type { Quiz, SelectedAnswer } from './schema.js'
import { resolveResultId, type TieBreakStage } from './scoring.js'

export interface ExhaustiveValidation {
  combinationCount: number
  resolvedCount: number
  reachableResults: string[]
  unreachableResults: string[]
  outcomeDistribution: Record<string, number>
  stageUsage: Record<TieBreakStage, number>
  nondeterministicOutcomes: number
}

/** Cartesian product of all answers, question order preserved. */
function* combinations(quiz: Quiz): Generator<SelectedAnswer[]> {
  const pools = quiz.questions.map((q) => q.answers.map((a) => a.id))
  const total = pools.reduce((acc, p) => acc * p.length, 1)
  const indices = new Array(pools.length).fill(0)
  for (let n = 0; n < total; n++) {
    let rest = n
    for (let i = 0; i < pools.length; i++) {
      // least-significant digit = last question (stable enumeration)
      const dim = pools.length - 1 - i
      indices[dim] = rest % pools[dim].length
      rest = Math.floor(rest / pools[dim].length)
    }
    yield pools.map((pool, i) => ({
      questionId: quiz.questions[i].id,
      answerId: pool[indices[i]],
    }))
  }
}

/**
 * Exhaustive deterministic validation over every possible answer combination.
 * For the approved content this is 4^7 x 6 = 98,304 combinations — a fully
 * enumerable search space used as the scoring correctness hard gate.
 */
export function exhaustiveValidation(quiz: Quiz): ExhaustiveValidation {
  const stageUsage: Record<TieBreakStage, number> = {
    'max-score': 0,
    'control-question': 0,
    'primary-hits': 0,
    'primary-order': 0,
    'fixed-order': 0,
  }
  const outcomeDistribution: Record<string, number> = {}
  const decisionsByCombo = new Map<string, string>()
  let combinationCount = 0
  let resolvedCount = 0
  let nondeterministicOutcomes = 0

  for (const combo of combinations(quiz)) {
    combinationCount++
    const resolution = resolveResultId(quiz, combo)
    if (!resolution.resultId) continue
    resolvedCount++
    outcomeDistribution[resolution.resultId] =
      (outcomeDistribution[resolution.resultId] ?? 0) + 1
    stageUsage[resolution.decidedBy]++

    const key = combo.map((a) => a.answerId).join('|')
    const previous = decisionsByCombo.get(key)
    if (previous !== undefined && previous !== resolution.resultId) {
      nondeterministicOutcomes++
    } else {
      decisionsByCombo.set(key, resolution.resultId)
    }
  }

  const reachableResults = Object.keys(outcomeDistribution)
  const unreachableResults = quiz.results
    .map((r) => r.id)
    .filter((id) => !reachableResults.includes(id))

  return {
    combinationCount,
    resolvedCount,
    reachableResults,
    unreachableResults,
    outcomeDistribution,
    stageUsage,
    nondeterministicOutcomes,
  }
}
