#!/usr/bin/env node
// datalog-to-atlas.mjs — convert a datalog dependency model (the horn `%`-comment
// dialect) into an anim atlas ES module ({ d2, tours }). anim ingests d2, not
// datalog, so this is the bridge for migrating horn's datalog pages.
//
//   node bin/datalog-to-atlas.mjs model.dl --tours tours.json -o out.atlas.js
//
// Input datalog (one rule/fact per line):
//   % folder: L3-route            sets the container for subsequent heads
//   route(Dst) :- ip(Pkt), fib(Dst).   head depends on each body goal -> edges
//   % @ route/1 : note            node annotation     (ids are functor/arity)
//   % @ route/1 -> nexthop/1 : n  edge annotation
//   % diff add x/1 | % diff mod x/1
//   % src route/1 = path:line   |  % src a/1 -> b/1 = path:line
// A goal "f(A,B)" has id "f/2". The folder a head is FIRST defined in becomes its
// container; body-only goals (never a head) stay ungrouped at the root.
//
// Output d2: `folder: { name ... }` container blocks + `a.x -> b.y` edges, with
// the `%` annotations rewritten to anim's `#` form and every functor/arity id
// rewritten to its dotted d2 id. Tours (focus/path ids) are rewritten the same way.

import { readFileSync, writeFileSync } from 'node:fs'

const arity = (args) => { const s = args.trim(); if (!s) return 0; let d = 0, n = 1; for (const c of s) { if (c === '(' || c === '[') d++; else if (c === ')' || c === ']') d--; else if (c === ',' && d === 0) n++ } return n }
const goalId = (goal) => { const m = goal.trim().match(/^([A-Za-z_][\w]*)\s*\(([^]*)\)\s*$/); return m ? { id: `${m[1]}/${arity(m[2])}`, name: m[1] } : { id: goal.trim(), name: goal.trim() } }
const splitTop = (s) => { const out = []; let d = 0, cur = ''; for (const c of s) { if (c === '(' || c === '[') d++; else if (c === ')' || c === ']') d--; if (c === ',' && d === 0) { out.push(cur); cur = '' } else cur += c } if (cur.trim()) out.push(cur); return out }
const sanFolder = (f) => f.trim().replace(/[^\w]+/g, '_')

function parse(text) {
  const folderOf = new Map()   // id -> container folder (first head def)
  const nameOf = new Map()     // id -> functor name
  const edges = []             // {source, target} by id
  const seen = new Set()
  const ann = [], annE = [], diff = [], src = [], srcE = []
  let folder = ''
  for (const raw of text.split('\n')) {
    const line = raw.trim()
    if (!line) continue
    let m
    if ((m = line.match(/^%\s*folder:\s*(.+)$/i))) { folder = sanFolder(m[1]); continue }
    if ((m = line.match(/^%\s*@\s*(\S+)\s*->\s*(\S+)\s*:\s*(.+)$/))) { annE.push({ a: m[1], b: m[2], note: m[3] }); continue }
    if ((m = line.match(/^%\s*@\s*(\S+)\s*:\s*(.+)$/))) { ann.push({ id: m[1], note: m[2] }); continue }
    if ((m = line.match(/^%\s*diff\s+(add|mod|del)\s+(\S+)/i))) { diff.push({ kind: m[1].toLowerCase(), id: m[2] }); continue }
    if ((m = line.match(/^%\s*src\s+(\S+)\s*->\s*(\S+)\s*=\s*(.+)$/))) { srcE.push({ a: m[1], b: m[2], loc: m[3] }); continue }
    if ((m = line.match(/^%\s*src\s+(\S+)\s*=\s*(.+)$/))) { src.push({ id: m[1], loc: m[2] }); continue }
    if (line.startsWith('%')) continue
    // rule or fact: "head :- b1, b2." or "head."
    const body = line.replace(/\.\s*$/, '')
    const [head, rest] = body.split(':-')
    const h = goalId(head)
    if (!folderOf.has(h.id) && folder) folderOf.set(h.id, folder)
    nameOf.set(h.id, h.name); seen.add(h.id)
    if (rest) for (const g of splitTop(rest)) {
      const b = goalId(g); nameOf.set(b.id, b.name); seen.add(b.id)
      edges.push({ source: h.id, target: b.id })
    }
  }
  return { folderOf, nameOf, edges, ids: [...seen], ann, annE, diff, src, srcE }
}

