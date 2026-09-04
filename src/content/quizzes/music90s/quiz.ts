import { results } from './results.js'
import type { Question, Quiz } from '../../../features/quiz/schema.js'

/**
 * Music90s content — 18 FIXED questions: factual gate covers all 18.
 * Content safety: song titles, artist names and years only.
 * No lyrics, no album art, no audio, no third-party media.
 *
 * Answer ids (a/b/c/d) are reused across questions: identity is compound (questionId, answerId).
 * Fixed order, no random pool, no seed, no timer.
 */
export const questions: Question[] = [
  {
    id: 'm1',
    category: 'emoji',
    difficulty: 'easy',
    layout: 'choice',
    title: 'Какой хит зашифрован?\n\n💌 ➡️ 📭 😔 ❤️',
    correctAnswerId: 'a',
    feedback: {
      correct: 'В точку!',
      wrong: 'Эх, мимо.',
    },
    answers: [
      { id: 'a', title: '«Крошка моя»' },
      { id: 'b', title: '«Алёшка»' },
      { id: 'c', title: '«Он тебя целует»' },
      { id: 'd', title: '«Чужие губы»' },
    ],
  },
  {
    id: 'm2',
    category: 'music-video',
    difficulty: 'medium',
    layout: 'choice',
    title: 'Чей томный взгляд и расстёгнутая рубашка в клипе «Позови меня в ночи» сводили с ума девчонок по всей стране?',
    correctAnswerId: 'b',
    feedback: {
      correct: 'Зачёт!',
      wrong: 'Не-а, не то.',
    },
    answers: [
      { id: 'a', title: 'Кай Метов' },
      { id: 'b', title: 'Влад Сташевский' },
      { id: 'c', title: 'Дмитрий Маликов' },
      { id: 'd', title: 'Женя Белоусов' },
    ],
  },
  {
    id: 'm3',
    category: 'artist-history',
    difficulty: 'easy',
    layout: 'choice',
    title: 'Кто до сольной карьеры пела в группе «Комбинация»?',
    correctAnswerId: 'b',
    feedback: {
      correct: 'В яблочко!',
      wrong: 'Чуть-чуть не туда.',
    },
    answers: [
      { id: 'a', title: 'Лада Дэнс' },
      { id: 'b', title: 'Алёна Апина' },
      { id: 'c', title: 'Татьяна Овсиенко' },
      { id: 'd', title: 'Наталья Ветлицкая' },
    ],
  },
  {
    id: 'm4',
    category: 'song-recognition',
    difficulty: 'medium',
    layout: 'choice',
    title: 'Какой хит конца 90-х заставлял смотреть в мокрое окно и страдать так, будто жизнь навсегда разбита?',
    correctAnswerId: 'a',
    feedback: {
      correct: 'База на месте.',
      wrong: 'Фальшивая нота.',
    },
    answers: [
      { id: 'a', title: '«Одинокий голубь» (Яна)' },
      { id: 'b', title: '«Ветер с моря дул» (Натали)' },
      { id: 'c', title: '«Чашка кофию» (Марина Хлебникова)' },
      { id: 'd', title: '«Маленькая страна» (Наташа Королёва)' },
    ],
  },
  {
    id: 'm5',
    category: 'timeline',
    difficulty: 'medium',
    layout: 'choice',
    title: 'Какой из этих хитов вышел уже в нулевых, а НЕ в 90-х?',
    correctAnswerId: 'd',
    feedback: {
      correct: 'Знаешь наизусть!',
      wrong: 'Срезалась!',
    },
    answers: [
      { id: 'a', title: '«Сэра»' },
      { id: 'b', title: '«Ветер с моря дул»' },
      { id: 'c', title: '«Мальчик хочет в Тамбов»' },
      { id: 'd', title: '«Я сошла с ума»' },
    ],
  },
  {
    id: 'm6',
    category: 'mismatch',
    difficulty: 'medium',
    layout: 'choice',
    title: 'В какой паре «исполнитель — песня» спрятана ошибка?',
    correctAnswerId: 'c',
    feedback: {
      correct: 'С первой ноты.',
      wrong: 'Мимо кассы.',
    },
    answers: [
      { id: 'a', title: 'Линда — «Ворона»' },
      { id: 'b', title: 'Андрей Губин — «Мальчик-бродяга»' },
      { id: 'c', title: 'Натали — «Мальчик хочет в Тамбов»' },
      { id: 'd', title: 'Технология — «Нажми на кнопку»' },
    ],
  },
  {
    id: 'm7',
    category: 'tv-culture',
    difficulty: 'easy',
    layout: 'choice',
    title: 'Какая легендарная пара вела «Бодрое утро» на MTV Россия, под шутки которых собирались в школу и институт?',
    correctAnswerId: 'b',
    feedback: {
      correct: 'Без шансов для ошибки.',
      wrong: 'Не угадала.',
    },
    answers: [
      { id: 'a', title: 'Яна Чурикова и Александр Анатольевич' },
      { id: 'b', title: 'Ольга Шелест и Антон Комолов' },
      { id: 'c', title: 'Тутта Ларсен и Вася Стрельников' },
      { id: 'd', title: 'Аврора и Лера Кудрявцева' },
    ],
  },
  {
    id: 'm8',
    category: 'pop-culture',
    difficulty: 'easy',
    layout: 'choice',
    title: 'Какой журнал в конце 90-х прятали под подушку от родителей ради постеров, анкет и честных ответов про мальчиков?',
    correctAnswerId: 'b',
    feedback: {
      correct: 'Красиво!',
      wrong: 'Рядом, но нет.',
    },
    answers: [
      { id: 'a', title: '«Ровесник»' },
      { id: 'b', title: '«Cool Girl»' },
      { id: 'c', title: '«Крестьянка»' },
      { id: 'd', title: '«Бурда Моден»' },
    ],
  },
  {
    id: 'm9',
    category: 'artist',
    difficulty: 'easy',
    layout: 'choice',
    title: 'Что из этого — сценическое имя одного артиста, а не название группы?',
    correctAnswerId: 'c',
    feedback: {
      correct: 'Точно в ритм.',
      wrong: 'Память подвела.',
    },
    answers: [
      { id: 'a', title: 'Hi-Fi' },
      { id: 'b', title: 'Демо' },
      { id: 'c', title: 'Mr. Credo' },
      { id: 'd', title: 'Вирус!' },
    ],
  },
  {
    id: 'm10',
    category: 'producer',
    difficulty: 'medium',
    layout: 'choice',
    title: 'Кто придумал мрачный стиль певицы Линды и написал музыку к «Вороне» и «Мало огня»?',
    correctAnswerId: 'b',
    feedback: {
      correct: 'Память не подводит!',
      wrong: 'Слишком сложно?',
    },
    answers: [
      { id: 'a', title: 'Игорь Матвиенко' },
      { id: 'b', title: 'Максим Фадеев' },
      { id: 'c', title: 'Бари Алибасов' },
      { id: 'd', title: 'Юрий Айзеншпис' },
    ],
  },
  {
    id: 'm11',
    category: 'group-history',
    difficulty: 'medium',
    layout: 'choice',
    title: 'Какую девичью группу в конце 90-х называли «русскими Spice Girls», где у каждой солистки был свой образ — от «радистки» до пацанки?',
    correctAnswerId: 'b',
    feedback: {
      correct: 'Классика.',
      wrong: 'Не тот трек.',
    },
    answers: [
      { id: 'a', title: 'Блестящие' },
      { id: 'b', title: 'Стрелки' },
      { id: 'c', title: 'Лицей' },
      { id: 'd', title: 'Комбинация' },
    ],
  },
  {
    id: 'm12',
    category: 'absurd-description',
    difficulty: 'medium',
    layout: 'choice',
    title: 'Какой хит «Иванушек» звучит как мем: «POV: на улице жара +30, а вокруг почему-то сугробы»?',
    correctAnswerId: 'b',
    feedback: {
      correct: 'Как по нотам!',
      wrong: 'Обидно, но мимо.',
    },
    answers: [
      { id: 'a', title: '«Тучи»' },
      { id: 'b', title: '«Тополиный пух»' },
      { id: 'c', title: '«Кукла»' },
      { id: 'd', title: '«Снегири»' },
    ],
  },
  {
    id: 'm13',
    category: 'artist-image',
    difficulty: 'easy',
    layout: 'choice',
    title: 'Чей сценический образ в 90-х запомнился всем: шуба на голое тело, платформы и полное отсутствие передних зубов?',
    correctAnswerId: 'a',
    feedback: {
      correct: 'Легчайшая.',
      wrong: 'Спутала!',
    },
    answers: [
      { id: 'a', title: 'Шура' },
      { id: 'b', title: 'Богдан Титомир' },
      { id: 'c', title: 'Никита' },
      { id: 'd', title: 'Кай Метов' },
    ],
  },
  {
    id: 'm14',
    category: 'music-video',
    difficulty: 'hard',
    layout: 'choice',
    title: 'В каком клипе 90-х тусуется богема, певицу похищают Бондарчук и Паук, а всё происходящее похоже на русский криминальный фильм?',
    correctAnswerId: 'b',
    feedback: {
      correct: 'Ни секунды сомнений!',
      wrong: 'Увы, не угадала.',
    },
    answers: [
      { id: 'a', title: 'Линда — «Ворона»' },
      { id: 'b', title: 'Лика Стар — «Одинокая луна»' },
      { id: 'c', title: 'Наталья Ветлицкая — «Посмотри в глаза»' },
      { id: 'd', title: 'Мумий Тролль — «Владивосток 2000»' },
    ],
  },
  {
    id: 'm15',
    category: 'absurd-description',
    difficulty: 'medium',
    layout: 'choice',
    title: 'Какой хит 90-х сегодня подошёл бы на роль статуса в Telegram перед удалением аккаунта?',
    correctAnswerId: 'a',
    feedback: {
      correct: 'Золотой фонд.',
      wrong: 'Мимо нот.',
    },
    answers: [
      { id: 'a', title: '«Ты меня не ищи»' },
      { id: 'b', title: '«Позови меня с собой»' },
      { id: 'c', title: '«Беги от меня»' },
      { id: 'd', title: '«Плачь, плачь»' },
    ],
  },
  {
    id: 'm16',
    category: 'music-video',
    difficulty: 'hard',
    layout: 'choice',
    title: 'В каком клипе певица в серебристом мини-платье и с каре танцует в павильоне среди софитов и операторских рельсов?',
    correctAnswerId: 'b',
    feedback: {
      correct: 'Чистая победа.',
      wrong: 'Не попала в такт.',
    },
    answers: [
      { id: 'a', title: 'Лада Дэнс — «Девочка-ночь»' },
      { id: 'b', title: 'Наталья Ветлицкая — «Посмотри в глаза»' },
      { id: 'c', title: 'Татьяна Овсиенко — «Школьная пора»' },
      { id: 'd', title: 'Ирина Салтыкова — «Серые глаза»' },
    ],
  },
  {
    id: 'm17',
    category: 'artist-image',
    difficulty: 'medium',
    layout: 'choice',
    title: 'Какой романтичный певец в 90-е убедил девчонок, что мальчикам тоже не стыдно страдать и плакать от любви?',
    correctAnswerId: 'b',
    feedback: {
      correct: 'Уровень: профи.',
      wrong: 'Ай, осечка!',
    },
    answers: [
      { id: 'a', title: 'Влад Сташевский' },
      { id: 'b', title: 'Андрей Губин' },
      { id: 'c', title: 'Кай Метов' },
      { id: 'd', title: 'Влад Топалов' },
    ],
  },
  {
    id: 'm18',
    category: 'era-culture',
    difficulty: 'easy',
    layout: 'choice',
    title: 'Главный лайфхак школьных дискотек 90-х: на что ставили чёлку-каркас, если под рукой не было лака «Прелесть»?',
    correctAnswerId: 'b',
    feedback: {
      correct: 'Абсолют!',
      wrong: 'Тут не срослось.',
    },
    answers: [
      { id: 'a', title: 'На пиво' },
      { id: 'b', title: 'На сахарную воду' },
      { id: 'c', title: 'На мыльную пену' },
      { id: 'd', title: 'На мучной клейстер' },
    ],
  },
]

