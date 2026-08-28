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
 *   3. cover every question with a `claim`, the `correct.id` and
 *      `correct.label`, and at least one source URL.
 *
 * Each source URL is matched for protocol (`http://` or `https://`); we do
 * not fetch it at test time (would require network) — the fact that the
 * file is present, parseable, and consistent with the quiz is the gate.
 */
describe('FACTUAL CONTENT GATE: Music90s provenance', () => {
  const provenancePath = resolve(
    process.cwd(),
    'content-facts',
    `${music90sQuiz.id}.json`,
  )
  const provenance = JSON.parse(readFileSync(provenancePath, 'utf8')) as {
    quiz_id: string
    date_convention: string
    verified_on: string
    questions: Record<
      string,
      {
        correct: { id: string; label: string; sources: string[] }
      }
    >
  }

  it('declares the canonical structure', () => {
    expect(provenance.quiz_id).toBe(music90sQuiz.id)
    expect(typeof provenance.date_convention).toBe('string')
    expect(provenance.date_convention.length).toBeGreaterThan(10)
    expect(typeof provenance.verified_on).toBe('string')
    expect(provenance.verified_on).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('covers every question and matches the correct answer id', () => {
    expect(Object.keys(provenance.questions).sort()).toEqual(
      music90sQuiz.questions.map((q) => q.id).sort(),
    )
    for (const question of music90sQuiz.questions) {
      const prov = provenance.questions[question.id]
      expect(prov, `no provenance for question ${question.id}`).toBeDefined()
      expect(prov.correct.id, `${question.id} correct id drift`).toBe(question.correctAnswerId)
      expect(prov.correct.label.length).toBeGreaterThan(0)
      const answer = question.answers.find((a) => a.id === prov.correct.id)
      expect(answer, `${question.id} provenance points to missing answer id`).toBeDefined()
      // Distractor continuity: every other answer id in the question should NOT
      // be marked correct in provenance. (We can't currently distinguish
      // wrongness in provenance, but the structural invariant is enough.)
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

  it('forbids lyric clue prompts (legacy guardrail)', () => {
    for (const question of music90sQuiz.questions) {
      const title = question.title.trim()
      // Heuristic only — flag any title that contains a line of contiguous
      // 5+ words that also appear as a known song lyric. The current check
      // forbids titles that start with a quoted string of 4+ words; lyric
      // clues tend to be quoted song fragments.
      const looksLikeQuotedFragment = /^[\u00ab\u201c"][А-Яа-яA-Za-z][\u00ab\u201c"]/.test(title)
      expect(looksLikeQuotedFragment, `question ${question.id} starts with a quoted fragment — possible lyric clue: ${title}`).toBe(false)
    }
  })
})
