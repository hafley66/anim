// CssGraph — a pure-DOM + CSS-anchor-positioning backend that DUCK-TYPES the
// subset of cytoscape's Core that AtlasPanel calls. No new type system: the
// contract IS cytoscape's runtime API. Swap it in where AtlasPanel does
// `cytoscape({...})` and every handler runs unchanged.
//
// Render+interact is pure CSS (the css-anchor-node-editor prototype): nodes are
// divs with anchor-name, edges are anchor-tethered SVG beziers, pan/zoom is a
// transform on .world. The ENGINE is real cytoscape, run HEADLESS: layout() feeds
// the live elements (+ parent links for compound grouping) to a throwaway
// cytoscape({headless:true}), runs the requested layout/plugin (dagre/elk/cose/
// concentric/grid — all of them, for free), reads node.position() back, and writes
// transform:translate. The anchor edges re-tether automatically; group boxes are
// drawn from the children's bounding box. Styling lives in css-graph.css.
import cytoscape from 'cytoscape'

type XY = { x: number; y: number }
type Handler = (ev: any) => void
type LayoutOpts = any

// node ids carry dots/colons; CSS anchor-name needs a bare dashed-ident.
const cssName = (id: string) => '--n_' + id.replace(/[^a-zA-Z0-9_-]/g, '_')
const DRAG_DEAD = 4   // px the pointer must travel before a press becomes a pan/drag (kills touchiness)

// point on a node's border, on the ray from its center toward `toward` (world coords)
function borderPoint(pos: { x: number; y: number; w: number; h: number }, toward: { x: number; y: number }) {
  const cx = pos.x + pos.w / 2, cy = pos.y + pos.h / 2, dx = toward.x - cx, dy = toward.y - cy
  if (!dx && !dy) return { x: cx, y: cy }
  const s = Math.min(dx ? (pos.w / 2) / Math.abs(dx) : Infinity, dy ? (pos.h / 2) / Math.abs(dy) : Infinity)
  return { x: cx + dx * s, y: cy + dy * s }
}

function matchSel(e: Ele, sel?: string): boolean {
  if (!sel) return true
  if (sel === 'node') return e.group === 'nodes'
  if (sel === 'edge') return e.group === 'edges'
  if (sel.startsWith('.')) return e.el.classList.contains(sel.slice(1))
  if (sel.startsWith('[?')) return !!e.data(sel.slice(2, -1))   // [?grp] -> data('grp') truthy
  return true
}

// ── one node or edge ────────────────────────────────────────────────────────
class Ele {
  _data: Record<string, any>
  _pos: { x: number; y: number; w: number; h: number } | null = null
  lblEl?: HTMLSpanElement
  constructor(public cy: CssGraph, public group: 'nodes' | 'edges', public el: HTMLElement, data: Record<string, any>) {
    this._data = { ...data }
  }
  id() { return this._data.id }
  nonempty() { return true }
  get length() { return 1 }
  forEach(fn: (e: Ele) => void) { fn(this) }
  data(k?: string, v?: any): any {
    if (k === undefined) return this._data
    if (v === undefined) return this._data[k]
    this._data[k] = v
    if ((k === 'lbl' || k === 'label' || k === 'name') && this.lblEl) this.lblEl.textContent = this._data.lbl ?? this._data.label ?? this._data.name ?? ''
    if (k === 'heat') this.el.style.setProperty('--heat', String(v))
    return this
  }
  addClass(c: string) { for (const t of c.split(/\s+/)) if (t) this.el.classList.add(t); return this }
  removeClass(c: string) { for (const t of c.split(/\s+/)) if (t) this.el.classList.remove(t); return this }
  toggleClass(c: string, on?: boolean) { for (const t of c.split(/\s+/)) if (t) this.el.classList.toggle(t, on); return this }
  outdegree(_inc?: boolean) { return this.cy.edgeIds.reduce((n, eid) => n + (this.cy.byId.get(eid)!._data.source === this.id() ? 1 : 0), 0) }
  renderedPosition(): XY {
    const r = this.el.getBoundingClientRect(), h = this.cy.host.getBoundingClientRect()
    return { x: r.left + r.width / 2 - h.left, y: r.top + r.height / 2 - h.top }
  }
  renderedMidpoint(): XY { return this.renderedPosition() }
}

