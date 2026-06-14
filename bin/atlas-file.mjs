#!/usr/bin/env node
// atlas-file.mjs — stamp ONE standalone, graph-only HTML around the prebuilt
// <atlas-graph> renderer. No deck, no markdown, no ?src split: one file = one
// graph, opens straight from file:// with no server.
//
//   npm run build:embed            # once -> dist/atlas.js (the whole renderer)
//   node bin/atlas-file.mjs atlases/networking.d2            -> atlases/networking.html
//   node bin/atlas-file.mjs atlases/networking.atlas.js -o out.html
//   node bin/atlas-file.mjs g.d2 --link                       # <script src=atlas.js> instead of inlining
//
// Input:
//   *.d2            raw d2 text + `#` annotations (AtlasPanel parses them); no tours.
//   *.js / *.mjs    ES module exporting { d2, tours?, docs? } (default or named).
// Output: self-contained .html carrying { d2, tours, docs } as the
//   <script type="application/atlas+json"> child embed.tsx reads.

import { readFileSync, writeFileSync, copyFileSync } from 'node:fs'
import { basename, dirname, extname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const BUNDLE = resolve(HERE, '../dist/atlas.js')

function parseArgs(argv) {
  const a = { link: false, out: null, title: null, input: null }
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i]
    if (t === '--link') a.link = true
    else if (t === '-o' || t === '--out') a.out = argv[++i]
    else if (t === '--title') a.title = argv[++i]
    else if (!a.input) a.input = t
    else throw new Error(`unexpected arg: ${t}`)
  }
  if (!a.input) throw new Error('usage: atlas-file.mjs <graph.d2|graph.atlas.js> [-o out.html] [--link] [--title T]')
  return a
}

// load { d2, tours, docs } from the input file
async function loadConfig(input) {
  const ext = extname(input).toLowerCase()
  if (ext === '.d2') return { d2: readFileSync(input, 'utf8') }
  if (ext === '.js' || ext === '.mjs') {
    const mod = await import(pathToFileURL(resolve(input)).href)
    const cfg = mod.default ?? mod
    if (typeof cfg.d2 !== 'string') throw new Error(`${input}: module must export { d2: string, tours?, docs? }`)
    return { d2: cfg.d2, ...(cfg.tours ? { tours: cfg.tours } : {}), ...(cfg.docs ? { docs: cfg.docs } : {}) }
  }
  throw new Error(`${input}: unsupported extension (want .d2, .js, or .mjs)`)
}

// JSON safe to drop inside <script>...</script>: escape '<' (kills </script> and
// <!--) and the two JS line terminators that are legal in JSON but not in source.
const LS = String.fromCharCode(0x2028), PS = String.fromCharCode(0x2029)
const safeJson = (o) =>
  JSON.stringify(o)
    .replace(/</g, '\\u003c')
    .split(LS).join('\\u2028')
    .split(PS).join('\\u2029')

function html({ title, scriptTag, configJson }) {
  return `<!doctype html>
<meta charset="utf8">
<title>${title}</title>
<style>html,body{margin:0;height:100%} atlas-graph{display:block;height:100vh}</style>
${scriptTag}
<atlas-graph>
<script type="application/atlas+json">${configJson}</script>
</atlas-graph>
`
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const cfg = await loadConfig(args.input)
  const base = basename(args.input).replace(/\.(d2|atlas\.js|js|mjs)$/i, '')
  const out = args.out || join(dirname(resolve(args.input)), `${base}.html`)
  const title = args.title || base

  let scriptTag
  if (args.link) {
    copyFileSync(BUNDLE, join(dirname(out), 'atlas.js'))   // drop the bundle next to the html
    scriptTag = '<script src="atlas.js"></script>'
  } else {
    scriptTag = `<script>${readFileSync(BUNDLE, 'utf8')}</script>`   // inline -> true standalone
  }

  writeFileSync(out, html({ title, scriptTag, configJson: safeJson(cfg) }))
  const kb = (Buffer.byteLength(readFileSync(out)) / 1024).toFixed(0)
  console.error(`${out}  (${kb} KB${args.link ? ', --link' : ', standalone'})`)
}

main().catch((e) => { console.error(e.message); process.exit(1) })
