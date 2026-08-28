import { results } from './results.js'
import type { Question, Quiz } from '../../../features/quiz/schema.js'

/**
 * Music90s content — the second production quiz.
 * 10 FIXED questions: 2 emoji / 2 artist / 2 timeline / 2 title /
 * 2 absurd-description; difficulty 3 easy / 4 medium / 3 hard.
 *
 * Content safety: song titles, artist names and release years only.
 * No lyrics, no album art, no audio, no third-party media.
 * Timeline facts are verified band/song chronology (1995 < 1996,
 * «Тучи» 1997 < «Владимирский централ» 1998 < 1999-е хиты).
 *
 * Answer ids (a/b/c/d) are intentionally reused across questions: answer
 * identity in the platform is the compound (questionId, answerId).
 */
export const questions: Question[] = [
  {
    id: 'm1',
    category: 'emoji',
    difficulty: 'easy',
    layout: 'choice',
    title: 'Эмодзи-шифр: ☁️. Какой хит 90-х зашифрован?',
    correctAnswerId: 'c',
    answers: [
      { id: 'a', title: '«Облака»' },
      { id: 'b', title: '«Звёзды»' },
      { id: 'c', title: '«Тучи»' },
      { id: 'd', title: '«Снегопад»' },
    ],
  },
  {
    id: 'm2',
    category: 'emoji',
    difficulty: 'medium',
    layout: 'choice',
    title: '💿 + 📼. Главные носители музыки 90-х — это …',
    correctAnswerId: 'a',
    answers: [
      { id: 'a', title: 'Кассета и CD' },
      { id: 'b', title: 'Стриминг и плейлисты' },
      { id: 'c', title: 'Смс-рингтоны' },
      { id: 'd', title: 'Ноты и пианино' },
    ],
  },
  {
    id: 'm3',
    category: 'artist',
    difficulty: 'easy',
    layout: 'choice',
    title: 'Хит «Крошка моя» — чей это голос?',
    correctAnswerId: 'b',
    answers: [
      { id: 'a', title: 'Иванушки International' },
      { id: 'b', title: 'Руки Вверх!' },
      { id: 'c', title: 'На-На' },
      { id: 'd', title: 'Отпетые мошенники' },
    ],
  },
  {
    id: 'm4',
    category: 'artist',
    difficulty: 'medium',
    layout: 'choice',
    title: '«Тучи» — это песня какой группы?',
    correctAnswerId: 'c',
    answers: [
      { id: 'a', title: 'Руки Вверх!' },
      { id: 'b', title: 'Блестящие' },
      { id: 'c', title: 'Иванушки International' },
      { id: 'd', title: 'Ленинград' },
    ],
  },
  {
    id: 'm5',
    category: 'timeline',
    difficulty: 'medium',
    layout: 'comparison',
    title: 'Кто из этих артистов появился на сцене раньше всех?',
    correctAnswerId: 'a',
    answers: [
      { id: 'a', title: 'Дискотека Авария — 1990' },
      { id: 'b', title: 'Иванушки International — 1995' },
      { id: 'c', title: 'Руки Вверх! — 1996' },
      { id: 'd', title: 'Отпетые мошенники — 1996' },
    ],
  },
  {
    id: 'm6',
    category: 'timeline',
    difficulty: 'hard',
    layout: 'comparison',
    title: 'Что из этого вышло раньше остальных?',
    correctAnswerId: 'b',
    answers: [
      { id: 'a', title: '«Владимирский централ» — 1998' },
      { id: 'b', title: '«Тучи» — 1996' },
      { id: 'c', title: '«Ариведерчи» — 1999' },
      { id: 'd', title: '«Тополиный пух» — 1999' },
    ],
  },
  {
    id: 'm7',
    category: 'title',
    difficulty: 'medium',
    layout: 'choice',
    title: 'Какой из этих треков есть на дебютном альбоме Земфиры 1999 года?',
    correctAnswerId: 'a',
    answers: [
      { id: 'a', title: 'Ариведерчи' },
      { id: 'b', title: 'Хочешь' },
      { id: 'c', title: 'Искала' },
      { id: 'd', title: 'Не отпускай' },
    ],
  },
  {
    id: 'm8',
    category: 'title',
    difficulty: 'easy',
    layout: 'choice',
    title: 'Иванушки International, 1999. Песня с альбома «Об этом я буду кричать всю ночь»?',
    correctAnswerId: 'a',
    answers: [
      { id: 'a', title: 'Тополиный пух' },
      { id: 'b', title: 'Колечко' },
      { id: 'c', title: 'Кукла' },
      { id: 'd', title: 'Тучи' },
    ],
  },
  {
    id: 'm9',
    category: 'absurd-description',
    difficulty: 'hard',
    layout: 'choice',
    title: 'Иванушки International, 1996. Их дебютный альбом — это …',
    correctAnswerId: 'b',
    answers: [
      { id: 'a', title: 'Твои письма' },
      { id: 'b', title: 'Конечно он' },
      { id: 'c', title: 'Подожди меня…' },
      { id: 'd', title: '10 лет во вселенной' },
    ],
  },
  {
    id: 'm10',
    category: 'absurd-description',
    difficulty: 'hard',
    layout: 'choice',
    title: 'Кто исполнил «Владимирский централ» — гимн тверского шансона 1990-х?',
    correctAnswerId: 'b',
    answers: [
      { id: 'a', title: 'Владимир Высоцкий' },
      { id: 'b', title: 'Михаил Круг' },
      { id: 'c', title: 'Александр Розенбаум' },
      { id: 'd', title: 'Сергей Шнуров' },
    ],
  },
]

/** Approved Music90s definition, validated by loadQuiz() before use. */
export const music90sQuiz: Quiz = {
  id: 'music90s',
  title: 'Ты точно помнишь музыку 90-х?',
  subtitle: '10 вопросов о кассетах, дисках и хитах, которые знали все.',
  landing: {
    paragraphs: [
      'Кассеты перематывали карандашом, а хиты знали наизусть.',
      'Десять вопросов — и станет ясно, где ты была в 1999-м: на дискотеке или в другой комнате.',
      'Отвечай быстро, не гугли.',
    ],
    meta: ['10 вопросов', 'около 2 минут'],
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
      { min: 0, max: 2, resultId: 'm90_rookie' },
      { min: 3, max: 4, resultId: 'm90_familiar' },
      { min: 5, max: 6, resultId: 'm90_cassette' },
      { min: 7, max: 8, resultId: 'm90_disco' },
      { min: 9, max: 10, resultId: 'm90_legend' },
    ],
  },
  presentation: { kind: 'score' },
  answerBehavior: { mode: 'feedback', durationMs: 900, correctMessage: 'Да. Кассета не подвела.', wrongMessage: 'Где-то заплакал один кассетник.' },
  reveal: {
    steps: ['Кассеты', 'Диски', 'Твой счёт'],
    stepDurationMs: 250,
  },
}

