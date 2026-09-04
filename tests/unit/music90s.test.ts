import { describe, expect, it } from 'vitest'
import { music90sQuiz } from '@/content/quizzes/music90s/quiz'
import { quizzes } from '@/content/quizzes'
import { codesForQuiz } from '@/content/quizzes/codes'
import {
  computeCorrectCount,
  resolveBandResultId,
  resolveCorrectCountOutcome,
  resolveOutcome,
  resolveShareCardAsset,
  scoreCardAsset,
} from '@/features/quiz/scoring'

const q = music90sQuiz

function answerAll(ids: string[]) {
  return ids.map((answerId, i) => ({ questionId: q.questions[i].id, answerId }))
}

describe('Music90s: correct-count scoring config', () => {
  it('has scoring.kind === correct-count', () => {
    expect(q.scoring.kind).toBe('correct-count')
  })

  it('has exactly 18 questions, each with a single valid correct answer', () => {
    expect(q.questions).toHaveLength(18)
    for (const question of q.questions) {
      expect(typeof question.correctAnswerId).toBe('string')
      const ids = question.answers.map((a) => a.id)
      expect(ids).toContain(question.correctAnswerId)
      expect(new Set(ids).size).toBe(ids.length)
      expect(ids).toHaveLength(4)
    }
    const qids = q.questions.map((qu) => qu.id)
    expect(new Set(qids).size).toBe(qids.length)
    expect(qids).toEqual(['m1','m2','m3','m4','m5','m6','m7','m8','m9','m10','m11','m12','m13','m14','m15','m16','m17','m18'])
  })

  it('uses the canonical seven bands covering 0..18 with no gaps/overlaps', () => {
    const bands = q.scoring.kind === 'correct-count' ? q.scoring.bands : []
    expect(bands.map((b) => b.resultId)).toEqual([
      'm90_rookie',
      'm90_familiar',
      'm90_cassette',
      'm90_disco',
      'm90_legend',
      'm90_era17',
      'm90_era18',
    ])
    const sorted = [...bands].sort((a, b) => a.min - b.min)
    expect(sorted[0].min).toBe(0)
    expect(sorted[sorted.length - 1].max).toBe(18)
    for (let i = 0; i < sorted.length - 1; i++) {
      expect(sorted[i].max + 1).toBe(sorted[i + 1].min)
    }
    expect(sorted[0]).toEqual({ min: 0, max: 4, resultId: 'm90_rookie' })
    expect(sorted[1]).toEqual({ min: 5, max: 7, resultId: 'm90_familiar' })
    expect(sorted[2]).toEqual({ min: 8, max: 10, resultId: 'm90_cassette' })
    expect(sorted[3]).toEqual({ min: 11, max: 13, resultId: 'm90_disco' })
    expect(sorted[4]).toEqual({ min: 14, max: 16, resultId: 'm90_legend' })
    expect(sorted[5]).toEqual({ min: 17, max: 17, resultId: 'm90_era17' })
    expect(sorted[6]).toEqual({ min: 18, max: 18, resultId: 'm90_era18' })
  })

  it('has globally namespaced result ids (m90_*) and 7 results', () => {
    expect(q.results).toHaveLength(7)
    for (const result of q.results) {
      expect(result.id).toMatch(/^m90_/)
    }
  })

  it('all result IDs remain globally unique', () => {
    const allResultIds = quizzes.flatMap((quiz) => quiz.results.map((r) => r.id))
    expect(new Set(allResultIds).size).toBe(allResultIds.length)
  })

  it('all wire codes remain valid and unique', () => {
    const codes = codesForQuiz('music90s')
    expect(codes).not.toBeNull()
    const vals = Object.values(codes!.results)
    expect(new Set(vals).size).toBe(vals.length)
    expect(codes!.results).toHaveProperty('m90_rookie')
    expect(codes!.results).toHaveProperty('m90_familiar')
    expect(codes!.results).toHaveProperty('m90_cassette')
    expect(codes!.results).toHaveProperty('m90_disco')
    expect(codes!.results).toHaveProperty('m90_legend')
    expect(codes!.results).toHaveProperty('m90_era17')
    expect(codes!.results).toHaveProperty('m90_era18')
    // legacy code 'lg' still maps to m90_legend
    expect(codes!.results['m90_legend']).toBe('lg')
  })

  it('question order and correct answers match the fixed 18 spec', () => {
    const expected: Array<{ id: string; correct: string }> = [
      { id: 'm1', correct: 'a' }, // Крошка моя
      { id: 'm2', correct: 'b' }, // Влад Сташевский
      { id: 'm3', correct: 'b' }, // Алёна Апина
      { id: 'm4', correct: 'a' }, // Одинокий голубь
      { id: 'm5', correct: 'd' }, // Я сошла с ума
      { id: 'm6', correct: 'c' }, // Натали — Мальчик хочет в Тамбов
      { id: 'm7', correct: 'b' }, // Ольга Шелест и Антон Комолов
      { id: 'm8', correct: 'b' }, // Cool Girl
      { id: 'm9', correct: 'c' }, // Mr. Credo
      { id: 'm10', correct: 'b' }, // Максим Фадеев
      { id: 'm11', correct: 'b' }, // Стрелки
      { id: 'm12', correct: 'b' }, // Тополиный пух
      { id: 'm13', correct: 'a' }, // Шура
      { id: 'm14', correct: 'b' }, // Лика Стар — Одинокая луна
      { id: 'm15', correct: 'a' }, // Ты меня не ищи
      { id: 'm16', correct: 'b' }, // Ветлицкая — Посмотри в глаза
      { id: 'm17', correct: 'b' }, // Андрей Губин
      { id: 'm18', correct: 'b' }, // На сахарную воду
    ]
    expected.forEach(({ id, correct }, i) => {
      expect(q.questions[i].id).toBe(id)
      expect(q.questions[i].correctAnswerId).toBe(correct)
    })
  })

  it('landing meta says 18 questions', () => {
    expect(q.subtitle).toContain('18 вопросов')
    expect(q.landing.meta.join(' ')).toContain('18 вопросов')
    expect(q.landing.paragraphs.join(' ')).toContain('Восемнадцать вопросов')
    expect(q.landing.meta.join(' ')).toContain('около 4 минут')
  })

  it('categories and difficulty are advisory and layout remains choice', () => {
    for (const qu of q.questions) {
      expect(qu.layout).toBe('choice')
      expect(typeof qu.category).toBe('string')
    }
  })
})

