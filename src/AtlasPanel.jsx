// AtlasPanel — the interactive renderer of the SAME model anim renders statically.
// A frame's ```atlas <name>``` d2 block becomes a live cytoscape graph: click a node
// for its CONE (faded rest, downstream edges orange, upstream green, hop superscripts),
// switch the layout/direction, hover for a tooltip, and watch the fs/sql/api panels
// fill with the refs reachable in view. Hovering a node name in the prose lights the
// node too (via core/bus.js). Whole graph is added once + relayout animates existing
// nodes, so identity is constant — nothing flickers, nodes glide.
import React, { useEffect, useRef, useState } from 'react'
import cytoscape from 'cytoscape'
import dagre from 'cytoscape-dagre'
import expandCollapse from 'cytoscape-expand-collapse'
import Graph from 'graphology'
import betweenness from 'graphology-metrics/centrality/betweenness.js'
import { buildModel } from './core/d2.js'
import { scc } from './core/tarjan.js'
import { reachableRefs } from './core/views.js'
import { atlasBus, HOVER } from './atlas-bus.js'

let dagreReg = false, elkReg = false
const ensureLayouts = () => { if (!dagreReg) { cytoscape.use(dagre); cytoscape.use(expandCollapse); dagreReg = true } }
// elkjs ships a bundled worker that breaks the rollup build when static-imported,
// so load it on demand -> its own async chunk, registered the first time ELK is picked.
const ensureElk = async () => { if (!elkReg) { const m = await import('cytoscape-elk'); cytoscape.use(m.default); elkReg = true } }

const lastSeg = id => id.includes('.') ? id.slice(id.lastIndexOf('.') + 1) : id
const parentOf = id => id.includes('.') ? id.slice(0, id.lastIndexOf('.')) : 'root'
const ELK_DIR = { TB: 'DOWN', BT: 'UP', LR: 'RIGHT', RL: 'LEFT' }

const PANEL_KEYS = ['fs', 'sql', 'api']
const PANEL_TITLE = { fs: 'fs · files', sql: 'sql · rows', api: 'api · endpoints' }
const TAG_VOCAB = new Set(['hub', 'sink', 'dead', 'ghost', 'fn', 'type', 'module', 'relation'])
const SUP = { '-': '⁻', '+': '⁺', '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹' }
const supN = n => [...((n > 0 ? '+' : '') + n)].map(c => SUP[c] || c).join('')

