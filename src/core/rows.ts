// core/rows.ts — the DESIGN.md loader: relational rows (sqlite rel_* tables,
// JSON, anything) -> Model. Driver-agnostic: the CALLER runs the SQL / fetch;
// core never opens a database. Row shapes mirror the rel schema:
//   node(id, kind, label) · edge(id, f, t, kind) · tag(node, ns, value)
//   tour(id, title) · tour_step(tour, seq, target, comment)
//   card(id, body) · card_about(card, node) · view(id, focus, mode, layout, dir, iso)
//   node_ref(node, panel, locator)   (`ref` is reserved in dl: the span spine)

import type { Edge, Entity, Model, Ref, Tour, ViewSeed } from './model'
import { entity, lastSeg, makeModel, parentOf } from './model'
import { decodeFocus } from './codec'
import { toursFromRows } from './tour'

export type NodeRow = { id: string; kind?: string; label?: string }
export type EdgeRow = { id?: string; f: string; t: string; kind?: string; label?: string }
export type TagRow = { node: string; ns: string; value: string }
export type TourRow = { id: string; title?: string }
export type TourStepRow = { tour: string; seq: number; target: string; comment?: string }
export type CardRow = { id: string; body: string }
export type CardAboutRow = { card: string; node: string }
export type ViewRow = { id: string; focus?: string; mode?: string; layout?: string; dir?: string; iso?: number | boolean }
export type RefRowIn = { node: string; panel: string; locator: string }

export type RelRows = {
  nodes?: NodeRow[]
  edges?: EdgeRow[]
  tags?: TagRow[]
  tours?: TourRow[]
  tour_steps?: TourStepRow[]
  cards?: CardRow[]
  card_about?: CardAboutRow[]
  views?: ViewRow[]
  refs?: RefRowIn[]
}

// the tour_step target encoding ('file:lo..hi' span / '+'-joined focus) is
// parseTarget in codec.ts; row grouping is toursFromRows in tour.ts.
export function modelFromRows(rows: RelRows): Model {
  const tagsOf = new Map<string, string[]>()
  for (const t of rows.tags || []) {
    const tag = !t.ns || t.ns === 'tag' ? t.value : `${t.ns}:${t.value}`
    ;(tagsOf.get(t.node) || tagsOf.set(t.node, []).get(t.node)!).push(tag)
  }

  const entities: Entity[] = (rows.nodes || []).map(n => entity({
    id: n.id, label: n.label || lastSeg(n.id), kind: n.kind || 'node',
    container: parentOf(n.id), tags: tagsOf.get(n.id) || [],
  }))
  for (const c of rows.cards || []) {
    entities.push(entity({ id: c.id, kind: 'card', container: parentOf(c.id), tags: tagsOf.get(c.id) || [], note: c.body }))
  }

  let i = 0
  const edges: Edge[] = (rows.edges || []).map(e => ({
    id: e.id || `${e.f}>>${e.t}#${i++}`, source: e.f, target: e.t, label: e.label || '', kind: e.kind || 'dep',
  }))
  for (const a of rows.card_about || []) {
    edges.push({ id: `${a.card}>>${a.node}#${i++}`, source: a.card, target: a.node, label: '', kind: 'about' })
  }

  const refs = new Map<string, Ref[]>()
  for (const r of rows.refs || []) {
    (refs.get(r.node) || refs.set(r.node, []).get(r.node)!).push({ panel: r.panel, locator: r.locator })
  }

  const tours: Tour[] = toursFromRows(rows.tour_steps || [], rows.tours || [])

  const seeds: Record<string, ViewSeed> = {}
  for (const v of rows.views || []) {
    seeds[v.id] = {
      ...(v.focus ? { focus: decodeFocus(v.focus) } : {}),
      ...(v.mode ? { mode: v.mode } : {}),
      ...(v.layout ? { layout: v.layout } : {}),
      ...(v.dir ? { dir: v.dir } : {}),
      ...(v.iso ? { iso: true } : {}),
    }
  }
  // a view row named 'seed' pins the opening view (same role as `# view`)
  const seed = seeds['seed'] || null

  return makeModel({ entities, edges, refs, tours, ...(Object.keys(seeds).length ? { seeds } : {}), ...(seed ? { seed } : {}) })
}
