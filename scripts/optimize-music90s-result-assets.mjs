#!/usr/bin/env node
// Optimize music90s result runtime assets — data-driven per-range folders
// Source of truth: assets-source/score-cards/<range> + assets-source/music90s-objects
// Runtime: public/optimized/music90s/results/<range>/
// Graceful fallback: empty 17-18 / 18-18 -> music90s-objects
import { mkdir, readdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const sourceScoreDir = path.join(root, 'assets-source', 'score-cards')
const sourceObjectsDir = path.join(root, 'assets-source', 'music90s-objects')
const outBase = path.join(root, 'public', 'optimized', 'music90s', 'results')

const MAPPING = {
  m90_rookie: '0-4',
  m90_familiar: '5-7',
  m90_cassette: '8-10',
  m90_disco: '11-13',
  m90_legend: '14-16',
  m90_era17: '17-18',
  m90_era18: '18-18',
}

// Hero inference per spec §6
const HERO_PREFERENCE = {
  '0-4': ['tv.png'],
  '5-7': ['boombox'], // fallback to objects
  '8-10': ['cassette'],
  '11-13': ['cd-collage'],
  '14-16': null, // use first folder asset (disco family)
  '17-18': ['magazines'],
  '18-18': ['magazines'],
}

const OBJECTS_FALLBACK = {
  boombox: 'boombox.png',
  cassette: 'cassette.png',
  'cd-collage': 'cd-collage.png',
  tv: 'tv.png',
  magazines: 'magazines.png',
  crown: 'crown.png',
  stickers: 'stickers-1999.png',
}

async function ensureDir(p) { await mkdir(p, { recursive: true }) }

async function optimizePngToWebpPng(src, destBase, maxWidth = 640) {
  const meta = await sharp(src).metadata()
  const w = meta.width || maxWidth
  const h = meta.height || maxWidth
  // resize to maxWidth preserving aspect, without enlargement if already smaller
  const targetW = Math.min(w, maxWidth)
  const targetH = Math.round((targetW * h) / w)
  const base = sharp(src, { failOn: 'truncated' }).rotate()
  const webp = await base.clone().resize(targetW, targetH, { fit: 'inside', withoutEnlargement: false }).webp({ quality: 82, effort: 5 }).toBuffer()
  const png = await base.clone().resize(targetW, targetH, { fit: 'inside', withoutEnlargement: false }).png({ compressionLevel: 9, palette: false }).toBuffer()
  const { writeFile } = await import('node:fs/promises')
  await writeFile(destBase + '.webp', webp)
  await writeFile(destBase + '.png', png)
  return { webp: webp.length, png: png.length, w: targetW, h: targetH }
}

async function main() {
  await ensureDir(outBase)
  console.log('[m90-results] source score-cards:', sourceScoreDir)
  console.log('[m90-results] outBase:', outBase)

  for (const [resultId, range] of Object.entries(MAPPING)) {
    const srcFolder = path.join(sourceScoreDir, range)
    const outFolder = path.join(outBase, range)
    await ensureDir(outFolder)
    let files = []
    if (existsSync(srcFolder)) {
      try { files = await readdir(srcFolder) } catch { files = [] }
      files = files.filter(f => f.toLowerCase().endsWith('.png'))
    }
    console.log(`\n[${resultId} → ${range}] ${files.length} source files`)
    if (files.length === 0) {
      console.log(`  (empty) -> will fallback to music90s-objects`)
      // create fallback hero from objects
      const pref = HERO_PREFERENCE[range]
      if (pref && pref[0]) {
        const key = pref[0]
        const objFile = OBJECTS_FALLBACK[key]
        if (objFile) {
          const src = path.join(sourceObjectsDir, objFile)
          if (existsSync(src)) {
            const dest = path.join(outFolder, 'hero')
            const res = await optimizePngToWebpPng(src, dest, 700)
            console.log(`  fallback hero ${objFile} -> hero.webp ${res.w}x${res.h} ${res.webp} bytes`)
          }
        }
      }
      // also create marker for fallback
      const { writeFile } = await import('node:fs/promises')
      await writeFile(path.join(outFolder, '.fallback'), `fallback to music90s-objects/${HERO_PREFERENCE[range]?.[0] ?? 'magazines'}\n`)
      continue
    }

    // Copy each source PNG as optimized hero/secondary layers
    // Identify hero file
    let heroFile = null
    const pref = HERO_PREFERENCE[range]
    if (pref) {
      for (const p of pref) {
        const exact = files.find(f => f.toLowerCase().includes(p.toLowerCase()))
        if (exact) { heroFile = exact; break }
      }
    }
    if (!heroFile) {
      // pick first file deterministic alphabetical
      files.sort()
      heroFile = files[0]
    }
    console.log(`  hero: ${heroFile}`)

    for (const f of files) {
      const src = path.join(srcFolder, f)
      const nameNoExt = path.basename(f, '.png')
      // sanitize: keep hash or score_a etc, but prefix hero for main
      const isHero = f === heroFile
      const destName = isHero ? 'hero' : `layer-${nameNoExt}`
      const dest = path.join(outFolder, destName)
      const res = await optimizePngToWebpPng(src, dest, isHero ? 640 : 560)
      console.log(`  ${isHero ? 'hero' : 'layer'} ${f} -> ${destName}.webp ${res.w}x${res.h} ${Math.round(res.webp/1024)}KB`)
    }

    // Also ensure fallback object is accessible for graceful fallback logic
    // Copy preferred object fallback alongside if not already hero
    if (pref && pref[0]) {
      const key = pref[0]
      const objFile = OBJECTS_FALLBACK[key]
      if (objFile) {
        const src = path.join(sourceObjectsDir, objFile)
        if (existsSync(src)) {
          // only create fallback hero if hero wasn't from objects and is different
          // we create hero-fallback for config to reference
          const fallbackDest = path.join(outFolder, 'hero-fallback')
          // don't overwrite hero if already from same source; just create fallback marker
          if (heroFile && !heroFile.toLowerCase().includes(key)) {
            const res = await optimizePngToWebpPng(src, fallbackDest, 640)
            console.log(`  fallback object ${objFile} -> hero-fallback.webp ${res.w}x${res.h}`)
          }
        }
      }
    }
  }

  // Also ensure decorative assets from music90s-objects are optimized for results fallback
  // Already exists at public/optimized/music90s/*.png but we also mirror to results/_fallback/
  const fallbackDir = path.join(outBase, '_fallback')
  await ensureDir(fallbackDir)
  for (const obj of Object.keys(OBJECTS_FALLBACK)) {
    const src = path.join(sourceObjectsDir, OBJECTS_FALLBACK[obj])
    if (existsSync(src)) {
      const dest = path.join(fallbackDir, obj)
      await optimizePngToWebpPng(src, dest, 640)
    }
  }
  console.log(`\n[m90-results] fallback objects mirrored to ${fallbackDir}`)

  // Verify runtime assets exist
  console.log('\n[m90-results] verification:')
  for (const range of Object.values(MAPPING)) {
    const outFolder = path.join(outBase, range)
    const exists = existsSync(outFolder)
    const list = exists ? await readdir(outFolder) : []
    console.log(`  ${range}: ${list.join(', ')}`)
  }
}

main().catch(e => { console.error(e); process.exit(1) })