describe('Music90s: correct answers match the approved content', () => {
  it('m1 — Крошка моя = a', () => { expect(q.questions[0].correctAnswerId).toBe('a') })
  it('m2 — Влад Сташевский = b', () => { expect(q.questions[1].correctAnswerId).toBe('b') })
  it('m3 — Алёна Апина = b', () => { expect(q.questions[2].correctAnswerId).toBe('b') })
  it('m4 — Одинокий голубь = a', () => { expect(q.questions[3].correctAnswerId).toBe('a') })
  it('m5 — Я сошла с ума = d', () => { expect(q.questions[4].correctAnswerId).toBe('d') })
  it('m6 — mismatch Натали = c', () => { expect(q.questions[5].correctAnswerId).toBe('c') })
  it('m7 — Ольга Шелест и Антон Комолов = b', () => { expect(q.questions[6].correctAnswerId).toBe('b') })
  it('m8 — Cool Girl = b', () => { expect(q.questions[7].correctAnswerId).toBe('b') })
  it('m9 — Mr. Credo = c', () => { expect(q.questions[8].correctAnswerId).toBe('c') })
  it('m10 — Максим Фадеев = b', () => { expect(q.questions[9].correctAnswerId).toBe('b') })
  it('m11 — Стрелки = b', () => { expect(q.questions[10].correctAnswerId).toBe('b') })
  it('m12 — Тополиный пух = b', () => { expect(q.questions[11].correctAnswerId).toBe('b') })
  it('m13 — Шура = a', () => { expect(q.questions[12].correctAnswerId).toBe('a') })
  it('m14 — Лика Стар Одинокая луна = b', () => { expect(q.questions[13].correctAnswerId).toBe('b') })
  it('m15 — Ты меня не ищи = a', () => { expect(q.questions[14].correctAnswerId).toBe('a') })
  it('m16 — Ветлицкая Посмотри в глаза = b', () => { expect(q.questions[15].correctAnswerId).toBe('b') })
  it('m17 — Андрей Губин = b', () => { expect(q.questions[16].correctAnswerId).toBe('b') })
  it('m18 — На сахарную воду = b', () => { expect(q.questions[17].correctAnswerId).toBe('b') })
})

