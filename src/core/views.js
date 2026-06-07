// core/views.js — queries over a Model that produce Views (visible subsets).
// A View feeds the transition primitive. Cycle-safe (BFS, no infinite recursion).

export function buildAdj(model) {
  const out = new Map(), inc = new Map();
  for (const e of model.entities) { out.set(e.id, new Set()); inc.set(e.id, new Set()); }
  for (const e of model.edges) {
    (out.get(e.source) || out.set(e.source, new Set()).get(e.source)).add(e.target);
    (inc.get(e.target) || inc.set(e.target, new Set()).get(e.target)).add(e.source);
  }
  return { out, inc };
}

const reach = (adj, start) => {                 // transitive closure, cycle-safe
  const seen = new Set(), q = [start];
  while (q.length) { const v = q.shift(); for (const w of adj.get(v) || []) if (!seen.has(w)) { seen.add(w); q.push(w); } }
  seen.delete(start);
  return seen;
};
export const successors = (adj, id) => reach(adj.out, id);
export const predecessors = (adj, id) => reach(adj.inc, id);

// hop distance from focus: +n downstream (toward deps), -n upstream (toward callers)
export function hopDistances(adj, focus) {
  const dist = new Map([[focus, 0]]);
  let fr = [focus], d = 0;
  while (fr.length) { const nx = []; for (const n of fr) for (const m of adj.out.get(n) || []) if (!dist.has(m)) { dist.set(m, d + 1); nx.push(m); } fr = nx; d++; }
  let f2 = [focus], u = 0;
  while (f2.length) { const nx = []; for (const n of f2) for (const m of adj.inc.get(n) || []) if (!dist.has(m)) { dist.set(m, -(u + 1)); nx.push(m); } f2 = nx; u++; }
  return dist;
}

const edgesAmong = (model, idSet) =>
  new Set(model.edges.filter(e => idSet.has(e.source) && idSet.has(e.target)).map(e => e.id));

export function cone(model, focus, mode = 'cone', adj = buildAdj(model)) {
  const succ = successors(adj, focus), pred = predecessors(adj, focus);
  let ids;
  if (mode === 'neighbors') ids = new Set([focus, ...(adj.out.get(focus) || []), ...(adj.inc.get(focus) || [])]);
  else if (mode === 'downstream') ids = new Set([focus, ...succ]);
  else if (mode === 'upstream') ids = new Set([focus, ...pred]);
  else ids = new Set([focus, ...succ, ...pred]);
  return { entityIds: ids, edgeIds: edgesAmong(model, ids), focus };
}

export function pathFrontier(model, pathIds, step = pathIds.length - 1) {
  const ids = new Set(pathIds.slice(0, step + 1));
  const eids = new Set();
  for (const e of model.edges)
    for (let i = 0; i < step; i++) {
      const a = pathIds[i], b = pathIds[i + 1];
      if ((e.source === a && e.target === b) || (e.source === b && e.target === a)) eids.add(e.id);
    }
  return { entityIds: ids, edgeIds: eids, focus: pathIds[step] };
}

// the refs reachable in this view, per panel — what streams into fs/sql side panels.
export function reachableRefs(model, view, panel) {
  const out = [];
  for (const id of view.entityIds)
    for (const r of model.refs.get(id) || []) if (!panel || r.panel === panel) out.push({ id, ...r });
  return out;
}
