import type { Result } from '../../../features/quiz/schema.js'

/**
 * guess90s score results — five bands covering 0..10.
 * Namespaced g90_* to guarantee global uniqueness.
 */
export const results: Result[] = [
  {
    id: 'g90_rookie',
    title: 'Ты случайно зашла в 90-е',
    presentation: {
      kind: 'score',
      subtitle: '0–3 из 10',
      description: [
        'Похоже, в 90-е ты была занята чем-то важным — например, не родилась.',
        'Хорошая новость: кассеты никуда не делись. Нажми PLAY ещё раз и попробуй вспомнить.',
      ],
      shareQuote: 'Я угадала только пару хитов по 4 секундам 🎧 А ты сколько угадаешь?',
      shareCta: 'Бросить вызов',
    },
    shareImage: 'score_00',
  },
  {
    id: 'g90_familiar',
    title: 'Где-то это слышала',
    presentation: {
      kind: 'score',
      subtitle: '4–5 из 10',
      description: [
        'Мелодии 90-х звучали у тебя на кухне, в такси или из чужого плеера — краем памяти ты их узнаёшь.',
        'До кассетного человека один плейлист.',
      ],
      shareQuote: 'Я угадала 5 из 10 хитов 90-х по 4 секундам. Побьёшь?',
      shareCta: 'Бросить вызов',
    },
    shareImage: 'score_04',
  },
  {
    id: 'g90_cassette',
    title: 'Кассетный человек',
    presentation: {
      kind: 'score',
      subtitle: '6–7 из 10',
      description: [
        'Ты помнишь 90-е руками: перемотка карандашом и одна любимая песня до шипения.',
        'Не идеальная память — зато настоящая.',
      ],
      shareQuote: 'Я — кассетный человек: 7 из 10 по 4 секундам. Сможешь больше?',
      shareCta: 'Бросить вызов',
    },
    shareImage: 'score_06',
  },
  {
    id: 'g90_disco',
    title: 'Дискотека 1999',
    presentation: {
      kind: 'score',
      subtitle: '8–9 из 10',
      description: [
        'Ты узнаёшь хит быстрее, чем успеваешь вспомнить, где лежат старые кассеты.',
        'Такая память не появляется у случайных людей.',
      ],
      shareQuote: 'Я угадала 8 из 10 хитов 90-х всего по 4 секундам 🎧 А ты сколько угадаешь?',
      shareCta: 'Бросить вызов',
    },
    shareImage: 'score_08',
  },
  {
    id: 'g90_legend',
    title: 'Легенда кассетного века',
    presentation: {
      kind: 'score',
      subtitle: '10 из 10',
      description: [
        'Безупречно. Ты помнишь 90-е так, будто держала пульт от всей страны.',
        'Осталось одно: доказать это друзьям.',
      ],
      shareQuote: 'Я легенда кассетного века — 10 из 10 по 4 секундам! Твой ход 🎧',
      shareCta: 'Бросить вызов',
    },
    shareImage: 'score_10',
  },
]
