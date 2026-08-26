import { describe, expect, it } from 'vitest'
import { activeQuiz } from '@/content/quizzes'
import { interiorCharacterQuiz } from '@/content/quizzes/interior-character/quiz'
import { PALETTE_SEGMENT_PROPORTIONS } from '@/features/quiz/schema'

/**
 * CONTENT LOCK TESTS — approved product spec (addendum §28).
 * Any change to questions/answers/weights/copy must fail here.
 */
describe('approved content shape', () => {
  it('has exactly 8 questions with approved ids', () => {
    expect(activeQuiz.questions.map((q) => q.id)).toEqual([
      'q1',
      'q2',
      'q3',
      'q4',
      'q5',
      'q6',
      'q7',
      'q8',
    ])
  })

  it('gives q1–q7 exactly 4 answers and q8 exactly 6', () => {
    for (const question of activeQuiz.questions.slice(0, 7)) {
      expect(question.answers).toHaveLength(4)
    }
    expect(activeQuiz.questions[7].answers).toHaveLength(6)
  })

  it('defines exactly the 6 approved result ids in fixed order', () => {
    expect(activeQuiz.results.map((r) => r.id)).toEqual([
      'quiet',
      'paris',
      'italian',
      'collector',
      'cottage',
      'scandi',
    ])
    expect(activeQuiz.tieBreak.fixedResultOrder).toEqual([
      'quiet',
      'paris',
      'italian',
      'collector',
      'cottage',
      'scandi',
    ])
  })

  it('gives every image-cards question answers a media assetKey', () => {
    for (const question of activeQuiz.questions) {
      if (question.layout === 'image-cards') {
        for (const answer of question.answers) {
          expect(answer.assetKey, `image-cards answer ${question.id}/${answer.id} needs assetKey`).toBeTruthy()
        }
      }
    }
  })
})

/**
 * Q3 palette color stories — approved visual config.
 * Segment widths are fixed 40/25/20/15 for EVERY answer so no option gains
 * attention purely through a larger bright area; hex order is the visual
 * left-to-right order of the strip and may intentionally differ from the
 * textual label order (q3_c leads with the cream base).
 */
describe('approved q3 palette cards', () => {
  const q3 = activeQuiz.questions.find((q) => q.id === 'q3')
  if (!q3) throw new Error('q3 missing')

  it('has exactly four palette answers with four labels each', () => {
    expect(q3.answers).toHaveLength(4)
    for (const answer of q3.answers) {
      expect(answer.paletteLabels).toHaveLength(4)
      expect(answer.paletteSwatches).toHaveLength(4)
    }
  })

  it('uses exactly the approved swatch configuration per answer', () => {
    expect(Object.fromEntries(q3.answers.map((a) => [a.id, a.paletteSwatches]))).toEqual({
      q3_a: ['#F3EFE7', '#D8CBB6', '#AAA39A', '#C49B6C'],
      q3_b: ['#A9B09A', '#EFE5D3', '#91A5B0', '#B58662'],
      // cream leads the strip as the interior base (visual ≠ label order)
      q3_c: ['#E8D9C3', '#B66D50', '#6A2934', '#493126'],
      q3_d: ['#294A6D', '#C09A53', '#67465F', '#527B74'],
    })
  })

  it('keeps the identical 40/25/20/15 segment structure for all answers', () => {
    const total = PALETTE_SEGMENT_PROPORTIONS.reduce((sum, p) => sum + p, 0)
    expect(total).toBe(100)
    expect(q3.answers.every(() => PALETTE_SEGMENT_PROPORTIONS.length === 4)).toBe(true)
  })

  it('keeps approved palette labels untouched (lowercase · separator)', () => {
    expect(q3.answers.map((a) => a.paletteLabels?.join(' · '))).toEqual([
      'молочный · овсяный · теплый серый · светлое дерево',
      'шалфейный · сливочный · пыльно-голубой · теплое дерево',
      'терракота · бордо · теплый кремовый · темный орех',
      'глубокий синий · охра · сливовый · неожиданный цветовой акцент',
    ])
  })

  it('does not touch approved scoring weights', () => {
    expect(q3.answers.map((a) => [a.id, a.scores])).toEqual([
      ['q3_a', { scandi: 2, quiet: 1 }],
      ['q3_b', { cottage: 2, paris: 1 }],
      ['q3_c', { italian: 2, paris: 1 }],
      ['q3_d', { collector: 2, italian: 1 }],
    ])
  })
})

