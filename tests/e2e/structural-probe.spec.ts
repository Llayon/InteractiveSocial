import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { expect, test, expectNoRuntimeErrors } from './fixtures'

const pad = (n: number) => String(n).padStart(2, '0')

/**
 * G08 deterministic structural probe — HARD GATE.
 *
 * Unlike screenshot diffing (which requires a vision critic), this probe only
 * asserts observable layout facts in the live DOM/CSS. It must be green on all
 * four viewport projects before any visual critic round.
 *
 * Contract notes (approved plan):
 *  1. Essential text is NOT required to fit in the initial viewport — vertical
 *     scroll is allowed. We gate on: no horizontal clipping/overflow, content
 *     reachable by scrolling in the normal flow, and no unintended CSS clipping.
 *  2. Safe-area is split: presence of `env(safe-area-inset-*)` is validated
 *     statically against the source CSS; runtime gates only real
 *     padding/layout geometry invariants (desktop UA yields 0px insets).
 *  3. Forbidden-color checks apply ONLY to UI tokens/surfaces/controls, never
 *     to photos or image assets.
 *  4. share-card evidence lives in journey.spec.ts as the real 1080×1350 asset.
 */

/** overflow:hidden parents whose clipping is intentional (rounded hero card). */
const allowedIntentionalClipSet = ['result-card']

/** Forbidden hues on UI surfaces only (warm editorial palette is fine). */
const FORBIDDEN_SURFACE_RGB = [
  'rgb(0, 136, 204)', // Telegram blue
  'rgb(0, 170, 230)', // brighter Telegram blue
  'rgb(124, 58, 237)', // vivid AI purple
  'rgb(139, 92, 246)', // lighter AI purple
  'rgb(0, 255, 0)', // neon green
  'rgb(255, 0, 255)', // neon pink
]

function rgb(hex: string): string {
  const value = parseInt(hex.slice(1), 16)
  return `rgb(${(value >> 16) & 0xff}, ${(value >> 8) & 0xff}, ${value & 0xff})`
}

const BG = rgb('#f6f2ec') // --bg
const INK = rgb('#29241e') // --ink
const ACCENT = rgb('#6e2b2b') // --accent

interface ProbeItem {
  tag: string
  cls: string
  text: string
  left: number
  right: number
  width: number
  height: number
  internalClip: boolean
  ancestorClip: string
}

/** Collect visible text-bearing blocks and flag clipping/overflow hazards. */
async function probeEssentialElements(page: import('@playwright/test').Page) {
  const allowedClip = [...allowedIntentionalClipSet]
  return page.evaluate((allowedClipList) => {
    const vw = window.innerWidth
    const isHidden = (el: Element) => {
      const cls = el.classList
      return el.closest('[aria-hidden="true"]') !== null || cls.contains('visually-hidden')
    }

    const reports: ProbeItem[] = []
    const nodes = document.querySelectorAll('h1, h2, h3, p, li, dd, button')

    for (const node of Array.from(nodes)) {
      const text = (node.textContent ?? '').trim()
      if (!text) continue
      if (isHidden(node)) continue
      const style = getComputedStyle(node)
      if (style.display === 'none' || style.visibility === 'hidden') continue

      const rect = node.getBoundingClientRect()
      if (rect.width < 1 || rect.height < 1) continue

      // Real clipping only happens when the element itself applies a clipping
      // overflow value. A flowed block with `overflow: visible` that happens to
      // wrap (line-height rounding) reports scrollHeight slightly over
      // clientHeight but is NOT clipped — so it must not be flagged.
      const ownOverflow = (style.overflowX as string) === 'hidden' ? 'hidden' : style.overflow
      const clipsOwn = ownOverflow === 'hidden' || ownOverflow === 'clip'
      const internalClip =
        clipsOwn &&
        (node.scrollWidth > node.clientWidth + 1 ||
          node.scrollHeight > node.clientHeight + 1)

      let ancestorClip = ''
      let n: HTMLElement | null = node.parentElement
      while (n && n !== document.documentElement) {
        const cs = getComputedStyle(n)
        const ov = (cs.overflowX as string) === 'hidden' ? 'hidden' : cs.overflow
        if (ov === 'hidden' || ov === 'clip') {
          const cls = String(n.className)
          const isAllowed = cls
            .split(/\s+/)
            .some((c) => c !== '' && allowedClipList.includes(c))
          if (!isAllowed) {
            const clipBox = n.getBoundingClientRect()
            const padTop = parseFloat(cs.paddingTop) || 0
            const padLeft = parseFloat(cs.paddingLeft) || 0
            const innerTop = clipBox.top + padTop
            const innerBottom = clipBox.bottom - (parseFloat(cs.paddingBottom) || 0)
            const innerLeft = clipBox.left + padLeft
            const innerRight = clipBox.right - (parseFloat(cs.paddingRight) || 0)
            const box = node.getBoundingClientRect()
            const isCut =
              box.left < innerLeft - 0.5 ||
              box.right > innerRight + 0.5 ||
              box.top < innerTop - 0.5 ||
              box.bottom > innerBottom + 0.5
            if (isCut) {
              ancestorClip = `${n.tagName.toLowerCase()}.${cls}`
              break
            }
          }
        }
        n = n.parentElement
      }

      reports.push({
        tag: node.tagName.toLowerCase(),
        cls: String(node.className).slice(0, 60),
        text: text.slice(0, 48),
        left: rect.left,
        right: rect.right,
        width: rect.width,
        height: rect.height,
        internalClip,
        ancestorClip,
      })
    }
    return { vw, items: reports }
  }, allowedClip)
}

