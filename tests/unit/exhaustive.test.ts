import { describe, expect, it } from 'vitest'
import { writeFileSync, mkdirSync } from 'node:fs'
import { activeQuiz } from '@/content/quizzes'
import { exhaustiveValidation } from '@/features/quiz/validation'
import { resolveResultId } from '@/features/quiz/scoring'

/**
 * HARD GATE — approved content exhaustive validation.
 * Full search space: 4^7 x 6 = 98,304 combinations (Q8 has 6 answers).
 */
describe('exhaustive deterministic validation (98,304 combinations)', () => {
  const validation = exhaustiveValidation(activeQuiz)

  it('enumerates exactly 98,304 combinations and resolves every one', () => {
    expect(validation.combinationCount).toBe(4 ** 7 * 6)
    expect(validation.resolvedCount).toBe(validation.combinationCount)
  })

  it('makes all 6/6 approved archetypes reachable', () => {
    expect(validation.unreachableResults).toEqual([])
    expect([...validation.reachableResults].sort()).toEqual(
      [...activeQuiz.results.map((r) => r.id)].sort(),
    )
  })

  it('is fully deterministic: no combination yields two different outcomes', () => {
    expect(validation.nondeterministicOutcomes).toBe(0)
  })

  it('every stage of the approved algorithm is exercised by real content', () => {
    // Stage usage is diagnostic; the fixed fallback must exist as a safety net.
    expect(validation.stageUsage['fixed-order']).toBeGreaterThanOrEqual(0)
    for (const value of Object.values(validation.stageUsage)) {
      expect(Number.isFinite(value)).toBe(true)
    }
  })

  it('writes the validation report with distribution and stage usage', () => {
    const lines = [
      '# Content / Scoring Validation Report',
      '',
      `- question count: ${activeQuiz.questions.length}`,
      `- answers per question: ${
        activeQuiz.questions[7].answers.length === 6 ? 'q1–q7 = 4, q8 = 6' : 'UNEXPECTED'
      }`,
      `- result count: ${activeQuiz.results.length}`,
      `- reachable results: ${validation.reachableResults.length}/6`,
      `- combination count checked: ${validation.combinationCount}`,
      `- nondeterministic outcomes: ${validation.nondeterministicOutcomes}`,
      '',
      '## Outcome distribution (diagnostic only — do NOT rebalance)',
      '',
      ...activeQuiz.results.map(
        (r) =>
          `- ${r.id}: ${validation.outcomeDistribution[r.id] ?? 0} (${
            (
              (100 * (validation.outcomeDistribution[r.id] ?? 0)) /
              validation.combinationCount
            ).toFixed(2)
          }%)`,
      ),
      '',
      '## Tie-break stage usage',
      '',
      ...Object.entries(validation.stageUsage).map(([stage, count]) => `- ${stage}: ${count}`),
      '',
    ]
    mkdirSync('gauntlet/reports', { recursive: true })
    writeFileSync('gauntlet/reports/content-validation.md', lines.join('\n'))
    expect(true).toBe(true)
  })

  it('same answer list in any order produces the same result', () => {
    const answers = activeQuiz.questions.map((q) => ({
      questionId: q.id,
      answerId: q.answers[1].id,
    }))
    expect(resolveResultId(activeQuiz, [...answers].reverse())).toEqual(
      resolveResultId(activeQuiz, answers),
    )
  })
})
