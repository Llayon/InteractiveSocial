import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { sign } from '@tma.js/init-data-node'
import { music90sQuiz } from '@/content/quizzes/music90s/quiz'
import { getResultById, resolveBandResultId } from '@/features/quiz/scoring'
import fs from 'node:fs'
import path from 'node:path'

// handler under test — imported after env setup but before each test we re-import dynamically
// to ensure env vars are read at handler call time (requireEnv reads process.env on each request).
import handler from '../../api/share/prepare'

const BOT_TOKEN = '7000000001:TEST_FAKE_TOKEN_FOR_UNIT_TESTS'
const APP_BASE_URL = 'https://example.com'
const BOT_USERNAME = 'tginteractivebot'
const APP_SHORT = 'app'

function buildInitData(userId = 424242): string {
  return sign({ user: { id: userId, first_name: 'Тест' } }, BOT_TOKEN, new Date())
}

function mockReqRes(body: Record<string, unknown>) {
  const _jsonMock = vi.fn()
  const _statusMock = vi.fn((code: number) => {
    return { json: _jsonMock, statusCode: code }
  }) as unknown as { (c: number): { json: typeof _jsonMock } }
  // VercelResponse mock: res.status(code).json(obj)
  const res: unknown = {
    status: vi.fn((code: number) => ({
      json: _jsonMock,
      statusCode: code,
    })),
    // capture for inspection
    _jsonMock,
    _statusMock,
  }
  const req: unknown = {
    method: 'POST',
    body,
  }
  return { req: req as import('@vercel/node').VercelRequest, res: res as import('@vercel/node').VercelResponse & { _jsonMock: typeof _jsonMock; _statusMock: typeof _statusMock } }
}

