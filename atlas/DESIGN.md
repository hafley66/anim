# atlas x anim: the join design

Status: design only. Build later, starting from `core/` extraction.

## The one idea

A stable entity `id` is three things at once:

1. the **join key** (graph node = fs row = sql row = code token, matched by id),
2. the **animation key** (an entity that persists across two views is tweened, never
   destroyed and recreated), and
3. the **address** in every panel (each panel resolves id to its own locator via a Ref).

anim (linear narration, FLIP-tweened SVG) and the atlas (free exploration, cytoscape)
are two renderers over one model. They agree on ids. That agreement is the left join.

## The model (the left table)

```
Entity = { id, label, kind, container, tags[] }        // the node; LEFT side of every join
Ref    = { panel, locator }                            // entity LEFT JOIN <panel> ON id
Edge   = { source, target, label, kind }
View   = { entityIds: Set, edgeIds: Set, focus?, note? } // a visible subset = a query result
Model  = { entities, edges, refs: Map<id, Ref[]>, tours }
```

A panel shows a row for entity `e` only if `refs[e.id]` has a locator for that panel.
No ref = null = the row is absent (or dark). Per-panel left join, literally.

## Animation constancy (the no-flicker contract)

Never `remove()` then `add()` a whole graph. That is the "soup of rects A to soup of
rects B" flicker. Every transition is a keyed diff:

```
transition(prev: View, next: View):
  keep  = prev.entityIds ∩ next.entityIds     // exist in both -> glide pos + cross-fade style
  enter = next.entityIds \ prev.entityIds      // new       -> add hidden, then opacity 0->1
  exit  = prev.entityIds \ next.entityIds       // gone       -> opacity 1->0, remove ONLY in ondone

  1. add `enter` nodes at opacity 0 (provisional position = their container centroid)
  2. run ONE layout over keep ∪ enter with {animate:true, duration D}; keep nodes slide
  3. in parallel: tween enter opacity 0->1 (optionally scale up from centroid)
  4. tween exit opacity 1->0 then remove() in the completion callback
```

Invariants:
- A `keep` entity's DOM/cytoscape element is the same object before and after. Identity
  is never broken, so the eye tracks it.
- `enter`/`exit` grow/shrink from/toward their container so motion has an origin.
- One layout call, animated, never a re-layout that snaps.

The SAME `{keep, enter, exit}` sets drive every panel. Project each set through `refs`
for that panel and the fs/sql rows FLIP with the identical enter/move/exit. One diff,
many renderers. anim already FLIPs fs rows; this is that, generalized and shared.

## Reachable-refs-along-a-path

A View is produced by a query over the model:

```
cone(focus, mode)            -> View   (successors / predecessors / both)
pathFrontier(tour, step)     -> View   (the chain up to the current step)
reachableRefs(view, panel)   -> Ref[]  (flatMap view.entityIds through refs[id], for panel)
```

Walking a tour advances the frontier. Each step:
- the graph runs `transition(prevView, stepView)` (constant, no flicker), and
- each side panel runs `transition` over `reachableRefs(prevView, panel)` ->
  `reachableRefs(stepView, panel)`, so the fs panel animates IN exactly the files newly
  reachable at this step and animates OUT the ones left behind.

So "interactive graph where the refs reachable at this path light up, and the fs panel
shows anims for the new references/facts from that view" falls out of one primitive:
`transition` over stable ids, fed by `reachableRefs`.

## Library leverage (cytoscape ecosystem)

Lean on the ecosystem; do not hand-roll what a plugin does.

| need | plugin |
| --- | --- |
| layouts | `cytoscape-dagre`, `cytoscape-fcose`, `cytoscape-elk`, `cytoscape-cola` |
| animated layout / constancy | core `layout({animate, animationDuration})` + `ele.animate()` |
| containers = fs folders, collapse | `cytoscape-expand-collapse` (compound nodes) |
| rich annotations in-node | `cytoscape-node-html-label` |
| anchored tooltips / detail popovers | `cytoscape-popper` (+ tippy) |
| custom overlays (leaders, halos) | `cytoscape-layers` / `cytoscape-canvas` |
| keep relative positions pinned | `cytoscape-automove` |
| minimap for big graphs | `cytoscape-navigator` |
| interactive edge authoring | `cytoscape-edgehandles` |
| right-click actions | `cytoscape-context-menus` |
| undo/redo of edits | `cytoscape-undo-redo` |
| viewport save/restore | `cytoscape-view-utilities` |

Compound nodes (expand-collapse) are the bridge to the fs tree: a container collapses to
one node in the graph while its folder stays open in the panel, both keyed on the same id.

## core/ (extract this first; both apps import it)

```
core/
  model.js        Entity / Ref / Edge / View / Model types + builders
  d2.js           d2 text (+ # annotations) -> Model        (WASM compile, mini fallback)
  tarjan.js       SCC -> cyclic id set + component map        (dedupe: anim + atlas share)
  views.js        cone(), pathFrontier(), reachableRefs()
  transition.js   transition(prev, next, applyEnter, applyMove, applyExit)  // renderer-agnostic
  bus.js          EventTarget: emit/on 'select' | 'view'      // vanilla + React both speak it
```

`transition.js` knows nothing about cytoscape or the DOM. It computes `{keep, enter, exit}`
and calls renderer-supplied hooks. The atlas supplies cytoscape hooks; anim supplies SVG
hooks; the fs panel supplies row hooks. Constancy is defined once, used everywhere.

## Hosts and migration

- anim is the natural shell (React + Vite + Shiki + read-only sqlite already there).
- atlas rides in as a `<graph-atlas>` panel (web component; React mounts it via ref), or
  after `core/` extraction as a native cytoscape panel sharing the Bus.
- Panels (`{ id, title, side, mount(host, bus) }`) sit in a resizable multi-pane shell, all
  on one Bus. Selecting an entity in any panel transitions every other panel.
- "Left join again at work": drop `core/` + the shell into the work repo, point `refs` at
  work's fs / sql / api. The model and the constancy primitive do not change.

## Open questions

- anim renders d2 to SVG at build time; the atlas renders cytoscape at runtime. Either keep
  both renderers (share data only) or move anim's graph panel to runtime cytoscape so the
  constancy primitive covers narration too. The second unifies more but changes anim's build.
- Edge identity for parallel edges (already fixed in atlas via `src>>dst#index`); the shared
  model must keep edge ids stable across views for edges to tween, not just nodes.
