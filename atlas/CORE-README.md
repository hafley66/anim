# core/

Framework-neutral graph model shared by the atlas (cytoscape) and anim (SVG). No DOM,
no cytoscape, no React in here. Renderers import these and supply their own hooks.

```
model.js       Entity / Ref / Edge / View / Model + builders (the LEFT table)
d2.js          d2 text (+ # annotations) -> Model   (WASM compile, mini-parser fallback)
tarjan.js      scc() -> {cyclic, comp, components}; topoTiers() -> id->tier
views.js       buildAdj, successors/predecessors, hopDistances, cone, pathFrontier, reachableRefs
transition.js  diff / runTransition / transitionViews / transitionRefs  (the constancy primitive)
bus.js         Bus extends EventTarget: emit/on for 'select' | 'view' | 'hover'
index.js       barrel
```

## Usage

```js
import { buildModel, loadD2 } from './core/d2.js';
import { buildAdj, cone, pathFrontier, reachableRefs } from './core/views.js';
import { transitionViews } from './core/transition.js';

const D2 = await loadD2();                      // omit to use the mini-parser
const model = await buildModel(d2text, { D2, tours });
const adj = buildAdj(model);

let view = cone(model, 'net.ip', 'downstream', adj);
// later, on a tour step:
const next = pathFrontier(model, ['net.ip','net.route','net.nexthop'], step);
transitionViews(view, next, {                   // every kept node is the SAME element, gliding
  enterNode: id => renderer.add(id),            // born: opacity 0 -> 1 from container
  moveNode:  id => renderer.keep(id),           // never recreated
  exitNode:  id => renderer.fadeRemove(id),     // removed only after the fade
  layout:    ids => renderer.layout(ids),       // one animated layout over kept+born
});
view = next;
// side panels get their slice:
const files = reachableRefs(model, next, 'fs'); // -> [{id, panel:'fs', locator:'path:line'}]
```

The same `transitionRefs(prevFiles, nextFiles, hooks)` drives the fs/sql row FLIP, keyed on
locator. One diff, many renderers. Nothing flickers because `keep` elements are never
destroyed and recreated.

## Libraries to leverage or explore

Grouped by the job. Pick = what fits this stack (vanilla core, React/Vite anim, RxJS-leaning author).

### Graph data structure + algorithms
- **graphology** — robust graph type + a big algorithm pack (SCC, traversal, metrics, layouts).
  Could back `views.js`/`tarjan.js` instead of hand-rolled adjacency. Strong candidate; keeps
  our code to glue. Pairs with `graphology-layout-forceatlas2`, `graphology-traversal`.
- **ngraph** — very fast graph + pathfinding, minimal. Alternative to graphology if perf bites.

### Interactive render + layout (the atlas side)
- **cytoscape** (current) + plugins:
  - layout: `cytoscape-dagre` (tiers, current), `cytoscape-fcose` (best general force layout),
    `cytoscape-elk` (orthogonal, layered), `cytoscape-cola` (constraint/online).
  - `cytoscape-expand-collapse` — compound containers collapse/expand. This is the bridge to
    the fs tree: a folder is one collapsed node in the graph, open rows in the panel, same ids.
  - `cytoscape-node-html-label` — real HTML inside nodes (rich annotations, not just text).
  - `cytoscape-popper` (+ floating-ui/tippy) — detail popovers anchored to nodes/edges.
  - `cytoscape-layers` / `cytoscape-canvas` — custom overlay layers (leaders, halos, heat).
  - `cytoscape-automove` — pin nodes relative to others (keep clusters together on drag).
  - `cytoscape-navigator` — minimap for big graphs. `cytoscape-view-utilities` — save/restore.
  - `cytoscape-edgehandles` — interactive edge drawing (graph editing). `cytoscape-undo-redo`.
  - `cytoscape-context-menus` — right-click actions.
- Alternatives to cytoscape if you ever want them: **sigma.js** (WebGL, huge graphs, on
  graphology), **reaflow / @xyflow (React Flow)** (React-native node editor), **vis-network**.

### Layout / SVG diagramming (the anim side, declarative)
- **d2** (`@terrastruct/d2` WASM) — current source language. Imports, vars, classes, themes.
- **elkjs** — layered/orthogonal layout engine, standalone (no d2). Good if you want layout
  without a DSL. **dagre** — simpler layered. **@hpcc-js/wasm** (graphviz) — dot layout in wasm.
- **mermaid** — if you want a second author syntax besides d2.

### Animation / constancy (the no-flicker requirement)
- **Web Animations API** — built-in, enough for opacity/transform tweens; no dep.
- **Motion One** (`motion`) — tiny WAAPI wrapper, spring + timeline. Good default for `enter/exit`.
- **GSAP** + **Flip plugin** — the gold standard for "record state A, state B, tween the delta"
  (exactly our `keep` move). Heavier, commercial-ish license; reach for it if WAAPI gets fiddly.
- **@formkit/auto-animate** — drop-in list/tree FLIP; cheapest win for the fs/sql panels.
- **Framer Motion** (`motion/react`) — `layout` + `layoutId` shared-element transitions if the
  panels become React. **react-flip-toolkit** — FLIP for React lists/grids.
- anim already uses **shiki-magic-move** for code token tweening; keep it for the code panel.

### Resizable multi-panel shell (the "multiple sidebars")
- **react-resizable-panels** — simple resizable/collapsible panes, React. Likely pick for anim.
- **allotment** — VS Code-style split views, React. **react-mosaic** — draggable tiling.
- **dockview / golden-layout** — full docking (drag tabs, float). Bigger; if you want IDE feel.
- **split.js** — framework-neutral resizable gutters (works with the vanilla atlas too).

### State / event bus (you prefer RxJS)
- **RxJS** — make the Bus a `Subject`; `select$`, `view$`, `hover$` as streams. `combineLatest`
  the selection with the model to derive each panel's View; `distinctUntilChanged` kills
  redundant transitions; `animationFrameScheduler` paces them. Best fit for your background.
- Lighter if you ever want it: **nanostores** (tiny, framework-agnostic atoms), **zustand**,
  **valtio** (proxy state). The core stays bus-agnostic; swap freely.

### SQL panel (someday)
- **sql.js** — SQLite compiled to wasm, runs the same `sql-graph` queries in the browser that
  anim runs at build time. **@sqlite.org/sqlite-wasm** (official) — OPFS-backed, persistent.
  **duckdb-wasm** — if queries get analytical. Map query rows -> Entity/Ref, same model.

### FS panel
- **react-arborist** or **react-complex-tree** — virtualized tree with DnD, selection,
  keyboard nav, FLIP-friendly. Beats hand-rolling the sidebar tree if it grows.

### List/tree virtualization (large panels)
- **`content-visibility: auto`** + **`contain-intrinsic-size`** — native CSS. Skips offscreen
  layout/paint, keeps all DOM (a11y + find-in-page survive). Default for up to ~5-10k rows.
- **TanStack Virtual** / **virtua** — JS windowing that unmounts offscreen rows; reach for
  10k+ rows or when you cannot mount all DOM. Note: it unmounts offscreen rows, so the
  transitionRefs enter/exit only animates the visible window (correct: offscreen tweens are unseen).

### Recommended starting set
graphology (model algos) + cytoscape & fcose/expand-collapse/popper (atlas render) + Motion One
or auto-animate (constancy) + react-resizable-panels (shell) + RxJS (bus) + sql.js (later).
Everything else is opt-in.
