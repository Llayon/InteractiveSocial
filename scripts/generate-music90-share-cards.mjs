#!/usr/bin/env node
// Canonical Music90s share-card generator — single truth with runtime ResultCard.
// Renders Music90ShareCard via Vite dev server + Playwright screenshot at 1080x1350,
// then produces JPEG + thumbnail in versioned path public/share-cards/v3/

import { chromium } from '@playwright/test'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { createServer } from 'vite'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const outDir = path.join(root, 'public', 'share-cards', 'v3')
let baseUrl = process.env.SHARE_CARD_BASE_URL || null

async function ensureOutDir() {
  await fs.mkdir(outDir, { recursive: true })
}

async function startViteIfNeeded() {
  if (baseUrl) return null
  const server = await createServer({
    configFile: path.join(root, 'vite.config.ts'),
    server: { port: 5173, strictPort: true, host: '127.0.0.1' },
  })
  await server.listen()
  server.printUrls()
  baseUrl = 'http://127.0.0.1:5173'
  console.log(`[vite] dev server at ${baseUrl}`)
  return server
}

async function generate() {
  await ensureOutDir()
  const viteServer = await startViteIfNeeded()
  const browser = await chromium.launch()
  const context = await browser.newContext({
    viewport: { width: 1080, height: 1350 },
    deviceScaleFactor: 1,
  })
  const page = await context.newPage()

  const scores = Array.from({ length: 19 }, (_, i) => i)
  let failures = 0

  for (const score of scores) {
    const url = `${baseUrl}/?shareCardPreview=1&quiz=music90s&score=${score}`
    console.log(`→ ${score}/18 ${url}`)
    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 })
      await page.waitForSelector('[data-testid="m90-share-card"]', { timeout: 10000 })
      await page.waitForFunction(() => {
        const img = document.querySelector('.m90-share-card__object')
        return img && img.complete && img.naturalWidth > 0
      }, null, { timeout: 10000 }).catch(() => {
        console.warn(`  warn: object image not loaded for ${score}`)
      })
      await page.waitForTimeout(300)
      const element = page.locator('[data-testid="m90-share-card"]')
      const pngBuffer = await element.screenshot({ type: 'png', timeout: 10000 })
      const meta = await sharp(pngBuffer).metadata()
      if (meta.width !== 1080 || meta.height !== 1350) {
        console.warn(`  warn: unexpected dimensions ${meta.width}x${meta.height} for ${score}`)
      }
      const name = `m90_score_${String(score).padStart(2, '0')}`
      const jpgPath = path.join(outDir, `${name}.jpg`)
      const thumbPath = path.join(outDir, `${name}_thumb.jpg`)
      await sharp(pngBuffer).jpeg({ quality: 80, mozjpeg: true }).toFile(jpgPath)
      await sharp(pngBuffer).resize(256, 320, { fit: 'cover', position: 'centre' }).jpeg({ quality: 78, mozjpeg: true }).toFile(thumbPath)
      const stat = await fs.stat(jpgPath)
      const thumbStat = await fs.stat(thumbPath)
      console.log(`  ✓ ${name}.jpg ${Math.round(stat.size / 1024)}KB thumb ${Math.round(thumbStat.size / 1024)}KB`)
    } catch (e) {
      console.error(`  ✗ failed ${score}:`, e)
      failures++
    }
  }

  await browser.close()
  if (viteServer) await viteServer.close()

  if (failures > 0) {
    console.error(`\n${failures} failures`)
    process.exit(1)
  }

  const files = await fs.readdir(outDir)
  const m90 = files.filter(f => /^m90_score_\d{2}\.jpg$/.test(f))
  if (m90.length !== 19) {
    console.error(`expected 19 m90 cards, got ${m90.length}: ${m90.join(', ')}`)
    process.exit(1)
  }
  console.log(`\nDone. ${m90.length} cards in ${outDir}`)
}

generate().catch(e => {
  console.error(e)
  process.exit(1)
})
