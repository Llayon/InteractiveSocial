import type { Result } from '../../../features/quiz/schema.js'

/**
 * Music90s score results — seven semantic bands covering 0..18.
 * The exact score (7/18, 17/18, 18/18 …) is rendered separately on top of the band
 * and drives the exact-score share card set (m90_score_00 … m90_score_18).
 * Result ids are globally namespaced (m90_*) per the registry policy.
 * Backward compat: m90_legend (code 'lg') is retained for 14–16 — old s2_m90_lg_* links still resolve.
 * Two new ids m90_era17 / m90_era18 (codes 'l7' / 'l8') are standalone 17 and 18 outcomes.
 * Quiz-scoped asset keys prevent collision with guess90s (g90_score_09 = 9/20 vs m90_score_09 = 9/18).
 */
export const results: Result[] = [
  {
    id: 'm90_rookie',
    title: 'Случайно заглянула в 90-е',
    presentation: {
      kind: 'score',
      subtitle: '0–4 из 18',
      description: [
        'Похоже, эта эпоха пролетела совсем мимо.',
        'Но тебе простительно — скорее всего, ты тогда ещё даже не родилась.',
        'Зато теперь понятно, с чего начинать ликбез и что закинуть в плейлист на вечер.',
      ],
      shareQuote: 'Я случайно заглянула в 90-е 😅\n\nИ, кажется, быстро вышла. Сколько наберёшь ты?',
      shareCta: 'Бросить вызов',
    },
    shareImage: 'm90_score_00',
  },
  {
    id: 'm90_familiar',
    title: 'Где-то это играло',
    presentation: {
      kind: 'score',
      subtitle: '5–7 из 18',
      description: [
        'Что-то смутно всплывает в памяти.',
        'Обрывками — из радио в папиной девятке, с телевизора на кухне или из комнаты старшей сестры, пока та мотала кассету карандашом.',
        'Имена уже путаются, а вот всё остальное почему-то помнишь.',
      ],
      shareQuote: 'Кажется, где-то это всё играло 📻\n\nПроверишь свою память?',
      shareCta: 'Бросить вызов',
    },
    shareImage: 'm90_score_05',
  },
  {
    id: 'm90_cassette',
    title: 'Кассетная память',
    presentation: {
      kind: 'score',
      subtitle: '8–10 из 18',
      description: [
        'База на месте.',
        'Тополиный пух, анкеты в тетрадках с вопросом про того самого мальчика и клипы по пузатому телеку всё-таки застряли где-то глубоко в голове.',
        'Плёнку местами заедает, но знакомый мотив ты подхватишь с полуслова.',
      ],
      shareQuote: 'Моя кассетная память ещё держится 📼\n\nА ты сколько вспомнишь?',
      shareCta: 'Бросить вызов',
    },
    shareImage: 'm90_score_08',
  },
  {
    id: 'm90_disco',
    title: 'Звезда школьной дискотеки',
    presentation: {
      kind: 'score',
      subtitle: '11–13 из 18',
      description: [
        'Сразу видно человека с опытом.',
        'Ты отлично помнишь, под что танцевали первый медляк у стены спортзала, под что рыдали в подушку, а под какой трек прыгали так, что тряслись полы.',
        'Зачёт автоматом, дискотека удалась.',
      ],
      shareQuote: 'Мой статус: звезда школьной дискотеки 🪩\n\nПопробуй набрать больше!',
      shareCta: 'Бросить вызов',
    },
    shareImage: 'm90_score_11',
  },
  {
    id: 'm90_legend',
    title: 'Главред журнала Cool',
    presentation: {
      kind: 'score',
      subtitle: '14–16 из 18',
      description: [
        'Тебя так просто не срежешь.',
        'Ты без запинки перечислишь солистов «Иванушек», помнишь самые дикие клипы и наверняка помнишь, ради чьего постера покупался очередной номер.',
        'Признавайся: подшивка Cool дома была? Только честно.',
      ],
      shareQuote: 'Мой уровень: главный редактор журнала Cool 💅\n\nТвой ход — рискнёшь повторить?',
      shareCta: 'Бросить вызов',
    },
    shareImage: 'm90_score_14',
  },
  {
    id: 'm90_era17',
    title: 'Ты и есть 90-е',
    presentation: {
      kind: 'score',
      subtitle: '17 из 18',
      description: [
        '17 из 18. Одну всё-таки не вспомнила.',
        'Но семнадцать правильных ответов — это тот случай, когда спорить с тобой про попсу 90-х себе дороже.',
        'Джинсы-клёш с блёстками носила?',
      ],
      shareQuote: '17 из 18. Одну всё-таки не вспомнила 👑\n\nА у тебя сколько?',
      shareCta: 'Бросить вызов',
    },
    shareImage: 'm90_score_17',
  },
  {
    id: 'm90_era18',
    title: 'Ты и есть 90-е',
    presentation: {
      kind: 'score',
      subtitle: '18 из 18',
      description: [
        '18 из 18. Всё.',
        'Мы даже специально оставили пару вопросов посложнее. Не помогло.',
        'Ладно, сдаёмся. Чей постер висел над кроватью?',
      ],
      shareQuote: '18 из 18. Всё угадала 👑\n\nТеперь попробуй ты.',
      shareCta: 'Бросить вызов',
    },
    shareImage: 'm90_score_18',
  },
]
