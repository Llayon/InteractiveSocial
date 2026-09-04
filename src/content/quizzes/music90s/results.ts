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
      shareQuote: 'Я случайно заглянула в 90-е 😅 И, кажется, быстро вышла. Сколько наберёшь ты?',
      shareCta: 'Бросить вызов',
    },
    shareImage: 'm90_score_00',
  },
  {
    id: 'm90_familiar',
    title: 'Где-то это слышала',
    presentation: {
      kind: 'score',
      subtitle: '5–7 из 18',
      description: [
        'Обрывками — из папиной девятки, с телевизора на кухне или из комнаты старшей сестры.',
        'Имена исполнителей уже путаются, но фоновый шум детства никуда не делся.',
      ],
      shareQuote: 'Кажется, где-то это всё играло 📻 А ты сколько вспомнишь?',
      shareCta: 'Бросить вызов',
    },
    shareImage: 'm90_score_05',
  },
  {
    id: 'm90_cassette',
    title: 'Знаю только припевы',
    presentation: {
      kind: 'score',
      subtitle: '8–10 из 18',
      description: [
        '«Тополиный пух», анкеты с секретиками и клипы по пузатому телеку застряли где-то глубоко в голове.',
        'Авторов и запевы память уже стирает, но знакомый мотив ты подхватишь с первой ноты.',
      ],
      shareQuote: 'Мой уровень: знаю только припевы 🎶 А сколько выбьешь ты?',
      shareCta: 'Бросить вызов',
    },
    shareImage: 'm90_score_08',
  },
  {
    id: 'm90_disco',
    title: 'Слушала MTV сутками',
    presentation: {
      kind: 'score',
      subtitle: '11–13 из 18',
      description: [
        'Ты отлично помнишь клипы после школы, тетрадки с наклейками и вечерние хит-парады.',
        'Парочку каверзных вопросов ты упустила, но золотой фонд эпохи у тебя в голове в полном порядке.',
      ],
      shareQuote: 'В 90-х я явно смотрела MTV сутками 📺 Попробуй набрать больше!',
      shareCta: 'Бросить вызов',
    },
    shareImage: 'm90_score_11',
  },
  {
    id: 'm90_legend',
    title: 'Королева школьной дискотеки',
    presentation: {
      kind: 'score',
      subtitle: '14–16 из 18',
      description: [
        'Тебя так просто не срежешь.',
        'Ты без подсказок знаешь, под какой трек тряслись полы в спортзале, а под какой плакали в подушку.',
        'Солидное танцевальное прошлое не скрыть.',
      ],
      shareQuote: 'Мой статус: королева школьной дискотеки 🪩 Рискнёшь побить мой счёт?',
      shareCta: 'Бросить вызов',
    },
    shareImage: 'm90_score_14',
  },
  {
    id: 'm90_era17',
    title: 'Главред журнала Cool',
    presentation: {
      kind: 'score',
      subtitle: '17 из 18',
      description: [
        '17 из 18. Спорить с тобой про попсу 90-х — себе дороже.',
        'Ты помнишь всё: от солистов до скандалов в номерах.',
        'Та единственная ошибка списывается на опечатку в типографии.',
      ],
      shareQuote: '17 из 18! Мой уровень: главред журнала Cool 💅 На одном всё-таки срезалась. А ты сколько наберёшь?',
      shareCta: 'Бросить вызов',
    },
    shareImage: 'm90_score_17',
  },
  {
    id: 'm90_era18',
    title: 'Главред журнала Cool ✨',
    presentation: {
      kind: 'score',
      subtitle: '18 из 18',
      description: [
        '18 из 18. Ни единой осечки.',
        'Ощущение, что ты сама верстала те номера, утверждала плакаты в печать и лично знала всех продюсеров.',
        'Сдаюсь, это чистый абсолют.',
      ],
      shareQuote: '18 из 18! Выбила секретную карточку: главред журнала Cool ✨ Попробуй повторить, если сможешь.',
      shareCta: 'Бросить вызов',
    },
    shareImage: 'm90_score_18',
  },
]
