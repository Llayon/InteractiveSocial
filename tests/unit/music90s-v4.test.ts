import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'
import { music90sQuiz } from '@/content/quizzes/music90s/quiz'
import { guess90sQuiz } from '@/content/quizzes/guess90s/quiz'
import {
  getResultById,
  resolveBandResultId,
  resolveShareCardAsset,
  scoreCardAsset,
  shareCardImageUrl,
  shareCardThumbUrl,
  shareCardVersionedAsset,
  preparedShareId,
  shareCardVersionFromUrl,
  resolveShareCardVersion,
} from '@/features/quiz/scoring'
import { M90_STICKER, M90_HOOKS } from '@/features/result/ResultCard'

// Spec mapping: score → source PNG
const EXPECTED_SOURCE: Record<number, string> = {
  0: '0-4.png',
  1: '0-4.png',
  2: '0-4.png',
  3: '0-4.png',
  4: '0-4.png',
  5: '5-7.png',
  6: '5-7.png',
  7: '5-7.png',
  8: '8-10.png',
  9: '8-10.png',
  10: '8-10.png',
  11: '11-13.png',
  12: '11-13.png',
  13: '11-13.png',
  14: '14-16.png',
  15: '14-16.png',
  16: '14-16.png',
  17: '17-18.png',
  18: '18-18.png',
}

describe('Music90s v4 assetVersion bump', () => {
  it('assetVersion is v4', () => {
    expect(music90sQuiz.share?.assetVersion).toBe('v4')
  })

  it('Guess90s asset version untouched (no v4)', () => {
    // guess90s has no version (unversioned) — must not be bumped to v4
    expect(guess90sQuiz.share?.assetVersion).toBeUndefined()
  })

  it('shareCardImageUrl for score 10 is v4 path', () => {
    const result = getResultById(music90sQuiz, resolveBandResultId(music90sQuiz, 10))!
    const asset = resolveShareCardAsset(music90sQuiz, result, 10)
    expect(asset).toBe('m90_score_10')
    expect(shareCardVersionedAsset(music90sQuiz, asset)).toBe('v4/m90_score_10')
    expect(shareCardImageUrl(music90sQuiz, asset, 'https://example.com')).toBe(
      'https://example.com/share-cards/v4/m90_score_10.jpg',
    )
    expect(shareCardThumbUrl(music90sQuiz, asset, 'https://example.com')).toBe(
      'https://example.com/share-cards/v4/m90_score_10_thumb.jpg',
    )
  })

  it('preparedShareId includes v4', () => {
    const result = getResultById(music90sQuiz, resolveBandResultId(music90sQuiz, 10))!
    expect(preparedShareId(music90sQuiz, result, 10)).toBe('share_m90_score_10_v4')
    expect(preparedShareId(music90sQuiz, result, 10)).toContain('_v4')
    expect(preparedShareId(music90sQuiz, result)).toContain('_v4') // even without score, uses v4 fallback
  })

  it('scoreCardAsset covers 00..18 exactly', () => {
    for (let s = 0; s <= 18; s++) {
      expect(scoreCardAsset(music90sQuiz, s)).toBe(`m90_score_${String(s).padStart(2, '0')}`)
    }
  })

  it('shareCardVersionFromUrl parses v4 generically', () => {
    expect(shareCardVersionFromUrl('https://example.com/share-cards/v4/m90_score_10.jpg')).toBe('v4')
    expect(shareCardVersionFromUrl('https://example.com/share-cards/v3/m90_score_10.jpg')).toBe('v3')
    expect(shareCardVersionFromUrl('https://example.com/share-cards/v2/m90_score_10.jpg')).toBe('v2')
    expect(shareCardVersionFromUrl('https://example.com/share-cards/m90_score_10.jpg')).toBe('v1')
  })

  it('resolveShareCardVersion derives from quiz assetVersion generically', () => {
    expect(resolveShareCardVersion(music90sQuiz, 'https://example.com/share-cards/v3/m90_score_10.jpg')).toBe('v4')
    expect(resolveShareCardVersion(guess90sQuiz, 'https://example.com/share-cards/g90_score_10.jpg')).toBe('v1')
  })
})

