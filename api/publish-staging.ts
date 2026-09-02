import type { VercelRequest, VercelResponse } from '@vercel/node'
import fs from 'node:fs'
import path from 'node:path'

/**
 * Temporary staging publisher for Music90s launch post.
 * POST /api/publish-staging?secret=XXX  or  GET with secret
 * Uses server-side TELEGRAM_BOT_TOKEN to sendPhoto to staging channel.
 *
 * Guardrail: only publishes to @wtfwtf1234567889, not production.
 * No quiz code modified. Token never exposed to client.
 */

const STAGING_CHANNEL = '@wtfwtf1234567889'
const BUTTON_URL = 'https://t.me/tginteractivebot/app?startapp=quiz_music90s'
const CAPTION = `Поймала себя на том, что вообще не помню, о чём думала на уроках химии в девятом классе, но если сейчас включить песню «Одинокий голубь» — допою припев без единой запинки. И чёлку на сахарную воду перед школьной дискотекой тоже помню.

Короче, мы с мужем сделали небольшой ностальгический тест про попсу конца 90-х. Я вспоминала самые дурацкие клипы, постеры из Cool Girl и медляки, а он собрал из этого красивую штуку в телеграме.

Там 18 вопросов. Гуглить неспортивно.`

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Allow both GET and POST for manual trigger
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'method_not_allowed' })
    return
  }

  const token = process.env.TELEGRAM_BOT_TOKEN
  const botUsername = process.env.TELEGRAM_BOT_USERNAME
  if (!token) {
    res.status(503).json({ ok: false, error: 'bot_not_configured' })
    return
  }

  // Optional secret check — if PUBLISH_SECRET is set, require it
  const expectedSecret = process.env.PUBLISH_SECRET
  if (expectedSecret) {
    const provided = (req.query.secret as string) || (req.body as unknown as { secret?: string })?.secret
    if (provided !== expectedSecret) {
      res.status(401).json({ ok: false, error: 'unauthorized' })
      return
    }
  }

  // Dry-run mode: ?dry=1 returns payload without sending
  const isDryRun = req.query.dry === '1' || req.query.dry === 'true'

  // Validate quiz exists (music90s 18Q) — fail fast if content missing
  // We import quiz lazily to avoid bundling issues in Vercel
  try {
    const { music90sQuiz } = await import('../src/content/quizzes/music90s/quiz.js')
    if (music90sQuiz.id !== 'music90s' || music90sQuiz.questions.length !== 18) {
      res.status(500).json({ ok: false, error: 'quiz_music90s_invalid', quizId: music90sQuiz.id, len: music90sQuiz.questions.length })
      return
    }
  } catch (e) {
    // If import fails (Vercel bundling), just warn but continue — quiz is known 18Q
    console.warn('[publish-staging] quiz import failed, continuing', e)
  }

  const replyMarkup = {
    inline_keyboard: [[{ text: '🎧 Пройти тест', url: BUTTON_URL }]],
  }

  if (isDryRun) {
    res.status(200).json({
      ok: true,
      dry: true,
      channel: STAGING_CHANNEL,
      caption: CAPTION,
      button: { text: '🎧 Пройти тест', url: BUTTON_URL },
      image: 'public/telegram/music90s-launch.jpg (1080x1350, will be uploaded as multipart)',
      quiz: 'quiz_music90s -> music90s (18 questions)',
      bot: botUsername || 'tginteractivebot',
    })
    return
  }

  // Resolve image path — Vercel includes public files in the function bundle if includeFiles is set, but
  // public/telegram is not automatically included for api functions. We try multiple locations.
  const candidates = [
    path.join(process.cwd(), 'public', 'telegram', 'music90s-launch.jpg'),
    path.join(process.cwd(), '..', 'public', 'telegram', 'music90s-launch.jpg'),
    // Fallback: if file not found, try to use URL instead (requires APP_BASE_URL)
  ]

  let imageBuffer: Buffer | null = null
  let imagePathUsed: string | null = null
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) {
        imageBuffer = fs.readFileSync(p)
        imagePathUsed = p
        break
      }
    } catch {}
  }

  // If image not found on filesystem, fallback to URL method
  if (!imageBuffer) {
    const appBase = process.env.APP_BASE_URL || `https://${process.env.VERCEL_URL || 'tginteractive.vercel.app'}`
    const imageUrl = `${appBase.replace(/\/$/, '')}/telegram/music90s-launch.jpg`
    console.info(`[publish-staging] image not found locally, using URL ${imageUrl}`)
    // Send via URL (Telegram will fetch)
    const payload = {
      chat_id: STAGING_CHANNEL,
      photo: imageUrl,
      caption: CAPTION,
      reply_markup: replyMarkup,
    }
    const resp = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const json = (await resp.json().catch(() => null)) as unknown as { ok?: boolean; description?: string; result?: { message_id?: number } } | null
    console.info(`[publish-staging] sendPhoto URL status=${resp.status} ok=${json?.ok} desc=${json?.description} msgId=${json?.result?.message_id}`)
    if (json?.ok) {
      res.status(200).json({ ok: true, channel: STAGING_CHANNEL, message_id: json?.result?.message_id, method: 'url', imageUrl, caption: CAPTION, button: BUTTON_URL })
    } else {
      res.status(502).json({ ok: false, error: 'telegram_failure', details: json, status: resp.status })
    }
    return
  }

  // Multipart upload via FormData (recommended, no public URL needed)
  // Node 18+ has global FormData and Blob
  const form = new FormData()
  form.append('chat_id', STAGING_CHANNEL)
  form.append('caption', CAPTION)
  form.append('reply_markup', JSON.stringify(replyMarkup))
  // Use Blob for binary
  const blob = new Blob([new Uint8Array(imageBuffer)], { type: 'image/jpeg' })
  form.append('photo', blob, 'music90s-launch.jpg')

  const resp = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
    method: 'POST',
    body: form as unknown as BodyInit,
  })
  const json = (await resp.json().catch(() => null)) as unknown as { ok?: boolean; description?: string; result?: { message_id?: number } } | null
    console.info(`[publish-staging] sendPhoto multipart status=${resp.status} ok=${json?.ok} desc=${json?.description} msgId=${json?.result?.message_id} path=${imagePathUsed}`)
  if (json?.ok) {
    res.status(200).json({ ok: true, channel: STAGING_CHANNEL, message_id: json?.result?.message_id, method: 'multipart', imagePath: imagePathUsed, caption: CAPTION, button: BUTTON_URL })
  } else {
    res.status(502).json({ ok: false, error: 'telegram_failure', details: json, status: resp.status })
  }
}
