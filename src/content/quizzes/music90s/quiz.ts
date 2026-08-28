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
    title: '💿 + 📼. Без чего 90-е просто не существовали?',
    correctAnswerId: 'a',
    answers: [
      { id: 'a', title: 'Кассета и CD — главные носители музыки' },
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
    title: 'Кто из них появился на сцене раньше всех?',
    correctAnswerId: 'a',
    answers: [
      { id: 'a', title: 'Иванушки International — 1995' },
      { id: 'b', title: 'Руки Вверх! — 1996' },
      { id: 'c', title: 'Дискотека Авария — 1999' },
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
      { id: 'b', title: '«Тучи» — 1997' },
      { id: 'c', title: '«Я сошла с ума» — 1999' },
      { id: 'd', title: '«Тополиный пух» — 1999' },
    ],
  },
  {
    id: 'm7',
    category: 'title',
    difficulty: 'medium',
    layout: 'choice',
    title: 'Земфира, 1999 год. Допиши название хита: «Я …»',
    correctAnswerId: 'd',
    answers: [
      { id: 'a', title: '«Я тебя помню»' },
      { id: 'b', title: '«Я не вернусь»' },
      { id: 'c', title: '«Я иду искать»' },
      { id: 'd', title: '«Я сошла с ума»' },
    ],
  },
  {
    id: 'm8',
    category: 'title',
    difficulty: 'easy',
    layout: 'choice',
    title: '«Тополиный пух, жара, июль» — как называется песня целиком?',
    correctAnswerId: 'a',
    answers: [
      { id: 'a', title: '«Тополиный пух»' },
      { id: 'b', title: '«Летний зной»' },
      { id: 'c', title: '«Жара и июль»' },
      { id: 'd', title: '«Пух и тополя»' },
    ],
  },
  {
    id: 'm9',
    category: 'absurd-description',
    difficulty: 'hard',
    layout: 'choice',
    title:
      'После этого хита весь подъезд вставал и показывал стране, что гравитация для рук необязательна.',
    correctAnswerId: 'c',
    answers: [
      { id: 'a', title: 'Танцы Минус' },
      { id: 'b', title: 'Мумий Тролль' },
      { id: 'c', title: 'Руки Вверх!' },
      { id: 'd', title: 'Би-2' },
    ],
  },
  {
    id: 'm10',
    category: 'absurd-description',
    difficulty: 'hard',
    layout: 'choice',
    title:
      'Адресная тоска одного тверского двора, ставшая главным хитом дачников, маршруток и всех, у кого было «тяжело на сердце».',
    correctAnswerId: 'b',
    answers: [
      { id: 'a', title: '«Владивосток 2000»' },
      { id: 'b', title: '«Владимирский централ»' },
      { id: 'c', title: '«Жиган-лимон»' },
      { id: 'd', title: '«Тверские улицы»' },
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