describe('Music90s: score → band → result mapping', () => {
  it.each([
    [0, 'm90_rookie'],
    [1, 'm90_rookie'],
    [2, 'm90_rookie'],
    [3, 'm90_rookie'],
    [4, 'm90_rookie'],
    [5, 'm90_familiar'],
    [6, 'm90_familiar'],
    [7, 'm90_familiar'],
    [8, 'm90_cassette'],
    [9, 'm90_cassette'],
    [10, 'm90_cassette'],
    [11, 'm90_disco'],
    [12, 'm90_disco'],
    [13, 'm90_disco'],
    [14, 'm90_legend'],
    [15, 'm90_legend'],
    [16, 'm90_legend'],
    [17, 'm90_era17'],
    [18, 'm90_era18'],
  ])('score %i → %s', (score, expected) => {
    expect(resolveBandResultId(q, score)).toBe(expected)
  })

  it('rejects scores outside 0..18 and non-integers', () => {
    expect(() => resolveBandResultId(q, -1)).toThrow()
    expect(() => resolveBandResultId(q, 19)).toThrow()
    expect(() => resolveBandResultId(q, NaN)).toThrow()
    expect(Number.isInteger(7.5)).toBe(false)
    expect(resolveBandResultId(q, 10)).toBe('m90_cassette')
    expect(resolveBandResultId(q, 10)).not.toBe('m90_rookie')
  })

  it('17 and 18 are dedicated standalone outcomes', () => {
    expect(resolveBandResultId(q, 17)).toBe('m90_era17')
    expect(resolveBandResultId(q, 18)).toBe('m90_era18')
    expect(resolveBandResultId(q, 17)).not.toBe(resolveBandResultId(q, 18))
    expect(resolveBandResultId(q, 16)).not.toBe(resolveBandResultId(q, 17))
  })
})

describe('Music90s: outcome boundary', () => {
  it('all-correct answers resolve to m90_era18 with correct=18/total=18', () => {
    const allCorrect = answerAll(q.questions.map((qu) => qu.correctAnswerId!))
    const outcome = resolveCorrectCountOutcome(q, allCorrect)
    expect(outcome).toEqual({
      kind: 'correct-count',
      resultId: 'm90_era18',
      correct: 18,
      total: 18,
    })
  })

  it('all-wrong answers resolve to m90_rookie with correct=0/total=18', () => {
    const allWrong = answerAll(
      q.questions.map((qu) => qu.answers.find((a) => a.id !== qu.correctAnswerId)!.id),
    )
    const outcome = resolveCorrectCountOutcome(q, allWrong)
    expect(outcome).toEqual({
      kind: 'correct-count',
      resultId: 'm90_rookie',
      correct: 0,
      total: 18,
    })
  })

  it('mixed answer set maps to the correct band (e.g. 6/18 → familiar)', () => {
    const half = q.questions.map((qu, i) => ({
      questionId: qu.id,
      answerId: i < 6 ? qu.correctAnswerId! : qu.answers.find((a) => a.id !== qu.correctAnswerId)!.id,
    }))
    expect(computeCorrectCount(q, half)).toBe(6)
    const outcome = resolveOutcome(q, half)
    expect(outcome).toEqual({
      kind: 'correct-count',
      resultId: 'm90_familiar',
      correct: 6,
      total: 18,
    })
  })

  it('17/18 → m90_era17 boundary', () => {
    const seventeen = q.questions.map((qu, i) => ({
      questionId: qu.id,
      answerId: i < 17 ? qu.correctAnswerId! : qu.answers.find((a) => a.id !== qu.correctAnswerId)!.id,
    }))
    expect(computeCorrectCount(q, seventeen)).toBe(17)
    expect(resolveOutcome(q, seventeen).resultId).toBe('m90_era17')
  })

  it('14/18 → m90_legend (Главред журнала Cool) boundary', () => {
    const fourteen = q.questions.map((qu, i) => ({
      questionId: qu.id,
      answerId: i < 14 ? qu.correctAnswerId! : qu.answers.find((a) => a.id !== qu.correctAnswerId)!.id,
    }))
    expect(computeCorrectCount(q, fourteen)).toBe(14)
    expect(resolveOutcome(q, fourteen).resultId).toBe('m90_legend')
  })

  it('answer list ordering never changes the outcome (correct set)', () => {
    const correct = q.questions.map((qu) => ({ questionId: qu.id, answerId: qu.correctAnswerId! }))
    const reversed = [...correct].reverse()
    const a = resolveOutcome(q, correct)
    const b = resolveOutcome(q, reversed)
    expect(a.resultId).toBe(b.resultId)
    expect(computeCorrectCount(q, correct)).toBe(computeCorrectCount(q, reversed))
  })
})

