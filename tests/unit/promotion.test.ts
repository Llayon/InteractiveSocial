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
    expect(p.destinations.max).toBeUndefined()
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
    expect(resolvePromotionDestination(p, 'max')).toBeNull()
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
  it('MAX with no max destination shows no channel', () => {
    cleanup()
    const outcome = resolveOutcome(music90sQuiz, music90sQuiz.questions.map(q => ({ questionId: q.id, answerId: q.correctAnswerId! })))
    const adapter = mockAdapter('max')
    const { container } = render(React.createElement(ResultScreen, { quiz: music90sQuiz, outcome, adapter, onRestart: vi.fn() }))
    expect(container.querySelector('[data-testid="channel-link"]')).toBeNull()
    expect(container.querySelector('[data-testid="channel-promo-note"]')).toBeNull()
    expect(resolvePromotionDestination(music90sQuiz.channelPromotion, 'max')).toBeNull()
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