// ── a set of elements; chainable like a cytoscape collection ─────────────────
class Coll {
  [i: number]: Ele
  constructor(public els: Ele[]) { els.forEach((e, i) => { this[i] = e }) }
  get length() { return this.els.length }
  nonempty() { return this.els.length > 0 }
  forEach(fn: (e: Ele) => void) { this.els.forEach(fn) }
  data(k?: string, v?: any): any {                               // read = first ele; write = all
    if (arguments.length >= 2) { this.els.forEach(e => e.data(k!, v)); return this }
    return this.els[0]?.data(k)
  }
  filter(f: ((e: Ele) => boolean) | string) { return new Coll(this.els.filter(e => (typeof f === 'function' ? f(e) : matchSel(e, f)))) }
  not(sel: string) { return new Coll(this.els.filter(e => !matchSel(e, sel))) }
  union(c: Coll) { const seen = new Set(this.els.map(e => e.id())); return new Coll([...this.els, ...c.els.filter(e => !seen.has(e.id()))]) }
  difference(c: Coll) { const drop = new Set(c.els.map(e => e.id())); return new Coll(this.els.filter(e => !drop.has(e.id()))) }
  addClass(c: string) { this.els.forEach(e => e.addClass(c)); return this }
  removeClass(c: string) { this.els.forEach(e => e.removeClass(c)); return this }
  toggleClass(c: string, on?: boolean) { this.els.forEach(e => e.toggleClass(c, on)); return this }
}

export class CssGraph {
  host: HTMLElement
  viewport: HTMLDivElement
  world: HTMLDivElement
  byId = new Map<string, Ele>()
  nodeIds: string[] = []
  edgeIds: string[] = []
  view = { x: 0, y: 0, z: 1 }
  handlers: Record<string, { sel?: string; fn: Handler }[]> = { tap: [], mouseover: [], mouseout: [] }
  private groupEls = new Map<string, HTMLDivElement>()
  private flipQueued = false
  private animTok = 0
  private hovered: Ele | null = null
  // a single press: where it started, the node under it (if any), the view/node origin, and whether it has crossed the dead-zone.
  // a single press: pan, node-drag, or group-drag (members + their start positions)
  private press: { x: number; y: number; node: Ele | null; group: { e: Ele; x: number; y: number }[] | null; vx: number; vy: number; nx: number; ny: number; moved: boolean } | null = null

  constructor(opts: { container: HTMLElement }) {
    this.host = opts.container
    this.viewport = document.createElement('div'); this.viewport.className = 'cssg-viewport'
    this.world = document.createElement('div'); this.world.className = 'cssg-world'
    this.viewport.appendChild(this.world); this.host.appendChild(this.viewport)
    // one shared arrowhead marker; context-stroke makes it follow each wire's color.
    this.viewport.insertAdjacentHTML('beforeend',
      '<svg width="0" height="0" class="cssg-defs" aria-hidden="true"><defs>' +
      '<marker id="cssg-arrow" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="9" markerHeight="9" markerUnits="userSpaceOnUse" orient="auto-start-reverse">' +
      '<path class="cssg-arrowhead" d="M0,0 L10,5 L0,10 z"/></marker></defs></svg>')
    this.bindInput()
    this.applyView(false)
  }

