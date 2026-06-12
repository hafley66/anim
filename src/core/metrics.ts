// core/metrics.ts — graph metrics over a Model. Framework-neutral (graphology
// is a data library). Optional decorations: a failure returns {} and never
// blanks the graph.

import Graph from 'graphology'
import betweenness from 'graphology-metrics/centrality/betweenness.js'
import type { Model } from './model'

// betweenness centrality -> per-node heat 0..1. The hub colours itself; no hand tag.
export function heat(model: Model): Record<string, number> {
  try {
    const g = new Graph()
    model.entities.forEach(e => g.mergeNode(e.id))
    model.edges.forEach(ed => { if (ed.source !== ed.target) g.mergeEdge(ed.source, ed.target) })
    if (g.order === 0) return {}
    const bc = betweenness(g) as Record<string, number>
    const max = Math.max(1e-9, ...Object.values(bc))
    const out: Record<string, number> = {}
    for (const id of Object.keys(bc)) out[id] = bc[id] / max
    return out
  } catch { return {} }
}
