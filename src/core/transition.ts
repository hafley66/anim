// core/transition.ts — the animation-constancy primitive. Renderer-agnostic.
// Computes {keep, enter, exit} on stable keys and calls caller-supplied hooks.
// The CONTRACT: a `keep` element is the same object before and after — never
// recreated. That is what stops "soup of rects A -> soup of rects B" flicker.
// cytoscape, SVG, fs-rows, sql-rows each supply their own enter/move/exit hooks.

import type { RefRow, View } from './model'

export type Diff = { keep: Set<string>; enter: Set<string>; exit: Set<string> }

export function diff(prev?: Iterable<string> | null, next?: Iterable<string> | null): Diff {
  const P = prev instanceof Set ? prev : new Set(prev || [])
  const N = next instanceof Set ? next : new Set(next || [])
  const keep = new Set<string>(), enter = new Set<string>(), exit = new Set<string>()
  for (const x of N) (P.has(x) ? keep : enter).add(x)
  for (const x of P) if (!N.has(x)) exit.add(x)
  return { keep, enter, exit }
}

export type RunHooks = {
  prev?: Iterable<string> | null
  next?: Iterable<string> | null
  enter?: (id: string) => void
  move?: (id: string) => void
  exit?: (id: string) => void
  done?: (d: Diff) => void
}

// apply a keyed diff through hooks. enter first (born), then move (kept), then exit.
export function runTransition({ prev, next, enter = () => {}, move = () => {}, exit = () => {}, done }: RunHooks): Diff {
  const d = diff(prev, next)
  for (const id of d.enter) enter(id)
  for (const id of d.keep) move(id)
  for (const id of d.exit) exit(id)
  done?.(d)
  return d
}

export type ViewHooks = {
  enterNode?: (id: string) => void
  moveNode?: (id: string) => void
  exitNode?: (id: string) => void
  enterEdge?: (id: string) => void
  moveEdge?: (id: string) => void
  exitEdge?: (id: string) => void
  layout?: (visible: Set<string>) => void
  done?: (d: { nodes: Diff; edges: Diff }) => void
}

// view-level: diff nodes and edges together so both tween, not just nodes.
export function transitionViews(prevView: View | null | undefined, nextView: View, hooks: ViewHooks = {}): { nodes: Diff; edges: Diff } {
  const nodes = runTransition({
    prev: prevView && prevView.entityIds, next: nextView.entityIds,
    enter: hooks.enterNode, move: hooks.moveNode, exit: hooks.exitNode,
  })
  const edges = runTransition({
    prev: prevView && prevView.edgeIds, next: nextView.edgeIds,
    enter: hooks.enterEdge, move: hooks.moveEdge, exit: hooks.exitEdge,
  })
  hooks.layout?.(new Set([...nodes.keep, ...nodes.enter]))  // one animated layout over kept+born
  hooks.done?.({ nodes, edges })
  return { nodes, edges }
}

export type RefHooks = {
  enter?: (next: RefRow) => void
  move?: (next: RefRow, prev: RefRow) => void
  exit?: (prev: RefRow) => void
  done?: (d: Diff) => void
}

// panel-level: diff a list of refs by a stable locator key (file path, table:pk, token).
export function transitionRefs(
  prevRefs: RefRow[] | null | undefined,
  nextRefs: RefRow[] | null | undefined,
  hooks: RefHooks = {},
  key: (r: RefRow) => string = r => r.panel + ':' + r.locator,
): Diff {
  const prev = new Map((prevRefs || []).map(r => [key(r), r]))
  const next = new Map((nextRefs || []).map(r => [key(r), r]))
  return runTransition({
    prev: new Set(prev.keys()), next: new Set(next.keys()),
    enter: k => hooks.enter?.(next.get(k)!),
    move: k => hooks.move?.(next.get(k)!, prev.get(k)!),
    exit: k => hooks.exit?.(prev.get(k)!),
    done: hooks.done,
  })
}
