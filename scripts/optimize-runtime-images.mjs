#!/usr/bin/env node
// Optimizes runtime imagery for the Telegram Mini App into
// public/optimized/{quiz,results,landing}/ with WebP + JPEG variants at
// 480/720/960 widths. Source PNGs in assets-source/ are NEVER overwritten.
// Idempotent: re-running produces identical output bytes.
//
// Source data: assets-source/q1-a.png … q2-d.png, plus six archetype art
// files renamed by archetype id for the result hero. See config below.

import { mkdir, writeFile, stat, unlink, readdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const sourceDir = path.join(root, 'assets-source')
const outDir = path.join(root, 'public', 'optimized')

const WIDTHS = [480, 720, 960]
const WEBP_QUALITY = 80
const JPEG_QUALITY = 84

/** CI guard: hard ceiling per production variant (brief §20 soft budget). */
const BUDGET_BYTES = { quiz: 200 * 1024, results: 250 * 1024 }

/**
 * Source file (under assets-source/) and its production key.
 * Production keys MUST match the quiz content assetKeys ('q1_a', not
 * 'q1-a'): the React manifest lookup is by assetKey, so a mismatch here
 * silently renders null instead of an image (production regression 2024).
 */
const SOURCES = [
  // Quiz Q1/Q2 cards: 16:9 landscape
  ...['q1-a', 'q1-b', 'q1-c', 'q1-d', 'q2-a', 'q2-b', 'q2-c', 'q2-d'].map((file) => ({
    name: file.replace(/-/g, '_'),
    sourceFile: `${file}.png`,
    bucket: 'quiz',
    aspect: '16/9',
  })),
  // Result hero archetypes: 4:5 portrait
  ...[
    ['quiet-luxury', 'quiet'],
    ['parisian', 'paris'],
    ['italian-diva', 'italian'],
    ['the-collector', 'collector'],
    ['cottage-soul', 'cottage'],
    ['scandi-calm', 'scandi'],
  ].map(([file, key]) => ({
    name: key,
    sourceFile: `${file}.png`,
    bucket: 'results',
    aspect: '4/5',
  })),
]

/** Convert an entry + width to a pair of buffers (WebP, JPEG). */
async function encodeVariants(sourcePath, targetW, targetH) {
  const base = sharp(sourcePath, { failOn: 'truncated' }).rotate()
  const [webp, jpeg] = await Promise.all([
    base
      .clone()
      .resize(targetW, targetH, { fit: 'cover', position: 'centre' })
      .webp({ quality: WEBP_QUALITY, effort: 5 })
      .toBuffer(),
    base
      .clone()
      .resize(targetW, targetH, { fit: 'cover', position: 'centre' })
      .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
      .toBuffer(),
  ])
  return { webp, jpeg }
}

function targetPath(bucket, name, width, ext) {
  return path.join(outDir, bucket, `${name}-${width}.${ext}`)
}

function formatBytes(n) {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 / 1024).toFixed(2)} MB`
}

async function main() {
  if (!existsSync(sourceDir)) {
    console.error(`[runtime-images] source dir not found: ${sourceDir}`)
    process.exit(1)
  }

  await mkdir(path.join(outDir, 'quiz'), { recursive: true })
  await mkdir(path.join(outDir, 'results'), { recursive: true })

  const manifest = { quiz: {}, results: {}, landing: {}, widths: WIDTHS }
  const summary = { processed: 0, webpBytes: 0, jpegBytes: 0, sourceBytes: 0 }
  const allVariants = []
  const budgetViolations = []

  for (const entry of SOURCES) {
    const sourcePath = path.join(sourceDir, entry.sourceFile)
    if (!existsSync(sourcePath)) {
      console.warn(`[runtime-images] missing source: ${entry.sourceFile}`)
      continue
    }
    const sourceStat = await stat(sourcePath)
    summary.sourceBytes += sourceStat.size

    // master ratio target from the entry aspect (1/0.5 = 2.0 etc.)
    const [aw, ah] = entry.aspect === '16/9' ? [16, 9] : [4, 5]
    const entryOut = { ratio: entry.aspect, widths: WIDTHS, webp: {}, jpeg: {} }
    let largest = { width: 0, bytes: 0 }
    const overBudget = []
    for (const width of WIDTHS) {
      const targetH = Math.round((width * ah) / aw)
      const { webp, jpeg } = await encodeVariants(sourcePath, width, targetH)
      await writeFile(targetPath(entry.bucket, entry.name, width, 'webp'), webp)
      await writeFile(targetPath(entry.bucket, entry.name, width, 'jpg'), jpeg)
      entryOut.webp[String(width)] = { w: width, h: targetH, bytes: webp.length }
      entryOut.jpeg[String(width)] = { w: width, h: targetH, bytes: jpeg.length }
      summary.webpBytes += webp.length
      summary.jpegBytes += jpeg.length
      if (webp.length > largest.bytes) {
        largest = { width, bytes: webp.length }
      }
      const limit = BUDGET_BYTES[entry.bucket]
      for (const [ext, bytes] of [['webp', webp.length], ['jpg', jpeg.length]]) {
        if (bytes > limit) {
          overBudget.push(`${entry.bucket}/${entry.name}-${width}.${ext} ${formatBytes(bytes)}`)
        }
      }
      allVariants.push({
        asset: entry.name,
        bucket: entry.bucket,
        width,
        webp: webp.length,
        jpeg: jpeg.length,
      })
    }
    manifest[entry.bucket][entry.name] = entryOut
    summary.processed += 1
    console.log(
      `  ${entry.bucket}/${entry.name}: ${WIDTHS.length * 2} variants, ` +
        `largest webp ${largest.width}w = ${formatBytes(largest.bytes)}`
    )
    budgetViolations.push(...overBudget)
  }

  // Drop any leftover variants that no longer correspond to a known entry.
  for (const bucket of ['quiz', 'results']) {
    const keep = new Set(SOURCES.filter((e) => e.bucket === bucket).map((e) => e.name))
    const dir = path.join(outDir, bucket)
    if (!existsSync(dir)) continue
    for (const file of await readdir(dir)) {
      const stem = file.replace(/-\d+\.(webp|jpg)$/, '')
      if (!keep.has(stem)) {
        await unlink(path.join(dir, file))
        console.warn(`  removed stale ${bucket}/${file}`)
      }
    }
  }

  if (budgetViolations.length > 0) {
    console.error('')
    console.error('[runtime-images] BUDGET EXCEEDED (CI guard):')
    for (const v of budgetViolations) console.error(`  ${v}`)
    process.exit(1)
  }

  // Generated manifest for the React side.
  await writeFile(
    path.join(outDir, 'manifest.json'),
    JSON.stringify(manifest, null, 2) + '\n',
  )

  const totalOut = summary.webpBytes + summary.jpegBytes
  const saving = summary.sourceBytes
    ? ((1 - totalOut / summary.sourceBytes) * 100).toFixed(1)
    : '0'
  console.log('')
  console.log(`[runtime-images] processed ${summary.processed} assets`)
  console.log(`  source:   ${formatBytes(summary.sourceBytes)}`)
  console.log(`  webp:     ${formatBytes(summary.webpBytes)}`)
  console.log(`  jpeg:     ${formatBytes(summary.jpegBytes)}`)
  console.log(`  saving:   ${saving}% (vs source PNG)`)
  console.log(`  manifest: public/optimized/manifest.json`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})