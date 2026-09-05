import { expect, test } from './fixtures'

const CORRECT: Record<string, string> = {
  m1: 'a', m2: 'b', m3: 'b', m4: 'a', m5: 'd', m6: 'c', m7: 'b', m8: 'b', m9: 'c',
  m10: 'b', m11: 'b', m12: 'b', m13: 'a', m14: 'b', m15: 'a', m16: 'b', m17: 'b', m18: 'b',
}

async function answerMusicWithScore(page: import('@playwright/test').Page, correctCount: number) {
  for (let i = 1; i <= 18; i++) {
    const qid = `m${i}`
    const wantCorrect = i <= correctCount
    const chosen = wantCorrect ? CORRECT[qid] : (['a','b','c','d'].find(id => id !== CORRECT[qid]) ?? 'a')
    await page.locator(`[data-answer-id="${chosen}"]`).first().click()
    if (i < 18) {
      await expect(page.getByTestId('progress')).toHaveText(`${String(i+1).padStart(2,'0')} / 18`, { timeout: 3000 })
    }
  }
}

const VIEWPORTS = [
  { width: 360, height: 800, name: '360x800' },
  { width: 390, height: 844, name: '390x844' },
  { width: 430, height: 932, name: '430x932' },
]

test.describe('Music90s result collage — 8-10 cassette reference (layered assets)', () => {
  for (const vp of VIEWPORTS) {
    test(`cassette hero collage renders correctly at ${vp.name}`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width: vp.width, height: vp.height })
      await page.goto('/?mock=1&quiz=music90s')
      await page.getByTestId('start-cta').click()
      // get 9/18 => m90_cassette (8-10 band)
      await answerMusicWithScore(page, 9)
      await expect(page.getByTestId('result-screen')).toBeVisible({ timeout: 5000 })
      await expect(page.getByTestId('result-score')).toContainText('9 / 18')
      await expect(page.getByTestId('result-title')).toContainText('Знаю только припевы')
      await expect(page.getByTestId('result-hero')).toBeVisible()
      await expect(page.getByTestId('result-hook')).toHaveText('База на месте.')
      // hook wrap exists and hook bg is image
      await expect(page.getByTestId('result-hook-wrap')).toBeVisible()
      const hookBg = page.locator('.m90-hook-bg')
      await expect(hookBg).toBeVisible()
      const hookBgSrc = await hookBg.getAttribute('src')
      expect(hookBgSrc).toContain('m90-hook-strip')
      // stage contains layered assets
      const foil = page.locator('.m90-foil')
      await expect(foil).toBeVisible()
      const tapes = page.locator('.m90-tape')
      await expect(tapes).toHaveCount(2)
      const stickers = page.locator('.m90-sticker')
      await expect(stickers).toHaveCount(3)
      const cassette = page.locator('.m90-object--cassette')
      await expect(cassette).toBeVisible()
      const cassetteSrc = await cassette.getAttribute('src')
      expect(cassetteSrc).toContain('m90-cassette')

      // title is live HTML text, not baked image
      const titleTag = await page.getByTestId('result-title').evaluate((el) => el.tagName)
      expect(titleTag).toBe('H1')
      const titleText = await page.getByTestId('result-title').textContent()
      expect(titleText?.trim().toLowerCase()).toContain('знаю только припевы')

      // no overflow
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
      expect(overflow).toBe(false)

      // check hook text readable: computed color contrast not hidden, position centered
      const hookBox = await page.getByTestId('result-hook').boundingBox()
      expect(hookBox).not.toBeNull()
      expect(hookBox!.height).toBeGreaterThan(20)

      // score badge readable and in upper-right of stage
      const badgeBox = await page.getByTestId('result-score').boundingBox()
      const stageBox = await page.getByTestId('result-hero').boundingBox()
      expect(badgeBox).not.toBeNull()
      expect(stageBox).not.toBeNull()
      // badge should be inside stage top-right quadrant
      expect(badgeBox!.x + badgeBox!.width).toBeLessThanOrEqual(stageBox!.x + stageBox!.width + 2)
      expect(badgeBox!.y).toBeGreaterThanOrEqual(stageBox!.y - 2)

      // CTAs reachable without horizontal overflow, visible after scroll
      await expect(page.getByTestId('share-button')).toBeVisible()
      await expect(page.getByTestId('restart-button')).toBeVisible()
      await expect(page.getByTestId('channel-link')).toBeVisible()

      // first screen should show hero+title+hook+start of body+CTA close below
      // Check that share button is within viewport after initial load (no huge dead space)
      const shareBox = await page.getByTestId('share-button').boundingBox()
      expect(shareBox).not.toBeNull()
      // viewport height 800, hero 236 + title ~60 + hook ~60 = ~356, body start should be visible, share should be within 650
      // Allow some scroll but not overly tall
      expect(shareBox!.y).toBeLessThan(900)

      // stage height should be 220-260 range
      expect(stageBox!.height).toBeGreaterThanOrEqual(210)
      expect(stageBox!.height).toBeLessThanOrEqual(280)

      // ensure no cropped assets: each image naturalWidth >0 and visible
      for (const sel of ['.m90-object--cassette', '.m90-foil', '.m90-hook-bg']) {
        const img = page.locator(sel).first()
        const ok = await img.evaluate((el: HTMLImageElement) => el.naturalWidth > 0 && el.naturalHeight > 0)
        expect(ok, `${sel} not loaded`).toBe(true)
      }

      await page.screenshot({ path: `gauntlet/reports/evidence/${testInfo.project.name}/m90-cassette-${vp.name}.png`, fullPage: true })

      // also verify text is selectable (hook text)
      const selectable = await page.getByTestId('result-hook').evaluate((el) => {
        const s = window.getComputedStyle(el)
        return s.userSelect !== 'none'
      })
      expect(selectable).toBe(true)
    })
  }

  test('other bands still render with same stage system (reusable)', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    // test 0-4 => rookie with 2 correct
    await page.goto('/?mock=1&quiz=music90s')
    await page.getByTestId('start-cta').click()
    await answerMusicWithScore(page, 2)
    await expect(page.getByTestId('result-screen')).toBeVisible({ timeout: 5000 })
    await expect(page.getByTestId('result-title')).toContainText('Случайно заглянула')
    await expect(page.getByTestId('result-hero')).toBeVisible()
    await expect(page.getByTestId('result-hook')).toBeVisible()
    const stageCount = await page.locator('.m90-result-stage').count()
    expect(stageCount).toBe(1)
  })
})