/** Approved Music90s definition, validated by loadQuiz() before use. */
export const music90sQuiz: Quiz = {
  id: 'music90s',
  title: 'Ты точно помнишь музыку 90-х?',
  subtitle: '18 вопросов о хитах, клипах и той самой жизни в 90-х.',
  landing: {
    paragraphs: [
      'Кассеты перематывали карандашом, а хиты знали наизусть.',
      'Восемнадцать вопросов — и станет ясно, где ты была в 1999-м: на дискотеке или в другой комнате.',
      'Отвечай быстро, не гугли.',
    ],
    meta: ['18 вопросов', 'около 4 минут'],
  },
  startCta: 'Проверить память',
  shareCtaIntro: 'Пусть попробуют побить твой счёт ↓',
  shareCta: 'Бросить вызов',
  restartCta: 'Пройти ещё раз',
  channelPromotion: {
    authorName: 'Бюро историй',
    landingAttribution: 'тест от Бюро историй',
    resultIntro: 'Я в канале иногда собираю похожие штуки и просто делюсь историями. Заглядывай.',
    resultCta: 'Зайти в Бюро историй →',
    shareFooter: {
      title: 'Бюро историй',
      handle: '@takeiteasybefore',
    },
    destinations: {
      telegram: { url: 'https://t.me/takeiteasybefore' },
    },
  },
  share: {
    assetPrefix: 'm90',
    assetVersion: 'v4',
  },
  copy: {
    eyebrow: 'музыкальный тест',
    shareHeadline: 'Ты точно помнишь музыку 90-х? Проверь себя:',
    deliverOwnLine: 'Это твой счёт по музыке 90-х ✨',
  },
  questions,
  results,
  scoring: {
    kind: 'correct-count',
    bands: [
      { min: 0, max: 4, resultId: 'm90_rookie' },
      { min: 5, max: 7, resultId: 'm90_familiar' },
      { min: 8, max: 10, resultId: 'm90_cassette' },
      { min: 11, max: 13, resultId: 'm90_disco' },
      { min: 14, max: 16, resultId: 'm90_legend' },
      { min: 17, max: 17, resultId: 'm90_era17' },
      { min: 18, max: 18, resultId: 'm90_era18' },
    ],
  },
  presentation: { kind: 'score' },
  answerBehavior: { mode: 'feedback', durationMs: 900, correctMessage: 'Верно.', wrongMessage: 'Не угадала.' },
  reveal: {
    steps: ['Кассеты', 'Диски', 'Твой счёт'],
    stepDurationMs: 250,
  },
}
