// core/d2.ts — d2 text (+ `#` annotation comments, via annotations.ts) -> Model.
// The bundled @terrastruct/d2 WASM compiler is the ONLY parser; on file:// the
// worker-shim runs its compile worker on the main thread.

import type { Edge, Model, Ref } from './model'
import { entity, lastSeg, makeModel, parentOf } from './model'
import { parseAnnotations } from './annotations'
import { tourFromSteps } from './tour'
import { installMainThreadWorkerShim } from './worker-shim'

type RawNode = { id: string; name: string; mod: string }
type RawEdge = { id: string; source: string; target: string; label: string }
type RawGraph = { nodes: RawNode[]; edges: RawEdge[]; engine: string; note?: string }

type D2Compiler = new () => { compile: (text: string) => Promise<unknown> }

function dropContainers(nodes: RawNode[]): RawNode[] {
  const ids = nodes.map(n => n.id)
  const isC = (id: string): boolean => ids.some(o => o !== id && o.startsWith(id + '.'))
  return nodes.filter(n => !isC(n.id))
}

// dynamic import so the ~8MB d2 chunk loads only when a graph asks for it.
export async function loadD2(): Promise<D2Compiler> {
  installMainThreadWorkerShim()   // no-op off file://
  const m = await import('@terrastruct/d2')
  return m.D2 as unknown as D2Compiler
}

export async function parseD2WASM(text: string, D2: D2Compiler | null): Promise<RawGraph> {
  if (!D2) throw new Error('no D2 compiler')
  const res = await new D2().compile(text) as { diagram?: unknown }
  const dg = (res.diagram || res) as { shapes?: Array<{ id: string; label?: string }>; connections?: Array<{ src: string; dst: string; label?: string }> }
  const shapes = dg.shapes || [], conns = dg.connections || []
  if (!shapes.length) throw new Error('no shapes from wasm')
  let i = 0
  const nodes = shapes.map(s => ({ id: s.id, name: s.label || lastSeg(s.id), mod: parentOf(s.id) }))
  const edges = conns.map(c => ({ id: c.src + '>>' + c.dst + '#' + (i++), source: c.src, target: c.dst, label: c.label || '' }))
  return { nodes: dropContainers(nodes), edges, engine: 'wasm' }
}

// Prose-hover id scrape — NOT a d2 parser. Frames.jsx needs node ids
// synchronously to wrap mentions in narration; the real model arrives async
// from the WASM compiler. Bare idents and edge endpoints only.
export function proseHoverIds(text: string): Map<string, string> {
  const map = new Map<string, string>(); const stack: string[] = []
  for (const raw of text.split('\n')) {
    const line = raw.replace(/#.*$/, '').trim()
    if (!line) continue
    if (line === '}') { stack.pop(); continue }
    const open = line.match(/^([\w.\-]+)\s*(?::[^{]*)?\{$/)
    if (open) { stack.push(open[1].trim()); continue }
    for (const seg of line.split('->')) {
      const m = seg.trim().match(/^([\w.\-]+)/)
      if (!m) continue
      const id = stack.length ? stack.join('.') + '.' + m[1] : m[1]
      map.set(id.toLowerCase(), id); map.set(lastSeg(id).toLowerCase(), id)
    }
  }
  return map
}

// text -> Model via the WASM compiler. A compile failure yields an empty model
// carrying the error in `note` — surfaced, never silently re-parsed.
// `# step` rounds become model.tours[0] (a reveal Tour named 'rounds');
// `# view` becomes model.seed.
export async function buildModel(text: string, { D2 = null }: { D2?: D2Compiler | null } = {}): Promise<Model> {
  let g: RawGraph
  try { g = await parseD2WASM(text, D2) } catch (e) { g = { nodes: [], edges: [], engine: 'none', note: e instanceof Error ? e.message : String(e) } }
  const a = parseAnnotations(text)
  const entities = g.nodes.map(n => entity({
    id: n.id, label: n.name, container: n.mod, tags: a.tags[n.id] || [],
    kind: a.diff[n.id] ? 'diff-' + a.diff[n.id] : 'node', note: a.ann[n.id],
  }))
  const edges: Edge[] = g.edges.map(e => ({
    id: e.id, source: e.source, target: e.target, label: e.label || '', kind: 'dep',
    note: a.annE[e.source + '>>' + e.target], src: a.srcE[e.source + '>>' + e.target],
  }))
  const refs = new Map<string, Ref[]>()
  const add = (id: string, ref: Ref): number => (refs.get(id) || refs.set(id, []).get(id)!).push(ref)
  for (const [id, loc] of Object.entries(a.src)) add(id, { panel: 'fs', locator: loc })
  for (const [k, loc] of Object.entries(a.srcE)) add(k, { panel: 'fs', locator: loc })   // edge refs keyed a>>b
  for (const r of a.reflist) add(r.key, { panel: r.panel, locator: r.locator })          // # ref <panel> ...
  const tours = a.steps ? [tourFromSteps(a.steps)] : []
  return makeModel({ entities, edges, refs, tours, seed: a.viewSeed, engine: g.engine, note: g.note })
}
