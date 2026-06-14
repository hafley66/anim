#!/usr/bin/env node
// Verify the CssGraph backend via the TOOLBAR CHECKBOX (no URL routing).
// Flow: step to the atlas frame (cytoscape) -> tick the "css" checkbox -> the panel
// remounts on CssGraph -> exercise hover-preview, select, and node-drag.
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const base = process.env.URL || 'http://localhost:5176/'
const ATLAS_FRAME = Number(process.env.ATLAS_FRAME || 6)
const out = (n) => new URL(`../shots/${n}`, import.meta.url).pathname
mkdirSync(new URL('../shots/', import.meta.url), { recursive: true })

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
const errs = []
page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()) })
page.on('pageerror', (e) => errs.push(String(e)))

console.log('chromium', browser.version())
await page.goto(base, { waitUntil: 'networkidle' })
await page.waitForSelector('.title', { timeout: 10000 })
for (let i = 0; i < ATLAS_FRAME; i++) { await page.keyboard.press('ArrowRight'); await page.waitForTimeout(350) }
await page.waitForSelector('.atlas-graph canvas', { timeout: 10000 })
await page.waitForTimeout(800)

// tick the css checkbox -> remount on CssGraph
await page.locator('.atlas-chk', { hasText: 'css' }).locator('input').click()
await page.waitForSelector('.atlas-graph .cssg-node:not(.grp)', { timeout: 10000 })
await page.waitForTimeout(1200)
await page.screenshot({ path: out('css-00-seed.png') }); console.log('shot css-00-seed (css on)')

const nodeBox = async (txt) => page.evaluate((t) => {
  const n = [...document.querySelectorAll('.cssg-node:not(.grp)')].find(e => e.textContent.includes(t))
  if (!n) return null; const r = n.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, id: n.id }
}, txt)

// hover preview: move over a node, do NOT click -> dimmer cone
const ip = await nodeBox('vxlan')
await page.mouse.move(ip.x, ip.y); await page.waitForTimeout(500)
await page.screenshot({ path: out('css-01-hover-preview.png') }); console.log('shot css-01-hover-preview')

// commit select: click it -> full-strength cone
await page.mouse.click(ip.x, ip.y); await page.waitForTimeout(700)
await page.screenshot({ path: out('css-02-select.png') }); console.log('shot css-02-select')

// node drag: press a node, move it, release; edges must follow
const drag = await nodeBox('route')
await page.mouse.move(drag.x, drag.y); await page.mouse.down()
await page.mouse.move(drag.x + 150, drag.y + 90, { steps: 12 }); await page.mouse.up()
await page.waitForTimeout(400)
const moved = await page.evaluate((id) => document.getElementById(id).style.transform, drag.id)
console.log('dragged node transform:', moved)
await page.screenshot({ path: out('css-03-drag.png') }); console.log('shot css-03-drag')

console.log('focus state:', JSON.stringify(await page.evaluate(() => window.__atlas?.state?.())))
console.log('anchor supported:', await page.evaluate(() => CSS.supports('top: anchor(--x center)')))
await browser.close()
if (errs.length) { console.error(`\n${errs.length} console error(s):`); for (const e of errs.slice(0, 10)) console.error('  ' + e); process.exit(1) }
console.log('done, no console errors')
