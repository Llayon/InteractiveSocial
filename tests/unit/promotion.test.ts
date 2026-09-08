import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { Landing } from '@/features/landing/Landing'
import { ResultScreen } from '@/features/result/Result'
import { music90sQuiz } from '@/content/quizzes/music90s/quiz'
import { interiorCharacterQuiz } from '@/content/quizzes/interior-character/quiz'
import { guess90sQuiz } from '@/content/quizzes/guess90s/quiz'
import { resolveOutcome } from '@/features/quiz/scoring'
import { resolvePromotionDestination } from '@/features/quiz/promotion'
import type { MiniAppAdapter } from '@/platform/types'

function mockAdapter(platform: 'telegram' | 'max' | 'browser' | 'mock'): MiniAppAdapter {
  return {
    platform,
    mode: platform as unknown as MiniAppAdapter['mode'],
    ready: vi.fn(),
    expand: vi.fn(),
    getStartParam: vi.fn(() => null),
    getUser: vi.fn(() => null),
    getInitDataRaw: vi.fn(() => ''),
    haptic: vi.fn(),
  } as unknown as MiniAppAdapter
}

describe('promotion config', () => {
  it('music90s has exact approved copy', () => {
    const p = music90sQuiz.channelPromotion!
    expect(p.authorName).toBe('Бюро историй')
    expect(p.landingAttribution).toBe('тест от Бюро историй')
    expect(p.resultIntro).toBe('Я в канале иногда собираю похожие штуки и просто делюсь историями. Заглядывай.')
    expect(p.resultCta).toBe('Зайти в Бюро историй →')
    expect(p.shareFooter?.title).toBe('Бюро историй')
    expect(p.shareFooter?.handle).toBe('@takeiteasybefore')
    expect(p.destinations.telegram?.url).toBe('https://t.me/takeiteasybefore')
    expect(p.destinations.max?.url).toBe('https://max.ru/takeiteasybefore')
  })
  it('promotion is optional', () => {
    expect(interiorCharacterQuiz.channelPromotion).toBeUndefined()
    expect(guess90sQuiz.channelPromotion).toBeUndefined()
  })
  it('resolves telegram destination correctly, max not fallback', () => {
    const p = music90sQuiz.channelPromotion!
    expect(resolvePromotionDestination(p, 'telegram')).toBe('https://t.me/takeiteasybefore')
    expect(resolvePromotionDestination(p, 'browser')).toBe('https://t.me/takeiteasybefore')
    expect(resolvePromotionDestination(p, 'mock')).toBe('https://t.me/takeiteasybefore')
    expect(resolvePromotionDestination(p, 'max')).toBe('https://max.ru/takeiteasybefore')
  })
  it('max platform never falls back to telegram', () => {
    const onlyTelegram = { authorName: 'X', destinations: { telegram: { url: 'https://t.me/only' } } } as unknown as import('@/features/quiz/schema').ChannelPromotionConfig
    expect(resolvePromotionDestination(onlyTelegram, 'max')).toBeNull()
    expect(resolvePromotionDestination(onlyTelegram, 'telegram')).toBe('https://t.me/only')
  })
  it('landing renders attribution only when configured', () => {
    cleanup()
    render(React.createElement(Landing, { quiz: music90sQuiz, onStart: vi.fn() }))
    expect(screen.getByTestId('landing-attribution')).toHaveTextContent('тест от Бюро историй')
    cleanup()
    render(React.createElement(Landing, { quiz: interiorCharacterQuiz, onStart: vi.fn() }))
    expect(screen.queryByTestId('landing-attribution')).toBeNull()
    expect(interiorCharacterQuiz.channelPromotion).toBeUndefined()
    cleanup()
  })
})

