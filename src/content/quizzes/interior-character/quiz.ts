import { results } from './results.js'
import type { Question, Quiz } from '../../../features/quiz/schema.js'

/**
 * APPROVED PRODUCT CONTENT — LOCKED.
 * Questions, answer wording and scoring weights (+2 primary / +1 secondary)
 * are approved product spec. Do not modify without explicit approval.
 */
export const questions: Question[] = [
  {
    id: 'q1',
    title: 'Ты заходишь в совершенно пустую комнату. Что хочется сделать первым?',
    layout: 'image-cards',
    answers: [
      {
        id: 'q1_a',
        title: 'Оставить максимум воздуха и найти одну идеальную крупную вещь.',
        scores: { quiet: 2, scandi: 1 },
        assetKey: 'q1_a',
      },
      {
        id: 'q1_b',
        title: 'Найти старое зеркало, искусство или что-нибудь с историей.',
        scores: { paris: 2, cottage: 1 },
        assetKey: 'q1_b',
      },
      {
        id: 'q1_c',
        title: 'Поставить предмет, вокруг которого сразу строится вся комната.',
        scores: { italian: 2, collector: 1 },
        assetKey: 'q1_c',
      },
      {
        id: 'q1_d',
        title: 'Добавить дерево, текстиль и мягкий свет, чтобы комната сразу стала домашней.',
        scores: { cottage: 2, scandi: 1 },
        assetKey: 'q1_d',
      },
    ],
  },
  {
    id: 'q2',
    title: 'Что тебе приятнее всего трогать руками?',
    layout: 'image-cards',
    answers: [
      {
        id: 'q2_a',
        title: 'Натуральный камень, плотная шерсть, матовая поверхность.',
        scores: { quiet: 2, cottage: 1 },
        assetKey: 'q2_a',
      },
      {
        id: 'q2_b',
        title: 'Светлый дуб, лен, матовое стекло.',
        scores: { scandi: 2, quiet: 1 },
        assetKey: 'q2_b',
      },
      {
        id: 'q2_c',
        title: 'Состаренная латунь, бархат, дерево с патиной.',
        scores: { paris: 2, cottage: 1 },
        assetKey: 'q2_c',
      },
      {
        id: 'q2_d',
        title: 'Мрамор, темный орех, гладкая эффектная поверхность.',
        scores: { italian: 2, collector: 1 },
        assetKey: 'q2_d',
      },
    ],
  },
  {
    id: 'q3',
    title: 'В какой палитре тебе было бы легче всего просыпаться каждый день?',
    layout: 'palette',
    answers: [
      {
        id: 'q3_a',
        title: '',
        paletteLabels: ['молочный', 'овсяный', 'теплый серый', 'светлое дерево'],
        scores: { scandi: 2, quiet: 1 },
        assetKey: 'q3_a',
      },
      {
        id: 'q3_b',
        title: '',
        paletteLabels: ['шалфейный', 'сливочный', 'пыльно-голубой', 'теплое дерево'],
        scores: { cottage: 2, paris: 1 },
        assetKey: 'q3_b',
      },
      {
        id: 'q3_c',
        title: '',
        paletteLabels: ['терракота', 'бордо', 'теплый кремовый', 'темный орех'],
        scores: { italian: 2, paris: 1 },
        assetKey: 'q3_c',
      },
      {
        id: 'q3_d',
        title: '',
        paletteLabels: ['глубокий синий', 'охра', 'сливовый', 'неожиданный цветовой акцент'],
        scores: { collector: 2, italian: 1 },
        assetKey: 'q3_d',
      },
    ],
  },
  {
    id: 'q4',
    title: 'Можно купить только одну вещь. На что не жалко потратиться?',
    layout: 'text',
    answers: [
      {
        id: 'q4_a',
        title: 'На идеальный диван или кресло — простой формы, но безупречного качества.',
        scores: { quiet: 2, italian: 1 },
        assetKey: 'q4_a',
      },
      {
        id: 'q4_b',
        title: 'На картину, винтаж или странную вещь, которую больше нигде не встретишь.',
        scores: { collector: 2, paris: 1 },
        assetKey: 'q4_b',
      },
      {
        id: 'q4_c',
        title: 'На большой деревянный стол или красивый старый буфет.',
        scores: { cottage: 2, scandi: 1 },
        assetKey: 'q4_c',
      },
      {
        id: 'q4_d',
        title: 'На идеальный светильник и хорошую систему хранения.',
        scores: { scandi: 2, quiet: 1 },
        assetKey: 'q4_d',
      },
    ],
  },
  {
    id: 'q5',
    title: 'Какой интерьер ты скорее назовёшь дорогим?',
    layout: 'text',
    answers: [
      {
        id: 'q5_a',
        title: 'Где сразу чувствуются хорошие материалы и правильные пропорции.',
        scores: { quiet: 2, scandi: 1 },
        assetKey: 'q5_a',
      },
      {
        id: 'q5_b',
        title: 'Где старые вещи естественно живут рядом с новыми.',
        scores: { paris: 2, cottage: 1 },
        assetKey: 'q5_b',
      },
      {
        id: 'q5_c',
        title: 'Где есть хотя бы один предмет, который невозможно не заметить.',
        scores: { italian: 2, quiet: 1 },
        assetKey: 'q5_c',
      },
      {
        id: 'q5_d',
        title: 'Где сложно понять, в каком магазине вообще можно было купить всё это.',
        scores: { collector: 2, italian: 1 },
        assetKey: 'q5_d',
      },
    ],
  },
  {
    id: 'q6',
    title: 'Какую «неидеальность» ты бы с удовольствием оставила дома?',
    layout: 'text',
    answers: [
      {
        id: 'q6_a',
        title: 'Ручную керамику с чуть неровным краем.',
        scores: { scandi: 2, collector: 1 },
        assetKey: 'q6_a',
      },
      {
        id: 'q6_b',
        title: 'Потертое дерево, мятый лен, старый буфет.',
        scores: { cottage: 2, collector: 1 },
        assetKey: 'q6_b',
      },
      {
        id: 'q6_c',
        title: 'Старый паркет, немного разную мебель и зеркало с патиной.',
        scores: { paris: 2, cottage: 1 },
        assetKey: 'q6_c',
      },
      {
        id: 'q6_d',
        title: 'Странный объект, предназначение которого приходится объяснять гостям.',
        scores: { collector: 2, italian: 1 },
        assetKey: 'q6_d',
      },
    ],
  },
  {
    id: 'q7',
    title: 'Представь, что сегодня вечером никаких дел. Где ты?',
    layout: 'text',
    answers: [
      {
        id: 'q7_a',
        title: 'Чай, свечи, плед, книга — и телефон желательно где-нибудь далеко.',
        scores: { cottage: 2, scandi: 1 },
        assetKey: 'q7_a',
      },
      {
        id: 'q7_b',
        title: 'Бокал вина, музыка, приглушенный свет и красивое кресло у окна.',
        scores: { paris: 2, quiet: 1 },
        assetKey: 'q7_b',
      },
      {
        id: 'q7_c',
        title: 'Большой стол, еда, друзья и разговоры значительно дольше запланированного.',
        scores: { italian: 2, collector: 1 },
        assetKey: 'q7_c',
      },
      {
        id: 'q7_d',
        title: 'Музыка, книги, любимые предметы вокруг и очередная история о том, откуда эта странная штука.',
        scores: { collector: 2, paris: 1 },
        assetKey: 'q7_d',
      },
    ],
  },
  {
    id: 'q8',
    title: 'Какая фраза больше всего похожа на тебя?',
    layout: 'compact',
    answers: [
      {
        id: 'q8_a',
        title: 'Лучше одна идеальная вещь, чем пять просто красивых.',
        scores: { quiet: 2, scandi: 1 },
        assetKey: 'q8_a',
      },
      {
        id: 'q8_b',
        title: 'Дом должен давать мне воздух, а не постоянно требовать внимания.',
        scores: { scandi: 2, quiet: 1 },
        assetKey: 'q8_b',
      },
      {
        id: 'q8_c',
        title: 'Самые красивые дома выглядят так, будто у них уже была жизнь до нас.',
        scores: { paris: 2, quiet: 1 },
        assetKey: 'q8_c',
      },
      {
        id: 'q8_d',
        title: 'Если вещь прекрасна — пусть её заметят.',
        scores: { italian: 2, scandi: 1 },
        assetKey: 'q8_d',
      },
      {
        id: 'q8_e',
        title: 'Мне важнее, чтобы дома хотелось остаться, чем чтобы его хотелось сфотографировать.',
        scores: { cottage: 2, paris: 1 },
        assetKey: 'q8_e',
      },
      {
        id: 'q8_f',
        title: 'Идеальный интерьер невозможно целиком купить в одном месте.',
        scores: { collector: 2, italian: 1 },
        assetKey: 'q8_f',
      },
    ],
  },
]

