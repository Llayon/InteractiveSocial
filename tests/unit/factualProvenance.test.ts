import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { music90sQuiz } from '@/content/quizzes/music90s/quiz'

/**
 * FACTUAL CONTENT GATE.
 *
 * For every correct-count quiz a build-time provenance file MUST exist at
 * `content-facts/<quizId>.json` and MUST:
 *   1. declare a single `date_convention` string;
 *   2. declare a `verified_on` date;
 *   3. cover every question with a non-empty `claim` text;
 *   4. carry an explicit human review marker (`review: { factual, copyright,
 *      reviewed_on }`) for every question — this is the only place where
 *      "is this song lyric copyrighted?" or "is this date factually right?"
 *      is asserted. No automated regex can replace a human copyright/factual
 *      check, so the gate refuses to mark the file complete without it.
 *   5. match `correct.id` and the literal `correct.label` string of the
 *      runtime answer (typo drift between provenance and live content is
 *      what hides factual bugs);
 *   6. provide at least one http(s) source URL per question.
 *
 * Note on lyric detection: the file is NOT a place where we attempt to
 * regex-detect song lyrics. Lyric / copyright / "is this a fair-use
 * quotation?" is a human decision and lives in `review.copyright`.
 */
interface ProvenanceQuestion {
  claim: string
  correct: {
    id: string
    label: string
    sources: string[]
    review: { factual: boolean; copyright: boolean; reviewed_on: string }
  }
}
interface Provenance {
  quiz_id: string
  date_convention: string
  verified_on: string
  questions: Record<string, ProvenanceQuestion>
}

describe('FACTUAL CONTENT GATE: Music90s provenance', () => {
  const provenancePath = resolve(
    process.cwd(),
    'content-facts',
    `${music90sQuiz.id}.json`,
  )
  const provenance = JSON.parse(readFileSync(provenancePath, 'utf8')) as Provenance

  it('declares the canonical structure', () => {
    expect(provenance.quiz_id).toBe(music90sQuiz.id)
    expect(typeof provenance.date_convention).toBe('string')
    expect(provenance.date_convention.length).toBeGreaterThan(10)
    expect(typeof provenance.verified_on).toBe('string')
    expect(provenance.verified_on).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('covers every question and matches the correct answer id + label', () => {
    expect(Object.keys(provenance.questions).sort()).toEqual(
      music90sQuiz.questions.map((q) => q.id).sort(),
    )
    for (const question of music90sQuiz.questions) {
      const prov = provenance.questions[question.id]
      expect(prov, `no provenance for question ${question.id}`).toBeDefined()

      // claim is a required, non-empty string — bare strings fail the gate.
      expect(typeof prov.claim, `${question.id} claim missing`).toBe('string')
      expect(prov.claim.trim().length, `${question.id} claim is empty`).toBeGreaterThan(0)

      // correct.id must point at the live answer.
      expect(prov.correct.id, `${question.id} correct id drift`).toBe(question.correctAnswerId)

      // correct.label must match the runtime answer title byte-for-byte;
      // this is what catches typos in the provenance file itself.
      const answer = question.answers.find((a) => a.id === prov.correct.id)
      expect(answer, `${question.id} provenance points to missing answer id`).toBeDefined()
      expect(
        prov.correct.label,
        `${question.id} provenance label does not match runtime answer.title`,
      ).toBe(answer!.title)
    }
  })

  it('every provenance entry has at least one http(s) source URL', () => {
    for (const [qid, prov] of Object.entries(provenance.questions)) {
      expect(prov.correct.sources.length, `${qid} missing sources`).toBeGreaterThan(0)
      for (const url of prov.correct.sources) {
        expect(url, `${qid} bad source URL: ${url}`).toMatch(/^https?:\/\//)
      }
    }
  })

  it('every provenance entry carries an explicit human review marker', () => {
    // The `review` block is the only place where a human asserts the
    // question is factually correct AND does not reproduce copyrighted
    // material. A missing block means a future author skipped the check;
    // a `factual: false` or `copyright: false` is a hard fail.
    for (const [qid, prov] of Object.entries(provenance.questions)) {
      const review = prov.correct.review
      expect(review, `${qid} missing human review marker — see content-facts/music90s.json review: { factual, copyright, reviewed_on }`).toBeDefined()
      expect(review.factual, `${qid} review.factual must be true`).toBe(true)
      expect(review.copyright, `${qid} review.copyright must be true`).toBe(true)
      expect(review.reviewed_on, `${qid} review.reviewed_on required (YYYY-MM-DD)`).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    }
  })
})