describe('result ordering', () => {
  it('music90s result shows challenge before channel before restart on telegram', async () => {
    cleanup()
    const outcome = resolveOutcome(music90sQuiz, music90sQuiz.questions.map(q => ({ questionId: q.id, answerId: q.correctAnswerId! })))
    const adapter = mockAdapter('telegram')
    render(React.createElement(ResultScreen, { quiz: music90sQuiz, outcome, adapter, onRestart: vi.fn() }))
    const shareBtn = screen.getByTestId('share-button')
    const channelLink = screen.getByTestId('channel-link')
    const restart = screen.getByTestId('restart-button')
    const promoNote = screen.getByTestId('channel-promo-note')
    expect(shareBtn).toHaveTextContent('Бросить вызов')
    expect(promoNote).toHaveTextContent('Я в канале иногда собираю похожие штуки и просто делюсь историями. Заглядывай.')
    expect(channelLink).toHaveTextContent('Зайти в Бюро историй →')
    expect(channelLink.getAttribute('href')).toBe('https://t.me/takeiteasybefore')
    // order: share before channel before restart
    const order = [shareBtn, promoNote, channelLink, restart].map(el => {
      return Array.from(document.body.querySelectorAll('*')).indexOf(el)
    })
    for (let i=0;i<order.length-1;i++) expect(order[i]).toBeLessThan(order[i+1])
    cleanup()
  })
  it('MAX with max destination shows channel with MAX url', () => {
    cleanup()
    const outcome = resolveOutcome(music90sQuiz, music90sQuiz.questions.map(q => ({ questionId: q.id, answerId: q.correctAnswerId! })))
    const adapter = mockAdapter('max')
    render(React.createElement(ResultScreen, { quiz: music90sQuiz, outcome, adapter, onRestart: vi.fn() }))
    const channelLink = screen.getByTestId('channel-link')
    const promoNote = screen.getByTestId('channel-promo-note')
    const shareBtn = screen.getByTestId('share-button')
    const restart = screen.getByTestId('restart-button')
    expect(channelLink.getAttribute('href')).toBe('https://max.ru/takeiteasybefore')
    expect(channelLink).toHaveTextContent('Зайти в Бюро историй →')
    expect(promoNote).toHaveTextContent('Я в канале иногда собираю похожие штуки и просто делюсь историями. Заглядывай.')
    expect(resolvePromotionDestination(music90sQuiz.channelPromotion, 'max')).toBe('https://max.ru/takeiteasybefore')
    // order still challenge before channel before restart
    const order = [shareBtn, promoNote, channelLink, restart].map(el => {
      return Array.from(document.body.querySelectorAll('*')).indexOf(el)
    })
    for (let i=0;i<order.length-1;i++) expect(order[i]).toBeLessThan(order[i+1])
    // no telegram leakage in MAX result link
    expect(channelLink.getAttribute('href')).not.toContain('t.me')
    cleanup()
  })
  it('quizzes without promo show no channel', () => {
    cleanup()
    const answers = interiorCharacterQuiz.questions.map(q=>({questionId:q.id, answerId:q.answers[0].id}))
    const outcome2 = resolveOutcome(interiorCharacterQuiz, answers)
    const adapter = mockAdapter('telegram')
    const { container } = render(React.createElement(ResultScreen, { quiz: interiorCharacterQuiz, outcome: outcome2, adapter, onRestart: vi.fn() }))
    expect(container.querySelector('[data-testid="channel-link"]')).toBeNull()
    expect(container.querySelector('[data-testid="channel-promo-note"]')).toBeNull()
    cleanup()
  })
})

