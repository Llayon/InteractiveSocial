import { describe, expect, it, vi } from 'vitest'
import { quizzes } from '@/content/quizzes'
import { RUNTIME_IMAGE_MANIFEST } from '@/images/manifest'

/**
 * Media integrity: content and the generated runtime manifest must never
 * drift apart. A dangling assetKey renders <null> silently in production —
 * this suite turns that failure mode into a hard test error.
 */
describe('media integrity: content ↔ runtime manifest', () => {
  it('every image-cards answer assetKey resolves in manifest.quiz', () => {
    for (const quiz of quizzes) {
      for (const question of quiz.questions) {
        if (question.layout !== 'image-cards') continue
        for (const answer of question.answers) {
          expect(
            answer.assetKey && RUNTIME_IMAGE_MANIFEST.quiz[answer.assetKey],
            `${quiz.id}/${question.id} assetKey "${answer.assetKey}" missing from manifest`,
          ).toBeTruthy()
        }
      }
    }
  })

  it('every result id resolves to a hero entry in manifest.results', () => {
    for (const quiz of quizzes) {
      for (const result of quiz.results) {
        expect(
          RUNTIME_IMAGE_MANIFEST.results[result.id],
          `${quiz.id} result "${result.id}" missing a runtime hero`,
        ).toBeTruthy()
      }
    }
  })

  it('exact-score cards (quiz-scoped, e.g. m90_score_00) exist for correct-count quizzes', () => {
    for (const quiz of quizzes) {
      if (quiz.scoring.kind !== 'correct-count') continue
      const total = quiz.questions.length
      const prefix = quiz.id === 'music90s' ? 'm90' : quiz.id === 'guess90s' ? 'g90' : quiz.id
      for (let s = 0; s <= total; s++) {
        const key = `${prefix}_score_${String(s).padStart(2, '0')}`
        expect(
          RUNTIME_IMAGE_MANIFEST.results[key],
          `${quiz.id} exact-score card "${key}" missing from manifest`,
        ).toBeTruthy()
      }
    }
  })

  it('warns (but does not fail) about stale manifest entries', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const usedQuizKeys = new Set<string>()
    const usedResultKeys = new Set<string>()
    for (const quiz of quizzes) {
      for (const question of quiz.questions) {
        for (const answer of question.answers) {
          if (answer.assetKey) usedQuizKeys.add(answer.assetKey)
        }
      }
      for (const result of quiz.results) usedResultKeys.add(result.id)
      if (quiz.scoring.kind === 'correct-count') {
        const prefix = quiz.id === 'music90s' ? 'm90' : quiz.id === 'guess90s' ? 'g90' : quiz.id
        const total = quiz.questions.length
        for (let s = 0; s <= total; s++) usedResultKeys.add(`${prefix}_score_${String(s).padStart(2, '0')}`)
        // legacy generic score_XX kept for backwards compat of old share links
        for (let s = 0; s <= total; s++) usedResultKeys.add(`score_${String(s).padStart(2, '0')}`)
      }
    }
    for (const key of Object.keys(RUNTIME_IMAGE_MANIFEST.quiz)) {
      if (!usedQuizKeys.has(key)) console.warn(`[media] stale manifest entry quiz/${key}`)
    }
    for (const key of Object.keys(RUNTIME_IMAGE_MANIFEST.results)) {
      if (!usedResultKeys.has(key)) console.warn(`[media] stale manifest entry results/${key}`)
    }
    warn.mockRestore()
  })
})
