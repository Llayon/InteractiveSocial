import { describe, it, expect } from 'vitest'
import { music90sQuiz } from '@/content/quizzes/music90s/quiz'
import { guess90sQuiz } from '@/content/quizzes/guess90s/quiz'
import { getResultById, resolveBandResultId } from '@/features/quiz/scoring'
import {
  scoreCardAsset,
  resolveShareCardAsset,
  shareCardVersionedAsset,
  shareCardImageUrl,
  preparedShareId,
} from '@/features/quiz/scoring'
import { M90_HOOKS } from '@/features/result/ResultCard'
import React from 'react'
import { render } from '@testing-library/react'
import { Music90ShareCard } from '@/features/share/Music90ShareCard'
import fs from 'node:fs'
import path from 'node:path'

describe('Share pipeline canonical', () => {
  it('m90 exact score resolves to m90 exact-score asset', () => {
    expect(scoreCardAsset(music90sQuiz, 0)).toBe('m90_score_00')
    expect(scoreCardAsset(music90sQuiz, 10)).toBe('m90_score_10')
    expect(scoreCardAsset(music90sQuiz, 18)).toBe('m90_score_18')
  })

  it('m90 10 → correct current share asset and band', () => {
    const resultId = resolveBandResultId(music90sQuiz, 10)
    expect(resultId).toBe('m90_cassette')
    const result = getResultById(music90sQuiz, resultId)!
    expect(result.title).toBe('Знаю только припевы')
    const asset = resolveShareCardAsset(music90sQuiz, result, 10)
    expect(asset).toBe('m90_score_10')
    // versioned path should be v3
    expect(shareCardVersionedAsset(music90sQuiz, asset)).toBe('v3/m90_score_10')
    expect(shareCardImageUrl(music90sQuiz, asset, 'https://example.com')).toBe(
      'https://example.com/share-cards/v3/m90_score_10.jpg',
    )
  })

  it('0..18 all exist and map to correct bands', () => {
    const expected: Record<number, string> = {
      2: 'm90_rookie',
      6: 'm90_familiar',
      9: 'm90_cassette',
      12: 'm90_disco',
      15: 'm90_legend',
      17: 'm90_era17',
      18: 'm90_era18',
    }
    for (const [scoreStr, expectedId] of Object.entries(expected)) {
      const score = Number(scoreStr)
      expect(resolveBandResultId(music90sQuiz, score)).toBe(expectedId)
    }
    // Ensure all 0..18 map without throwing
    for (let s = 0; s <= 18; s++) {
      expect(() => resolveBandResultId(music90sQuiz, s)).not.toThrow()
      const rid = resolveBandResultId(music90sQuiz, s)
      expect(getResultById(music90sQuiz, rid)).toBeDefined()
    }
  })

  it('old generic score_10 is not selected for new Music90s shares', () => {
    const result = getResultById(music90sQuiz, 'm90_cassette')!
    const asset = resolveShareCardAsset(music90sQuiz, result, 10)
    expect(asset).not.toBe('score_10')
    expect(asset).toBe('m90_score_10')
  })

  it('Guess90s remains independent', () => {
    expect(scoreCardAsset(guess90sQuiz, 10)).toBe('g90_score_10')
    expect(scoreCardAsset(guess90sQuiz, 10)).not.toBe('m90_score_10')
    const gResult = getResultById(guess90sQuiz, resolveBandResultId(guess90sQuiz, 10))!
    const gAsset = resolveShareCardAsset(guess90sQuiz, gResult, 10)
    expect(gAsset).toBe('g90_score_10')
    // guess90s has no version, so unversioned path
    expect(shareCardVersionedAsset(guess90sQuiz, gAsset)).toBe('g90_score_10')
    expect(shareCardImageUrl(guess90sQuiz, gAsset, 'https://example.com')).toBe(
      'https://example.com/share-cards/g90_score_10.jpg',
    )
  })

  it('exact-score Telegram result IDs differ between scores in same band', () => {
    const r8 = getResultById(music90sQuiz, resolveBandResultId(music90sQuiz, 8))!
    const r9 = getResultById(music90sQuiz, resolveBandResultId(music90sQuiz, 9))!
    const r10 = getResultById(music90sQuiz, resolveBandResultId(music90sQuiz, 10))!
    // All three share same band m90_cassette but must have distinct IDs
    expect(r8.id).toBe('m90_cassette')
    expect(r9.id).toBe('m90_cassette')
    expect(r10.id).toBe('m90_cassette')
    const id8 = preparedShareId(music90sQuiz, r8, 8)
    const id9 = preparedShareId(music90sQuiz, r9, 9)
    const id10 = preparedShareId(music90sQuiz, r10, 10)
    expect(id8).not.toBe(id9)
    expect(id9).not.toBe(id10)
    expect(id8).not.toBe(id10)
    expect(id8).toBe('share_m90_score_08_v3')
    expect(id9).toBe('share_m90_score_09_v3')
    expect(id10).toBe('share_m90_score_10_v3')
  })

  it('card asset version appears in Telegram image URL', () => {
    const result = getResultById(music90sQuiz, 'm90_cassette')!
    const asset = resolveShareCardAsset(music90sQuiz, result, 10)
    const url = shareCardImageUrl(music90sQuiz, asset, 'https://example.com')
    expect(url).toContain('/v3/')
    expect(url).toBe('https://example.com/share-cards/v3/m90_score_10.jpg')
  })

  it('no fake CTA is part of share-card render model', () => {
    const { container } = render(React.createElement(Music90ShareCard, { quiz: music90sQuiz, score: 10 }))
    const text = container.textContent ?? ''
    expect(text).not.toContain('Бросить')
    expect(text).not.toContain('Пройти тест')
    expect(text).toContain('Знаю только припевы')
    expect(text).toContain('10 / 18')
    expect(text).toContain('Бюро историй')
    expect(text).toContain('@takeiteasybefore')
  })

  it('Music90ShareCard uses current approved hook for 18', () => {
    expect(M90_HOOKS['m90_era18']).toBe('Я с тобой про попсу даже спорить не буду.')
    const { container } = render(React.createElement(Music90ShareCard, { quiz: music90sQuiz, score: 18 }))
    expect(container.textContent).toContain('Я с тобой про попсу даже спорить не буду.')
  })

  it('uses canonical hook for 10', () => {
    const { container } = render(React.createElement(Music90ShareCard, { quiz: music90sQuiz, score: 10 }))
    expect(container.textContent).toContain('База на месте.')
  })

  it('share card does not contain old band label', () => {
    const { container } = render(React.createElement(Music90ShareCard, { quiz: music90sQuiz, score: 10 }))
    expect(container.textContent).not.toContain('8–10')
    expect(container.textContent).not.toContain('8-10')
    expect(container.textContent).not.toContain('из 18')
  })

  it('author footer is correct', () => {
    const { container } = render(React.createElement(Music90ShareCard, { quiz: music90sQuiz, score: 10 }))
    const footer = container.querySelector('[data-testid="share-card-footer"]')?.textContent ?? ''
    expect(footer).toContain('Бюро историй')
    expect(footer).toContain('@takeiteasybefore')
  })

  it('Telegram challenge keyboard contains only Пройти тест', () => {
    const file = fs.readFileSync(path.join(process.cwd(), 'api', 'share', 'prepare.ts'), 'utf-8')
    // Should contain single button row with Пройти тест
    expect(file).toContain("text: 'Пройти тест'")
    // Should NOT contain second channel button in challenge message
    // The file should have inline_keyboard: [[{ text: 'Пройти тест' ... }]] single row
    const keyboardMatches = file.match(/inline_keyboard/g) || []
    expect(keyboardMatches.length).toBeGreaterThanOrEqual(1)
    // Ensure not containing old second row with Бюро историй in that file's challenge payload
    // Count occurrences of Бюро in that file's payload section — should be 0 for challenge
    const challengeSection = file.slice(file.indexOf('inline_keyboard'))
    // The challenge file should not have two rows; check that after Пройти тест there is not a second row with Бюро
    expect(challengeSection).not.toContain("Бюро историй', url: promoChannelUrl")
    expect(challengeSection).not.toMatch(/\},\s*\],\s*\[\{ text: '✨/)
  })

  it('v2 challenge deeplink still works', async () => {
    const { resolveResultByCode } = await import('@/content/quizzes/codes')
    const res = resolveResultByCode('m90', 'cs')
    expect(res).not.toBeNull()
    expect(res?.quiz.id).toBe('music90s')
    expect(res?.resultId).toBe('m90_cassette')
  })
})