describe('Music90s: share-card asset key encoding (quiz-scoped)', () => {
  it('two-digit zero-padded m90_score_XX', () => {
    expect(scoreCardAsset(q, 0)).toBe('m90_score_00')
    expect(scoreCardAsset(q, 7)).toBe('m90_score_07')
    expect(scoreCardAsset(q, 18)).toBe('m90_score_18')
  })
  it('covers 0..18 with quiz prefix', () => {
    for (let s = 0; s <= 18; s++) {
      expect(scoreCardAsset(q, s)).toBe(`m90_score_${String(s).padStart(2, '0')}`)
    }
  })
  it('boundary assets exist logically (resolver)', () => {
    expect(scoreCardAsset(q, 17)).toBe('m90_score_17')
    expect(scoreCardAsset(q, 18)).toBe('m90_score_18')
    expect(scoreCardAsset(q, 14)).toBe('m90_score_14')
    expect(scoreCardAsset(q, 0)).toBe('m90_score_00')
  })
  it('music90s 9 → m90_score_09 (9/18) and 18 → m90_score_18 (18/18)', () => {
    expect(scoreCardAsset(q, 9)).toBe('m90_score_09')
    expect(scoreCardAsset(q, 18)).toBe('m90_score_18')
    // via resolver
    const r9 = q.results.find((r) => r.id === resolveBandResultId(q, 9))!
    const r18 = q.results.find((r) => r.id === resolveBandResultId(q, 18))!
    expect(resolveShareCardAsset(q, r9, 9)).toBe('m90_score_09')
    expect(resolveShareCardAsset(q, r18, 18)).toBe('m90_score_18')
  })
})