  // ── cytoscape Core surface ─────────────────────────────────────────────────
  add(eles: any[]) {
    for (const spec of eles) {
      if (spec.group === 'nodes') this.addNode(spec.data)
      else this.addEdge(spec.data)
    }
    this.scheduleFlips()
  }
  $id(id: string) { const e = this.byId.get(id); return new Coll(e ? [e] : []) }
  nodes(sel?: string) { return new Coll(this.nodeIds.map(i => this.byId.get(i)!)).filter(sel || (() => true)) }
  edges(sel?: string) { return new Coll(this.edgeIds.map(i => this.byId.get(i)!)).filter(sel || (() => true)) }
  elements(sel?: string) { return new Coll([...this.nodeIds, ...this.edgeIds].map(i => this.byId.get(i)!)).filter(sel || (() => true)) }
  batch(fn: () => void) { fn() }
  resize() { this.scheduleFlips() }
  expandCollapse(_opts?: any) { return { collapseAll() {}, expandAll() {} } }   // headless layout already groups; fold/unfold is a later pass
  animate(anis: any, opts?: any) { if (anis?.fit) this.fit(anis.fit.eles, anis.fit.padding ?? 40, opts?.duration ?? 0) }
  layout(opts: LayoutOpts) { return { run: () => { void this.runLayout(opts) }, stop() {}, on() {} } }
  on(events: string, selOrFn: string | Handler, fn?: Handler) {
    const handler = (typeof selOrFn === 'function' ? selOrFn : fn)!
    const sel = typeof selOrFn === 'string' ? selOrFn : undefined
    for (const ev of events.split(/\s+/)) (this.handlers[ev] ||= []).push({ sel, fn: handler })
    return this
  }
  destroy() { this.viewport.remove() }

  // ── build ──────────────────────────────────────────────────────────────────
  private addNode(data: Record<string, any>) {
    const el = document.createElement('div'); el.className = 'cssg-node'; el.id = data.id
    el.style.setProperty('anchor-name', cssName(data.id))
    if (data.ann) el.dataset.ann = '1'
    const lbl = document.createElement('span'); lbl.className = 'cssg-lbl'
    lbl.textContent = data.lbl ?? data.label ?? data.name ?? data.id
    el.appendChild(lbl)
    const e = new Ele(this, 'nodes', el, data); e.lblEl = lbl
    if (data.grp) el.classList.add('grp')
    this.world.appendChild(el); this.byId.set(data.id, e); this.nodeIds.push(data.id)
  }
  private addEdge(data: Record<string, any>) {
    const el = document.createElement('div'); el.className = 'cssg-edge'; el.id = data.id
    el.style.setProperty('--a', cssName(data.source)); el.style.setProperty('--b', cssName(data.target))
    if (data.hasNote) el.dataset.hasNote = '1'
    // viewBox + path are set per-frame in runEdges (px units, 1:1 with the box).
    el.innerHTML = '<svg><path class="cssg-hit"/><path class="cssg-wire" marker-end="url(#cssg-arrow)"/></svg>'
    const e = new Ele(this, 'edges', el, data)
    this.world.appendChild(el); this.byId.set(data.id, e); this.edgeIds.push(data.id)
  }

  // ── layout: REUSE cytoscape headless as the engine, render the result in CSS ──
  private async runLayout(opts: LayoutOpts) {
    const live = this.nodeIds.map(i => this.byId.get(i)!).filter(e => !e.el.classList.contains('step-hide') && !e.el.classList.contains('iso-hide'))
    const liveLeaf = live.filter(e => !e._data.grp)
    const present = new Set(live.map(e => e.id()))
    // throwaway headless instance = the layout/plugin engine. compound parents come
    // from each node's `parent` data, so dagre/elk/fcose group exactly like the canvas.
    const eng = cytoscape({
      headless: true, styleEnabled: true,
      style: [{ selector: 'node[_w]', style: { width: 'data(_w)', height: 'data(_h)' } }] as any,
      elements: [
        ...live.map(e => ({ group: 'nodes' as const, data: { ...e._data, ...(e._data.grp ? {} : { _w: e.el.offsetWidth || 100, _h: e.el.offsetHeight || 26 }) } })),
        ...this.edgeIds.map(i => this.byId.get(i)!._data).filter(d => present.has(d.source) && present.has(d.target))
          .map(d => ({ group: 'edges' as const, data: { id: d.id, source: d.source, target: d.target } })),
      ],
    } as any)
    try {
      const lay = eng.layout({ ...opts, animate: false, fit: false })
      await new Promise<void>(res => { lay.one('layoutstop', () => res()); lay.run() })
      for (const e of liveLeaf) {
        const n = eng.$id(e.id()); if (n.empty()) continue
        const p = n.position(), w = e.el.offsetWidth || 100, h = e.el.offsetHeight || 26
        e._pos = { x: p.x - w / 2, y: p.y - h / 2, w, h }
        e.el.style.transform = `translate(${e._pos.x}px, ${e._pos.y}px)`
      }
    } catch (err) { console.warn('CssGraph layout failed:', err) } finally { eng.destroy() }
    this.renderGroups(); this.scheduleFlips()
    if (opts.fit !== false) this.fit('all', opts.padding ?? 40, opts.animate ? (opts.animationDuration ?? 420) : 0)
  }

