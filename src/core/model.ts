// core/model.ts — the data model. The LEFT table of every join.
// Pure data, no DOM, no cytoscape. An entity id is join key + animation key + address.
// The tour step-target union is named Target (not Subject — RxJS owns that word).

export type NodeId = string
export type Span = { file: string; lo: number; hi: number }
export type ConeMode = 'cone' | 'neighbors' | 'downstream' | 'upstream'

export type Target =
  | { focus: NodeId[]; mode?: ConeMode }   // multi-select is the base case
  | { reveal: NodeId[] }                   // cumulative reveal (round player)
  | { path: NodeId[]; at?: number }        // walk a path, frontier at `at`
  | { span: Span }                         // document surface; graph view unchanged

export type TourStep = { target: Target; comment?: string }
export type Tour = { id: string; title?: string; steps: TourStep[] }

export type ViewSeed = {
  focus?: string[]
  mode?: string
  layout?: string
  dir?: string
  iso?: boolean
}

export type Entity = {
  id: string
  label: string
  kind: string
  container: string
  tags: string[]
  note?: string
}

export type Edge = {
  id: string
  source: string
  target: string
  label: string
  kind: string
  note?: string
  src?: string
}

export type Ref = { panel: string; locator: string }
export type RefRow = Ref & { id: string }

// A View is a visible subset: what the transition primitive diffs.
// focus is a SET of focal ids ([] = nothing focused).
export type View = { entityIds: Set<string>; edgeIds: Set<string>; focus: string[]; note?: string }

export type Detail = {
  id: string
  kind?: string
  note?: string
  tags: string[]
  byPanel: Record<string, string[]>
}

export type Model = {
  entities: Entity[]
  edges: Edge[]
  refs: Map<string, Ref[]>
  tours: Tour[]
  seed?: ViewSeed | null     // a frame's pinned opening view (# view ...)
  engine?: string
  note?: string
  seeds?: Record<string, ViewSeed>   // named camera states (rel view rows)
}

export const Panel = { FS: 'fs', SQL: 'sql', CODE: 'code', API: 'api', GRAPH: 'graph' } as const

// dotted-id helpers shared by d2 ids and row ids (a.b.c nests under a.b)
export const lastSeg = (id: string): string => (id.includes('.') ? id.slice(id.lastIndexOf('.') + 1) : id)
export const parentOf = (id: string): string => (id.includes('.') ? id.slice(0, id.lastIndexOf('.')) : 'root')

export function entity({ id, label = id, kind = 'node', container = 'root', tags = [], note }: {
  id: string; label?: string; kind?: string; container?: string; tags?: string[]; note?: string
}): Entity {
  return { id, label, kind, container, tags, ...(note ? { note } : {}) }
}

export function edge({ source, target, label = '', kind = 'dep' }: {
  source: string; target: string; label?: string; kind?: string
}, i = 0): Edge {
  return { id: `${source}>>${target}#${i}`, source, target, label, kind }
}

export function makeModel({ entities = [], edges = [], refs = new Map(), tours = [], ...extra }: {
  entities?: Entity[]; edges?: Edge[]; refs?: Map<string, Ref[]>; tours?: Tour[]
} & Record<string, unknown> = {}): Model {
  return { entities, edges, refs, tours, ...extra }
}

export const byId = (model: Model): Map<string, Entity> => new Map(model.entities.map(e => [e.id, e]))
export const refsOf = (model: Model, id: string, panel?: string): Ref[] =>
  (model.refs.get(id) || []).filter(r => !panel || r.panel === panel)
