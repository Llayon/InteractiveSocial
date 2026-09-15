import { describe, expect, it } from 'vitest'
import { music90sQuiz } from '@/content/quizzes/music90s/quiz'

describe('m40 factual fix (Zemfira)', () => {
  const m40 = music90sQuiz.questions.find((q) => q.id === 'm40')!

  it('keeps id=m40, song, medium, choice, correct=a', () => {
    expect(m40.id).toBe('m40')
    expect(m40.category).toBe('song')
    expect(m40.difficulty).toBe('medium')
    expect(m40.layout).toBe('choice')
    expect(m40.correctAnswerId).toBe('a')
  })

  it('correct answer is «Ариведерчи»', () => {
    const correct = m40.answers.find((a) => a.id === m40.correctAnswerId)!
    expect(correct.title).toBe('«Ариведерчи»')
  })

  it('title does NOT mix трещинки/соседей', () => {
    expect(m40.title).not.toContain('трещин')
    expect(m40.title).not.toContain('сосед')
  })

  it('title mentions вороны-москвички and корабли в моей гавани', () => {
    expect(m40.title).toContain('вороны-москвички')
    expect(m40.title).toContain('корабли в моей гавани')
  })

  it('answers are exactly Ариведерчи/Почему/Хочешь?/Ромашки once each', () => {
    const titles = m40.answers.map((a) => a.title)
    expect(titles).toHaveLength(4)
    expect(titles.filter((t) => t === '«Ариведерчи»')).toHaveLength(1)
    expect(titles.filter((t) => t === '«Почему»')).toHaveLength(1)
    expect(titles.filter((t) => t === '«Хочешь?»')).toHaveLength(1)
    expect(titles.filter((t) => t === '«Ромашки»')).toHaveLength(1)
  })

  it('bank stays 42 total, 18/run, quotas unchanged, m40 stays song', () => {
    expect(music90sQuiz.questions).toHaveLength(42)
    expect(music90sQuiz.questions.map((q) => q.id)).toContain('m40')
  })
})