  // is `e` inside container `gid` (walking the parent chain)?
  private inGroup(e: Ele, gid: string) { let p = e._data.parent; while (p) { if (p === gid) return true; p = this.byId.get(p)?._data.parent } return false }
  private membersOf(gid: string) { return this.nodeIds.map(i => this.byId.get(i)!).filter(e => !e._data.grp && e._pos && this.inGroup(e, gid)) }

  // group boxes: a dashed rectangle around each container's members (its compound box)
  private renderGroups() {
    for (const g of this.nodeIds.map(i => this.byId.get(i)!).filter(e => e._data.grp)) {
      const members = this.membersOf(g.id())
      let box = this.groupEls.get(g.id())
      if (!members.length) { box?.remove(); this.groupEls.delete(g.id()); continue }
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
      for (const m of members) { const p = m._pos!; minX = Math.min(minX, p.x); minY = Math.min(minY, p.y); maxX = Math.max(maxX, p.x + p.w); maxY = Math.max(maxY, p.y + p.h) }
      const pad = 16, lblH = 15
      if (!box) { box = document.createElement('div'); box.className = 'cssg-group'; box.dataset.gid = g.id(); box.innerHTML = '<span class="cssg-group-lbl"></span>'; this.world.insertBefore(box, this.world.firstChild); this.groupEls.set(g.id(), box) }
      box.querySelector('.cssg-group-lbl')!.textContent = g._data.label ?? g.id()
      box.style.transform = `translate(${minX - pad}px, ${minY - pad - lblH}px)`
      box.style.width = (maxX - minX + 2 * pad) + 'px'; box.style.height = (maxY - minY + 2 * pad + lblH) + 'px'
    }
  }

  // ── camera ──────────────────────────────────────────────────────────────────
  fit(eles: Coll | 'all' | undefined, padding: number, duration: number) {
    const els = (eles && eles !== 'all' ? eles.els : [...this.byId.values()])
      .filter(e => e.group === 'nodes' && e._pos && !e.el.classList.contains('step-hide') && !e.el.classList.contains('iso-hide'))
    if (!els.length) return
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (const e of els) { const p = e._pos!; minX = Math.min(minX, p.x); minY = Math.min(minY, p.y); maxX = Math.max(maxX, p.x + p.w); maxY = Math.max(maxY, p.y + p.h) }
    const bw = maxX - minX, bh = maxY - minY
    const vw = this.viewport.clientWidth, vh = this.viewport.clientHeight
    const z = Math.max(0.2, Math.min(2.5, Math.min((vw - 2 * padding) / bw, (vh - 2 * padding) / bh)))
    this.view = { z, x: (vw - bw * z) / 2 - minX * z, y: (vh - bh * z) / 2 - minY * z }
    this.applyView(duration > 0, duration)
  }
  private applyView(animate: boolean, duration = 420) {
    if (animate) {
      const tok = ++this.animTok
      this.world.classList.add('animating')
      this.world.style.transition = `transform ${duration}ms cubic-bezier(.4,0,.2,1)`
      setTimeout(() => { if (tok === this.animTok) { this.world.classList.remove('animating'); this.world.style.transition = '' } }, duration + 20)
    } else { this.world.style.transition = '' }
    this.world.style.transform = `translate(${this.view.x}px, ${this.view.y}px) scale(${this.view.z})`
    this.scheduleFlips()
  }