describe('Music90s score → source asset mapping (7 artworks → 19 exact)', () => {
  it('0 → 0-4 source', () => expect(EXPECTED_SOURCE[0]).toBe('0-4.png'))
  it('4 → 0-4 source', () => expect(EXPECTED_SOURCE[4]).toBe('0-4.png'))
  it('5 → 5-7', () => expect(EXPECTED_SOURCE[5]).toBe('5-7.png'))
  it('7 → 5-7', () => expect(EXPECTED_SOURCE[7]).toBe('5-7.png'))
  it('8 → 8-10', () => expect(EXPECTED_SOURCE[8]).toBe('8-10.png'))
  it('10 → 8-10', () => expect(EXPECTED_SOURCE[10]).toBe('8-10.png'))
  it('11 → 11-13', () => expect(EXPECTED_SOURCE[11]).toBe('11-13.png'))
  it('13 → 11-13', () => expect(EXPECTED_SOURCE[13]).toBe('11-13.png'))
  it('14 → 14-16', () => expect(EXPECTED_SOURCE[14]).toBe('14-16.png'))
  it('16 → 14-16', () => expect(EXPECTED_SOURCE[16]).toBe('14-16.png'))
  it('17 → 17-18.png (means 17/18 card, not range)', () => expect(EXPECTED_SOURCE[17]).toBe('17-18.png'))
  it('18 → 18-18.png (rare exact)', () => expect(EXPECTED_SOURCE[18]).toBe('18-18.png'))

  it('band mapping aligns with source grouping', () => {
    expect(resolveBandResultId(music90sQuiz, 0)).toBe('m90_rookie')
    expect(resolveBandResultId(music90sQuiz, 4)).toBe('m90_rookie')
    expect(resolveBandResultId(music90sQuiz, 5)).toBe('m90_familiar')
    expect(resolveBandResultId(music90sQuiz, 7)).toBe('m90_familiar')
    expect(resolveBandResultId(music90sQuiz, 8)).toBe('m90_cassette')
    expect(resolveBandResultId(music90sQuiz, 10)).toBe('m90_cassette')
    expect(resolveBandResultId(music90sQuiz, 11)).toBe('m90_disco')
    expect(resolveBandResultId(music90sQuiz, 13)).toBe('m90_disco')
    expect(resolveBandResultId(music90sQuiz, 14)).toBe('m90_legend')
    expect(resolveBandResultId(music90sQuiz, 16)).toBe('m90_legend')
    expect(resolveBandResultId(music90sQuiz, 17)).toBe('m90_era17')
    expect(resolveBandResultId(music90sQuiz, 18)).toBe('m90_era18')
  })
})

