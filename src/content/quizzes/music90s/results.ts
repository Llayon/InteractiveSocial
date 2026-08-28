import type { Result } from '../../../features/quiz/schema.js'

/**
 * Music90s score results — five semantic bands (NOT one per score).
 * The exact score (7/10, 8/10 …) is rendered separately on top of the band
 * and drives the exact-score share card set (score_00 … score_10).
 * Result ids are globally namespaced (m90_*) per the registry policy.
 */
export const results: Result[] = [
  {
    id: 'm90_rookie',
    title: 'Ты случайно зашла в 90-е',
    presentation: {
      kind: 'score',
      subtitle: '0–2 из 10',
      description: [
        'Похоже, в 90-е ты была занята чем-то важным — например, не родилась.',
        'Хорошая новость: кассеты никуда не делись, их можно прослушать заново. Прямо сейчас.',
      ],
      shareQuote: 'Я случайно зашла в 90-е — и набрала мало. Побьёшь мой счёт?',
      shareCta: 'Бросить вызов',
    },
    shareImage: 'score_00',
  },
  {
    id: 'm90_familiar',
    title: 'Ты где-то это слышала',
    presentation: {
      kind: 'score',
      subtitle: '3–4 из 10',
      description: [
        'Эти мелодии звучали где-то на кухне, в такси или в чужом плеере — и ты их помнишь краем души.',
        'До кассетного человека тебе один плейлист.',
      ],
      shareQuote: 'Я где-то это слышала. Угадаешь больше?',
      shareCta: 'Бросить вызов',
    },
    shareImage: 'score_04',
  },
  {
    id: 'm90_cassette',
    title: 'Кассетный человек',
    presentation: {
      kind: 'score',
      subtitle: '5–6 из 10',
      description: [
        'Ты знаешь 90-е руками: перемотка карандашом, альбом на два бобины и одна любимая песня, стёршаяся до шипения.',
        'Не идеальная память — зато настоящая.',
      ],
      shareQuote: 'Я кассетный человек. Проверь, помнишь ли ты больше.',
      shareCta: 'Бросить вызов',
    },
    shareImage: 'score_06',
  },
  {
    id: 'm90_disco',
    title: 'Дискотека 1999',
    presentation: {
      kind: 'score',
      subtitle: '7–8 из 10',
      description: [
        'Ты не просто помнишь 90-е — ты помнишь, под что танцевали.',
        'Такая память не появляется у случайных людей.',
      ],
      shareQuote: 'Дискотека 1999 засчитана. Сможешь больше?',
      shareCta: 'Бросить вызов',
    },
    shareImage: 'score_08',
  },
  {
    id: 'm90_legend',
    title: 'Легенда кассетного века',
    presentation: {
      kind: 'score',
      subtitle: '9–10 из 10',
      description: [
        'Почти безупречно. Ты помнишь 90-е так, будто держала пульт от всей страны.',
        'Осталось одно: доказать это друзьям.',
      ],
      shareQuote: 'Я легенда кассетного века. Твой ход.',
      shareCta: 'Бросить вызов',
    },
    shareImage: 'score_10',
  },
]
