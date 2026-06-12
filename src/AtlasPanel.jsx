// AtlasPanel — the interactive renderer of the SAME model anim renders statically.
// A frame's ```atlas <name>``` d2 block becomes a live cytoscape graph: click a node
// for its CONE (faded rest, downstream edges orange, upstream green, hop superscripts),
// shift/cmd-click to grow a multi-node selection, switch the layout/direction, hover
// for a tooltip, and watch the fs/sql/api panels fill with the refs reachable in view.
// Hovering a node name in the prose lights the node too (via core/bus.ts).
//
// This file is an ADAPTER: every view/selection/step is computed purely in core/
// (cone, tourView, fullView, hopDistances, tierCells, heat, codec) and applied here
// through cytoscape hooks. Visibility changes go through core/transition.ts; the
// cone is a lighting decoration over the visible set, not a visibility change.
import React, { useEffect, useMemo, useRef, useState } from 'react'
import cytoscape from 'cytoscape'
import dagre from 'cytoscape-dagre'
import expandCollapse from 'cytoscape-expand-collapse'
import { buildModel, loadD2 } from './core/d2'
import { modelFromRows } from './core/rows'
import { lastSeg, parentOf } from './core/model'
import { scc, topoTiers } from './core/tarjan'
import { buildAdj, cone, detailFor, detailForEdge, fullView, hopDistances, identRefs, predecessors, reachableRefs, successors } from './core/views'
import { tourFromSequence, tourView } from './core/tour'
import { tierCells, gridCell } from './core/layout'
import { heat as computeHeat } from './core/metrics'
import { decodeAtlasState, decodeFocus, encodeAtlasState, encodeFocus } from './core/codec'
import { transitionViews } from './core/transition'
import { Tree } from 'react-arborist'
import { buildTree, toForest, nodeCount } from './core/tree'
import { panelSpec, pathOfFor, panelKeysOf } from './core/panels'
import { atlasBus, HOVER, PERISCOPE } from './atlas-bus.js'
import CodeSpotlight from './CodeSpotlight.jsx'

let dagreReg = false, elkReg = false
const ensureLayouts = () => { if (!dagreReg) { cytoscape.use(dagre); cytoscape.use(expandCollapse); dagreReg = true } }
// elkjs ships a bundled worker that breaks the rollup build when static-imported,
// so load it on demand -> its own async chunk, registered the first time ELK is picked.
const ensureElk = async () => { if (!elkReg) { const m = await import('cytoscape-elk'); cytoscape.use(m.default); elkReg = true } }
// Full d2: lazy-load the bundled @terrastruct/d2 WASM — an async chunk in the
// app build, folded into dist/atlas.js for the embed. Memoized once per session.
// On file:// the worker-shim (installed inside loadD2) runs d2's compile worker
// on the main thread, so the same path works everywhere. The probe-compile
// inside the race catches a module that loads but whose wasm can't run; a
// failure resolves null and buildModel surfaces the error in the model note.
const D2_LOAD_MS = 10000
let d2Loading = null
const ensureD2 = () =>
  (d2Loading ||= Promise.race([
    (async () => { const D2 = await loadD2(); await new D2().compile('a -> b'); return D2 })().catch(e => { console.error('d2 load failed:', e); return null }),
    new Promise(r => setTimeout(() => r(null), D2_LOAD_MS)),
  ]))

const ELK_DIR = { TB: 'DOWN', BT: 'UP', LR: 'RIGHT', RL: 'LEFT' }
const ROW_H = 24   // react-arborist row height

const TAG_VOCAB = new Set(['hub', 'sink', 'dead', 'ghost', 'fn', 'type', 'module', 'relation', 'text'])
const SUP = { '-': '⁻', '+': '⁺', '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹' }
const supN = n => [...((n > 0 ? '+' : '') + n)].map(c => SUP[c] || c).join('')