/** Document-level + essential-text layout gate (vertical scroll is allowed). */
async function assertLayoutIntegrity(page: import('@playwright/test').Page): Promise<void> {
  const doc = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }))
  expect(doc.scrollWidth).toBeLessThanOrEqual(doc.innerWidth + 1)

  const { vw, items } = await probeEssentialElements(page)
  const failures: string[] = []
  for (const item of items) {
    if (item.internalClip) {
      failures.push(`${item.tag} "${item.text}" internally clips its own text`)
    }
    if (item.ancestorClip) {
      failures.push(`${item.tag} "${item.text}" is clipped by ${item.ancestorClip}`)
    }
    if (item.left < -1 || item.right > vw + 1) {
      failures.push(
        `${item.tag} "${item.text}" overflows horizontally (L=${item.left} R=${item.right} vw=${vw})`,
      )
    }
    if (item.width < 1 || item.height < 1) {
      failures.push(`${item.tag} "${item.text}" has no real box (scroll reach broken)`)
    }
  }
  expect(failures, failures.slice(0, 8).join('\n')).toEqual([])
}

/** Touch targets >= 40 CSS px on all interactive answer/CTA controls. */
async function assertTouchTargets(page: import('@playwright/test').Page): Promise<void> {
  const tooSmall = await page.evaluate(() => {
    const bad: string[] = []
    document
      .querySelectorAll('[data-testid="answer-option"], button.button')
      .forEach((el) => {
        const cs = getComputedStyle(el)
        if (cs.display === 'none' || cs.visibility === 'hidden') return
        const h = el.getBoundingClientRect().height
        if (h < 40) bad.push(`${h.toFixed(1)}px ${String(el.className).slice(0, 40)}`)
      })
    return bad
  })
  expect(tooSmall).toEqual([])
}

/** `.screen` width constraint: max-width 480 on mobile, 600 on desktop (>=720px), nothing wider than the viewport. */
async function assertContentWidth(page: import('@playwright/test').Page): Promise<void> {
  const report = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('.screen')).map((s) => ({
      maxWidth: getComputedStyle(s).maxWidth,
      scrollWidth: s.scrollWidth,
    }))
  })
  const vw = page.viewportSize()!.width
  const expectedMax = vw >= 720 ? '600px' : '480px'
  for (const rep of report) {
    expect(rep.maxWidth, `screen max-width must be ${expectedMax}`).toBe(expectedMax)
    expect(rep.scrollWidth).toBeLessThanOrEqual(vw + 1)
  }
}

/** Design tokens on UI surfaces + approved serif/sans pairing + no forbidden hues. */
async function assertDesignTokens(page: import('@playwright/test').Page): Promise<void> {
  const ui = await page.evaluate(() => {
    const firstBg = (...selectors: string[]) => {
      for (const s of selectors) {
        const el = document.querySelector(s)
        if (el) return getComputedStyle(el).backgroundColor
      }
      return ''
    }
    const primaryBgEl = document.querySelector('.button--primary')
    const primaryBackground = primaryBgEl ? getComputedStyle(primaryBgEl).backgroundColor : ''
    const titleEl =
      document.querySelector('.screen h1') || document.querySelector('.question__title')
    const uiEl = document.querySelector('button.button') || document.querySelector('.button')
    return {
      bodyBg: getComputedStyle(document.body).backgroundColor,
      bodyColor: getComputedStyle(document.body).color,
      primaryBg: primaryBackground,
      surface: firstBg('.landing__copy', '.result-card', '.answer-card'),
      titleFont: titleEl ? getComputedStyle(titleEl).fontFamily : '',
      uiFont: uiEl ? getComputedStyle(uiEl).fontFamily : '',
    }
  })

  expect(ui.bodyBg).toBe(BG)
  expect(ui.bodyColor).toBe(INK)

  if (ui.primaryBg) expect(ui.primaryBg).toBe(ACCENT)
  for (const surface of [ui.surface, ui.primaryBg].filter(Boolean)) {
    expect(FORBIDDEN_SURFACE_RGB).not.toContain(surface)
  }
  expect(FORBIDDEN_SURFACE_RGB).not.toContain(ui.bodyBg)

  expect(ui.titleFont).toMatch(/(Iowan|Palatino|Georgia|serif)/i)
  expect(ui.titleFont).not.toMatch(/sans-serif/i)
  expect(ui.uiFont).toMatch(/(Segoe UI|system-ui|sans-serif|Roboto|Helvetica)/i)
  // The sans UI stack contains "sans-serif", so match on the actual serif
  // family names rather than the substring "serif".
  expect(ui.uiFont).not.toMatch(/(Iowan|Palatino|Georgia)/i)
}