describe('Music90s: approved result copy (RESULT COPY remap)', () => {
  // canonical hook map — must match ResultCard/Music90ShareCard runtime
  const hookMap: Record<string, string> = {
    m90_rookie: 'И, кажется, быстро вышла.',
    m90_familiar: 'Что-то смутно всплывает в памяти.',
    m90_cassette: 'База на месте.',
    m90_disco: 'Сразу видно человека с опытом.',
    m90_legend: 'Первый медляк помнишь до сих пор.',
    m90_era17: 'На одном всё-таки срезалась.',
    m90_era18: 'Я с тобой про попсу даже спорить не буду.',
  }

  it('0–4 title/hook/copy/shareQuote exact', () => {
    const r = q.results.find((x) => x.id === 'm90_rookie')!
    expect(r.title).toBe('Случайно заглянула в 90-е')
    expect(r.presentation.subtitle).toBe('0–4 из 18')
    expect(r.presentation.description).toEqual([
      'Похоже, эта эпоха пролетела совсем мимо.',
      'Но тебе простительно — скорее всего, ты тогда ещё даже не родилась.',
      'Зато теперь понятно, с чего начинать ликбез и что закинуть в плейлист на вечер.',
    ])
    expect(r.presentation.shareQuote).toBe('Я случайно заглянула в 90-е 😅 И, кажется, быстро вышла. Сколько наберёшь ты?')
  })

  it('5–7 title/hook/copy/shareQuote exact', () => {
    const r = q.results.find((x) => x.id === 'm90_familiar')!
    expect(r.title).toBe('Где-то это слышала')
    expect(r.presentation.subtitle).toBe('5–7 из 18')
    expect(r.presentation.description).toEqual([
      'Обрывками — из папиной девятки, с телевизора на кухне или из комнаты старшей сестры.',
      'Имена исполнителей уже путаются, но фоновый шум детства никуда не делся.',
    ])
    expect(r.presentation.shareQuote).toBe('Кажется, где-то это всё играло 📻 А ты сколько вспомнишь?')
  })

  it('8–10 title/hook/copy/shareQuote exact', () => {
    const r = q.results.find((x) => x.id === 'm90_cassette')!
    expect(r.title).toBe('Знаю только припевы')
    expect(r.presentation.subtitle).toBe('8–10 из 18')
    expect(r.presentation.description).toEqual([
      '«Тополиный пух», анкеты с секретиками и клипы по пузатому телеку застряли где-то глубоко в голове.',
      'Авторов и запевы память уже стирает, но знакомый мотив ты подхватишь с первой ноты.',
    ])
    expect(r.presentation.shareQuote).toBe('Мой уровень: знаю только припевы 🎶 А сколько выбьешь ты?')
  })

  it('11–13 title/hook/copy/shareQuote exact', () => {
    const r = q.results.find((x) => x.id === 'm90_disco')!
    expect(r.title).toBe('Слушала MTV сутками')
    expect(r.presentation.subtitle).toBe('11–13 из 18')
    expect(r.presentation.description).toEqual([
      'Ты отлично помнишь клипы после школы, тетрадки с наклейками и вечерние хит-парады.',
      'Парочку каверзных вопросов ты упустила, но золотой фонд эпохи у тебя в голове в полном порядке.',
    ])
    expect(r.presentation.shareQuote).toBe('В 90-х я явно смотрела MTV сутками 📺 Попробуй набрать больше!')
  })

  it('14–16 title/hook/copy/shareQuote exact', () => {
    const r = q.results.find((x) => x.id === 'm90_legend')!
    expect(r.title).toBe('Королева школьной дискотеки')
    expect(r.presentation.subtitle).toBe('14–16 из 18')
    expect(r.presentation.description).toEqual([
      'Тебя так просто не срежешь.',
      'Ты без подсказок знаешь, под какой трек тряслись полы в спортзале, а под какой плакали в подушку.',
      'Солидное танцевальное прошлое не скрыть.',
    ])
    expect(r.presentation.shareQuote).toBe('Мой статус: королева школьной дискотеки 🪩 Рискнёшь побить мой счёт?')
  })

  it('17 title/hook/copy/shareQuote exact (Главред журнала Cool)', () => {
    const r = q.results.find((x) => x.id === 'm90_era17')!
    expect(r.title).toBe('Главред журнала Cool')
    expect(r.presentation.subtitle).toBe('17 из 18')
    expect(r.presentation.description).toEqual([
      '17 из 18. Спорить с тобой про попсу 90-х — себе дороже.',
      'Ты помнишь всё: от солистов до скандалов в номерах.',
      'Та единственная ошибка списывается на опечатку в типографии.',
    ])
    expect(r.presentation.shareQuote).toBe('17 из 18! Мой уровень: главред журнала Cool 💅 На одном всё-таки срезалась. А ты сколько наберёшь?')
  })

  it('18 title/hook/copy/shareQuote exact (RARE FOIL Главред журнала Cool ✨)', () => {
    const r = q.results.find((x) => x.id === 'm90_era18')!
    expect(r.title).toBe('Главред журнала Cool ✨')
    expect(r.presentation.subtitle).toBe('18 из 18')
    expect(r.presentation.description).toEqual([
      '18 из 18. Ни единой осечки.',
      'Ощущение, что ты сама верстала те номера, утверждала плакаты в печать и лично знала всех продюсеров.',
      'Сдаюсь, это чистый абсолют.',
    ])
    expect(r.presentation.shareQuote).toBe('18 из 18! Выбила секретную карточку: главред журнала Cool ✨ Попробуй повторить, если сможешь.')
  })

  it('all seven hooks match runtime M90_HOOKS map exactly', async () => {
    const { M90_HOOKS } = await import('@/features/result/ResultCard')
    for (const [id, hook] of Object.entries(hookMap)) {
      expect(M90_HOOKS[id]).toBe(hook)
    }
  })

  it('old titles no longer appear in current Music90s result/share UI', () => {
    const allText = q.results.map((r) => `${r.title} ${r.presentation.shareQuote} ${r.presentation.description.join(' ')}`).join(' | ')
    expect(allText).not.toContain('Где-то это играло')
    expect(allText).not.toContain('Кассетная память')
    expect(allText).not.toContain('Звезда школьной дискотеки')
    // "Ты и есть 90-е" must be gone for both era outcomes
    expect(allText).not.toContain('Ты и есть 90-е')
  })

  it('band mapping remains 0–4,5–7,8–10,11–13,14–16,17,18', () => {
    const bands = q.scoring.kind === 'correct-count' ? q.scoring.bands : []
    expect(bands).toEqual([
      { min: 0, max: 4, resultId: 'm90_rookie' },
      { min: 5, max: 7, resultId: 'm90_familiar' },
      { min: 8, max: 10, resultId: 'm90_cassette' },
      { min: 11, max: 13, resultId: 'm90_disco' },
      { min: 14, max: 16, resultId: 'm90_legend' },
      { min: 17, max: 17, resultId: 'm90_era17' },
      { min: 18, max: 18, resultId: 'm90_era18' },
    ])
  })
})