// id (functor/arity) -> dotted d2 id (folder.name), disambiguating same-name ids by arity.
function dottedMap({ ids, nameOf, folderOf }) {
  const byName = new Map()
  for (const id of ids) { const n = nameOf.get(id); byName.set(n, (byName.get(n) || 0) + 1) }
  const dotted = new Map()
  for (const id of ids) {
    const n = nameOf.get(id)
    const leaf = byName.get(n) > 1 ? `${n}_${id.split('/')[1]}` : n
    const f = folderOf.get(id)
    dotted.set(id, f ? `${f}.${leaf}` : leaf)
  }
  return dotted
}

function toD2(p) {
  const dot = dottedMap(p)
  const D = (id) => dot.get(id) || id
  const byFolder = new Map(), roots = []
  for (const id of p.ids) {
    const f = p.folderOf.get(id)
    if (f) { if (!byFolder.has(f)) byFolder.set(f, []); byFolder.get(f).push(D(id).split('.')[1]) }
    else roots.push(D(id))
  }
  const lines = []
  for (const [f, names] of byFolder) lines.push(`${f}: {\n${[...new Set(names)].map(n => '  ' + n).join('\n')}\n}`)
  for (const r of [...new Set(roots)]) lines.push(r)
  lines.push('')
  const seenE = new Set()
  for (const e of p.edges) { const k = `${D(e.source)}>>${D(e.target)}`; if (e.source !== e.target && !seenE.has(k)) { seenE.add(k); lines.push(`${D(e.source)} -> ${D(e.target)}`) } }
  lines.push('')
  for (const a of p.ann) lines.push(`# @ ${D(a.id)} : ${a.note}`)
  for (const a of p.annE) lines.push(`# @ ${D(a.a)} -> ${D(a.b)} : ${a.note}`)
  for (const d of p.diff) lines.push(`# diff ${d.kind} ${D(d.id)}`)
  for (const s of p.src) lines.push(`# src ${D(s.id)} = ${s.loc}`)
  for (const s of p.srcE) lines.push(`# src ${D(s.a)} -> ${D(s.b)} = ${s.loc}`)
  return { d2: lines.join('\n'), dot }
}

// rewrite tour step ids (functor/arity -> dotted) using the dotted map.
function rewriteTours(tours, dot) {
  const D = (id) => dot.get(id) || id
  const out = {}
  for (const [name, steps] of Object.entries(tours || {})) {
    out[name] = steps.map(s => {
      const r = { ...s }
      if (Array.isArray(s.focus)) r.focus = s.focus.map(D); else if (s.focus) r.focus = D(s.focus)
      if (Array.isArray(s.path)) r.path = s.path.map(D)
      return r
    })
  }
  return out
}

function main() {
  const argv = process.argv.slice(2)
  let input = null, toursPath = null, out = null
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--tours') toursPath = argv[++i]
    else if (argv[i] === '-o') out = argv[++i]
    else input = argv[i]
  }
  if (!input || !out) { console.error('usage: datalog-to-atlas.mjs <model.dl> [--tours tours.json] -o out.atlas.js'); process.exit(1) }
  const p = parse(readFileSync(input, 'utf8'))
  const { d2, dot } = toD2(p)
  const tours = toursPath ? rewriteTours(JSON.parse(readFileSync(toursPath, 'utf8')), dot) : {}
  const mod = `// generated by bin/datalog-to-atlas.mjs — edit the source datalog, not this file.\nexport default ${JSON.stringify({ d2, tours }, null, 2)}\n`
  writeFileSync(out, mod)
  console.error(`${out}  (${p.ids.length} nodes, ${p.edges.length} edges)`)
}

main()
