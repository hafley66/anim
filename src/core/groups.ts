// core/groups.ts — regroup the GRAPH ENTITIES (not refs) into a sidebar forest by
// a chosen dimension. This is anim's port of horn's "tree map" groupby. It reuses
// buildTree/toForest: each entity becomes a synthetic RefRow whose locator is a
// '/'-path ending in the entity, so the SAME tree machinery segments it. Only the
// segmentation changes per dimension; the renderer never names a dimension.

import type { Model, RefRow } from './model'
import { refsOf } from './model'
import { scc } from './tarjan'
import { buildTree, toForest, type ForestNode, type PathOf } from './tree'

export type GroupKey = 'container' | 'source' | 'tag' | 'kind'
export const GROUP_DIMS: { key: GroupKey; title: string }[] = [
  { key: 'container', title: 'container' },
  { key: 'source', title: 'source folder' },
  { key: 'tag', title: 'tag' },
  { key: 'kind', title: 'kind' },
]

// folder of a fs locator: "src/server/api.ts:42" -> "src/server"
const folderOf = (loc: string): string => {
  const path = String(loc).split(/:(?=\d+$)/)[0]
  const i = path.lastIndexOf('/')
  return i < 0 ? '' : path.slice(0, i)
}

// classify each entity: cycle (in a real SCC) > api (no incoming) > leaf (no
// outgoing) > the entity's own kind. Mirrors horn's api/leaf/cycle buckets.
export function kindOf(model: Model): Map<string, string> {
  const cyc = scc(model.entities, model.edges).cyclic
  const indeg = new Map<string, number>(), outdeg = new Map<string, number>()
  for (const e of model.entities) { indeg.set(e.id, 0); outdeg.set(e.id, 0) }
  for (const ed of model.edges) {
    outdeg.set(ed.source, (outdeg.get(ed.source) || 0) + 1)
    indeg.set(ed.target, (indeg.get(ed.target) || 0) + 1)
  }
  const out = new Map<string, string>()
  for (const e of model.entities) {
    out.set(e.id, cyc.has(e.id) ? 'cycle'
      : (indeg.get(e.id) || 0) === 0 ? 'api'
      : (outdeg.get(e.id) || 0) === 0 ? 'leaf'
      : (e.kind || 'node'))
  }
  return out
}

// synthetic rows: locator = "<bucket path>/<entity label>", id = entity id. An
// entity with no value for the dimension lands in a "(none)" bucket; a multi-tag
// entity appears under each of its tags.
export function groupRows(model: Model, dim: GroupKey): RefRow[] {
  const rows: RefRow[] = []
  const push = (id: string, path: string) => rows.push({ id, panel: 'group', locator: path })
  if (dim === 'kind') {
    const k = kindOf(model)
    for (const e of model.entities) push(e.id, `${k.get(e.id) || 'node'}/${e.label}`)
    return rows
  }
  for (const e of model.entities) {
    if (dim === 'container') {
      const c = e.container && e.container !== 'root' ? e.container.replace(/\./g, '/') + '/' : ''
      push(e.id, c + e.label)
    } else if (dim === 'source') {
      const loc = refsOf(model, e.id, 'fs')[0]?.locator
      const f = loc ? folderOf(loc) : ''
      push(e.id, `${f || '(no source)'}/${e.label}`)
    } else if (dim === 'tag') {
      if (e.tags.length) for (const t of e.tags) push(e.id, `${t}/${e.label}`)
      else push(e.id, `(untagged)/${e.label}`)
    }
  }
  return rows
}

const groupPathOf: PathOf = (loc) => String(loc).split('/').filter(Boolean)

// build the regroup forest for one dimension. collapse:false keeps the top buckets
// as stable headers (container nesting still reads cleanly without chain folding).
export function groupForest(model: Model, dim: GroupKey): ForestNode[] {
  return toForest(buildTree(groupRows(model, dim), groupPathOf, { collapse: false }))
}