describe('Music90s: per-question answer feedback (ANSWER FEEDBACK pass)', () => {
  const approved: Record<string, { correct: string; wrong: string }> = {
    m1: { correct: 'В точку!', wrong: 'Эх, мимо.' },
    m2: { correct: 'Зачёт!', wrong: 'Не-а, не то.' },
    m3: { correct: 'В яблочко!', wrong: 'Чуть-чуть не туда.' },
    m4: { correct: 'База на месте.', wrong: 'Фальшивая нота.' },
    m5: { correct: 'Знаешь наизусть!', wrong: 'Срезалась!' },
    m6: { correct: 'С первой ноты.', wrong: 'Мимо кассы.' },
    m7: { correct: 'Без шансов для ошибки.', wrong: 'Не угадала.' },
    m8: { correct: 'Красиво!', wrong: 'Рядом, но нет.' },
    m9: { correct: 'Точно в ритм.', wrong: 'Память подвела.' },
    m10: { correct: 'Память не подводит!', wrong: 'Слишком сложно?' },
    m11: { correct: 'Классика.', wrong: 'Не тот трек.' },
    m12: { correct: 'Как по нотам!', wrong: 'Обидно, но мимо.' },
    m13: { correct: 'Легчайшая.', wrong: 'Спутала!' },
    m14: { correct: 'Ни секунды сомнений!', wrong: 'Увы, не угадала.' },
    m15: { correct: 'Золотой фонд.', wrong: 'Мимо нот.' },
    m16: { correct: 'Чистая победа.', wrong: 'Не попала в такт.' },
    m17: { correct: 'Уровень: профи.', wrong: 'Ай, осечка!' },
    m18: { correct: 'Абсолют!', wrong: 'Тут не срослось.' },
  }

  it('answerBehavior is feedback with duration 900 and neutral fallback', () => {
    expect(q.answerBehavior.mode).toBe('feedback')
    if (q.answerBehavior.mode === 'feedback') {
      expect(q.answerBehavior.durationMs).toBe(900)
      expect(q.answerBehavior.correctMessage).toBe('Верно.')
      expect(q.answerBehavior.wrongMessage).toBe('Не угадала.')
      expect(q.answerBehavior.correctMessage).not.toBe('Да. Кассета не подвела.')
      expect(q.answerBehavior.wrongMessage).not.toBe('Где-то заплакал один кассетник.')
    }
  })

  it('every question defines feedback correct/wrong exactly matching approved copy', () => {
    expect(q.questions).toHaveLength(18)
    for (const question of q.questions) {
      const exp = approved[question.id]
      expect(exp, `missing approved entry for ${question.id}`).toBeDefined()
      expect(question.feedback, `${question.id} missing feedback`).toBeDefined()
      expect(question.feedback!.correct).toBe(exp.correct)
      expect(question.feedback!.wrong).toBe(exp.wrong)
    }
  })

  it('m1 correct → В точку! / wrong → Эх, мимо.', () => {
    const m1 = q.questions.find((qq) => qq.id === 'm1')!
    expect(m1.feedback!.correct).toBe('В точку!')
    expect(m1.feedback!.wrong).toBe('Эх, мимо.')
  })

  it('m10 correct → Память не подводит! / wrong → Слишком сложно?', () => {
    const m10 = q.questions.find((qq) => qq.id === 'm10')!
    expect(m10.feedback!.correct).toBe('Память не подводит!')
    expect(m10.feedback!.wrong).toBe('Слишком сложно?')
  })

  it('m18 correct → Абсолют! / wrong → Тут не срослось.', () => {
    const m18 = q.questions.find((qq) => qq.id === 'm18')!
    expect(m18.feedback!.correct).toBe('Абсолют!')
    expect(m18.feedback!.wrong).toBe('Тут не срослось.')
  })

  it('all 18 mapped yes', () => {
    const ids = q.questions.map((qq) => qq.id).sort()
    expect(ids).toEqual(Object.keys(approved).sort())
    for (const id of ids) {
      const qq = q.questions.find((x) => x.id === id)!
      expect(qq.feedback?.correct).toBe(approved[id].correct)
      expect(qq.feedback?.wrong).toBe(approved[id].wrong)
    }
  })

  it('no question displays old generic cassette fallback', () => {
    const allFeedback = q.questions.flatMap((qq) => [qq.feedback?.correct ?? '', qq.feedback?.wrong ?? '']).join(' | ')
    expect(allFeedback).not.toContain('Да. Кассета не подвела.')
    expect(allFeedback).not.toContain('Где-то заплакал один кассетник.')
    // also ensure quiz-level fallback is neutral
    if (q.answerBehavior.mode === 'feedback') {
      expect(q.answerBehavior.correctMessage).not.toContain('Кассета')
      expect(q.answerBehavior.wrongMessage).not.toContain('кассетник')
    }
  })

  it('questions and answer keys unchanged (feedback-only)', () => {
    // spot check that question text and correctAnswerId still match original spec
    expect(q.questions[0].title).toContain('Какой хит зашифрован')
    expect(q.questions[0].correctAnswerId).toBe('a')
    expect(q.questions[9].correctAnswerId).toBe('b') // m10
    expect(q.questions[17].correctAnswerId).toBe('b') // m18
  })

  it('generic feedback resolution: question.feedback ?? quiz fallback', () => {
    // Simulate Quiz.tsx resolution order
    const resolveCorrect = (question: typeof q.questions[number]) =>
      (question.feedback?.correct ?? (q.answerBehavior.mode === 'feedback' ? q.answerBehavior.correctMessage : undefined))
    const resolveWrong = (question: typeof q.questions[number]) =>
      (question.feedback?.wrong ?? (q.answerBehavior.mode === 'feedback' ? q.answerBehavior.wrongMessage : undefined))
    for (const qq of q.questions) {
      expect(resolveCorrect(qq)).toBe(approved[qq.id].correct)
      expect(resolveWrong(qq)).toBe(approved[qq.id].wrong)
    }
    // fallback case: a question without feedback should use quiz-level
    const fakeWithoutFeedback = { id: 'fake', feedback: undefined } as unknown as typeof q.questions[number]
    expect(fakeWithoutFeedback.feedback?.correct ?? (q.answerBehavior.mode === 'feedback' ? q.answerBehavior.correctMessage : undefined)).toBe('Верно.')
    expect(fakeWithoutFeedback.feedback?.wrong ?? (q.answerBehavior.mode === 'feedback' ? q.answerBehavior.wrongMessage : undefined)).toBe('Не угадала.')
  })
})