describe('Telegram prepared photo payload — Music90s caption recovery', () => {
  let fetchCaptured: { url: string; init: RequestInit; bodyJson: unknown } | null = null
  let consoleInfoSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    process.env.TELEGRAM_BOT_TOKEN = BOT_TOKEN
    process.env.APP_BASE_URL = APP_BASE_URL
    process.env.TELEGRAM_BOT_USERNAME = BOT_USERNAME
    process.env.TELEGRAM_APP_SHORT_NAME = APP_SHORT
    fetchCaptured = null
    consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => undefined)
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        const bodyJson = init?.body ? JSON.parse(init.body as string) : null
        fetchCaptured = { url: String(url), init: init ?? {}, bodyJson }
        return new Response(JSON.stringify({ ok: true, result: { id: 'prepared_test_id' } }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      }),
    )
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    delete process.env.TELEGRAM_BOT_TOKEN
    delete process.env.APP_BASE_URL
    delete process.env.TELEGRAM_BOT_USERNAME
    delete process.env.TELEGRAM_APP_SHORT_NAME
  })

  it('Music90s score 9 — final Bot API payload has photo type, v4 asset, caption, show_caption_above_media, button', async () => {
    const resultId = resolveBandResultId(music90sQuiz, 9)
    expect(resultId).toBe('m90_cassette')
    const result = getResultById(music90sQuiz, resultId)!
    const initDataRaw = buildInitData(999001)

    const { req, res } = mockReqRes({
      quizId: 'music90s',
      resultId,
      score: 9,
      initDataRaw,
    })

    await handler(req, res)

    // handler should have called Telegram savePreparedInlineMessage
    expect(fetchCaptured).not.toBeNull()
    expect(fetchCaptured!.url).toContain('savePreparedInlineMessage')
    expect(fetchCaptured!.url).toContain(BOT_TOKEN)

    const payload = fetchCaptured!.bodyJson as Record<string, unknown>
    const resultPayload = payload.result as Record<string, unknown>

    // type photo (not article) — required for image delivery
    expect(resultPayload.type).toBe('photo')

    // v4 exact-score asset for 09
    expect(resultPayload.photo_url).toBe('https://example.com/share-cards/v4/m90_score_09.jpg')
    expect(String(resultPayload.photo_url)).toContain('/share-cards/v4/m90_score_09.jpg')
    expect(String(resultPayload.thumbnail_url)).toContain('/share-cards/v4/m90_score_09_thumb.jpg')

    // show_caption_above_media=false requests caption BELOW image: [IMAGE]→[TEXT]→[BUTTON]
    expect(resultPayload.show_caption_above_media).toBe(false)

    // inline keyboard single button Пройти тест
    const markup = resultPayload.reply_markup as { inline_keyboard: Array<Array<{ text: string; url: string }>> }
    expect(markup.inline_keyboard[0][0].text).toBe('Пройти тест')
    expect(markup.inline_keyboard[0][0].url).toContain('t.me')
    // must not have second row (no channel promo in challenge)
    expect(markup.inline_keyboard.length).toBe(1)

    // must NOT use input_message_content fallback (that would drop photo)
    expect(resultPayload).not.toHaveProperty('input_message_content')

    // exact caption for 9/18 (dynamic score + approved quote + headline)
    const expectedCaption9 =
      'Я набрала 9/18 в тесте «Ты точно помнишь музыку 90-х?»\n\n«Мой уровень: знаю только припевы 🎶 А сколько выбьешь ты?»\n\nТы точно помнишь музыку 90-х? Проверь себя:'
    expect(resultPayload.caption).toBe(expectedCaption9)
    expect(resultPayload.caption).toBe(
      `Я набрала 9/18 в тесте «${music90sQuiz.title}»\n\n«${result.presentation.shareQuote}»\n\n${music90sQuiz.copy.shareHeadline}`,
    )

    // caption length within Telegram 1024 limit
    expect((resultPayload.caption as string).length).toBeGreaterThan(0)
    expect((resultPayload.caption as string).length).toBeLessThanOrEqual(1024)

    // diagnostics: [share-caption] logged before call, safe fields only, no token/initDataRaw
    const captionLog = consoleInfoSpy.mock.calls.find((c: unknown[]) => String(c[0]).includes('[share-caption]'))?.[0] as string | undefined
    expect(captionLog).toBeDefined()
    expect(captionLog).toContain('quizId=music90s')
    expect(captionLog).toContain('resultId=m90_cassette')
    expect(captionLog).toContain('score=9')
    expect(captionLog).toContain('captionLength=' + (expectedCaption9.length))
    expect(captionLog).toContain('captionPresent=true')
    expect(captionLog).toContain('showCaptionAboveMedia=false')
    expect(captionLog).toContain('asset=m90_score_09')
    expect(captionLog).toContain('version=v4')
    // must not leak token or raw data
    for (const call of consoleInfoSpy.mock.calls) {
      const s = String(call[0])
      expect(s).not.toContain(BOT_TOKEN)
      expect(s).not.toContain(initDataRaw)
    }

    // response log contains status/ok/preparedId
    const shareLog = consoleInfoSpy.mock.calls.find((c: unknown[]) => String(c[0]).includes('[share] telegram'))?.[0] as string | undefined
    expect(shareLog).toBeDefined()
    expect(shareLog).toContain('status=200')
    expect(shareLog).toContain('ok=true')
    expect(shareLog).toContain('preparedId=prepared_test_id')

    // handler response to client
    const resMock = res as unknown as { status: ReturnType<typeof vi.fn> }
    // verify success id echoed
    expect((resMock.status as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0]).toBe(200)
  })

  it('Music90s score 18 — caption contains 18/18 and secret card quote', async () => {
    const resultId = resolveBandResultId(music90sQuiz, 18)
    expect(resultId).toBe('m90_era18')
    const result = getResultById(music90sQuiz, resultId)!
    const initDataRaw = buildInitData(999002)

    const { req, res } = mockReqRes({
      quizId: 'music90s',
      resultId,
      score: 18,
      initDataRaw,
    })

    await handler(req, res)

    const payload = fetchCaptured!.bodyJson as Record<string, unknown>
    const resultPayload = payload.result as Record<string, unknown>

    expect(resultPayload.type).toBe('photo')
    expect(String(resultPayload.photo_url)).toContain('/share-cards/v4/m90_score_18.jpg')
    expect(resultPayload.show_caption_above_media).toBe(false)

    const expectedCaption18 =
      'Я набрала 18/18 в тесте «Ты точно помнишь музыку 90-х?»\n\n«18 из 18! Выбила секретную карточку: главред журнала Cool ✨ Попробуй повторить, если сможешь.»\n\nТы точно помнишь музыку 90-х? Проверь себя:'
    expect(resultPayload.caption).toBe(expectedCaption18)
    expect(resultPayload.caption).toBe(
      `Я набрала 18/18 в тесте «${music90sQuiz.title}»\n\n«${result.presentation.shareQuote}»\n\n${music90sQuiz.copy.shareHeadline}`,
    )
  })

  it('all Music90s captions 0..18 — non-empty, <=1024, contain score/title/quote/headline, no stale copy', async () => {
    for (let score = 0; score <= 18; score++) {
      fetchCaptured = null
      const resultId = resolveBandResultId(music90sQuiz, score)
      const result = getResultById(music90sQuiz, resultId)!
      const initDataRaw = buildInitData(1000000 + score)

      const { req, res } = mockReqRes({
        quizId: 'music90s',
        resultId,
        score,
        initDataRaw,
      })

      await handler(req, res)

      const payload = fetchCaptured!.bodyJson as Record<string, unknown>
      const resultPayload = payload.result as Record<string, unknown>
      const caption = resultPayload.caption as string

      // non-empty and <=1024
      expect(caption.length, `score ${score} empty`).toBeGreaterThan(0)
      expect(caption.length, `score ${score} exceeds 1024`).toBeLessThanOrEqual(1024)

      // contain score fragment
      expect(caption, `score ${score} missing score`).toContain(`${score}/18`)
      // contain quiz title
      expect(caption, `score ${score} missing quiz title`).toContain(music90sQuiz.title)
      // contain current approved shareQuote
      expect(caption, `score ${score} missing current shareQuote`).toContain(result.presentation.shareQuote)
      // contain current shareHeadline
      expect(caption, `score ${score} missing shareHeadline`).toContain(music90sQuiz.copy.shareHeadline)

      // no stale copy fragments anywhere in caption
      const stale = [
        'Ты и есть 90-е',
        'Кассетная память',
        'Звезда школьной дискотеки',
        '17 из 18. Одну всё-таки не вспомнила',
        '18 из 18. Всё угадала',
        'Теперь попробуй ты.',
        'Моя кассетная память ещё держится',
        'Проверишь свою память?',
      ]
      for (const s of stale) {
        expect(caption, `score ${score} contains stale "${s}"`).not.toContain(s)
      }

      // each payload still has photo contract
      expect(resultPayload.type).toBe('photo')
      expect(String(resultPayload.photo_url)).toContain(`/share-cards/v4/m90_score_${String(score).padStart(2, '0')}.jpg`)
      expect(resultPayload.show_caption_above_media).toBe(false)
      const markup = resultPayload.reply_markup as { inline_keyboard: unknown }
      expect(markup).toBeDefined()
    }
  })

  it('source file does not use input_message_content fallback', () => {
    const file = fs.readFileSync(path.join(process.cwd(), 'api', 'share', 'prepare.ts'), 'utf-8')
    expect(file).not.toContain('input_message_content')
    expect(file).toContain('show_caption_above_media')
    expect(file).toContain('show_caption_above_media: false')
  })

  it('v4 artwork guardrail still in effect', () => {
    const file = fs.readFileSync(path.join(process.cwd(), 'api', 'share', 'prepare.ts'), 'utf-8')
    // ensure versioned path logic remains and not hardcoded to old v2/v3
    const outDir = path.join(process.cwd(), 'public', 'share-cards', 'v4')
    for (let s = 0; s <= 18; s++) {
      const name = `m90_score_${String(s).padStart(2, '0')}.jpg`
      expect(fs.existsSync(path.join(outDir, name)), `missing v4 asset ${name}`).toBe(true)
    }
    // payload already tested to contain v4, double-check file uses server-computed asset
    expect(file).toContain('resolveShareCardAsset')
    expect(file).toContain('shareCardImageUrl')
  })
})
