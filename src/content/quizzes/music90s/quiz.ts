import { results } from './results.js'
import type { Question, Quiz } from '../../../features/quiz/schema.js'

/**
 * Music90s content — 14 FIXED questions: factual gate covers all 14.
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
    title: 'Какой хит зашифрован?\n💌 ➡️ 📭 😔 ❤️',
    correctAnswerId: 'a',
    answers: [
      { id: 'a', title: 'Крошка моя' },
      { id: 'b', title: 'Алёшка' },
      { id: 'c', title: 'Он тебя целует' },
      { id: 'd', title: 'Чужие губы' },
    ],
  },
  {
    id: 'm2',
    category: 'artist-history',
    difficulty: 'medium',
    layout: 'choice',
    title: 'Кто из этих артистов действительно начинал в составе «Кар-Мэн»?',
    correctAnswerId: 'b',
    answers: [
      { id: 'a', title: 'Андрей Губин' },
      { id: 'b', title: 'Богдан Титомир' },
      { id: 'c', title: 'Шура' },
      { id: 'd', title: 'Кай Метов' },
    ],
  },
  {
    id: 'm3',
    category: 'artist-history',
    difficulty: 'easy',
    layout: 'choice',
    title: 'Кто до сольной карьеры была одной из солисток группы «Комбинация»?',
    correctAnswerId: 'b',
    answers: [
      { id: 'a', title: 'Лада Дэнс' },
      { id: 'b', title: 'Алёна Апина' },
      { id: 'c', title: 'Татьяна Овсиенко' },
      { id: 'd', title: 'Наталья Ветлицкая' },
    ],
  },
  {
    id: 'm4',
    category: 'music-history',
    difficulty: 'medium',
    layout: 'choice',
    title: 'Кто представлял Россию на «Евровидении» в 1997 году?',
    correctAnswerId: 'c',
    answers: [
      { id: 'a', title: 'Филипп Киркоров' },
      { id: 'b', title: 'Валерий Меладзе' },
      { id: 'c', title: 'Алла Пугачёва' },
      { id: 'd', title: 'Алсу' },
    ],
  },
  {
    id: 'm5',
    category: 'timeline',
    difficulty: 'medium',
    layout: 'choice',
    title: 'Какой из этих хитов уже НЕ относится к 90-м?',
    correctAnswerId: 'd',
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
    answers: [
      { id: 'a', title: 'Линда — «Ворона»' },
      { id: 'b', title: 'Андрей Губин — «Мальчик-бродяга»' },
      { id: 'c', title: 'Натали — «Мальчик хочет в Тамбов»' },
      { id: 'd', title: 'Технология — «Нажми на кнопку»' },
    ],
  },
  {
    id: 'm7',
    category: 'music-history',
    difficulty: 'easy',
    layout: 'choice',
    title: 'Какой музыкальный телеканал начал вещание в России в 1998 году?',
    correctAnswerId: 'b',
    answers: [
      { id: 'a', title: 'МУЗ-ТВ' },
      { id: 'b', title: 'MTV Россия' },
      { id: 'c', title: 'RU.TV' },
      { id: 'd', title: 'Music Box Russia' },
    ],
  },
  {
    id: 'm8',
    category: 'era-tech',
    difficulty: 'easy',
    layout: 'choice',
    title: 'На кассете написано C90. Что означает число 90?',
    correctAnswerId: 'b',
    answers: [
      { id: 'a', title: '90 песен' },
      { id: 'b', title: '90 минут записи суммарно' },
      { id: 'c', title: '90 минут на каждой стороне' },
      { id: 'd', title: '90 кбит/с' },
    ],
  },
  {
    id: 'm9',
    category: 'artist',
    difficulty: 'easy',
    layout: 'choice',
    title: 'Что из этого — сценическое имя одного исполнителя, а не название группы?',
    correctAnswerId: 'c',
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
    title: 'Кто стоял за музыкальным звучанием Линды в период её главных хитов 90-х?',
    correctAnswerId: 'b',
    answers: [
      { id: 'a', title: 'Игорь Матвиенко' },
      { id: 'b', title: 'Максим Фадеев' },
      { id: 'c', title: 'Бари Алибасов' },
      { id: 'd', title: 'Юрий Айзеншпис' },
    ],
  },
  {
    id: 'm11',
    category: 'producer',
    difficulty: 'easy',
    layout: 'choice',
    title: 'Какую группу создал и продюсировал Бари Алибасов?',
    correctAnswerId: 'a',
    answers: [
      { id: 'a', title: 'На-На' },
      { id: 'b', title: 'Отпетые мошенники' },
      { id: 'c', title: 'Премьер-министр' },
      { id: 'd', title: 'Иванушки International' },
    ],
  },
  {
    id: 'm12',
    category: 'absurd-description',
    difficulty: 'medium',
    layout: 'choice',
    title: 'Какой хит «Иванушек» мог бы называться сегодня: «POV: на улице +30, а визуально почему-то декабрь»?',
    correctAnswerId: 'b',
    answers: [
      { id: 'a', title: 'Тучи' },
      { id: 'b', title: 'Тополиный пух' },
      { id: 'c', title: 'Кукла' },
      { id: 'd', title: 'Снегири' },
    ],
  },
  {
    id: 'm13',
    category: 'timeline',
    difficulty: 'medium',
    layout: 'choice',
    title: 'Тебе показывают старый музыкальный журнал. Какое имя здесь явно выбивается по времени?',
    correctAnswerId: 'd',
    answers: [
      { id: 'a', title: 'Влад Сташевский' },
      { id: 'b', title: 'Шура' },
      { id: 'c', title: 'Андрей Губин' },
      { id: 'd', title: 'Дима Билан' },
    ],
  },
  {
    id: 'm14',
    category: 'music-video',
    difficulty: 'hard',
    layout: 'choice',
    title:
      'Какой клип можно пересказать как российский фильм Тарантино: московская богема тусуется всю ночь, певицу похищают Бондарчук и Паук, а дальше выясняется, что с этой компанией вообще что-то не так?',
    correctAnswerId: 'b',
    answers: [
      { id: 'a', title: 'Линда — «Ворона»' },
      { id: 'b', title: 'Лика Стар — «Одинокая луна»' },
      { id: 'c', title: 'Наталья Ветлицкая — «Посмотри в глаза»' },
      { id: 'd', title: 'Мумий Тролль — «Владивосток 2000»' },
    ],
  },
]

/** Approved Music90s definition, validated by loadQuiz() before use. */
export const music90sQuiz: Quiz = {
  id: 'music90s',
  title: 'Ты точно помнишь музыку 90-х?',
  subtitle: '14 вопросов о кассетах, дисках и хитах, которые знали все.',
  landing: {
    paragraphs: [
      'Кассеты перематывали карандашом, а хиты знали наизусть.',
      'Четырнадцать вопросов — и станет ясно, где ты была в 1999-м: на дискотеке или в другой комнате.',
      'Отвечай быстро, не гугли.',
    ],
    meta: ['14 вопросов', 'около 3 минут'],
  },
  startCta: 'Проверить память',
  shareCtaIntro: 'Пусть попробуют побить твой счёт ↓',
  shareCta: 'Бросить вызов',
  restartCta: 'Пройти ещё раз',
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
      { min: 0, max: 3, resultId: 'm90_rookie' },
      { min: 4, max: 6, resultId: 'm90_familiar' },
      { min: 7, max: 9, resultId: 'm90_cassette' },
      { min: 10, max: 12, resultId: 'm90_disco' },
      { min: 13, max: 14, resultId: 'm90_legend' },
    ],
  },
  presentation: { kind: 'score' },
  answerBehavior: { mode: 'feedback', durationMs: 900, correctMessage: 'Да. Кассета не подвела.', wrongMessage: 'Где-то заплакал один кассетник.' },
  reveal: {
    steps: ['Кассеты', 'Диски', 'Твой счёт'],
    stepDurationMs: 250,
  },
}
