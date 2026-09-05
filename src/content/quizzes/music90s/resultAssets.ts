/**
 * Single source of truth for Music90s runtime result-screen assets.
 * Data-driven mapping: resultId → range folder → runtime hero + decorative layers.
 *
 * Source structure (assets-source/score-cards/):
 *   0-4, 5-7, 8-10, 11-13, 14-16, 17-18, 18-18
 * Runtime structure (public/optimized/music90s/results/<range>/):
 *   hero.webp/.png (+ layers) — produced by scripts/optimize-music90s-result-assets.mjs
 * Fallback chain per spec §1: range-specific folder → assets-source/music90s-objects
 *   e.g. 17-18 / 18-18 are empty → fallback to magazines.png
 *
 * No JSX in this file hard-codes paths; all paths flow through this config
 * and are consumed by Music90ResultHero / Music90ResultLayout.
 */

export type Music90ResultId =
  | 'm90_rookie'
  | 'm90_familiar'
  | 'm90_cassette'
  | 'm90_disco'
  | 'm90_legend'
  | 'm90_era17'
  | 'm90_era18'

export interface LayerAsset {
  src: string
  fallback: string
}

export interface StickerAsset extends LayerAsset {
  positionClass: string // e.g. m90-sticker--heart
}

export interface TapeAsset extends LayerAsset {
  positionClass: string // e.g. m90-tape--a
}

export interface Music90AssetSet {
  id: Music90ResultId
  /** Source truth folder name under assets-source/score-cards */
  rangeFolder: string
  /** Human-readable band, for docs */
  bandLabel: string
  /** Hero object — primary collage centerpiece */
  hero: LayerAsset & { objectFallback?: string }
  /** Secondary layers from range folder (optional collage fillers) */
  secondary: LayerAsset[]
  /** Decorative tapes pinning the collage */
  tapes: TapeAsset[]
  /** Holographic foil scrap behind hero */
  foil: (LayerAsset & { variant: 'cassette' | 'generic' | 'hidden' | 'rare' }) | null
  /** Glossy sticker pack around hero */
  stickers: StickerAsset[]
  /** Hook pink torn strip background */
  hookStrip: LayerAsset
  /** Title-top small sticker / label */
  label: { text: string; mod?: string }
  /** Pink-paper hook copy (live HTML, not baked) */
  hook: string
  /** Positional / visual hints for CSS */
  layout: {
    heroClass: string
    heroSizeMod?: string
    rare?: boolean
    creamLabel?: boolean
  }
}

const OBJECTS_FALLBACK = {
  tv: '/optimized/music90s/tv.png',
  boombox: '/optimized/music90s/boombox.png',
  cassette: '/optimized/music90s/cassette.png',
  cd: '/optimized/music90s/cd-collage.png',
  magazines: '/optimized/music90s/magazines.png',
}

// Base decorative assets — shared editorial kit, curated not messy.
// These live at public/optimized/music90s/result/* (singular, pre-existing result kit).
const BASE_TAPES: TapeAsset[] = [
  { src: '/optimized/music90s/result/m90-tape-gingham-1.webp', fallback: '/optimized/music90s/result/m90-tape-gingham-1.png', positionClass: 'm90-tape--a' },
  { src: '/optimized/music90s/result/m90-tape-pale-1.webp', fallback: '/optimized/music90s/result/m90-tape-pale-1.png', positionClass: 'm90-tape--b' },
]

const BASE_STICKERS: StickerAsset[] = [
  { src: '/optimized/music90s/result/m90-sticker-heart-glitter.webp', fallback: '/optimized/music90s/result/m90-sticker-heart-glitter.png', positionClass: 'm90-sticker--heart' },
  { src: '/optimized/music90s/result/m90-sticker-star-gold.webp', fallback: '/optimized/music90s/result/m90-sticker-star-gold.png', positionClass: 'm90-sticker--star' },
  { src: '/optimized/music90s/result/m90-sticker-lips.webp', fallback: '/optimized/music90s/result/m90-sticker-lips.png', positionClass: 'm90-sticker--lips' },
]

const HOOK_STRIP: LayerAsset = {
  src: '/optimized/music90s/result/m90-hook-strip.webp',
  fallback: '/optimized/music90s/result/m90-hook-strip.png',
}