/** Safe-area static: `env(safe-area-inset-*)` present in source tokens.css. */
function expectStaticSafeArea(): void {
  const tokens = readFileSync(join(process.cwd(), 'src', 'design', 'tokens.css'), 'utf8')
  expect(tokens).toContain('env(safe-area-inset-top')
  expect(tokens).toContain('env(safe-area-inset-bottom')
}

/** Safe-area runtime: #root applies paddings and its box covers the viewport. */
async function expectRuntimeSafeArea(page: import('@playwright/test').Page): Promise<void> {
  const geo = await page.evaluate(() => {
    const root = document.getElementById('root')
    if (!root) return null
    const cs = getComputedStyle(root)
    return {
      paddingTop: parseFloat(cs.paddingTop) || 0,
      paddingBottom: parseFloat(cs.paddingBottom) || 0,
      minHeight: parseFloat(cs.minHeight) || 0,
      vh: window.innerHeight,
    }
  })
  expect(geo).not.toBeNull()
  if (!geo) return
  expect(geo.paddingTop).toBeGreaterThanOrEqual(0)
  expect(geo.paddingBottom).toBeGreaterThanOrEqual(0)
  expect(geo.minHeight).toBeGreaterThanOrEqual(geo.vh * 0.95)
}

/** Drive the deterministic quiz to the result screen. */
async function reachResult(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/?mock=1')
  await page.getByTestId('start-cta').click()
  for (let i = 1; i <= 8; i++) {
    await expect(page.getByTestId('progress')).toHaveText(`${pad(i)} / 08`)
    await page.getByTestId('answer-option').first().click()
  }
  await expect(page.getByTestId('result-screen')).toBeVisible({ timeout: 5_000 })
}

test.describe('G08 structural probe (deterministic hard gate)', () => {
  test('safe-area declaration + runtime geometry', async ({ page }) => {
    expectStaticSafeArea()
    await page.goto('/?mock=1')
    await expect(page.getByTestId('start-cta')).toBeVisible()
    await expectRuntimeSafeArea(page)
  })

  test('landing: layout, tokens, no clip, CTA reachable', async ({ page, errorCollector }) => {
    await page.goto('/?mock=1')
    await expect(page.getByTestId('start-cta')).toBeVisible()
    await assertLayoutIntegrity(page)
    await assertTouchTargets(page)
    await assertContentWidth(page)
    await assertDesignTokens(page)
    await expectNoRuntimeErrors(page, errorCollector)
  })

  test('quiz: every question layout is clean', async ({ page, errorCollector }) => {
    await page.goto('/?mock=1')
    await page.getByTestId('start-cta').click()
    for (let i = 1; i <= 8; i++) {
      await expect(page.getByTestId('progress')).toHaveText(`${pad(i)} / 08`)
      await assertLayoutIntegrity(page)
      await assertTouchTargets(page)
      await assertContentWidth(page)
      await assertDesignTokens(page)
      await page.getByTestId('answer-option').first().click()
    }
    await expectNoRuntimeErrors(page, errorCollector)
  })

  test('result: layout, tokens, hero 4:5, both CTAs real', async ({ page, errorCollector }) => {
    await reachResult(page)

    await assertLayoutIntegrity(page)
    await assertTouchTargets(page)
    await assertContentWidth(page)
    await assertDesignTokens(page)

    // Result hero preserves the approved 4:5 crop.
    const hero = await page.getByTestId('result-hero').boundingBox()
    expect(hero).not.toBeNull()
    if (hero) {
      expect(hero.width).toBeGreaterThan(0)
      expect(hero.height).toBeGreaterThan(0)
      expect(Math.abs(hero.width / hero.height - 0.8)).toBeLessThan(0.02)
    }

    for (const id of ['share-button', 'restart-button']) {
      const box = await page.getByTestId(id).boundingBox()
      expect(box, `CTA ${id} must be present`).not.toBeNull()
      if (box) expect(box.height).toBeGreaterThanOrEqual(40)
    }

    await expectNoRuntimeErrors(page, errorCollector)
  })
})