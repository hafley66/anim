// e2e for the atlas panel: what shoot-atlas only screenshots, asserted.
// Canvas classes aren't DOM-queryable, so the specs drive/read the panel via
// the window.__atlas hook (select / setStepTo / state / ids).
import { expect, test, type Page } from '@playwright/test'

declare global {
  interface Window {
    __atlas: {
      select: (ids: string[]) => void
      showAll: () => void
      setStepTo: (n: number) => void
      ids: () => string[]
      state: () => { focus: string[]; visible: number | null; round: number | null }
    }
  }
}

const SEED_FRAME = 6    // start-here deck: atlas frame with a # view seed
const STEPS_FRAME = 13  // sprefa deck: atlas frame with # step rounds + captions

async function gotoFrame(page: Page, frame: number, errs: string[]): Promise<void> {
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()) })
  page.on('pageerror', e => errs.push(String(e)))
  await page.goto('/', { waitUntil: 'networkidle' })
  await page.waitForSelector('.title', { timeout: 10_000 })
  await page.evaluate(f => sessionStorage.setItem('frame', String(f)), frame)
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForSelector('.atlas-graph canvas', { timeout: 15_000 })
  await page.waitForFunction(() => !!window.__atlas, undefined, { timeout: 15_000 })
  await page.waitForTimeout(1200)  // layout + initial fit
}

test('atlas mounts on the seeded frame without console errors', async ({ page }) => {
  const errs: string[] = []
  await gotoFrame(page, SEED_FRAME, errs)
  expect(errs).toEqual([])
})

test('round player: ▶/◀ change the visible set and show captions', async ({ page }) => {
  const errs: string[] = []
  await gotoFrame(page, STEPS_FRAME, errs)
  const s0 = await page.evaluate(() => window.__atlas.state())
  expect(s0.round).toBe(0)
  await page.locator('button[title="next round"]').click()
  await page.waitForTimeout(500)
  const s1 = await page.evaluate(() => window.__atlas.state())
  expect(s1.round).toBe(1)
  expect(s1.visible!).toBeGreaterThan(s0.visible!)            // reveal is cumulative
  await expect(page.locator('.atlas-step')).toContainText('round 1')
  await page.locator('button[title="prev round"]').click()
  await page.waitForTimeout(500)
  const back = await page.evaluate(() => window.__atlas.state())
  expect(back.round).toBe(0)
  expect(back.visible).toBe(s0.visible)                       // stepping back re-hides
  expect(errs).toEqual([])
})

test('cone select: detail fills, URL carries the focus', async ({ page }) => {
  const errs: string[] = []
  await gotoFrame(page, SEED_FRAME, errs)
  const id = await page.evaluate(() => { const i = window.__atlas.ids()[0]; window.__atlas.select([i]); return i })
  await page.waitForTimeout(600)
  await expect(page.locator('.atlas-detail .rid').first()).toContainText(id.split('.').pop()!)
  expect(decodeURIComponent(page.url())).toContain('focus:' + id)
  expect(errs).toEqual([])
})

test('multi-select unions cones and roundtrips through ?av=', async ({ page }) => {
  const errs: string[] = []
  await gotoFrame(page, SEED_FRAME, errs)
  const picked = await page.evaluate(() => {
    const ids = window.__atlas.ids().slice(0, 2)
    window.__atlas.select(ids)
    return ids
  })
  await page.waitForTimeout(600)
  const st = await page.evaluate(() => window.__atlas.state())
  expect(st.focus).toEqual(picked)
  expect(decodeURIComponent(page.url())).toContain(picked.join('+'))
  // reload the same URL: the multi-id focus set must come back
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForFunction(() => !!window.__atlas, undefined, { timeout: 15_000 })
  await page.waitForTimeout(1200)
  const again = await page.evaluate(() => window.__atlas.state())
  expect(again.focus).toEqual(picked)
  expect(errs).toEqual([])
})

test('layout switch to elk completes (lazy chunk)', async ({ page }) => {
  const errs: string[] = []
  await gotoFrame(page, SEED_FRAME, errs)
  await page.locator('.atlas-sel').nth(1).selectOption('elk')
  await page.waitForTimeout(2500)  // elk worker + relayout
  expect(errs).toEqual([])
})
