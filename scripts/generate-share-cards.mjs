/**
 * Cross-platform deterministic placeholder share-card generator.
 * Produces tasteful two-tone gradient PNGs (1080x1350) per archetype using
 * only Node built-ins — works identically on Windows / Linux / CI.
 *
 * Final designer assets will replace these files in public/share-cards/
 * without any code changes (stable asset keys: result_<id>.png).
 *
 * NOTE: api/share/prepare.ts shares these cards via InlineQueryResultPhoto,
 * which requires a JPEG URL. Keep the .jpg siblings of these PNGs in sync
 * (any image tool: `magick result_x.png result_x.jpg` quality ~90).
 */
import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const WIDTH = 1080
const HEIGHT = 1350

/** Art-direction palette per result id (see addendum §22). */
const PALETTES = {
  quiet: ['#ede6dc', '#cfc2b1'],
  paris: ['#e9d9cf', '#b99a92'],
  italian: ['#7a2e2b', '#c67b52'],
  collector: ['#27436b', '#c8912f'],
  cottage: ['#dce3d2', '#b9977a'],
  scandi: ['#f2f0ea', '#d5d0c6'],
}

// ---------- minimal PNG encoder (truecolor RGB, no interlace) ----------
const CRC_TABLE = (() => {
  const table = new Int32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c
  }
  return table
})()

function crc32(buffer) {
  let crc = -1
  for (let i = 0; i < buffer.length; i++) {
    crc = CRC_TABLE[(crc ^ buffer[i]) & 0xff] ^ (crc >>> 8)
  }
  return (crc ^ -1) >>> 0
}

function chunk(type, data) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const typeBuffer = Buffer.from(type, 'ascii')
  const crcBuffer = Buffer.alloc(4)
  crcBuffer.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])))
  return Buffer.concat([length, typeBuffer, data, crcBuffer])
}

function encodePng(width, height, pixels /* Uint8Array RGB */) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 2 // color type: truecolor

  const stride = width * 3
  const raw = Buffer.alloc((stride + 1) * height)
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0 // filter: none
    for (let x = 0; x < stride; x++) {
      raw[y * (stride + 1) + 1 + x] = pixels[y * stride + x]
    }
  }

  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

// ---------- gradient rendering ----------
function hexToRgb(hex) {
  const value = parseInt(hex.slice(1), 16)
  return [(value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff]
}

function renderGradient(topHex, bottomHex) {
  const [tr, tg, tb] = hexToRgb(topHex)
  const [br, bg, bb] = hexToRgb(bottomHex)
  const pixels = new Uint8Array(WIDTH * HEIGHT * 3)
  for (let y = 0; y < HEIGHT; y++) {
    const t = y / (HEIGHT - 1)
    const eased = t * t * (3 - 2 * t) // smoothstep for a calmer blend
    const r = Math.round(tr + (br - tr) * eased)
    const g = Math.round(tg + (bg - tg) * eased)
    const b = Math.round(tb + (bb - tb) * eased)
    let offset = y * WIDTH * 3
    for (let x = 0; x < WIDTH; x++) {
      pixels[offset++] = r
      pixels[offset++] = g
      pixels[offset++] = b
    }
  }
  return pixels
}

// ---------- main ----------
const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'share-cards')
mkdirSync(outDir, { recursive: true })

for (const [resultId, [top, bottom]] of Object.entries(PALETTES)) {
  const png = encodePng(WIDTH, HEIGHT, renderGradient(top, bottom))
  const file = join(outDir, `result_${resultId}.png`)
  writeFileSync(file, png)
  console.log(`wrote ${file} (${png.length} bytes)`)
}
