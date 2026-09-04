#!/usr/bin/env node
// =============================================================================
// Music90s v4+ uses approved source artwork from assets-source/score-cards/
// and must NOT be regenerated from the legacy React card renderer.
//
// CANONICAL PRODUCTION GENERATOR FOR EXTERNAL SHARE CARDS (v4):
//   assets-source/score-cards/*.png  →  public/share-cards/v4/m90_score_XX.jpg
//
// Source PNGs are the FINAL approved external share-card artwork (7 files).
// The legacy Playwright/Music90ShareCard screenshot pipeline is RETIRED for
// production v4 — do NOT screenshot the React component for v4 assets.
// Music90ShareCard.tsx remains as internal preview/deprecated only and is
// explicitly NOT canonical for v4+ external shares.
//
// Score → source mapping (exact):
//   0-4  → 0-4.png
//   5-7  → 5-7.png
//   8-10 → 8-10.png
//   11-13→ 11-13.png
//   14-16→ 14-16.png
//   17   → 17-18.png  (means 17/18 result card, NOT a range)
//   18   → 18-18.png  (rare 18/18)
// Expanded to 19 exact-score JPEGs m90_score_00..m90_score_18 + thumbs.
// =============================================================================

import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const srcDir = path.join(root, 'assets-source', 'score-cards')
const outDir = path.join(root, 'public', 'share-cards', 'v4')

// Exact mapping per spec: score → source PNG basename
const SCORE_TO_SOURCE = {
  0: '0-4.png',
  1: '0-4.png',
  2: '0-4.png',
  3: '0-4.png',
  4: '0-4.png',
  5: '5-7.png',
  6: '5-7.png',
  7: '5-7.png',
  8: '8-10.png',
  9: '8-10.png',
 10: '8-10.png',
 11: '11-13.png',
 12: '11-13.png',
 13: '11-13.png',
 14: '14-16.png',
 15: '14-16.png',
 16: '14-16.png',
 17: '17-18.png',
 18: '18-18.png',
}

async function ensureOutDir() {
  await fs.mkdir(outDir, { recursive: true })
}

async function generate() {
  await ensureOutDir()

  const requiredSources = new Set(Object.values(SCORE_TO_SOURCE))
  for (const src of requiredSources) {
    const p = path.join(srcDir, src)
    try {
      await fs.access(p)
    } catch {
      console.error(`Missing source artwork: ${p}`)
      process.exit(1)
    }
  }

  console.log(`[m90-v4] source dir: ${srcDir}`)
  console.log(`[m90-v4] out dir:    ${outDir}`)
  console.log(`[m90-v4] generating 19 exact-score JPEGs from 7 source PNGs...`)

  let failures = 0

  for (let score = 0; score <= 18; score++) {
    const sourceFile = SCORE_TO_SOURCE[score]
    const srcPath = path.join(srcDir, sourceFile)
    const name = `m90_score_${String(score).padStart(2, '0')}`
    const jpgPath = path.join(outDir, `${name}.jpg`)
    const thumbPath = path.join(outDir, `${name}_thumb.jpg`)

    try {
      const image = sharp(srcPath)
      const meta = await image.metadata()
      if (!meta.width || !meta.height) {
        throw new Error(`unreadable source ${sourceFile}`)
      }
      // Validate source is readable and roughly 4:5 — supplied artworks are 1122x1402.
      // We target 1080x1350 (same 4:5) with quality 90, preserving aspect ratio.
      // Sharp 'inside' keeps ratio; negligible 0.03% difference rounds to exact target.
      // No cropping, no margins, no overlays.

      // Main JPEG: 1080x1350, quality 90 (within 88–92), mozjpeg for efficient encode
      await sharp(srcPath)
        .resize(1080, 1350, { fit: 'inside', withoutEnlargement: false })
        .jpeg({ quality: 90, mozjpeg: true })
        .toFile(jpgPath)

      // Thumbnail: 256x320, quality 88, preserve aspect ratio (inside), no crop
      await sharp(srcPath)
        .resize(256, 320, { fit: 'inside', withoutEnlargement: false })
        .jpeg({ quality: 88, mozjpeg: true })
        .toFile(thumbPath)

      const stat = await fs.stat(jpgPath)
      const thumbStat = await fs.stat(thumbPath)
      // Verify output is JPEG and roughly correct dimensions
      const outMeta = await sharp(jpgPath).metadata()
      const thumbMeta = await sharp(thumbPath).metadata()
      console.log(
        `  ✓ ${name}.jpg ${outMeta.width}x${outMeta.height} ${Math.round(stat.size / 1024)}KB` +
          ` | thumb ${thumbMeta.width}x${thumbMeta.height} ${Math.round(thumbStat.size / 1024)}KB ← ${sourceFile}`,
      )
      if (outMeta.width !== 1080 || outMeta.height !== 1350) {
        console.warn(`    warn: main ${name} is ${outMeta.width}x${outMeta.height}, expected 1080x1350`)
      }
      if (thumbMeta.width !== 256 || thumbMeta.height !== 320) {
        console.warn(`    warn: thumb ${name} is ${thumbMeta.width}x${thumbMeta.height}, expected 256x320`)
      }
    } catch (e) {
      console.error(`  ✗ failed ${score} (${sourceFile}):`, e)
      failures++
    }
  }

  if (failures > 0) {
    console.error(`\n${failures} failures`)
    process.exit(1)
  }

  const files = await fs.readdir(outDir)
  const m90 = files.filter((f) => /^m90_score_\d{2}\.jpg$/.test(f))
  const thumbs = files.filter((f) => /^m90_score_\d{2}_thumb\.jpg$/.test(f))
  if (m90.length !== 19) {
    console.error(`expected 19 m90 cards, got ${m90.length}: ${m90.join(', ')}`)
    process.exit(1)
  }
  if (thumbs.length !== 19) {
    console.error(`expected 19 m90 thumbs, got ${thumbs.length}: ${thumbs.join(', ')}`)
    process.exit(1)
  }
  console.log(`\nDone. ${m90.length} cards + ${thumbs.length} thumbs in ${outDir}`)
  console.log(`Mapping: 0-4→0-4.png, 5-7→5-7.png, 8-10→8-10.png, 11-13→11-13.png, 14-16→14-16.png, 17→17-18.png, 18→18-18.png`)
}

generate().catch((e) => {
  console.error(e)
  process.exit(1)
})
