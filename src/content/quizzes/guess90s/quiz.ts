import { results } from './results.js'
import { guess90sCatalog } from './catalog.js'
import type { Question, Quiz } from '../../../features/quiz/schema.js'

/**
 * guess90s — audio-preview 90s music quiz.
 * Catalog: 20 entries (all verified). Playthrough: all 20 deterministically.
 * Each question uses audio-preview content branching (content.kind), never quiz.id.
 */

function buildQuestions(): Question[] {
  // Full 20-track playthrough
  const playthrough = guess90sCatalog.slice(0, 20)

  return playthrough.map((entry, idx) => {
    const questionId = `g${idx + 1}`
    const correctTitle = `${entry.artist} — ${entry.track}`

    // Distractors: next 3 entries circularly (deterministic, no overlap with correct)
    const distractors: string[] = []
    let offset = 1
    while (distractors.length < 3) {
      const cand = guess90sCatalog[(idx + offset) % guess90sCatalog.length]
      const title = `${cand.artist} — ${cand.track}`
      if (title !== correctTitle && !distractors.includes(title)) {
        distractors.push(title)
      }
      offset++
      if (offset > 30) break // safety
    }

    // Ensure exactly 4 options, deterministic shuffle: correct always 'a' for test determinism,
    // but we could rotate to avoid pattern. Keep 'a' as correct for simplicity and test determinism.
    const answers = [
      { id: 'a', title: correctTitle },
      { id: 'b', title: distractors[0] },
      { id: 'c', title: distractors[1] },
      { id: 'd', title: distractors[2] },
    ]

    const question: Question = {
      id: questionId,
      title: 'Угадай хит с 4 секунд',
      layout: 'choice',
      category: 'audio',
      correctAnswerId: 'a',
      content: {
        kind: 'audio-preview',
        provider: 'apple-itunes',
        trackId: entry.trackId,
        previewUrl: entry.previewUrl,
        trackViewUrl: entry.trackViewUrl,
        startSeconds: entry.startSeconds,
        durationSeconds: 4,
        attribution: 'Preview provided courtesy of Apple',
        trackTitle: entry.track,
        artistName: entry.artist,
      },
      answers,
    }
    return question
  })
}

export const questions: Question[] = buildQuestions()

export const guess90sQuiz: Quiz = {
  id: 'guess90s',
  title: 'Угадай хит 90-х с 4 секунд',
  subtitle: '20 хитов · 4 секунды на каждый · узнаешь?',
  landing: {
    paragraphs: [
      'Нажми PLAY — услышишь 4 секунды хита из 90-х.',
      'Угадай трек быстрее, чем вспомнишь, где лежат старые кассеты.',
      'Никаких подсказок — только слух и память.',
    ],
    meta: ['20 вопросов', 'около 4 минут'],
  },
  startCta: 'Угадать хит',
  shareCtaIntro: 'Поделись результатом и брось вызов друзьям ↓',
  shareCta: 'Бросить вызов',
  restartCta: 'Пройти ещё раз',
  copy: {
    eyebrow: 'аудио-тест',
    shareHeadline: 'Угадай хит 90-х с 4 секунд — проверим память:',
    deliverOwnLine: 'Это твой результат по хитам 90-х ✨',
  },
  questions,
  results,
  scoring: {
    kind: 'correct-count',
    bands: [
      { min: 0, max: 5, resultId: 'g90_rookie' },
      { min: 6, max: 10, resultId: 'g90_familiar' },
      { min: 11, max: 14, resultId: 'g90_cassette' },
      { min: 15, max: 18, resultId: 'g90_disco' },
      { min: 19, max: 20, resultId: 'g90_legend' },
    ],
  },
  presentation: { kind: 'score' },
  answerBehavior: { mode: 'feedback', durationMs: 900, correctMessage: 'Точно! Слух не подвёл.', wrongMessage: 'Мимо — но кассета помнит всё.' },
  reveal: {
    steps: ['Кассеты', 'Плей', 'Твой счёт'],
    stepDurationMs: 250,
  },
}