const CY_STYLE = [
  { selector: 'node', style: { 'label': 'data(lbl)', 'font-size': 11, 'font-family': 'ui-monospace,monospace',
    'font-weight': 600, 'text-valign': 'center', 'color': '#1e293b', 'background-color': '#a5b4fc', 'background-opacity': 1,
    'border-width': 1.6, 'border-color': '#4f46e5', 'shape': 'round-rectangle', 'width': 'label', 'height': 22, 'padding': '6px' } },
  { selector: 'node[?grp]', style: {                                                          // d2 container
    'background-opacity': 0.06, 'background-color': '#64748b', 'border-color': '#94a3b8',
    'border-style': 'dashed', 'border-width': 1, 'shape': 'round-rectangle',
    'text-valign': 'top', 'text-halign': 'center', 'font-size': 10, 'color': '#64748b', 'padding': 12 } },
  { selector: 'node[?ann]', style: { 'border-width': 2 } },                                  // has a # @ note
  { selector: 'node.leaf', style: { 'background-color': '#f1f5f9', 'border-color': '#94a3b8' } },
  { selector: 'node.hub',  style: { 'background-color': '#fde68a', 'border-color': '#f59e0b', 'width': 'label' } },
  { selector: 'node.sink', style: { 'shape': 'round-hexagon', 'background-color': '#e2e8f0' } },
  { selector: 'node.dead', style: { 'border-style': 'dashed', 'border-color': '#dc2626', 'background-color': '#fee2e2' } },
  { selector: 'node.ghost', style: { 'opacity': 0.45, 'border-style': 'dotted' } },
  { selector: 'node.diff-add', style: { 'border-color': '#16a34a', 'background-color': '#dcfce7' } },
  { selector: 'node.diff-del', style: { 'border-color': '#dc2626', 'background-color': '#fee2e2', 'border-style': 'dashed' } },
  { selector: 'node.diff-mod', style: { 'border-color': '#d97706', 'background-color': '#fef3c7' } },
  { selector: 'node.cyc', style: { 'border-color': '#dc2626', 'border-width': 2.5, 'border-style': 'double' } },
  { selector: 'node.hl-cone', style: { 'background-color': '#6366f1', 'color': '#fff', 'border-color': '#4338ca', 'border-width': 2, 'opacity': 1 } },
  { selector: 'node.hl-focal', style: { 'border-width': 4, 'border-color': '#c7d2fe', 'background-color': '#312e81', 'color': '#fff', 'opacity': 1, 'z-index': 99 } },
  { selector: 'node.heaton', style: { 'background-color': 'mapData(heat, 0, 1, #dbeafe, #b91c1c)', 'color': 'mapData(heat, 0.5, 1, #1e293b, #fff)' } },
  { selector: 'node.hot', style: { 'background-color': '#fef08a', 'border-color': '#eab308' } },     // cross-lit
  { selector: 'node.faded', style: { 'opacity': 0.5, 'background-color': '#e5e7eb', 'border-color': '#cbd5e1', 'color': '#9aa3b2' } }, // desaturate to gray scaffold, not just dim
  { selector: 'edge.faded', style: { 'opacity': 0.08, 'line-color': '#cbd5e1', 'target-arrow-color': '#cbd5e1' } }, // edges recede further
  { selector: '.iso-hide', style: { 'display': 'none' } },
  { selector: 'edge', style: { 'width': 1.4, 'line-color': '#cbd5e1', 'target-arrow-color': '#cbd5e1',
    'target-arrow-shape': 'triangle', 'curve-style': 'bezier', 'arrow-scale': 0.9 } },
  { selector: 'edge.hl-in',  style: { 'line-color': '#22c55e', 'target-arrow-color': '#22c55e', 'width': 2, 'opacity': 0.9 } },
  { selector: 'edge.hl-out', style: { 'line-color': '#fb923c', 'target-arrow-color': '#fb923c', 'width': 2, 'opacity': 0.9 } },
]

// strip the longest shared path prefix so rows indent under their common ancestor.
function trimRows(rows) {
  if (!rows.length) return { prefix: '', items: rows.map(r => ({ ...r, rel: r.locator, depth: 0 })) }
  const segs = rows.map(r => r.locator.split('/'))
  let p = 0
  while (segs[0][p] !== undefined && segs.every(s => s.length > p + 1 && s[p] === segs[0][p])) p++
  const prefix = segs[0].slice(0, p).join('/')
  const items = rows.map((r, i) => { const rest = segs[i].slice(p); return { ...r, rel: rest.join('/'), depth: Math.max(0, rest.length - 1) } })
  return { prefix, items }
}

// betweenness centrality -> per-node heat 0..1. The hub colours itself; no hand tag.
function computeHeat(model) {
  const g = new Graph()
  model.entities.forEach(e => g.mergeNode(e.id))
  model.edges.forEach(ed => { if (ed.source !== ed.target) g.mergeEdge(ed.source, ed.target) })
  const bc = betweenness(g)
  const max = Math.max(1e-9, ...Object.values(bc))
  const heat = {}
  for (const id of Object.keys(bc)) heat[id] = bc[id] / max
  return heat
}

// view state <-> URL ?av=  so an expanded/configured slice is a shareable link.
function readAtlasURL() {
  const p = new URLSearchParams(location.search).get('av')
  if (!p) return null
  const s = {}; for (const kv of p.split(',')) { const [k, v] = kv.split(':'); if (k) s[k] = v }
  return s
}
function writeAtlasURL(s) {
  const parts = Object.entries(s).filter(([, v]) => v !== undefined && v !== null && v !== '').map(([k, v]) => `${k}:${v}`)
  const u = new URL(location.href); u.searchParams.set('av', parts.join(',')); history.replaceState(null, '', u)
}

