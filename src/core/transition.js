// core/transition.js — the animation-constancy primitive. Renderer-agnostic.
// Computes {keep, enter, exit} on stable keys and calls caller-supplied hooks.
// The CONTRACT: a `keep` element is the same object before and after — never
// recreated. That is what stops "soup of rects A -> soup of rects B" flicker.
// cytoscape, SVG, fs-rows, sql-rows each supply their own enter/move/exit hooks.

export function diff(prev, next) {
  const P = prev instanceof Set ? prev : new Set(prev || []);
  const N = next instanceof Set ? next : new Set(next || []);
  const keep = new Set(), enter = new Set(), exit = new Set();
  for (const x of N) (P.has(x) ? keep : enter).add(x);
  for (const x of P) if (!N.has(x)) exit.add(x);
  return { keep, enter, exit };
}

// apply a keyed diff through hooks. enter first (born), then move (kept), then exit.
export function runTransition({ prev, next, enter = () => {}, move = () => {}, exit = () => {}, done }) {
  const d = diff(prev, next);
  for (const id of d.enter) enter(id);
  for (const id of d.keep) move(id);
  for (const id of d.exit) exit(id);
  done?.(d);
  return d;
}

// view-level: diff nodes and edges together so both tween, not just nodes.
export function transitionViews(prevView, nextView, hooks = {}) {
  const nodes = runTransition({
    prev: prevView && prevView.entityIds, next: nextView.entityIds,
    enter: hooks.enterNode, move: hooks.moveNode, exit: hooks.exitNode,
  });
  const edges = runTransition({
    prev: prevView && prevView.edgeIds, next: nextView.edgeIds,
    enter: hooks.enterEdge, move: hooks.moveEdge, exit: hooks.exitEdge,
  });
  hooks.layout?.(new Set([...nodes.keep, ...nodes.enter]));  // one animated layout over kept+born
  hooks.done?.({ nodes, edges });
  return { nodes, edges };
}

// panel-level: diff a list of refs by a stable locator key (file path, table:pk, token).
export function transitionRefs(prevRefs, nextRefs, hooks = {}, key = r => r.panel + ':' + r.locator) {
  const prev = new Map((prevRefs || []).map(r => [key(r), r]));
  const next = new Map((nextRefs || []).map(r => [key(r), r]));
  return runTransition({
    prev: new Set(prev.keys()), next: new Set(next.keys()),
    enter: k => hooks.enter?.(next.get(k)),
    move: k => hooks.move?.(next.get(k), prev.get(k)),
    exit: k => hooks.exit?.(prev.get(k)),
    done: hooks.done,
  });
}