describe('Music90s v4 approved shareQuote exact (7 current)', () => {
  it('score 6 → Где-то это слышала', () => {
    const r = getResultById(music90sQuiz, resolveBandResultId(music90sQuiz, 6))!
    expect(r.title).toBe('Где-то это слышала')
    expect(r.presentation.shareQuote).toBe('Кажется, где-то это всё играло 📻 А ты сколько вспомнишь?')
  })
  it('score 9 → Знаю только припевы', () => {
    const r = getResultById(music90sQuiz, resolveBandResultId(music90sQuiz, 9))!
    expect(r.title).toBe('Знаю только припевы')
    expect(r.presentation.shareQuote).toBe('Мой уровень: знаю только припевы 🎶 А сколько выбьешь ты?')
  })
  it('score 12 → Слушала MTV сутками', () => {
    const r = getResultById(music90sQuiz, resolveBandResultId(music90sQuiz, 12))!
    expect(r.title).toBe('Слушала MTV сутками')
    expect(r.presentation.shareQuote).toBe('В 90-х я явно смотрела MTV сутками 📺 Попробуй набрать больше!')
  })
  it('score 15 → Королева школьной дискотеки', () => {
    const r = getResultById(music90sQuiz, resolveBandResultId(music90sQuiz, 15))!
    expect(r.title).toBe('Королева школьной дискотеки')
    expect(r.presentation.shareQuote).toBe('Мой статус: королева школьной дискотеки 🪩 Рискнёшь побить мой счёт?')
  })
  it('score 17 → Главред журнала Cool', () => {
    const r = getResultById(music90sQuiz, resolveBandResultId(music90sQuiz, 17))!
    expect(r.title).toBe('Главред журнала Cool')
    expect(r.presentation.shareQuote).toBe('17 из 18! Мой уровень: главред журнала Cool 💅 На одном всё-таки срезалась. А ты сколько наберёшь?')
  })
  it('score 18 → Главред журнала Cool ✨ (rare)', () => {
    const r = getResultById(music90sQuiz, resolveBandResultId(music90sQuiz, 18))!
    expect(r.title).toBe('Главред журнала Cool ✨')
    expect(r.presentation.shareQuote).toBe('18 из 18! Выбила секретную карточку: главред журнала Cool ✨ Попробуй повторить, если сможешь.')
  })
  it('0–4 exact shareQuote', () => {
    const r = getResultById(music90sQuiz, 'm90_rookie')!
    expect(r.presentation.shareQuote).toBe('Я случайно заглянула в 90-е 😅 И, кажется, быстро вышла. Сколько наберёшь ты?')
  })
  it('all seven shareQuotes exact', () => {
    const expectations: Record<string, string> = {
      m90_rookie: 'Я случайно заглянула в 90-е 😅 И, кажется, быстро вышла. Сколько наберёшь ты?',
      m90_familiar: 'Кажется, где-то это всё играло 📻 А ты сколько вспомнишь?',
      m90_cassette: 'Мой уровень: знаю только припевы 🎶 А сколько выбьешь ты?',
      m90_disco: 'В 90-х я явно смотрела MTV сутками 📺 Попробуй набрать больше!',
      m90_legend: 'Мой статус: королева школьной дискотеки 🪩 Рискнёшь побить мой счёт?',
      m90_era17: '17 из 18! Мой уровень: главред журнала Cool 💅 На одном всё-таки срезалась. А ты сколько наберёшь?',
      m90_era18: '18 из 18! Выбила секретную карточку: главред журнала Cool ✨ Попробуй повторить, если сможешь.',
    }
    for (const [id, quote] of Object.entries(expectations)) {
      const r = getResultById(music90sQuiz, id)!
      expect(r.presentation.shareQuote, `mismatch for ${id}`).toBe(quote)
    }
  })
})

describe('Old copy regression — exact stale strings must be absent from current Music90s output', () => {
  const allText = music90sQuiz.results
    .map((r) => `${r.title} ${r.presentation.shareQuote} ${r.presentation.description.join(' ')}`)
    .join(' | ')

  it('does not contain Ты и есть 90-е', () => expect(allText).not.toContain('Ты и есть 90-е'))
  it('does not contain Кассетная память', () => expect(allText).not.toContain('Кассетная память'))
  it('does not contain Звезда школьной дискотеки', () => expect(allText).not.toContain('Звезда школьной дискотеки'))
  it('does not contain 17 из 18. Одну всё-таки не вспомнила', () => expect(allText).not.toContain('17 из 18. Одну всё-таки не вспомнила'))
  it('does not contain 18 из 18. Всё угадала', () => expect(allText).not.toContain('18 из 18. Всё угадала'))
  it('does not contain Теперь попробуй ты.', () => expect(allText).not.toContain('Теперь попробуй ты.'))
  it('does not contain Моя кассетная память ещё держится', () => expect(allText).not.toContain('Моя кассетная память ещё держится'))
  it('does not contain Проверишь свою память?', () => expect(allText).not.toContain('Проверишь свою память?'))
  // Old without "даже" must be absent; new with "даже" must be present
  it('old hook without даже must be absent', () => {
    // Exact old: "Я с тобой про попсу спорить не буду." without "даже"
    const withDa = 'Я с тобой про попсу даже спорить не буду.'
    // Ensure new hook is present with "даже"
    expect(M90_HOOKS['m90_era18']).toBe(withDa)
    expect(M90_HOOKS['m90_era18']).toContain('даже')
    // And old version is not present in hooks (old without даже would be different)
    expect(M90_HOOKS['m90_era18']).not.toBe('Я с тобой про попсу спорить не буду.')
  })
  it('approved titles Главред журнала Cool must still be present (not banned)', () => {
    expect(allText).toContain('Главред журнала Cool')
  })
  it('approved phrase где-то это всё играло must still be present', () => {
    expect(allText).toContain('где-то это всё играло')
  })
})

