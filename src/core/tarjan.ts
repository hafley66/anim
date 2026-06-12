// core/tarjan.ts — Tarjan SCC over a plain edge list. Pure.
// One pass yields everything anim + atlas each used to compute separately:
//   cyclic  : Set of ids that sit in a real cycle (loop tinting)
//   comp    : Map id -> component number (topo-tier condensation)
//   components: id[][] in reverse-topo order

type IdNode = { id: string }
type IdEdge = { source: string; target: string }

export type Scc = { cyclic: Set<string>; comp: Map<string, number>; components: string[][] }

export function scc(nodes: IdNode[], edges: IdEdge[]): Scc {
  const ids = nodes.map(n => n.id)
  const adj = new Map<string, string[]>(ids.map(i => [i, []]))
  for (const e of edges) (adj.get(e.source) || adj.set(e.source, []).get(e.source)!).push(e.target)
  let idx = 0, cid = 0
  const stack: string[] = [], onStack = new Set<string>(), index = new Map<string, number>(), low = new Map<string, number>()
  const comp = new Map<string, number>(), components: string[][] = [], cyclic = new Set<string>()
  const strong = (v: string): void => {
    index.set(v, idx); low.set(v, idx); idx++; stack.push(v); onStack.add(v)
    for (const w of adj.get(v) || []) {
      if (!index.has(w)) { strong(w); low.set(v, Math.min(low.get(v)!, low.get(w)!)) }
      else if (onStack.has(w)) low.set(v, Math.min(low.get(v)!, index.get(w)!))
    }
    if (low.get(v) === index.get(v)) {
      const group: string[] = []; let w: string
      do { w = stack.pop()!; onStack.delete(w); comp.set(w, cid); group.push(w) } while (w !== v)
      components.push(group)
      if (group.length > 1) group.forEach(x => cyclic.add(x))
      cid++
    }
  }
  for (const id of ids) if (!index.has(id)) strong(id)
  for (const e of edges) if (e.source === e.target) cyclic.add(e.source) // self-loop
  return { cyclic, comp, components }
}

// condense each SCC, longest-path layer the DAG so roots sit at tier 0 (Kahn).
export function topoTiers(nodes: IdNode[], edges: IdEdge[], comp: Map<string, number>): Map<string, number> {
  const cids = [...new Set(comp.values())]
  const adj = new Map<number, Set<number>>(cids.map(c => [c, new Set()])), indeg = new Map<number, number>(cids.map(c => [c, 0]))
  for (const e of edges) {
    const a = comp.get(e.source)!, b = comp.get(e.target)!
    if (a !== b && !adj.get(a)!.has(b)) { adj.get(a)!.add(b); indeg.set(b, indeg.get(b)! + 1) }
  }
  const tier = new Map<number, number>(cids.map(c => [c, 0])), left = new Map(indeg), q = cids.filter(c => indeg.get(c) === 0)
  while (q.length) {
    const c = q.shift()!
    for (const d of adj.get(c)!) { tier.set(d, Math.max(tier.get(d)!, tier.get(c)! + 1)); left.set(d, left.get(d)! - 1); if (left.get(d) === 0) q.push(d) }
  }
  return new Map(nodes.map(n => [n.id, tier.get(comp.get(n.id)!) || 0])) // id -> tier
}
