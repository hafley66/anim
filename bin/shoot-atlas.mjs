#!/usr/bin/env node
// Visual proof of the interactive atlas. Loads the deck, steps to the atlas
// frame, waits for the cytoscape canvas to paint, then captures:
//   atlas-00-seed.png   the slide's pinned view (# view focus=overlay.vxlan ...)
//   atlas-01-focus.png  after clicking the hub node (cone highlight + panels)
//   atlas-02-layout.png after switching layout to elk (lazy chunk loads)
//   atlas-03-full.png   after ⤢ expand (same instance, full-screen overlay)
// Override the frame index with ATLAS_FRAME, the server with URL.
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const target = process.env.URL || 'http://localhost:5173/'
const ATLAS_FRAME = Number(process.env.ATLAS_FRAME || 6) // 0-based; frame 7 in the starter deck
const out = (n) => new URL(`../shots/${n}`, import.meta.url).pathname
mkdirSync(new URL('../shots/', import.meta.url), { recursive: true })

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
const errs = []
page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()) })
page.on('pageerror', (e) => errs.push(String(e)))

await page.goto(target, { waitUntil: 'networkidle' })
await page.waitForSelector('.title', { timeout: 10000 })

for (let i = 0; i < ATLAS_FRAME; i++) {
  await page.keyboard.press('ArrowRight')
  await page.waitForTimeout(400)
}

// the atlas mounts a <canvas> inside .atlas-graph
await page.waitForSelector('.atlas-graph canvas', { timeout: 10000 })
await page.waitForTimeout(1200) // dagre layout + initial fit
await page.screenshot({ path: out('atlas-00-seed.png') })
console.log('shot atlas-00-seed.png')

// click the hub node: project graph center, tap canvas there
const box = await page.locator('.atlas-graph').boundingBox()
await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
await page.waitForTimeout(900)
await page.screenshot({ path: out('atlas-01-focus.png') })
console.log('shot atlas-01-focus.png')

// switch layout -> elk (forces the lazy import('cytoscape-elk') chunk)
const layoutSel = page.locator('.atlas-sel').nth(1)
await layoutSel.selectOption('elk')
await page.waitForTimeout(2500) // elk worker + relayout
await page.screenshot({ path: out('atlas-02-layout.png') })
console.log('shot atlas-02-layout.png')

// ⤢ expand -> full-screen same instance
await page.locator('.atlas-full-btn').click()
await page.waitForTimeout(900)
await page.screenshot({ path: out('atlas-03-full.png') })
console.log('shot atlas-03-full.png')

await browser.close()
if (errs.length) {
  console.error(`\n${errs.length} console error(s):`)
  for (const e of errs.slice(0, 10)) console.error('  ' + e)
  process.exit(1)
}
console.log('done, no console errors')