// Per-band hero overrides — data-driven but still within reusable system.
// All heroes use /optimized/music90s/results/<range>/hero.* when folder has content,
// otherwise fallback to OBJECTS_FALLBACK per graceful fallback chain.
export const MUSIC90_RESULT_ASSETS: Record<Music90ResultId, Music90AssetSet> = {
  m90_rookie: {
    id: 'm90_rookie',
    rangeFolder: '0-4',
    bandLabel: '0–4 из 18 — Случайно заглянула в 90-е',
    hero: {
      src: '/optimized/music90s/results/0-4/hero.webp',
      fallback: '/optimized/music90s/results/0-4/hero.png',
      objectFallback: OBJECTS_FALLBACK.tv,
    },
    secondary: [
      { src: '/optimized/music90s/results/0-4/layer-13a67292-e7ac-4cb2-aaae-0348eb8c0be3.webp', fallback: '/optimized/music90s/results/0-4/layer-13a67292-e7ac-4cb2-aaae-0348eb8c0be3.png' },
      { src: '/optimized/music90s/results/0-4/layer-29aa26dd-e17c-4597-881e-187dd55b6d5e.webp', fallback: '/optimized/music90s/results/0-4/layer-29aa26dd-e17c-4597-881e-187dd55b6d5e.png' },
    ],
    tapes: BASE_TAPES,
    foil: { src: '/optimized/music90s/result/m90-foil.webp', fallback: '/optimized/music90s/result/m90-foil.png', variant: 'generic' },
    stickers: BASE_STICKERS,
    hookStrip: HOOK_STRIP,
    label: { text: '0—4' },
    hook: 'И, кажется, быстро вышла.',
    layout: { heroClass: 'm90-result-hero--rookie', creamLabel: true },
  },
  m90_familiar: {
    id: 'm90_familiar',
    rangeFolder: '5-7',
    bandLabel: '5–7 из 18 — Где-то это слышала',
    hero: {
      src: '/optimized/music90s/results/5-7/hero.webp',
      fallback: '/optimized/music90s/results/5-7/hero.png',
      objectFallback: OBJECTS_FALLBACK.boombox,
    },
    secondary: [
      { src: '/optimized/music90s/results/5-7/layer-19b3c474-659c-4972-b490-9049217f5c10.webp', fallback: '/optimized/music90s/results/5-7/layer-19b3c474-659c-4972-b490-9049217f5c10.png' },
    ],
    tapes: BASE_TAPES,
    foil: { src: '/optimized/music90s/result/m90-foil.webp', fallback: '/optimized/music90s/result/m90-foil.png', variant: 'generic' },
    stickers: BASE_STICKERS,
    hookStrip: HOOK_STRIP,
    label: { text: '5—7' },
    hook: 'Что-то смутно всплывает в памяти.',
    layout: { heroClass: 'm90-result-hero--familiar', creamLabel: true },
  },
  m90_cassette: {
    id: 'm90_cassette',
    rangeFolder: '8-10',
    bandLabel: '8–10 из 18 — Знаю только припевы (reference hero)',
    hero: {
      // Reference cassette is the layered m90-cassette kit (richer than plain cassette.png)
      src: '/optimized/music90s/result/m90-cassette.webp',
      fallback: '/optimized/music90s/result/m90-cassette.png',
      objectFallback: OBJECTS_FALLBACK.cassette,
    },
    secondary: [
      { src: '/optimized/music90s/results/8-10/layer-score_b.webp', fallback: '/optimized/music90s/results/8-10/layer-score_b.png' },
      { src: '/optimized/music90s/results/8-10/layer-score_c.webp', fallback: '/optimized/music90s/results/8-10/layer-score_c.png' },
    ],
    tapes: BASE_TAPES,
    foil: { src: '/optimized/music90s/result/m90-foil.webp', fallback: '/optimized/music90s/result/m90-foil.png', variant: 'cassette' },
    stickers: BASE_STICKERS,
    hookStrip: HOOK_STRIP,
    label: { text: 'кассета' },
    hook: 'База на месте.',
    layout: { heroClass: 'm90-result-hero--cassette' },
  },
  m90_disco: {
    id: 'm90_disco',
    rangeFolder: '11-13',
    bandLabel: '11–13 из 18 — Слушала MTV сутками',
    hero: {
      src: '/optimized/music90s/results/11-13/hero.webp',
      fallback: '/optimized/music90s/results/11-13/hero.png',
      objectFallback: OBJECTS_FALLBACK.cd,
    },
    secondary: [
      { src: '/optimized/music90s/results/11-13/layer-815adfaf-1f22-427a-ba4c-44572ac3bd9a.webp', fallback: '/optimized/music90s/results/11-13/layer-815adfaf-1f22-427a-ba4c-44572ac3bd9a.png' },
      { src: '/optimized/music90s/results/11-13/layer-b018ad77-d036-4b39-a3c5-fb14733ac4cb.webp', fallback: '/optimized/music90s/results/11-13/layer-b018ad77-d036-4b39-a3c5-fb14733ac4cb.png' },
    ],
    tapes: BASE_TAPES,
    foil: { src: '/optimized/music90s/result/m90-foil.webp', fallback: '/optimized/music90s/result/m90-foil.png', variant: 'generic' },
    stickers: [
      ...BASE_STICKERS,
      // glossy extra for disco not overwhelming
    ],
    hookStrip: HOOK_STRIP,
    label: { text: 'дискотека', mod: 'm90-sticker-title--cyan' },
    hook: 'Сразу видно человека с опытом.',
    layout: { heroClass: 'm90-result-hero--disco' },
  },
  m90_legend: {
    id: 'm90_legend',
    rangeFolder: '14-16',
    bandLabel: '14–16 из 18 — Королева школьной дискотеки',
    hero: {
      src: '/optimized/music90s/results/14-16/hero.webp',
      fallback: '/optimized/music90s/results/14-16/hero.png',
      objectFallback: OBJECTS_FALLBACK.cd, // should never need fallback if folder has content
    },
    secondary: [
      { src: '/optimized/music90s/results/14-16/layer-39cf1b97-37cc-4e66-8650-d014ceaa5cc4.webp', fallback: '/optimized/music90s/results/14-16/layer-39cf1b97-37cc-4e66-8650-d014ceaa5cc4.png' },
      { src: '/optimized/music90s/results/14-16/layer-88e0d7b2-0ed2-4b88-a067-0f463aef8586.webp', fallback: '/optimized/music90s/results/14-16/layer-88e0d7b2-0ed2-4b88-a067-0f463aef8586.png' },
    ],
    tapes: BASE_TAPES,
    foil: { src: '/optimized/music90s/result/m90-foil.webp', fallback: '/optimized/music90s/result/m90-foil.png', variant: 'generic' },
    stickers: BASE_STICKERS,
    hookStrip: HOOK_STRIP,
    label: { text: 'дискотека', mod: 'm90-sticker-title--lime' },
    hook: 'Первый медляк помнишь до сих пор.',
    layout: { heroClass: 'm90-result-hero--legend' },
  },
  m90_era17: {
    id: 'm90_era17',
    rangeFolder: '17-18',
    bandLabel: '17 из 18 — Главред журнала Cool',
    hero: {
      src: '/optimized/music90s/results/17-18/hero.webp',
      fallback: '/optimized/music90s/results/17-18/hero.png',
      objectFallback: OBJECTS_FALLBACK.magazines,
    },
    secondary: [],
    tapes: BASE_TAPES.slice(0, 1), // editorial: fewer tapes, cleaner
    foil: null, // editorial vibe, foil subtle via CSS not image
    stickers: BASE_STICKERS.slice(0, 2),
    hookStrip: HOOK_STRIP,
    label: { text: '17/18' },
    hook: 'На одном всё-таки срезалась.',
    layout: { heroClass: 'm90-result-hero--era17' },
  },
  m90_era18: {
    id: 'm90_era18',
    rangeFolder: '18-18',
    bandLabel: '18 из 18 — Главред журнала Cool ✨ (rare foil)',
    hero: {
      src: '/optimized/music90s/results/18-18/hero.webp',
      fallback: '/optimized/music90s/results/18-18/hero.png',
      objectFallback: OBJECTS_FALLBACK.magazines,
    },
    secondary: [],
    tapes: BASE_TAPES,
    foil: { src: '/optimized/music90s/result/m90-foil.webp', fallback: '/optimized/music90s/result/m90-foil.png', variant: 'rare' },
    stickers: BASE_STICKERS, // richer stickering for rare
    hookStrip: HOOK_STRIP,
    label: { text: 'редкая', mod: 'm90-sticker-title--lime m90-sticker-title--rare' },
    hook: 'Я с тобой про попсу даже спорить не буду.',
    layout: { heroClass: 'm90-result-hero--era18', rare: true },
  },
}

export function getMusic90AssetSet(resultId: string): Music90AssetSet {
  const set = (MUSIC90_RESULT_ASSETS as Record<string, Music90AssetSet>)[resultId]
  if (set) return set
  // Graceful fallback for unknown -> cassette reference (should never hit, but keeps screen from breaking)
  return MUSIC90_RESULT_ASSETS['m90_cassette']
}

export const MUSIC90_RESULT_IDS = Object.keys(MUSIC90_RESULT_ASSETS) as Music90ResultId[]

export const MUSIC90_RANGE_MAPPING: Record<Music90ResultId, string> = {
  m90_rookie: '0-4',
  m90_familiar: '5-7',
  m90_cassette: '8-10',
  m90_disco: '11-13',
  m90_legend: '14-16',
  m90_era17: '17-18',
  m90_era18: '18-18',
}