  // ── edge geometry: compute each edge's viewBox + path from the node positions ──
  // The anchor-positioned container (padded by --p) gives the box; here we size the
  // SVG to it (1:1 px) and draw border-to-border, so colinear / cross-group / self
  // edges all render with an arrowhead at the target's edge.
  private scheduleFlips() { if (!this.flipQueued) { this.flipQueued = true; requestAnimationFrame(() => this.runEdges()) } }
  private runEdges() {
    this.flipQueued = false
    const P = 30   // must equal --p in css-graph.css
    for (const eid of this.edgeIds) {
      const e = this.byId.get(eid)!, a = this.byId.get(e._data.source), b = this.byId.get(e._data.target)
      if (!a?._pos || !b?._pos) continue
      const svg = e.el.firstElementChild as SVGSVGElement
      // read LIVE sizes: hop superscripts widen a node after layout, so _pos.w/h are stale
      const aw = a.el.offsetWidth, ah = a.el.offsetHeight, bw = b.el.offsetWidth, bh = b.el.offsetHeight
      const ab = { x: a._pos.x, y: a._pos.y, w: aw, h: ah }, bb = { x: b._pos.x, y: b._pos.y, w: bw, h: bh }
      const ac = { x: a._pos.x + aw / 2, y: a._pos.y + ah / 2 }
      const bc = { x: b._pos.x + bw / 2, y: b._pos.y + bh / 2 }
      let d: string, W: number, H: number
      if (a === b) {                                   // self-loop: a small arc off the top-right corner
        W = aw / 2 + 2 * P; H = ah / 2 + 2 * P
        const x0 = aw / 2, y0 = P, r = P
        d = `M${x0},${y0 + r * 0.4} C${x0 + r},${y0 - r * 0.6} ${x0 + r * 2},${y0 + r * 0.8} ${x0 + r * 1.1},${y0 + r * 1.6}`
      } else {
        const minX = Math.min(ac.x, bc.x), minY = Math.min(ac.y, bc.y)
        W = Math.abs(bc.x - ac.x) + 2 * P; H = Math.abs(bc.y - ac.y) + 2 * P
        // endpoints on the node borders (toward the other node), in box-local coords
        const sb = borderPoint(ab, bc), tb = borderPoint(bb, ac)
        const sx = sb.x - minX + P, sy = sb.y - minY + P, tx = tb.x - minX + P, ty = tb.y - minY + P
        const horiz = Math.abs(bc.x - ac.x) >= Math.abs(bc.y - ac.y)
        const c1 = horiz ? `${(sx + tx) / 2},${sy}` : `${sx},${(sy + ty) / 2}`
        const c2 = horiz ? `${(sx + tx) / 2},${ty}` : `${tx},${(sy + ty) / 2}`
        d = `M${sx},${sy} C${c1} ${c2} ${tx},${ty}`
      }
      svg.setAttribute('viewBox', `0 0 ${W} ${H}`)
      for (const p of e.el.querySelectorAll('path')) p.setAttribute('d', d)
    }
  }