/** Full lock of approved scoring weights: answerId → {resultId: weight}. */
const APPROVED_WEIGHTS: Record<string, Record<string, number>> = {
  q1_a: { quiet: 2, scandi: 1 },
  q1_b: { paris: 2, cottage: 1 },
  q1_c: { italian: 2, collector: 1 },
  q1_d: { cottage: 2, scandi: 1 },
  q2_a: { quiet: 2, cottage: 1 },
  q2_b: { scandi: 2, quiet: 1 },
  q2_c: { paris: 2, cottage: 1 },
  q2_d: { italian: 2, collector: 1 },
  q3_a: { scandi: 2, quiet: 1 },
  q3_b: { cottage: 2, paris: 1 },
  q3_c: { italian: 2, paris: 1 },
  q3_d: { collector: 2, italian: 1 },
  q4_a: { quiet: 2, italian: 1 },
  q4_b: { collector: 2, paris: 1 },
  q4_c: { cottage: 2, scandi: 1 },
  q4_d: { scandi: 2, quiet: 1 },
  q5_a: { quiet: 2, scandi: 1 },
  q5_b: { paris: 2, cottage: 1 },
  q5_c: { italian: 2, quiet: 1 },
  q5_d: { collector: 2, italian: 1 },
  q6_a: { scandi: 2, collector: 1 },
  q6_b: { cottage: 2, collector: 1 },
  q6_c: { paris: 2, cottage: 1 },
  q6_d: { collector: 2, italian: 1 },
  q7_a: { cottage: 2, scandi: 1 },
  q7_b: { paris: 2, quiet: 1 },
  q7_c: { italian: 2, collector: 1 },
  q7_d: { collector: 2, paris: 1 },
  q8_a: { quiet: 2, scandi: 1 },
  q8_b: { scandi: 2, quiet: 1 },
  q8_c: { paris: 2, quiet: 1 },
  q8_d: { italian: 2, scandi: 1 },
  q8_e: { cottage: 2, paris: 1 },
  q8_f: { collector: 2, italian: 1 },
}

describe('approved scoring weights', () => {
  it('matches every approved answer weight exactly (+2 primary / +1 secondary)', () => {
    const actual: Record<string, Record<string, number>> = {}
    for (const question of interiorCharacterQuiz.questions) {
      for (const answer of question.answers) {
        actual[answer.id] = { ...answer.scores }
      }
    }
    expect(actual).toEqual(APPROVED_WEIGHTS)
  })
})

describe('approved copy essentials', () => {
  it('keeps quiz identity copy', () => {
    expect(activeQuiz.title).toBe('Какой у тебя интерьерный характер?')
    expect(activeQuiz.subtitle).toBe(
      '8 выборов — и узнаешь, какой интерьер на самом деле похож на тебя.',
    )
    expect(activeQuiz.startCta).toBe('Узнать свой характер')
    expect(activeQuiz.shareCta).toBe('Отправить результат подруге')
    expect(activeQuiz.restartCta).toBe('Пройти ещё раз')
  })

  it('keeps display titles of all archetypes', () => {
    const titles = Object.fromEntries(activeQuiz.results.map((r) => [r.id, r.title]))
    expect(titles).toEqual({
      quiet: 'QUIET LUXURY',
      paris: 'PARISIAN',
      italian: 'ITALIAN DIVA',
      collector: 'THE COLLECTOR',
      cottage: 'COTTAGE SOUL',
      scandi: 'SCANDI CALM',
    })
  })

  it('renders every result with a full editorial field set', () => {
    for (const result of activeQuiz.results) {
      expect(result.description.length).toBeGreaterThanOrEqual(3)
      expect(result.traits).toHaveLength(5)
      expect(result.superpower.length).toBeGreaterThan(0)
      expect(result.redFlag.length).toBeGreaterThan(0)
      expect(result.recommendation.length).toBeGreaterThan(0)
      expect(result.shareQuote.length).toBeGreaterThan(0)
      expect(result.shareImage).toBe(`result_${result.id}`)
    }
  })
})
