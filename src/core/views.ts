// core/views.ts — queries over a Model that produce Views (visible subsets).
// A View feeds the transition primitive. Cycle-safe (BFS, no infinite recursion).
// Focus is a SET of ids everywhere: single select is just length 1.

import type { ConeMode, Detail, Model, NodeId, RefRow, View } from './model'
import { lastSeg } from './model'

export type Adj = { out: Map<string, Set<string>>; inc: Map<string, Set<string>> }

export function buildAdj(model: Model): Adj {
  const out = new Map<string, Set<string>>(), inc = new Map<string, Set<string>>()
  for (const e of model.entities) { out.set(e.id, new Set()); inc.set(e.id, new Set()) }
  for (const e of model.edges) {
    (out.get(e.source) || out.set(e.source, new Set()).get(e.source)!).add(e.target);
    (inc.get(e.target) || inc.set(e.target, new Set()).get(e.target)!).add(e.source)
  }
  return { out, inc }
}

const reach = (adj: Map<string, Set<string>>, start: string): Set<string> => {  // transitive closure, cycle-safe
  const seen = new Set<string>(), q = [start]
  while (q.length) { const v = q.shift()!; for (const w of adj.get(v) || []) if (!seen.has(w)) { seen.add(w); q.push(w) } }
  seen.delete(start)
  return seen
}
export const successors = (adj: Adj, id: string): Set<string> => reach(adj.out, id)
export const predecessors = (adj: Adj, id: string): Set<string> => reach(adj.inc, id)

// hop distance from focus: +n downstream (toward deps), -n upstream (toward callers)
export function hopDistances(adj: Adj, focus: string): Map<string, number> {
  const dist = new Map<string, number>([[focus, 0]])
  let fr = [focus], d = 0
  while (fr.length) { const nx: string[] = []; for (const n of fr) for (const m of adj.out.get(n) || []) if (!dist.has(m)) { dist.set(m, d + 1); nx.push(m) } fr = nx; d++ }
  let f2 = [focus], u = 0
  while (f2.length) { const nx: string[] = []; for (const n of f2) for (const m of adj.inc.get(n) || []) if (!dist.has(m)) { dist.set(m, -(u + 1)); nx.push(m) } f2 = nx; u++ }
  return dist
}

const edgesAmong = (model: Model, idSet: Set<string>): Set<string> =>
  new Set(model.edges.filter(e => idSet.has(e.source) && idSet.has(e.target)).map(e => e.id))

// cone over a focus set: per-focus reach unioned; every focal id stays lit.
export function cone(model: Model, focus: NodeId[], mode: ConeMode = 'cone', adj: Adj = buildAdj(model)): View {
  const ids = new Set<string>(focus)
  for (const f of focus) {
    if (mode === 'neighbors') { for (const m of adj.out.get(f) || []) ids.add(m); for (const m of adj.inc.get(f) || []) ids.add(m) }
    else if (mode === 'downstream') for (const m of successors(adj, f)) ids.add(m)
    else if (mode === 'upstream') for (const m of predecessors(adj, f)) ids.add(m)
    else { for (const m of successors(adj, f)) ids.add(m); for (const m of predecessors(adj, f)) ids.add(m) }
  }
  return { entityIds: ids, edgeIds: edgesAmong(model, ids), focus: [...focus] }
}

export function pathFrontier(model: Model, pathIds: NodeId[], step: number = pathIds.length - 1): View {
  const ids = new Set(pathIds.slice(0, step + 1))
  const eids = new Set<string>()
  for (const e of model.edges)
    for (let i = 0; i < step; i++) {
      const a = pathIds[i], b = pathIds[i + 1]
      if ((e.source === a && e.target === b) || (e.source === b && e.target === a)) eids.add(e.id)
    }
  return { entityIds: ids, edgeIds: eids, focus: [pathIds[step]] }
}

// everything visible, nothing focused: the reset state.
export function fullView(model: Model): View {
  const ids = new Set(model.entities.map(e => e.id))
  return { entityIds: ids, edgeIds: new Set(model.edges.map(e => e.id)), focus: [] }
}

// the refs reachable in this view, per panel — what streams into fs/sql side panels.
export function reachableRefs(model: Model, view: Pick<View, 'entityIds'>, panel?: string): RefRow[] {
  const out: RefRow[] = []
  for (const id of view.entityIds)
    for (const r of model.refs.get(id) || []) if (!panel || r.panel === panel) out.push({ id, ...r })
  return out
}

// resolve an ident token to entity ids: id, label, or last id segment,
// case-insensitive. The periscope's WHERE clause.
export function resolveIdent(model: Model, ident: string): string[] {
  const t = String(ident).toLowerCase()
  return model.entities
    .filter(e => e.id.toLowerCase() === t || e.label.toLowerCase() === t || lastSeg(e.id).toLowerCase() === t)
    .map(e => e.id)
}

// the periscope query: ident -> the RefRows of every matching entity in one
// panel (fs by default: "which files mention this ident").
export function identRefs(model: Model, ident: string, panel: string = 'fs'): RefRow[] {
  const out: RefRow[] = []
  for (const id of resolveIdent(model, ident))
    for (const r of model.refs.get(id) || []) if (!panel || r.panel === panel) out.push({ id, ...r })
  return out
}

// the detail-panel payload for a selected node.
export function detailFor(model: Model, id: string): Detail | null {
  const ent = model.entities.find(e => e.id === id)
  if (!ent) return null
  const byPanel: Record<string, string[]> = {}
  for (const r of model.refs.get(id) || []) (byPanel[r.panel] ||= []).push(r.locator)
  return { id: ent.id, note: ent.note, tags: ent.tags, byPanel }
}

// the detail-panel payload for a selected edge (refs are keyed `src>>tgt`).
export function detailForEdge(model: Model, srcId: string, tgtId: string, note?: string): Detail {
  const byPanel: Record<string, string[]> = {}
  for (const r of model.refs.get(srcId + '>>' + tgtId) || []) (byPanel[r.panel] ||= []).push(r.locator)
  return { id: lastSeg(srcId) + ' → ' + lastSeg(tgtId), kind: 'edge · why it exists', note, tags: [], byPanel }
}
