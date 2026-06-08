# anim — working on the atlas (orientation for any session)

`anim` turns markdown into an animated deck. The **atlas** is the interactive
right-panel renderer: the same model the deck draws statically, mounted as a live
cytoscape graph with derived side panels (fs/sql/api/...). To *author a deck*, read
`AGENTS.md` instead — this file is for working on the atlas *code*.

## Run

```
npm run dev          # vite dev server on http://localhost:5173/
npm run shoot:atlas  # playwright screenshots -> shots/atlas-*.png (dev server MUST be up)
npm run check        # build-frames in --check mode: compiler-style errors, fix in one pass
npm run build        # vite build (cytoscape-elk is a LAZY import — never static, it breaks rollup)
```

`shoot:atlas` is the verification gate: it steps to the atlas frame, captures
seed/focus/elk-layout/full-screen, and FAILS on any console error. Re-shoot after
every atlas change and read the PNG back before claiming done.

## Where things live

- `src/AtlasPanel.jsx` — the interactive renderer (cytoscape init, theme read,
  focus/cone lighting, the ref panels, toolbar). The main deliverable.
- `src/Frames.jsx` — the deck shell (markdown via `marked`, left code panel, slide nav).
- `src/core/` — framework-neutral shared model (no React/DOM), imported by both the
  static build and the atlas:
  - `model.js` build the entity/edge/ref model · `d2.js` parse d2 + `#` annotations
  - `tarjan.js` scc + `topoTiers` (longest-path layering, feeds the grid layout)
  - `views.js` cone / `reachableRefs` · `transition.js` constancy primitive (UNUSED by AtlasPanel yet)
  - `tree.js` flat refs -> nestable tree (`buildTree`, `toForest`, collapse single-child chains)
  - `panels.js` how each panel kind segments a locator -> tree path
  - `bus.js` event bus · `index.js` barrel
- `src/app.css` — `:root { --atlas-* }` is the SINGLE theme source. The canvas can't
  use `var()`; it reads tokens via `getComputedStyle` (`readTheme()` in AtlasPanel).
  DOM uses `var(--atlas-*)` directly. Change a color in one place.

## Extending it (the interfaces)

- **Add a panel kind**: push a `PanelSpec` (or `registerPanel`) in `core/panels.js`.
  `pathOf(locator) -> segments` is the only required hook; the renderer never names
  kinds (the panel set is derived from the `# ref <kind>` keys in the model).
- **Weight bar**: per-panel, opt-in via `PanelSpec.bar` (a `BarConfig`). `weight(node)
  -> number` is pluggable (default = leaf count; LOC/churn/coverage later). `toForest`
  attaches `share`/`offset` (cumulative). UI select: `bar: off | rows | stacked`.
- **Annotations** (in the d2 source, parsed by `d2.js`): `# @ id : note`,
  `# src id = path:line`, `# ref <panel> id = locator`, `# tag`, `# diff`,
  `# view focus=.. mode=.. layout=.. dir=.. iso`.

## Invariants (do not regress)

- **Weight bar left origin = the row's content indent** (`--indent` from arborist
  `paddingLeft`), never the panel's absolute left. Right edge is the fixed origin
  (gradient `to left`). Applies to both `rows` and `stacked` modes. Do not set
  `.trow-bar { left: 0 }`.
- **Theme is one source**: `:root --atlas-*`. No hardcoded hexes in AtlasPanel; read
  via `readTheme()`.
- **ELK is lazy**: `import('cytoscape-elk')` on first use only. A static import breaks
  `vite build`.