  // ── one press handles pan / node-drag / tap, gated by a dead-zone ─────────────
  private bindInput() {
    const vp = this.viewport
    vp.addEventListener('pointerdown', ev => {
      const nodeEl = (ev.target as HTMLElement).closest('.cssg-node:not(.grp)') as HTMLElement | null
      const node = nodeEl ? this.byId.get(nodeEl.id) || null : null
      // press on a group box (and not on a member node) = drag the whole container
      let group: { e: Ele; x: number; y: number }[] | null = null
      if (!node) {
        const gEl = (ev.target as HTMLElement).closest('.cssg-group') as HTMLElement | null
        if (gEl?.dataset.gid) group = this.membersOf(gEl.dataset.gid).map(e => ({ e, x: e._pos!.x, y: e._pos!.y }))
      }
      this.press = { x: ev.clientX, y: ev.clientY, node, group, vx: this.view.x, vy: this.view.y, nx: node?._pos?.x ?? 0, ny: node?._pos?.y ?? 0, moved: false }
      vp.setPointerCapture(ev.pointerId)
    })
    vp.addEventListener('pointermove', ev => {
      if (!this.press) { this.updateHover(ev); return }
      const dx = ev.clientX - this.press.x, dy = ev.clientY - this.press.y
      if (!this.press.moved && Math.hypot(dx, dy) < DRAG_DEAD) return   // dead-zone: a press isn't a drag yet
      this.press.moved = true
      const z = this.view.z
      if (this.press.node) {                                            // drag the node (world coords = screen delta / zoom)
        const w = this.press.node._pos?.w ?? this.press.node.el.offsetWidth, h = this.press.node._pos?.h ?? this.press.node.el.offsetHeight
        this.press.node._pos = { x: this.press.nx + dx / z, y: this.press.ny + dy / z, w, h }
        this.press.node.el.style.transform = `translate(${this.press.node._pos.x}px, ${this.press.node._pos.y}px)`
        this.scheduleFlips()
      } else if (this.press.group) {                                    // drag the whole container: move every member
        for (const m of this.press.group) { m.e._pos!.x = m.x + dx / z; m.e._pos!.y = m.y + dy / z; m.e.el.style.transform = `translate(${m.e._pos!.x}px, ${m.e._pos!.y}px)` }
        this.renderGroups(); this.scheduleFlips()
      } else {                                                          // pan from the press origin (no acceleration)
        this.view.x = this.press.vx + dx; this.view.y = this.press.vy + dy; vp.classList.add('panning'); this.applyView(false)
      }
    })
    const end = (ev: PointerEvent) => {
      vp.classList.remove('panning')
      if (this.press && !this.press.moved) this.tap(ev, this.press.node) // a clean press (no drag) = a tap
      else if (this.press?.node) this.renderGroups()                    // node moved: redraw its group box
      this.press = null
    }
    vp.addEventListener('pointerup', end)
    vp.addEventListener('pointercancel', end)
    vp.addEventListener('wheel', ev => {
      ev.preventDefault()
      const r = vp.getBoundingClientRect(), sx = ev.clientX - r.left, sy = ev.clientY - r.top
      const wx = (sx - this.view.x) / this.view.z, wy = (sy - this.view.y) / this.view.z
      this.view.z = Math.max(0.2, Math.min(2.5, this.view.z * (ev.deltaY < 0 ? 1.1 : 1 / 1.1)))
      this.view.x = sx - wx * this.view.z; this.view.y = sy - wy * this.view.z
      this.applyView(false)
    }, { passive: false })
  }
  private updateHover(ev: PointerEvent) {
    const t = ev.target as HTMLElement
    const hit = t.closest('.cssg-node:not(.grp)') || t.closest('.cssg-edge')
    const ele = hit ? this.byId.get((hit as HTMLElement).id) || null : null
    if (ele === this.hovered) return
    if (this.hovered) this.emit('mouseout', this.hovered, ev)
    this.hovered = ele
    if (ele) this.emit('mouseover', ele, ev)
  }
  // pointer capture re-targets pointerup to the viewport, so trust the node captured
  // at press-time for a node tap; for empty/edge presses, hit-test under the cursor.
  private tap(ev: PointerEvent, pressedNode: Ele | null) {
    if (pressedNode) { this.emit('tap', pressedNode, ev); return }
    const el = document.elementFromPoint(ev.clientX, ev.clientY) as HTMLElement | null
    const edge = el?.closest('.cssg-edge')
    this.emit('tap', edge ? this.byId.get((edge as HTMLElement).id) || null : null, ev)
  }
  // dispatch to handlers whose selector matches (node/edge/none). target===this for background.
  private emit(event: string, ele: Ele | null, orig: PointerEvent) {
    const r = this.host.getBoundingClientRect()
    const ev = { target: ele ?? this, originalEvent: orig, renderedPosition: { x: orig.clientX - r.left, y: orig.clientY - r.top } }
    for (const h of this.handlers[event] || []) {
      if (!h.sel) { if (!ele) h.fn(ev) }                          // bare tap -> background only
      else if (ele && matchSel(ele, h.sel)) h.fn(ev)
    }
  }
}