describe('MAX attachments — generic secondary promo', () => {
  it('buildMaxAttachments with secondaryButton adds Бюро историй row and no telegram leakage', async () => {
    const { buildMaxAttachments } = await import('../../api/_lib/maxMedia')
    const promoUrl = resolvePromotionDestination(music90sQuiz.channelPromotion, 'max')!
    expect(promoUrl).toBe('https://max.ru/takeiteasybefore')
    const attachments = buildMaxAttachments({ type: 'image', payload: { token: 'tok' } } as unknown as import('../../api/_lib/maxMedia').MaxImageAttachment, 'https://max.ru/test_bot?startapp=quiz_music90s', {
      secondaryButton: { text: 'Бюро историй', url: promoUrl },
    })
    expect(attachments).toHaveLength(2)
    // second element is keyboard
    const keyboard = attachments[1] as { payload: { buttons: Array<Array<{ text: string; url: string }>> } }
    expect(keyboard.payload.buttons).toHaveLength(2)
    expect(keyboard.payload.buttons[0][0].text).toBe('Пройти тест')
    expect(keyboard.payload.buttons[1][0].text).toBe('Бюро историй')
    expect(keyboard.payload.buttons[1][0].url).toBe('https://max.ru/takeiteasybefore')
    // no telegram URL in MAX attachments
    const json = JSON.stringify(attachments)
    expect(json).not.toContain('t.me')
    expect(json).toContain('max.ru')
  })

  it('buildMaxAttachments without secondary has only Пройти тест', async () => {
    const { buildMaxAttachments } = await import('../../api/_lib/maxMedia')
    const attachments = buildMaxAttachments({ type: 'image', payload: { token: 'tok' } } as unknown as import('../../api/_lib/maxMedia').MaxImageAttachment, 'https://max.ru/test_bot?startapp=quiz_music90s')
    const keyboard = attachments[1] as { payload: { buttons: Array<Array<{ text: string; url: string }>> } }
    expect(keyboard.payload.buttons).toHaveLength(1)
    expect(keyboard.payload.buttons[0][0].text).toBe('Пройти тест')
    expect(JSON.stringify(attachments)).not.toContain('Бюро историй')
  })

  it('MAX self-delivery secondaryButton derived from quiz config (generic, not hardcoded)', async () => {
    // verify that quiz config is source, not a literal in deliver file
    const fs = await import('node:fs')
    const deliverSrc = fs.readFileSync('api/max/results/deliver.ts', 'utf-8')
    // should use resolvePromotionDestination and channelPromotion.authorName, not hardcoded URL literal for secondary
    expect(deliverSrc).toContain('resolvePromotionDestination')
    expect(deliverSrc).toContain('channelPromotion')
    // must not contain hardcoded telegram url in max deliver secondary path
    const maxBlock = deliverSrc.slice(deliverSrc.indexOf('secondaryButton'))
    expect(maxBlock).not.toContain('https://t.me/takeiteasybefore')
    // promo url via quiz config should be max.ru
    expect(resolvePromotionDestination(music90sQuiz.channelPromotion, 'max')).toBe('https://max.ru/takeiteasybefore')
    expect(resolvePromotionDestination(music90sQuiz.channelPromotion, 'telegram')).toBe('https://t.me/takeiteasybefore')
  })

  it('MAX share prepare does NOT contain promo channel button', async () => {
    const fs = await import('node:fs')
    const prepareSrc = fs.readFileSync('api/max/share/prepare.ts', 'utf-8')
    // prepare must have only single keyboard row with Пройти тест, no Бюро историй
    expect(prepareSrc).toContain("text: 'Пройти тест'")
    expect(prepareSrc).not.toContain('Бюро историй')
    expect(prepareSrc).not.toContain('takeiteasybefore')
    // ensure prepare still uses buildMaxAttachments without secondary
    expect(prepareSrc).toContain('buildMaxAttachments')
    // but not with secondaryButton
    const secondaryInPrepare = (prepareSrc.match(/secondaryButton/g) || []).length
    expect(secondaryInPrepare).toBe(0)
  })

  it('MAX self-delivery handler sends MAX promo url, not telegram', async () => {
    const { buildMaxAttachments } = await import('../../api/_lib/maxMedia')
    // simulate deliver call: secondaryButton should be max url
    const promoUrl = resolvePromotionDestination(music90sQuiz.channelPromotion, 'max')!
    const tgUrl = resolvePromotionDestination(music90sQuiz.channelPromotion, 'telegram')!
    expect(promoUrl).not.toBe(tgUrl)
    const attachments = buildMaxAttachments(null, 'https://max.ru/bot?startapp=quiz_music90s', {
      secondaryButton: { text: music90sQuiz.channelPromotion!.authorName, url: promoUrl },
    })
    const json = JSON.stringify(attachments)
    expect(json).toContain(promoUrl)
    expect(json).not.toContain(tgUrl)
  })
})
