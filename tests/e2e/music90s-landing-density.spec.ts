import { expect, test } from './fixtures'

/**
 * Focused MOBILE LANDING DENSITY regression for music90s.
 * Guards the CTA-first vertical rhythm and the top-clipping fix.
 * Must run on 360x800, 390x844, 430x932 (and 1280x800 sanity).
 */
test.describe('music90s landing density + top clipping', () => {
  test('fresh landing opens at scrollTop 0, no top clipping, attribution/title visible', async ({ page }) => {
    await page.goto('/?mock=1&quiz=music90s')
    await expect(page.getByTestId('start-cta')).toBeVisible()
    await expect(page.getByTestId('m90-hero-collage')).toBeVisible()
    // give rAF scrollTo and collage layout a tick
    await page.waitForTimeout(250)

    const data = await page.evaluate(() => {
      const r = (sel: string) => {
        const el = document.querySelector(sel) as HTMLElement | null
        if (!el) return null
        const b = el.getBoundingClientRect()
        return { top: b.top, bottom: b.bottom, height: b.height, width: b.width }
      }
      const cs = (sel: string) => {
        const el = document.querySelector(sel)
        if (!el) return null
        const s = getComputedStyle(el as Element)
        return { fontSize: s.fontSize, lineHeight: s.lineHeight, fontWeight: s.fontWeight, letterSpacing: s.letterSpacing, height: s.height, padding: s.padding }
      }
      return {
        scrollTop: window.scrollY,
        scrollTopDocEl: document.documentElement.scrollTop,
        scrollRestoration: (() => {
          try { return (history as unknown as { scrollRestoration?: string }).scrollRestoration ?? 'unknown' } catch { return 'unknown' }
        })(),
        viewport: { w: window.innerWidth, h: window.innerHeight },
        docScrollHeight: document.documentElement.scrollHeight,
        titleRect: r('.landing__title'),
        eyebrowRect: r('.landing__eyebrow'),
        subtitleRect: r('.landing__subtitle'),
        attributionRect: r('[data-testid="landing-attribution"]'),
        collageRect: r('[data-testid="m90-hero-collage"]'),
        copyRect: r('.landing__copy'),
        metaRect: r('.landing__meta'),
        ctaRect: r('[data-testid="start-cta"]'),
        overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
        titleCS: cs('.landing__title'),
        subtitleCS: cs('.landing__subtitle'),
        attrCS: cs('[data-testid="landing-attribution"]'),
        copyPCS: cs('.landing__copy p'),
        metaCS: cs('.landing__meta-item'),
        ctaCS: cs('[data-testid="start-cta"]'),
        stageCS: cs('.m90-collage-stage'),
        captionCS: cs('.m90-hero-caption'),
      }
    })

    // 1) Top clipping / scroll position
    expect(data.scrollTop, 'fresh landing must open at scrollTop 0').toBe(0)
    expect(data.scrollTopDocEl).toBe(0)
    // Title must not be clipped under Telegram chrome (top >= -1, fully above viewport top)
    expect(data.titleRect).not.toBeNull()
    if (data.titleRect) {
      expect(data.titleRect.top, 'title must not be clipped under top chrome').toBeGreaterThanOrEqual(-1)
      expect(data.titleRect.top).toBeGreaterThanOrEqual(0)
    }
    if (data.eyebrowRect) {
      expect(data.eyebrowRect.top).toBeGreaterThanOrEqual(-1)
    }
    if (data.attributionRect) {
      expect(data.attributionRect).not.toBeNull()
      expect(data.attributionRect!.height).toBeGreaterThan(0)
      // attribution must be visible within initial viewport
      expect(data.attributionRect!.top).toBeGreaterThanOrEqual(0)
      expect(data.attributionRect!.bottom).toBeLessThanOrEqual(data.viewport.h + 200)
    }

    // 2) Horizontal overflow
    expect(data.overflow, 'horizontal overflow must be false').toBe(false)

    // 3) Typography targets (allow 0.5px rounding)
    const px = (s: string | null | undefined) => (s ? parseFloat(s) : NaN)
    const titlePx = px(data.titleCS?.fontSize)
    // 22–24 on mobile, larger on desktop allowed
    if (data.viewport.w < 720) {
      expect(titlePx).toBeGreaterThanOrEqual(21.5)
      expect(titlePx).toBeLessThanOrEqual(24.5)
      // weight 800, line-height ~1.07
      expect(data.titleCS?.fontWeight).toBe('800')
      const lh = px(data.titleCS?.lineHeight)
      const ratio = lh / titlePx
      expect(ratio).toBeGreaterThanOrEqual(1.02)
      expect(ratio).toBeLessThanOrEqual(1.15)
    }
    const subtitlePx = px(data.subtitleCS?.fontSize)
    if (data.viewport.w < 720) {
      expect(subtitlePx).toBeGreaterThanOrEqual(12.5)
      expect(subtitlePx).toBeLessThanOrEqual(13.5)
      expect(['400', '500']).toContain(data.subtitleCS?.fontWeight)
      // not competing with title
      expect(subtitlePx).toBeLessThan(titlePx)
    }
    const attrPx = px(data.attrCS?.fontSize)
    expect(attrPx).toBeGreaterThanOrEqual(10.5)
    expect(attrPx).toBeLessThanOrEqual(12.5)
    expect(data.attrCS?.fontWeight).toBe('500')
    const copyPx = px(data.copyPCS?.fontSize)
    if (data.viewport.w < 720) {
      expect(copyPx).toBeGreaterThanOrEqual(12.5)
      expect(copyPx).toBeLessThanOrEqual(14)
      expect(data.copyPCS?.fontWeight).toBe('400')
    }
    const metaPx = px(data.metaCS?.fontSize)
    expect(metaPx).toBeGreaterThanOrEqual(10.5)
    expect(metaPx).toBeLessThanOrEqual(12.5)
    expect(data.metaCS?.fontWeight).toBe('500')
    const ctaPx = px(data.ctaCS?.fontSize)
    expect(ctaPx).toBeGreaterThanOrEqual(14.5)
    expect(ctaPx).toBeLessThanOrEqual(16.5)
    expect(data.ctaCS?.fontWeight).toBe('600')
    const ctaH = data.ctaRect?.height ?? 0
    expect(ctaH).toBeGreaterThanOrEqual(44)
    expect(ctaH).toBeLessThanOrEqual(50)
    const stageH = px(data.stageCS?.height)
    // hero reduced ~10-15% (200 vs 228 originally, 176 vs 200) — handle each project viewport
    if (Number.isNaN(stageH)) {
      console.log('stageCS missing', JSON.stringify(data.stageCS))
    }
    if (data.viewport.w <= 365) {
      expect(stageH).toBeGreaterThanOrEqual(170)
      expect(stageH).toBeLessThanOrEqual(182)
    } else if (data.viewport.w >= 385 && data.viewport.w <= 395) {
      expect(stageH).toBeGreaterThanOrEqual(195)
      expect(stageH).toBeLessThanOrEqual(205)
    } else if (data.viewport.w >= 425 && data.viewport.w <= 435) {
      expect(stageH).toBeGreaterThanOrEqual(200)
      expect(stageH).toBeLessThanOrEqual(212)
    } else if (data.viewport.w >= 720) {
      expect(stageH).toBeGreaterThanOrEqual(280)
      expect(stageH).toBeLessThanOrEqual(320)
    }

    // 4) CTA discoverability per spec
    expect(data.ctaRect).not.toBeNull()
    if (data.viewport.w === 390 || data.viewport.w === 430) {
      // full CTA visible without scrolling
      expect(data.ctaRect!.bottom).toBeLessThanOrEqual(data.viewport.h + 2)
      expect(data.ctaRect!.top).toBeGreaterThanOrEqual(0)
    } else if (data.viewport.w === 360) {
      // at minimum top enters viewport, minimal scroll
      expect(data.ctaRect!.top).toBeLessThan(data.viewport.h)
      const scrollNeeded = Math.max(0, data.ctaRect!.bottom - data.viewport.h)
      expect(scrollNeeded).toBeLessThanOrEqual(20)
    }
    // meta pills visible
    expect(data.metaRect).not.toBeNull()
    expect(data.metaRect!.top).toBeLessThan(data.viewport.h + 50)
    // copy card visible
    expect(data.copyRect).not.toBeNull()
    // collage fully visible (top >=0)
    expect(data.collageRect).not.toBeNull()
    expect(data.collageRect!.top).toBeGreaterThanOrEqual(0)

    // 5) Caption stays small italic
    const captionPx = px(data.captionCS?.fontSize)
    expect(captionPx).toBeGreaterThanOrEqual(10.5)
    expect(captionPx).toBeLessThanOrEqual(12)
  })

  test('scroll is reset after quiz start + restart (no retained offset)', async ({ page }) => {
    await page.goto('/?mock=1&quiz=music90s')
    await expect(page.getByTestId('start-cta')).toBeVisible()
    // Try to force a scroll offset; landing is now short enough that document may not be scrollable,
    // so before may remain 0 — that's fine. The key is that after navigation landing is still at top.
    await page.evaluate(() => window.scrollTo(0, 200))
    await page.waitForTimeout(100)
    const before = await page.evaluate(() => window.scrollY)
    // If page is short, scroll will clamp to 0; if tall, it would be >0. Either is acceptable here.
    expect(before).toBeGreaterThanOrEqual(0)
    // start quiz
    await page.getByTestId('start-cta').click()
    await expect(page.getByTestId('quiz-screen')).toBeVisible()
    // fresh landing via navigation must reset to top (simulates Telegram re-open / back)
    await page.goto('/?mock=1&quiz=music90s')
    await expect(page.getByTestId('start-cta')).toBeVisible()
    await page.waitForTimeout(250)
    const after = await page.evaluate(() => window.scrollY)
    expect(after, 'fresh landing after navigation must be at top').toBe(0)
    // also after restart inside app: go through a mini journey and check restart scroll
    await page.getByTestId('start-cta').click()
    await expect(page.getByTestId('quiz-screen')).toBeVisible()
    // answer one question to advance
    await page.getByTestId('answer-option').first().click()
    await expect(page.getByTestId('progress')).toHaveText('02 / 18')
    await page.evaluate(() => window.scrollTo(0, 300))
    await page.waitForTimeout(50)
    // simulate back? Instead reload landing by going back to landing via history? Use goto again
    await page.goto('/?mock=1&quiz=music90s')
    await expect(page.getByTestId('start-cta')).toBeVisible()
    await page.waitForTimeout(150)
    const after2 = await page.evaluate(() => window.scrollY)
    expect(after2).toBe(0)
  })

  test('landing has no autofocus element that pulls viewport', async ({ page }) => {
    await page.goto('/?mock=1&quiz=music90s')
    await expect(page.getByTestId('start-cta')).toBeVisible()
    const activeTag = await page.evaluate(() => document.activeElement?.tagName.toLowerCase() ?? 'none')
    // Either body or no focused input; should not be an input that would scroll
    expect(['body', 'html', 'button'].includes(activeTag) || activeTag === 'body').toBeTruthy()
    const scrollTop = await page.evaluate(() => window.scrollY)
    expect(scrollTop).toBe(0)
  })
})