// a frame can pin its slice with one comment in the d2:
//   # view focus=net.nexthop mode=cone layout=elk dir=LR iso
// the slide opens at that exact picture; expanding to full-screen keeps it.
function parseViewSeed(text) {
  const line = text.split('\n').map(s => s.trim()).find(l => /^#\s*view\b/i.test(l))
  if (!line) return null
  const seed = {}
  for (const tok of line.replace(/^#\s*view\s*/i, '').split(/\s+/)) {
    if (!tok) continue
    const [k, v] = tok.includes('=') ? tok.split('=') : [tok, '1']
    seed[k.toLowerCase()] = v
  }
  return seed
}

function detailFor(model, id) {
  const ent = model.entities.find(e => e.id === id)
  if (!ent) return null
  const byPanel = {}
  for (const r of model.refs.get(id) || []) (byPanel[r.panel] ||= []).push(r.locator)
  return { id: ent.id, note: ent.note, tags: ent.tags, byPanel }
}

const MODES = [['cone', 'cone (both)'], ['neighbors', '1-hop'], ['downstream', 'downstream'], ['upstream', 'upstream']]
const LAYOUTS = [['dagre', 'dagre'], ['elk', 'elk'], ['breadthfirst', 'tree'], ['concentric', 'rings'], ['cose', 'force'], ['grid', 'grid']]
const DIRECTIONAL = new Set(['dagre', 'elk'])
const DIRS = [['TB', '↓ TB'], ['LR', '→ LR'], ['BT', '↑ BT'], ['RL', '← RL']]

export default function AtlasPanel({ d2, tours = {} }) {
  const cyEl = useRef(null)
  const cyRef = useRef(null)
  const anchorRef = useRef(null)   // 1px element placed at the hovered node (the only JS)
  const tipRef = useRef(null)      // native popover; CSS anchors it above the node
  const S = useRef({ model: null, cur: null, mode: 'cone', isolate: false, layoutName: 'dagre', rankDir: 'TB', noteOf: new Map() })
  const [refsByPanel, setRefsByPanel] = useState({})
  const [detail, setDetail] = useState(null)
  const [collapsed, setCollapsed] = useState({})
  const [tour, setTour] = useState({ name: null, step: -1 })
  const [litRow, setLitRow] = useState(null)
  const [full, setFull] = useState(false)   // click-into: same instance, full-screen
  const [heat, setHeat] = useState(false)   // graphology betweenness coloring
  const [ui, setUi] = useState({ mode: 'cone', isolate: false, layoutName: 'dagre', rankDir: 'TB' })
  const tourNames = Object.keys(tours || {})

  const setRefsFromView = ids => {
    const view = { entityIds: ids }, rbp = {}
    for (const k of PANEL_KEYS) rbp[k] = reachableRefs(S.current.model, view, k)
    setRefsByPanel(rbp)
  }

  function labelDist(cy, node, keep) {
    cy.nodes().forEach(x => x.data('lbl', x.data('name')))
    const dist = { [node.id()]: 0 }
    let fr = [node], d = 0, seen = new Set([node.id()])
    while (fr.length) { const nx = []; fr.forEach(n => n.outgoers('node').forEach(m => { if (!seen.has(m.id())) { seen.add(m.id()); dist[m.id()] = d + 1; nx.push(m) } })); fr = nx; d++ }
    let f2 = [node], u = 0, s2 = new Set([node.id()])
    while (f2.length) { const nx = []; f2.forEach(n => n.incomers('node').forEach(m => { if (!s2.has(m.id())) { s2.add(m.id()); if (dist[m.id()] === undefined) dist[m.id()] = -(u + 1); nx.push(m) } })); f2 = nx; u++ }
    keep.nodes().forEach(n => { const dd = dist[n.id()]; if (dd) n.data('lbl', n.data('name') + ' ' + supN(dd)) })
  }

  function focusNode(id) {
    const { cy, model } = S.current
    const node = cy.$id(id); if (!node || node.empty()) return
    const mode = S.current.mode
    const succ = node.successors(), pred = node.predecessors()
    const keep = mode === 'neighbors' ? node.closedNeighborhood()
      : mode === 'downstream' ? succ.union(node)
      : mode === 'upstream' ? pred.union(node)
      : succ.union(pred).union(node)
    cy.elements().addClass('faded').removeClass('iso-hide hl-focal hl-cone hl-in hl-out')
    keep.nodes().not('[?grp]').removeClass('faded').addClass('hl-cone')
    node.removeClass('faded hl-cone').addClass('hl-focal')
    succ.edges().intersection(keep).removeClass('faded').addClass('hl-out')
    pred.edges().intersection(keep).removeClass('faded').addClass('hl-in')
    if (S.current.isolate) cy.elements().difference(keep).addClass('iso-hide')
    labelDist(cy, node, keep)
    cy.animate({ fit: { eles: keep, padding: 60 } }, { duration: 300 })
    setRefsFromView(new Set(keep.nodes().map(n => n.id())))
    setDetail(detailFor(model, id))
    S.current.cur = id
    syncURL()
  }

  function showAll() {
    const { cy } = S.current
    cy.elements().removeClass('faded hl-focal hl-cone hl-in hl-out iso-hide')
    cy.nodes().forEach(n => n.data('lbl', n.data('name')))
    cy.animate({ fit: { eles: cy.elements(), padding: 40 } }, { duration: 300 })
    setRefsFromView(new Set(cy.nodes().map(n => n.id())))
    setDetail(null); S.current.cur = null
    syncURL()
  }

  function relayout() {
    const { cy, layoutName, rankDir } = S.current
    const base = { animate: true, animationDuration: 420, fit: true, padding: 40 }
    const opts = layoutName === 'dagre'
      ? { name: 'dagre', rankDir, nodeSep: 18, rankSep: 50, ...base }
      : layoutName === 'elk'
        ? { name: 'elk', nodeDimensionsIncludeLabels: true, ...base,
            elk: { algorithm: 'layered', 'elk.direction': ELK_DIR[rankDir] || 'DOWN',
              'elk.spacing.nodeNode': 24, 'elk.layered.spacing.nodeNodeBetweenLayers': 44 } }
      : layoutName === 'breadthfirst' ? { name: 'breadthfirst', directed: true, spacingFactor: 1.1, ...base }
      : layoutName === 'concentric' ? { name: 'concentric', minNodeSpacing: 24, ...base }
      : layoutName === 'cose' ? { name: 'cose', idealEdgeLength: 70, nodeRepulsion: 8000, ...base }
      : { name: 'grid', ...base }
    cy.layout(opts).run()
  }

  // build model + cytoscape once per d2 source
  useEffect(() => {
    let alive = true
    ensureLayouts()
    ;(async () => {
      const model = await buildModel(d2)
      if (!alive) return
      const { cyclic } = scc(model.entities, model.edges)
      const noteOf = new Map(model.entities.map(e => [e.id, e.note]))
      const cy = cytoscape({ container: cyEl.current, wheelSensitivity: 0.2, style: CY_STYLE })
      // d2 grouping -> cytoscape compound parents. container ids + their ancestors.
      const groups = new Set()
      for (const e of model.entities) { let c = e.container; while (c && c !== 'root') { groups.add(c); c = parentOf(c) } }
      cy.add([...groups].map(g => ({ group: 'nodes',
        data: { id: g, label: lastSeg(g), name: lastSeg(g), lbl: lastSeg(g), grp: true,
                ...(parentOf(g) !== 'root' ? { parent: parentOf(g) } : {}) } })))
      cy.add(model.entities.map(e => ({ group: 'nodes',
        data: { id: e.id, label: e.label, name: e.label, lbl: e.label, ann: !!e.note,
                ...(e.container !== 'root' ? { parent: e.container } : {}) } })))
      cy.add(model.edges.map(e => ({ group: 'edges', data: { id: e.id, source: e.source, target: e.target } })))
      const heatMap = computeHeat(model)
      cy.nodes().forEach(n => {
        if (n.data('grp')) return
        const id = n.id(), e = model.entities.find(x => x.id === id)
        n.data('heat', heatMap[id] ?? 0)
        if (cyclic.has(id)) n.addClass('cyc')
        if (n.outdegree(false) === 0) n.addClass('leaf')
        if (e?.kind?.startsWith('diff-')) n.addClass(e.kind)
        for (const t of e?.tags || []) if (TAG_VOCAB.has(t)) n.addClass(t)
      })
      S.current = { ...S.current, model, cur: null, noteOf, cy }
      cyRef.current = cy
      S.current.ec = cy.expandCollapse({                                 // fold/unfold d2 containers
        layoutBy: { name: 'dagre', rankDir: S.current.rankDir, animate: true, fit: true, padding: 40 },
        fisheye: false, animate: true, undoable: false, cueEnabled: true, expandCollapseCueSize: 12,
      })
      cy.on('tap', 'node', ev => focusNode(ev.target.id()))
      cy.on('tap', ev => { if (ev.target === cy) showAll() })
      cy.on('mouseover', 'node', ev => {
        const id = ev.target.id(); setLitRow(id)
        const rp = ev.target.renderedPosition()
        const a = anchorRef.current, t = tipRef.current
        if (!a || !t) return
        a.style.left = rp.x + 'px'; a.style.top = rp.y + 'px'   // the one JS write
        t.textContent = noteOf.get(id) || id
        if (!t.matches(':popover-open')) { try { t.showPopover() } catch {} }
      })
      cy.on('mouseout', 'node', () => { setLitRow(null); try { tipRef.current?.hidePopover() } catch {} })

      // apply the URL slice (shareable) first, else the frame's pinned view, else full graph
      const seed = readAtlasURL() || parseViewSeed(d2)
      if (seed) {
        if (seed.mode) S.current.mode = seed.mode
        if (seed.layout) S.current.layoutName = seed.layout
        if (seed.dir) S.current.rankDir = seed.dir
        if (seed.iso) S.current.isolate = seed.iso === '1' || seed.iso === 'true'
        setUi({ mode: S.current.mode, isolate: S.current.isolate, layoutName: S.current.layoutName, rankDir: S.current.rankDir })
        if (S.current.layoutName === 'elk') await ensureElk()
        relayout()
        if (seed.focus) focusNode(seed.focus)
        else setRefsFromView(new Set(model.entities.map(e => e.id)))
      } else {
        relayout()
        setRefsFromView(new Set(model.entities.map(e => e.id)))
      }
    })()
    return () => { alive = false; cyRef.current?.destroy(); cyRef.current = null }
  }, [d2])

  // narration hover -> light the matching node + its rows (core/bus.js in action)
  useEffect(() => {
    const off = atlasBus.on(HOVER, tok => {
      const cy = cyRef.current; if (!cy) return
      cy.nodes().removeClass('hot')
      if (!tok) { setLitRow(null); return }
      const t = String(tok).toLowerCase()
      const hit = cy.nodes().filter(n => n.id().toLowerCase() === t || (n.data('name') || '').toLowerCase() === t)
      hit.addClass('hot')
      setLitRow(hit.nonempty() ? hit[0].id() : null)
    })
    return off
  }, [])

  useEffect(() => { tipRef.current?.setAttribute('popover', 'manual') }, [])

  // expand/collapse: same instance, so the picture carries over byte-for-byte.
  // cytoscape just needs a resize + refit when its container changes size.
  useEffect(() => {
    const cy = cyRef.current; if (!cy) return
    const id = requestAnimationFrame(() => { cy.resize(); S.current.cur ? focusNode(S.current.cur) : cy.animate({ fit: { eles: cy.elements(), padding: 40 } }, { duration: 250 }) })
    return () => cancelAnimationFrame(id)
  }, [full])
  useEffect(() => {
    if (!full) return
    const onKey = e => { if (e.key === 'Escape') { e.stopPropagation(); setFull(false) } }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [full])

  const hot = (id, on) => { const cy = cyRef.current; if (cy) cy.$id(id).toggleClass('hot', on) }

  function stepTour(name, dir) {
    const seq = tours[name]; if (!seq || !seq.length) return
    let s = (tour.name === name ? tour.step : -1) + dir
    s = (s + seq.length) % seq.length
    setTour({ name, step: s })
    const st = seq[s]
    if (st.focus) focusNode(st.focus)
    else if (st.path) focusNode(st.path[st.path.length - 1])
  }

  const syncURL = () => writeAtlasURL({ focus: S.current.cur || '', mode: S.current.mode, layout: S.current.layoutName, dir: S.current.rankDir, iso: S.current.isolate ? '1' : '' })
  const setMode = m => { S.current.mode = m; setUi(u => ({ ...u, mode: m })); if (S.current.cur) focusNode(S.current.cur); syncURL() }
  const setIsolate = v => { S.current.isolate = v; setUi(u => ({ ...u, isolate: v })); if (S.current.cur) focusNode(S.current.cur); syncURL() }
  const setLayout = async l => { S.current.layoutName = l; setUi(u => ({ ...u, layoutName: l })); if (l === 'elk') await ensureElk(); relayout(); syncURL() }
  const setDir = d => { S.current.rankDir = d; setUi(u => ({ ...u, rankDir: d })); relayout(); syncURL() }
  const toggleHeat = () => { const cy = cyRef.current; if (!cy) return; const on = !heat; setHeat(on); cy.nodes().forEach(n => { if (!n.data('grp')) n.toggleClass('heaton', on) }) }
  const fold = () => S.current.ec?.collapseAll()
  const unfold = () => S.current.ec?.expandAll()
  const reset = () => { setTour({ name: null, step: -1 }); showAll() }
  const toggle = k => setCollapsed(c => ({ ...c, [k]: !c[k] }))

  return (
    <div className={`atlas${full ? ' atlas--full' : ''}`}>
      <div className="atlas-graph" ref={cyEl}>
        <div className="atlas-anchor" ref={anchorRef} />
        <div className="atlas-tip" ref={tipRef} />
      </div>
      <div className="atlas-side">
        <div className="atlas-bar">
          <select className="atlas-sel" value={ui.mode} onChange={e => setMode(e.target.value)} title="cone mode">
            {MODES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <select className="atlas-sel" value={ui.layoutName} onChange={e => setLayout(e.target.value)} title="layout">
            {LAYOUTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          {DIRECTIONAL.has(ui.layoutName) && (
            <select className="atlas-sel" value={ui.rankDir} onChange={e => setDir(e.target.value)} title="direction">
              {DIRS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          )}
          {DIRECTIONAL.has(ui.layoutName) && <><button className="atlas-btn" onClick={fold} title="fold containers">⊟</button><button className="atlas-btn" onClick={unfold} title="unfold">⊞</button></>}
          <label className="atlas-chk"><input type="checkbox" checked={ui.isolate} onChange={e => setIsolate(e.target.checked)} />iso</label>
          <label className="atlas-chk"><input type="checkbox" checked={heat} onChange={toggleHeat} />heat</label>
          {tourNames.map(n => (
            <button key={n} className="atlas-btn" onClick={() => stepTour(n, 1)}>
              ▶ {n}{tour.name === n ? ` ${tour.step + 1}/${tours[n].length}` : ''}
            </button>
          ))}
          <button className="atlas-btn" onClick={reset}>reset</button>
          <button className="atlas-btn atlas-full-btn" onClick={() => setFull(f => !f)} title={full ? 'collapse (Esc)' : 'open editor'}>
            {full ? '⤡ close' : '⤢ expand'}
          </button>
        </div>

        {PANEL_KEYS.map(k => {
          const rows = refsByPanel[k] || []
          const { prefix, items } = trimRows(rows)
          return (
            <div key={k} className={`atlas-panel${collapsed[k] ? ' collapsed' : ''}`}>
              <div className="atlas-phead" onClick={() => toggle(k)}>
                <span className="caret">▾</span><span>{PANEL_TITLE[k]}</span>
                {prefix && <span className="pprefix">{prefix}/</span>}
                <span className="count">{rows.length || ''}</span>
              </div>
              <ul className="atlas-rows">
                {items.map(r => (
                  <li key={r.panel + ':' + r.locator} title={`${r.id}  ${r.locator}`}
                      className={litRow === r.id ? 'hot' : ''}
                      style={{ paddingLeft: 6 + r.depth * 12 }}
                      onClick={() => focusNode(r.id)}
                      onMouseEnter={() => hot(r.id, true)} onMouseLeave={() => hot(r.id, false)}>
                    <span className="rid">{r.id}</span><span className="rloc">{r.rel}</span>
                  </li>
                ))}
              </ul>
            </div>
          )
        })}

        <div className={`atlas-panel${collapsed.detail ? ' collapsed' : ''}`}>
          <div className="atlas-phead" onClick={() => toggle('detail')}>
            <span className="caret">▾</span><span>detail · selected</span>
          </div>
          <div className="atlas-detail">
            {!detail ? <div className="muted">click a node</div> : (
              <>
                <div className="dnote"><span className="rid">{detail.id}</span>{detail.note ? ' — ' + detail.note : ''}</div>
                {detail.tags?.length > 0 && <div className="dtags">{detail.tags.map(t => <span key={t} className="dtag">{t}</span>)}</div>}
                {Object.entries(detail.byPanel).map(([p, locs]) => (
                  <div key={p}>
                    <div className="dgroup">{p}</div>
                    <ul className="atlas-rows">{locs.map(l => <li key={l}><span className="rloc">{l}</span></li>)}</ul>
                  </div>
                ))}
                {!Object.keys(detail.byPanel).length && <div className="muted">no refs</div>}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