/** Approved quiz definition, validated by loadQuiz() before use. */
export const interiorCharacterQuiz: Quiz = {
  id: 'interior-character',
  title: 'Какой у тебя интерьерный характер?',
  subtitle: '8 выборов — и узнаешь, какой интерьер на самом деле похож на тебя.',
  landing: {
    paragraphs: [
      'Ты выбираешь интерьер не только глазами.',
      'Кому-то нужен воздух и идеальные пропорции, кому-то — цвет, история и вещи с характером.',
      'Выбирай быстро, не пытайся быть «правильной».',
    ],
    meta: ['8 вопросов', 'около 1 минуты'],
  },
  startCta: 'Узнать свой характер',
  shareCtaIntro: 'Узнать, кто твои подруги ↓',
  shareCta: 'Отправить результат подруге',
  restartCta: 'Пройти ещё раз',
  questions,
  results,
  tieBreak: {
    controlQuestionId: 'q8',
    primaryOrderQuestionIds: ['q1', 'q7', 'q5'],
    fixedResultOrder: ['quiet', 'paris', 'italian', 'collector', 'cottage', 'scandi'],
  },
  reveal: {
    steps: ['Цвет', 'Материалы', 'Атмосфера', 'Характер'],
    stepDurationMs: 250,
  },
}