// notes are markdown-lite: `code` -> chip, **bold**, \n -> break, \n\n -> paragraph.
// (\n may be a literal backslash-n in a one-line d2 annotation, or a real newline.)
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
function noteToHTML(text) {
  if (!text) return ''
  return String(text).split(/\\n\\n|\n\n/).map(b => {
    let h = esc(b).replace(/\\n|\n/g, '<br>')
    h = h.replace(/`([^`]+)`/g, '<code class="ncode">$1</code>')
    h = h.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    return '<p class="npara">' + h + '</p>'
  }).join('')
}

// Read the --atlas-* theme tokens off :root so the canvas (cytoscape can't use
// CSS var()) and the DOM panels share one palette. Re-skin in app.css, not here.
function readTheme() {
  const cs = getComputedStyle(document.documentElement)
  const v = (n, fb) => (cs.getPropertyValue(n).trim() || fb)
  return {
    nodeFill: v('--atlas-node-fill', '#a5b4fc'), nodeText: v('--atlas-node-text', '#1e293b'), nodeBorder: v('--atlas-node-border', '#4f46e5'),
    coneFill: v('--atlas-cone-fill', '#4f46e5'), coneText: v('--atlas-cone-text', '#fff'), coneBorder: v('--atlas-cone-border', '#312e81'),
    focalFill: v('--atlas-focal-fill', '#1e1b4b'), focalText: v('--atlas-focal-text', '#fff'), focalHalo: v('--atlas-focal-halo', '#c7d2fe'),
    ctxFill: v('--atlas-ctx-fill', '#eef1f6'), ctxText: v('--atlas-ctx-text', '#64748b'), ctxBorder: v('--atlas-ctx-border', '#cbd5e1'),
    ctxOpacity: parseFloat(v('--atlas-ctx-opacity', '0.7')),
    edge: v('--atlas-edge', '#cbd5e1'), edgeOut: v('--atlas-edge-out', '#ea7c1f'), edgeIn: v('--atlas-edge-in', '#16a34a'),
    hubFill: v('--atlas-hub-fill', '#fde68a'), hubBorder: v('--atlas-hub-border', '#f59e0b'),
    hot: v('--atlas-hot', '#fde047'), hotBorder: v('--atlas-hot-border', '#ca8a04'),
  }
}

function buildCyStyle(t) {
  return [
  { selector: 'node', style: { 'label': 'data(lbl)', 'font-size': 11, 'font-family': 'ui-monospace,monospace',
    'font-weight': 600, 'text-valign': 'center', 'color': t.nodeText, 'background-color': t.nodeFill, 'background-opacity': 1,
    'border-width': 1.6, 'border-color': t.nodeBorder, 'shape': 'round-rectangle', 'width': 'label', 'height': 22, 'padding': '6px' } },
  { selector: 'node[?grp]', style: {                                                          // d2 container
    'background-opacity': 0.06, 'background-color': t.ctxText, 'border-color': t.ctxBorder,
    'border-style': 'dashed', 'border-width': 1, 'shape': 'round-rectangle',
    'text-valign': 'top', 'text-halign': 'center', 'font-size': 10, 'color': t.ctxText, 'padding': 12 } },
  { selector: 'node[?ann]', style: { 'border-width': 2 } },                                  // has a # @ note
  { selector: 'node.leaf', style: { 'background-color': '#f1f5f9', 'border-color': '#94a3b8', 'color': t.nodeText } },
  { selector: 'node.hub',  style: { 'background-color': t.hubFill, 'border-color': t.hubBorder, 'color': '#1e293b', 'width': 'label' } },
  { selector: 'node.sink', style: { 'shape': 'round-hexagon', 'background-color': '#e2e8f0', 'color': t.nodeText } },
  { selector: 'node.dead', style: { 'border-style': 'dashed', 'border-color': '#dc2626', 'background-color': '#fee2e2', 'color': '#1e293b' } },
  { selector: 'node.ghost', style: { 'opacity': 0.45, 'border-style': 'dotted' } },
  // a text-only card: tag a node `text` and its # @ note becomes the wrapped body.
  { selector: 'node.text', style: { 'shape': 'round-rectangle', 'background-color': '#fffbeb',
    'border-color': '#fcd34d', 'border-width': 1, 'color': '#334155', 'font-weight': 400,
    'font-family': 'ui-sans-serif,system-ui,sans-serif', 'font-size': 11,
    'text-wrap': 'wrap', 'text-max-width': '230px', 'text-valign': 'center', 'text-halign': 'center',
    'text-justification': 'left', 'width': 'label', 'height': 'label', 'padding': '10px' } },
  { selector: 'node.diff-add', style: { 'border-color': '#16a34a', 'background-color': '#dcfce7', 'color': '#1e293b' } },
  { selector: 'node.diff-del', style: { 'border-color': '#dc2626', 'background-color': '#fee2e2', 'border-style': 'dashed', 'color': '#1e293b' } },
  { selector: 'node.diff-mod', style: { 'border-color': '#d97706', 'background-color': '#fef3c7', 'color': '#1e293b' } },
  { selector: 'node.cyc', style: { 'border-color': '#dc2626', 'border-width': 2.5, 'border-style': 'double' } },
  { selector: 'node.hl-cone', style: { 'background-color': t.coneFill, 'color': t.coneText, 'border-color': t.coneBorder, 'border-width': 2, 'opacity': 1 } },
  { selector: 'node.hl-focal', style: { 'border-width': 4, 'border-color': t.focalHalo, 'background-color': t.focalFill, 'color': t.focalText, 'opacity': 1, 'z-index': 99 } },
  { selector: 'node.heaton', style: { 'background-color': 'mapData(heat, 0, 1, #dbeafe, #b91c1c)', 'color': 'mapData(heat, 0.5, 1, #1e293b, #fff)' } },
  { selector: 'node.hot', style: { 'background-color': t.hot, 'border-color': t.hotBorder, 'color': '#1e293b' } },     // cross-lit
  // context: desaturate to a gray scaffold but keep the label READABLE (mid-slate text)
  { selector: 'node.faded', style: { 'opacity': t.ctxOpacity, 'background-color': t.ctxFill, 'border-color': t.ctxBorder, 'color': t.ctxText } },
  { selector: 'edge.faded', style: { 'opacity': 0.12, 'line-color': t.ctxBorder, 'target-arrow-color': t.ctxBorder } },
  { selector: '.iso-hide', style: { 'display': 'none' } },
  { selector: '.step-hide', style: { 'display': 'none' } },                                  // not yet revealed by the round player
  { selector: 'node.step-new', style: { 'border-width': 4, 'border-color': '#16a34a', 'background-color': '#dcfce7', 'color': '#14532d', 'z-index': 80 } }, // derived THIS round
  { selector: 'edge', style: { 'width': 1.4, 'line-color': t.edge, 'target-arrow-color': t.edge,
    'target-arrow-shape': 'triangle', 'curve-style': 'bezier', 'arrow-scale': 0.9 } },
  // edges that carry a # @ a -> b note get a dashed line + an ⓘ badge: a "hover me" cue.
  { selector: 'edge[?hasNote]', style: { 'line-style': 'dashed', 'label': 'ⓘ', 'font-size': 12,
    'color': '#64748b', 'text-background-color': '#ffffff', 'text-background-opacity': 0.92, 'text-background-padding': 2 } },
  { selector: 'edge.hl-in',  style: { 'line-color': t.edgeIn, 'target-arrow-color': t.edgeIn, 'width': 2.4, 'opacity': 1 } },
  { selector: 'edge.hl-out', style: { 'line-color': t.edgeOut, 'target-arrow-color': t.edgeOut, 'width': 2.4, 'opacity': 1 } },
  { selector: 'edge.hl-note', style: { 'line-color': '#6366f1', 'target-arrow-color': '#6366f1',
    'line-style': 'solid', 'width': 2.6, 'color': '#4338ca', 'font-size': 15, 'z-index': 50, 'opacity': 1 } },
  ]
}

const MODES = [['cone', 'cone (both)'], ['neighbors', '1-hop'], ['downstream', 'downstream'], ['upstream', 'upstream']]
const LAYOUTS = [['dagre', 'dagre'], ['elk', 'elk'], ['breadthfirst', 'tree'], ['concentric', 'rings'], ['cose', 'force'], ['grid', 'grid']]
const DIRECTIONAL = new Set(['dagre', 'elk', 'grid'])   // grid uses dir to pick the tier axis
const DIRS = [['TB', '↓ TB'], ['LR', '→ LR'], ['BT', '↑ BT'], ['RL', '← RL']]

// toggle an id's membership in a focus set (shift/cmd-click)
const toggleId = (ids, id) => (ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id])

// Two model sources: `d2` text (compiled at runtime) or `rows` (RelRows JSON,
// embedded by the build's atlas-db fence) -> core modelFromRows, no d2 needed.
export default function AtlasPanel({ d2, rows, tours = {}, docs = {} }) {
  const cyEl = useRef(null)
  const cyRef = useRef(null)
  const anchorRef = useRef(null)   // 1px element placed at the hovered node (the only JS)
  const tipRef = useRef(null)      // native popover; CSS anchors it above the node
  const S = useRef({ model: null, adj: null, view: null, focus: [], mode: 'cone', isolate: false, layoutName: 'dagre', rankDir: 'TB', noteOf: new Map() })
  const [refsByPanel, setRefsByPanel] = useState({})
  const [detail, setDetail] = useState(null)
  const [collapsed, setCollapsed] = useState({})   // whole-panel fold (fs/sql/api/detail)
  const [tour, setTour] = useState({ name: null, step: -1 })
  const [litRow, setLitRow] = useState(null)
  const [full, setFull] = useState(false)   // click-into: same instance, full-screen
  const [stepUI, setStepUI] = useState(null) // round player: { n, cap } or null when no steps
  const [heat, setHeat] = useState(false)   // graphology betweenness coloring
  const [barMode, setBarMode] = useState('rows')  // 'off' | 'rows' (per-row slice) | 'stacked' (branch = one stacked bar of children)
  const [ui, setUi] = useState({ mode: 'cone', isolate: false, layoutName: 'dagre', rankDir: 'TB' })
  const [spot, setSpot] = useState(null)         // active span step: { span, comment } | null
  const [modelTours, setModelTours] = useState([])  // model.tours minus 'rounds' (# tour lines / rel rows)
  // legacy tours prop ({name: [{focus}|{path}]}) -> Tour at the boundary
  const namedTours = useMemo(() => Object.entries(tours || {}).map(([n, seq]) => tourFromSequence(n, seq)), [tours])
  const allTours = useMemo(() => [...modelTours, ...namedTours], [modelTours, namedTours])
  // mirrored in S.current so the once-bound window.__atlas closure stays fresh
  const showSpot = v => { S.current.spot = v; setSpot(v) }
  const stepTourRef = useRef(null)

  const setRefsFromView = ids => {
    const view = { entityIds: ids }, rbp = {}
    for (const k of panelKeysOf(S.current.model)) {            // panels derived from the refs
      rbp[k] = buildTree(reachableRefs(S.current.model, view, k), pathOfFor(k))
    }
    setRefsByPanel(rbp)
  }

  // hop superscripts for a focus set: nearest distance (by |hops|) wins.
  function labelDist(cy, focusIds, keepIds) {
    cy.nodes().forEach(x => x.data('lbl', x.data('name')))
    const merged = new Map()
    for (const f of focusIds) {
      for (const [id, d] of hopDistances(S.current.adj, f)) {
        const cur = merged.get(id)
        if (cur === undefined || Math.abs(d) < Math.abs(cur)) merged.set(id, d)
      }
    }
    for (const id of keepIds) {
      const dd = merged.get(id)
      if (dd) { const n = cy.$id(id); if (n.nonempty()) n.data('lbl', n.data('name') + ' ' + supN(dd)) }
    }
  }

  // visibility changes (round player / reset) go through the transition primitive:
  // enter/exit toggle .step-hide, kept elements are NEVER recreated.
  function applyView(next) {
    const { cy } = S.current
    cy.batch(() => {
      transitionViews(S.current.view, next, {
        enterNode: id => { const n = cy.$id(id); if (!n.data('grp')) n.removeClass('step-hide') },
        exitNode: id => { const n = cy.$id(id); if (!n.data('grp')) n.addClass('step-hide') },
        enterEdge: id => cy.$id(id).removeClass('step-hide'),
        exitEdge: id => cy.$id(id).addClass('step-hide'),
      })
    })
    S.current.view = next
  }

  // the CONE is a lighting decoration over the visible set (faded context unless
  // isolate). Computed purely (core cone()), painted here.
  function select(ids) {
    const { cy, model, adj, mode } = S.current
    if (!ids || !ids.length) return showAll()
    const v = cone(model, ids, mode, adj)
    const keepN = cy.nodes().filter(n => v.entityIds.has(n.id()))
    const keepE = cy.edges().filter(e => v.edgeIds.has(e.id()))
    cy.elements().addClass('faded').removeClass('iso-hide hl-focal hl-cone hl-in hl-out')
    keepN.not('[?grp]').removeClass('faded').addClass('hl-cone')
    for (const f of ids) cy.$id(f).removeClass('faded hl-cone').addClass('hl-focal')
    // edge direction classes: out = on a downstream path from a focal, in = upstream
    for (const f of ids) {
      const down = successors(adj, f), up = predecessors(adj, f)
      keepE.forEach(e => {
        const s = e.data('source'), t = e.data('target')
        if ((s === f || down.has(s)) && down.has(t)) e.removeClass('faded').addClass('hl-out')
        if ((t === f || up.has(t)) && up.has(s)) e.removeClass('faded').addClass('hl-in')
      })
    }
    const keep = keepN.union(keepE)
    if (S.current.isolate) cy.elements().difference(keep).addClass('iso-hide')
    labelDist(cy, ids, v.entityIds)
    cy.animate({ fit: { eles: keep, padding: 60 } }, { duration: 300 })
    setRefsFromView(v.entityIds)
    setDetail(detailFor(model, ids[ids.length - 1]))
    S.current.focus = ids
    syncURL()
  }

  function showAll() {
    const { cy } = S.current
    cy.elements().removeClass('faded hl-focal hl-cone hl-in hl-out iso-hide')
    cy.nodes().forEach(n => n.data('lbl', n.data('name')))
    cy.animate({ fit: { eles: cy.elements(), padding: 40 } }, { duration: 300 })
    setRefsFromView(S.current.view ? S.current.view.entityIds : new Set(cy.nodes().map(n => n.id())))
    setDetail(null); S.current.focus = []
    syncURL()
  }

  // round player: the 'rounds' Tour from `# step` -> a pure View per round,
  // applied as a transition; the new arrivals get the .step-new ring.
  function setStepTo(n) {
    const { cy, model, adj, roundTour } = S.current; if (!roundTour) return
    n = Math.max(0, Math.min(roundTour.steps.length - 1, n))
    const next = tourView(model, roundTour, n, adj)
    if (!next) return
    applyView(next)
    cy.nodes().removeClass('step-new')
    const fresh = roundTour.steps[n].target.reveal || []
    for (const id of fresh) cy.$id(id).addClass('step-new')
    S.current.step = n; setStepUI({ n, cap: roundTour.steps[n].comment || '' })
    cy.animate({ fit: { eles: cy.elements().not('.step-hide').not('[?grp]').length ? cy.elements().not('.step-hide') : cy.elements(), padding: 55 } }, { duration: 320 })
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
      // d2-grid feel: every node sits in an exact (tier, column) cell; dir picks the axis.
      : { name: 'grid', avoidOverlap: true, condense: false, position: gridPos, ...base }
    cy.layout(opts).run()
  }

  // map a node to its grid cell from the precomputed tier/tcol; rankDir flips the axis.
  function gridPos(n) {
    if (n.data('grp')) return undefined
    return gridCell(n.data('tier') ?? 0, n.data('tcol') ?? 0, S.current.maxTier || 0, S.current.rankDir)
  }

  // view state <-> URL ?av=  so an expanded/configured slice is a shareable link.
  const syncURL = () => {
    const payload = encodeAtlasState({
      focus: encodeFocus(S.current.focus), mode: S.current.mode,
      layout: S.current.layoutName, dir: S.current.rankDir, iso: S.current.isolate,
    })
    const u = new URL(location.href); u.searchParams.set('av', payload); history.replaceState(null, '', u)
  }
  const readAtlasURL = () => decodeAtlasState(new URLSearchParams(location.search).get('av'))

  // build model + cytoscape once per model source (d2 text or rel rows)
  useEffect(() => {
    let alive = true
    ensureLayouts()
    ;(async () => {
      const model = rows ? modelFromRows(rows) : await buildModel(d2, { D2: await ensureD2() })
      if (!alive) return
      const { cyclic, comp } = scc(model.entities, model.edges)
      // d2-grid-style tiering: Kahn longest-path layer, then a stable column index
      // within each tier. Drives the grid layout's exact cell placement.
      const tierMap = topoTiers(model.entities, model.edges, comp)
      const { tcol, maxTier } = tierCells(model.entities, tierMap)
      S.current.maxTier = maxTier
      const noteOf = new Map(model.entities.map(e => [e.id, e.note]))
      const cy = cytoscape({ container: cyEl.current, wheelSensitivity: 0.2, style: buildCyStyle(readTheme()) })
      // d2 grouping -> cytoscape compound parents. container ids + their ancestors.
      const groups = new Set()
      for (const e of model.entities) { let c = e.container; while (c && c !== 'root') { groups.add(c); c = parentOf(c) } }
      cy.add([...groups].map(g => ({ group: 'nodes',
        data: { id: g, label: lastSeg(g), name: lastSeg(g), lbl: lastSeg(g), grp: true,
                ...(parentOf(g) !== 'root' ? { parent: parentOf(g) } : {}) } })))
      cy.add(model.entities.map(e => ({ group: 'nodes',
        data: { id: e.id, label: e.label, name: e.label, lbl: e.label, ann: !!e.note,
                ...(e.container !== 'root' ? { parent: e.container } : {}) } })))
      cy.add(model.edges.map(e => ({ group: 'edges', data: {
        id: e.id, source: e.source, target: e.target,
        elabel: e.label || '', enote: e.note || '', hasNote: !!e.note } })))
      const heatMap = computeHeat(model)
      cy.nodes().forEach(n => {
        if (n.data('grp')) return
        const id = n.id(), e = model.entities.find(x => x.id === id)
        n.data('heat', heatMap[id] ?? 0)
        n.data('tier', tierMap.get(id) || 0); n.data('tcol', tcol.get(id) || 0)
        if (cyclic.has(id)) n.addClass('cyc')
        if (n.outdegree(false) === 0) n.addClass('leaf')
        if (e?.kind?.startsWith('diff-')) n.addClass(e.kind)
        for (const t of e?.tags || []) if (TAG_VOCAB.has(t)) n.addClass(t)
        // a `text` node shows its # @ note as the wrapped card body, not its short id.
        // canvas labels are plain text: strip md markers, turn \n into real breaks.
        if (e?.tags?.includes('text') && e.note) {
          const body = String(e.note).replace(/\*\*/g, '').replace(/`/g, '').replace(/\\n\\n|\\n/g, '\n')
          n.data('name', body); n.data('lbl', body); n.data('label', body)
        }
      })
      const adj = buildAdj(model)
      const roundTour = model.tours.find(t => t.id === 'rounds') || null
      setModelTours(model.tours.filter(t => t.id !== 'rounds'))
      S.current = { ...S.current, model, adj, view: fullView(model), focus: [], noteOf, cy, roundTour }
      cyRef.current = cy
      S.current.ec = cy.expandCollapse({                                 // fold/unfold d2 containers
        layoutBy: { name: 'dagre', rankDir: S.current.rankDir, animate: true, fit: true, padding: 40 },
        fisheye: false, animate: true, undoable: false, cueEnabled: true, expandCollapseCueSize: 12,
      })
      cy.on('tap', 'node', ev => {
        const id = ev.target.id()
        const oe = ev.originalEvent
        const multi = oe && (oe.shiftKey || oe.metaKey || oe.ctrlKey)
        select(multi ? toggleId(S.current.focus, id) : [id])
      })
      cy.on('tap', ev => { if (ev.target === cy) showAll() })
      cy.on('mouseover', 'node', ev => {
        const id = ev.target.id(); setLitRow(id)
        if (!ev.target.data('grp')) {                            // periscope: this node's files
          const rows = identRefs(model, id)
          atlasBus.emit(PERISCOPE, rows.length ? { ident: lastSeg(id), rows } : null)
        }
        const rp = ev.target.renderedPosition()
        const a = anchorRef.current, t = tipRef.current
        if (!a || !t) return
        a.style.left = rp.x + 'px'; a.style.top = rp.y + 'px'   // the one JS write
        t.innerHTML = noteOf.get(id) ? noteToHTML(noteOf.get(id)) : esc(id)
        if (!t.matches(':popover-open')) { try { t.showPopover() } catch {} }
      })
      cy.on('mouseout', 'node', () => { setLitRow(null); atlasBus.emit(PERISCOPE, null); try { tipRef.current?.hidePopover() } catch {} })
      // edge hover -> show WHY the edge exists (its # @ a -> b note), anchored at the cursor.
      cy.on('mouseover', 'edge', ev => {
        const note = ev.target.data('enote') || ev.target.data('elabel')
        if (!note) return
        ev.target.addClass('hl-note')
        const a = anchorRef.current, t = tipRef.current; if (!a || !t) return
        const rp = ev.renderedPosition || ev.target.renderedMidpoint?.() || { x: 0, y: 0 }
        a.style.left = rp.x + 'px'; a.style.top = rp.y + 'px'
        t.innerHTML = noteToHTML(note)
        if (!t.matches(':popover-open')) { try { t.showPopover() } catch {} }
      })
      cy.on('mouseout', 'edge', ev => { ev.target.removeClass('hl-note'); try { tipRef.current?.hidePopover() } catch {} })
      // click an edge -> read its WHY in the roomy detail panel (formatted)
      cy.on('tap', 'edge', ev => {
        const e = ev.target, src = e.data('source'), tgt = e.data('target')
        cy.edges().removeClass('hl-note'); e.addClass('hl-note')
        setDetail(detailForEdge(model, src, tgt, e.data('enote') || e.data('elabel')))
      })

      // apply the URL slice (shareable) first, else the frame's pinned view (# view),
      // else the full graph. Both decode to the same shape via core/codec + model.seed.
      const fromURL = readAtlasURL()
      const seed = fromURL
        ? { focus: decodeFocus(fromURL.focus), mode: fromURL.mode, layout: fromURL.layout, dir: fromURL.dir, iso: fromURL.iso === '1' || fromURL.iso === 'true' }
        : model.seed
          ? { focus: model.seed.focus || [], mode: model.seed.mode, layout: model.seed.layout, dir: model.seed.dir, iso: !!model.seed.iso }
          : null
      if (seed) {
        if (seed.mode) S.current.mode = seed.mode
        if (seed.layout) S.current.layoutName = seed.layout
        if (seed.dir) S.current.rankDir = seed.dir
        S.current.isolate = !!seed.iso
        setUi({ mode: S.current.mode, isolate: S.current.isolate, layoutName: S.current.layoutName, rankDir: S.current.rankDir })
        if (S.current.layoutName === 'elk') await ensureElk()
        relayout()
        if (seed.focus && seed.focus.length) select(seed.focus)
        else setRefsFromView(new Set(model.entities.map(e => e.id)))
      } else {
        relayout()
        setRefsFromView(new Set(model.entities.map(e => e.id)))
      }
      if (S.current.roundTour) setStepTo(0)   // start the round player at round 0
      // e2e hook: canvas classes aren't queryable from the DOM, so the playwright
      // specs read/drive the panel through this (dev + prod, harmless).
      window.__atlas = {
        select, showAll, setStepTo,
        tour: (name, dir = 1) => stepTourRef.current?.(name, dir),
        ids: () => S.current.model.entities.map(e => e.id),
        state: () => ({
          focus: [...S.current.focus],
          visible: S.current.view ? S.current.view.entityIds.size : null,
          round: S.current.step ?? null,
          spot: S.current.spot ? S.current.spot.span : null,
        }),
      }
    })()
    return () => { alive = false; cyRef.current?.destroy(); cyRef.current = null }
  }, [d2, rows])

  // narration hover -> light the matching node + its rows (core/bus.ts in action),
  // and answer with the ident's files (the periscope feed).
  useEffect(() => {
    const off = atlasBus.on(HOVER, tok => {
      const cy = cyRef.current; if (!cy) return
      cy.nodes().removeClass('hot')
      if (!tok) { setLitRow(null); atlasBus.emit(PERISCOPE, null); return }
      const t = String(tok).toLowerCase()
      const hit = cy.nodes().filter(n => n.id().toLowerCase() === t || (n.data('name') || '').toLowerCase() === t)
      hit.addClass('hot')
      setLitRow(hit.nonempty() ? hit[0].id() : null)
      const rows = S.current.model ? identRefs(S.current.model, tok) : []
      atlasBus.emit(PERISCOPE, rows.length ? { ident: tok, rows } : null)
    })
    return off
  }, [])

  useEffect(() => { tipRef.current?.setAttribute('popover', 'manual') }, [])

  // expand/collapse: same instance, so the picture carries over byte-for-byte.
  // cytoscape just needs a resize + refit when its container changes size.
  useEffect(() => {
    const cy = cyRef.current; if (!cy) return
    const id = requestAnimationFrame(() => { cy.resize(); S.current.focus.length ? select(S.current.focus) : cy.animate({ fit: { eles: cy.elements(), padding: 40 } }, { duration: 250 }) })
    return () => cancelAnimationFrame(id)
  }, [full])
  useEffect(() => {
    if (!full) return
    const onKey = e => { if (e.key === 'Escape') { e.stopPropagation(); setFull(false) } }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [full])

  const hot = (id, on) => { const cy = cyRef.current; if (cy) cy.$id(id).toggleClass('hot', on) }

  // react-arborist row renderer (closes over litRow/select/hot/bars). Indent
  // lives on the inner wrapper so the bar (a full-width child anchored to the row,
  // not the indented content) keeps the right edge as a fixed origin. The bar is
  // its own element so it can grow features (segments, tooltips, clicks) later.
  const indentVar = p => typeof p === 'number' ? `${p}px` : (p || 0)
  const renderRow = spec => ({ node, style }) => {
    const { paddingLeft, ...rest } = style
    const d = node.data, branch = !node.isLeaf, id = d.ids && d.ids[0]
    const lit = d.ids && d.ids.includes(litRow)
    // rows: every row shows its own slice. stacked: only branches, drawn as one
    // horizontal stacked bar of their children (each segment = child.share).
    const on = spec.bar && barMode !== 'off'
    const rowsBar = on && barMode === 'rows'
    const stackBar = on && barMode === 'stacked' && branch && d.children
    return (
      <div style={rest} title={d.title}
           className={`trow ${branch ? 'branch' : 'leaf'}${lit ? ' hot' : ''}`}
           onClick={() => branch ? node.toggle() : (id && select([id]))}
           onMouseEnter={() => d.ids && d.ids.forEach(x => hot(x, true))}
           onMouseLeave={() => d.ids && d.ids.forEach(x => hot(x, false))}>
        <div className="trow-in" style={{ paddingLeft }}>
          <span className="tw">{branch ? (node.isOpen ? '▾' : '▸') : ''}</span>
          <span className="ticon">{branch ? '' : (d.icon || spec.leafIcon)}</span>
          <span className="tlabel">{d.label}</span>
          {branch ? <span className="tcount">·{d.count}</span> : (id && <span className="rid">{id}</span>)}
        </div>
        {rowsBar && <div className="trow-bar" style={{ '--share': d.share || 0, '--offset': d.offset || 0, '--indent': indentVar(paddingLeft) }}
                         title={`${Math.round((d.share || 0) * 100)}% of ${node.parent?.data?.label || spec.title}`} />}
        {stackBar && <div className="trow-bar stacked" style={{ '--indent': indentVar(paddingLeft) }}>
          {d.children.map(c => <span key={c.id} style={{ flexGrow: c.share || 0 }}
                                      title={`${c.label} · ${Math.round((c.share || 0) * 100)}%`} />)}
        </div>}
      </div>
    )
  }

  // named tours: each click advances; the step's target drives the selection.
  // A span step leaves the graph untouched and opens the spotlight (the document
  // surface) over it; the next non-span step closes it. Position lives in
  // S.current.tourPos so the once-bound e2e hook is never stale.
  function stepTour(name, dir) {
    const t = allTours.find(x => x.id === name); if (!t || !t.steps.length) return
    const pos = S.current.tourPos || { name: null, step: -1 }
    let s = (pos.name === name ? pos.step : -1) + dir
    s = (s + t.steps.length) % t.steps.length
    S.current.tourPos = { name, step: s }
    setTour({ name, step: s })
    const step = t.steps[s], target = step.target
    if (target.span) { showSpot({ span: target.span, comment: step.comment }); return }
    showSpot(null)
    if (target.focus && target.focus.length) select(target.focus)
    else if (target.path) select([target.path[target.at ?? target.path.length - 1]])
  }
  stepTourRef.current = stepTour

  const setMode = m => { S.current.mode = m; setUi(u => ({ ...u, mode: m })); if (S.current.focus.length) select(S.current.focus); syncURL() }
  const setIsolate = v => { S.current.isolate = v; setUi(u => ({ ...u, isolate: v })); if (S.current.focus.length) select(S.current.focus); syncURL() }
  const setLayout = async l => { S.current.layoutName = l; setUi(u => ({ ...u, layoutName: l })); if (l === 'elk') await ensureElk(); relayout(); syncURL() }
  const setDir = d => { S.current.rankDir = d; setUi(u => ({ ...u, rankDir: d })); relayout(); syncURL() }
  const toggleHeat = () => { const cy = cyRef.current; if (!cy) return; const on = !heat; setHeat(on); cy.nodes().forEach(n => { if (!n.data('grp')) n.toggleClass('heaton', on) }) }
  const fold = () => S.current.ec?.collapseAll()
  const unfold = () => S.current.ec?.expandAll()
  const reset = () => { S.current.tourPos = null; setTour({ name: null, step: -1 }); showSpot(null); showAll() }
  const toggle = k => setCollapsed(c => ({ ...c, [k]: !c[k] }))

  return (
    <div className={`atlas${full ? ' atlas--full' : ''}`}>
      <div className="atlas-graph" ref={cyEl}>
        <div className="atlas-anchor" ref={anchorRef} />
        <div className="atlas-tip" ref={tipRef} />
        {stepUI && stepUI.cap && <div className="atlas-cap" dangerouslySetInnerHTML={{ __html: noteToHTML(stepUI.cap) }} />}
        {spot && <CodeSpotlight docs={docs} span={spot.span}
                                commentHTML={spot.comment ? noteToHTML(spot.comment) : ''}
                                onClose={() => showSpot(null)} />}
      </div>
      <div className="atlas-side">
        <div className="atlas-bar">
          {stepUI && <>
            <button className="atlas-btn" onClick={() => setStepTo((S.current.step || 0) - 1)} title="prev round">◀</button>
            <span className="atlas-step">round {stepUI.n}/{S.current.roundTour ? S.current.roundTour.steps.length - 1 : 0}</span>
            <button className="atlas-btn" onClick={() => setStepTo((S.current.step || 0) + 1)} title="next round">▶</button>
          </>}
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
          <select className="atlas-sel" value={barMode} onChange={e => setBarMode(e.target.value)} title="weight bar">
            <option value="off">bar: off</option>
            <option value="rows">bar: rows</option>
            <option value="stacked">bar: stacked</option>
          </select>
          {allTours.map(t => (
            <button key={t.id} className="atlas-btn" onClick={() => stepTour(t.id, 1)}>
              ▶ {t.id}{tour.name === t.id ? ` ${tour.step + 1}/${t.steps.length}` : ''}
            </button>
          ))}
          <button className="atlas-btn" onClick={reset}>reset</button>
          <button className="atlas-btn atlas-full-btn" onClick={() => setFull(f => !f)} title={full ? 'collapse (Esc)' : 'open editor'}>
            {full ? '⤡ close' : '⤢ expand'}
          </button>
        </div>

        {Object.keys(refsByPanel).map(k => {
          const tree = refsByPanel[k], spec = panelSpec(k)
          const forest = tree ? toForest(tree, spec.bar?.weight) : []
          const h = Math.min(Math.max(tree ? nodeCount(tree) : 1, 1), 9) * ROW_H + 6   // fit content, cap ~9 rows
          return (
            <div key={k} className={`atlas-panel${collapsed[k] ? ' collapsed' : ''}`}>
              <div className="atlas-phead" onClick={() => toggle(k)}>
                <span className="caret">▾</span><span>{spec.title}</span>
                <span className="count">{tree?.count || ''}</span>
              </div>
              {!collapsed[k] && (forest.length
                ? <Tree className="atlas-tree" data={forest} openByDefault width="100%" height={h}
                        rowHeight={ROW_H} indent={14} disableDrag disableDrop disableMultiSelection>
                    {renderRow(spec)}
                  </Tree>
                : <div className="muted atlas-empty">no refs in view</div>)}
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
                <div className="dkind">{detail.kind || 'node'}</div>
                <div className="dnote"><span className="rid">{detail.id}</span></div>
                {detail.note && <div className="dbody" dangerouslySetInnerHTML={{ __html: noteToHTML(detail.note) }} />}
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
