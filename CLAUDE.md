# anim — working on the atlas (orientation for any session)

`anim` turns markdown into an animated deck. The **atlas** is the interactive
right-panel renderer: the same model the deck draws statically, mounted as a live
cytoscape graph with derived side panels (fs/sql/api/...). To *author a deck*, read
`AGENTS.md` instead — this file is for working on the atlas *code*.

## Run

```
npm run dev          # vite dev server on http://localhost:5173/
npm run typecheck    # tsgo --noEmit over ALL of src (renderers are .tsx) + e2e, strict
npm test             # vitest: src/core/*.test.ts (atlas/core is a symlink — vitest.config.ts scopes the include)
npm run test:e2e     # playwright e2e (e2e/atlas.spec.ts; auto-starts/reuses the dev server)
npm run shoot:atlas  # playwright screenshots -> shots/atlas-*.png (dev server MUST be up)
npm run check        # build-frames in --check mode: compiler-style errors, fix in one pass
npm run build        # vite build (cytoscape-elk is a LAZY import — never static, it breaks rollup)
```

`shoot:atlas` is the verification gate: it steps to the atlas frame, captures
seed/focus/elk-layout/full-screen, and FAILS on any console error. Re-shoot after
every atlas change and read the PNG back before claiming done.

## Where things live

- `src/AtlasPanel.tsx` — the interactive renderer, an ADAPTER over core: every
  view/selection/step is computed purely in core and applied through cytoscape
  hooks. select() takes a focus SET (shift/cmd-click grows it). `window.__atlas`
  is the e2e hook. Named tours (model `# tour` lines + legacy prop) get ▶ buttons;
  a span step opens CodeSpotlight over the graph. Two model sources: `d2` text
  (runtime compile) or `rows` (RelRows embedded by the build's `atlas-db` fence
  -> core modelFromRows; the browser never opens a database).
- `src/CodeSpotlight.tsx` — the document surface for span tour steps: file stays
  resident, the band top/height CSS-transitions between ranges (the FLIP), scroll
  eases to center it. Geometry from core/spotlight.ts; its LINE_H (18px) must
  equal `.spotlight-pre` line-height. File text arrives via the `doc: <path>`
  deck directive (build-frames inlines it into f.docs; the path as written is
  the docs key and must match the tour target's file).
- `src/Frames.tsx` — the deck shell (markdown via `marked`, left code panel, slide nav).
  Also hosts the **Periscope** dock (screen edge, fixed): hover an ident (prose
  `.natlas` span or a graph node) and AtlasPanel answers over the bus
  (`PERISCOPE` event) with the ident's fs refs (`identRefs` in core/views.ts);
  kept rows FLIP, entering rows draw on with an index-staggered connector.
  e2e hook: `window.__peri`.
- `src/core/` — framework-neutral shared model, TypeScript (strict, checked by
  tsgo), imported by both the static build and the atlas:
  - `model.ts` Entity/Edge/View/Model + Target/Tour types (Target, NOT Subject — RxJS owns Subject)
  - `annotations.ts` all `#` comment parsing (`# @ / tag / diff / ref / src / step / tour / view`)
  - `tour.ts` THE sequencing concept: tourFromSteps/tourFromSequence/toursFromRows/tourView
  - `d2.ts` d2 text -> Model (attaches tours + seed) · `rows.ts` rel_* rows -> Model (sqlite loader, driver-agnostic)
  - `tarjan.ts` scc + `topoTiers` · `layout.ts` tierCells/gridCell · `metrics.ts` betweenness heat
  - `views.ts` cone(focus[]) / fullView / detailFor / `reachableRefs` · `transition.ts` constancy primitive (WIRED: round player + FsTree)
  - `codec.ts` ?av= payload ('+'-joined focus sets) + parseTarget (tour_step target string -> Target)
  - `spotlight.ts` span -> highlight band + scroll target (pure math behind CodeSpotlight.tsx)
  - `tree.ts` flat refs -> nestable tree + `explorerRows` (fs lens rows)
  - `panels.ts` how each panel kind segments a locator -> tree path
  - `bus.ts` event bus · `index.ts` barrel
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