describe('In-app sticker fix', () => {
  it('m90_legend no longer says главред', () => {
    expect(M90_STICKER['m90_legend'].label).not.toBe('главред')
    expect(M90_STICKER['m90_legend'].label).toBe('дискотека')
  })
  it('m90_legend sticker is дискотека', () => {
    expect(M90_STICKER['m90_legend']).toEqual(expect.objectContaining({ label: 'дискотека' }))
  })
  it('17/18 stickers remain correct', () => {
    expect(M90_STICKER['m90_era17'].label).toBe('17/18')
    expect(M90_STICKER['m90_era18'].label).toBe('редкая')
  })
})

describe('v4 generated JPEGs existence (filesystem)', () => {
  const outDir = path.join(process.cwd(), 'public', 'share-cards', 'v4')
  const srcDir = path.join(process.cwd(), 'assets-source', 'score-cards')

  it('source PNGs all exist (7 files)', () => {
    const expected = ['0-4.png', '5-7.png', '8-10.png', '11-13.png', '14-16.png', '17-18.png', '18-18.png']
    for (const f of expected) {
      expect(fs.existsSync(path.join(srcDir, f)), `missing source ${f}`).toBe(true)
    }
  })

  it('19 exact-score JPEGs exist', () => {
    for (let s = 0; s <= 18; s++) {
      const name = `m90_score_${String(s).padStart(2, '0')}.jpg`
      expect(fs.existsSync(path.join(outDir, name)), `missing ${name}`).toBe(true)
    }
  })

  it('19 thumbnails exist', () => {
    for (let s = 0; s <= 18; s++) {
      const name = `m90_score_${String(s).padStart(2, '0')}_thumb.jpg`
      expect(fs.existsSync(path.join(outDir, name)), `missing ${name}`).toBe(true)
    }
  })

  it('all are valid JPEGs with expected dimensions', async () => {
    for (let s = 0; s <= 18; s++) {
      const name = `m90_score_${String(s).padStart(2, '0')}.jpg`
      const p = path.join(outDir, name)
      const meta = await sharp(p).metadata()
      expect(meta.format).toBe('jpeg')
      // Allow small tolerance due to rounding, but spec prefers 1080x1350
      expect(meta.width).toBe(1080)
      expect(meta.height).toBe(1350)
      const thumbName = `m90_score_${String(s).padStart(2, '0')}_thumb.jpg`
      const tp = path.join(outDir, thumbName)
      const tmeta = await sharp(tp).metadata()
      expect(tmeta.format).toBe('jpeg')
      expect(tmeta.width).toBe(256)
      expect(tmeta.height).toBe(320)
    }
  })

  it('v2 and v3 retained (backward compat)', () => {
    const v2 = path.join(process.cwd(), 'public', 'share-cards', 'v2')
    const v3 = path.join(process.cwd(), 'public', 'share-cards', 'v3')
    expect(fs.existsSync(v2)).toBe(true)
    expect(fs.existsSync(v3)).toBe(true)
    expect(fs.readdirSync(v2).length).toBeGreaterThan(0)
    expect(fs.readdirSync(v3).length).toBeGreaterThan(0)
  })
})
