# Session — CSS anchor positioning → node editor → AI-notebook research

Saved 2026-06-07. Colocated with `node-editor.html` (the artifact). Source demo lives at
`~/projects/claude-research/commands/reports/demos/node-editor.html`; a simpler static
variant (`anchor-node-editor.html`, 6 hardcoded nodes) is in that same `demos/` folder.

## Goal

Two arcs in one session:
1. Build a real, pure-CSS-edge node editor on **CSS Anchor Positioning**.
2. Survey the **AI-notebook / learn-by-doing** tool landscape, which circled back to the
   user's own `anim` + `sprefa/dl` repos.

## The node editor (`node-editor.html`)

Full-featured: pan/zoom (transform on `.world`), add/delete nodes, drag-to-connect,
delete edges, multi-port nodes, 4 opt-in flow-animation toggles.

**The core trick — edges in pure CSS, any direction:**

```css
.edge {
  position: absolute; z-index: 1; pointer-events: none;
  top:    min(anchor(var(--a) center), anchor(var(--b) center));
  left:   min(anchor(var(--a) center), anchor(var(--b) center));
  right:  min(anchor(var(--a) center), anchor(var(--b) center));
  bottom: min(anchor(var(--a) center), anchor(var(--b) center));
}
.edge.flip svg { transform: scaleY(-1); transform-origin: center; }
```

`min(anchor(--a center), anchor(--b center))` on all four insets = the bounding rectangle
of the two anchor points, in any direction. The SVG bezier fills that box
(`preserveAspectRatio="none"` + `vector-effect: non-scaling-stroke`); a JS `.flip` class
mirrors the diagonal. Flow animation = `stroke-dasharray`/`stroke-dashoffset`.

- **Drag-to-connect ghost wire:** a 1px `#cursor` element with `anchor-name: --cursor`,
  moved in world coords on pointermove. `--a` = source port, `--b` = `--cursor`. The ghost
  reuses the identical `anchor()` mechanism.
- **Pan/zoom:** transform the `.world`; anchors resolve in world space, so edges scale/tether
  correctly.
- **DOM-order invariant:** nodes appended before edges (anchor must precede the positioned
  element in tree order); z-index puts edges behind nodes.
- Eventing is hand-rolled pointer events + delegation (no jQuery).

**kizu.dev cross-check** (https://kizu.dev/anchor-positioning-experiments/): the editor's
edge is exactly Roman Komarov's #3 "Four Quadrants." His version handles the diagonal in
*pure CSS* (four pseudo-elements + scaleX/scaleY) instead of a JS `.flip`. Borrowable but
not yet ported — left as-is on purpose.

## Research thread (the other arc)

Full writeup: `~/projects/claude-research/commands/reports/llm-learning-tools.md`.

- **Lathe** (devenjarvis/lathe) = LLM tutorial generator, local reading UI, skill-invoked,
  verify-in-temp-dirs, provenance. "Teach you, rather than think for you."
- **Sizzle AI** = the half-remembered 2023 HN phone app (step-by-step STEM tutor). OSS
  alternatives: OATtor (hint-ladder), open-tutor-ai-CE (PWA), OpenTutor (local), tutor-gpt.
- **Indie AI notebooks**: marimo (reactive, AI sees live vars), srcbook (TS), jupyter-ai;
  builders Linus Lee / Geoffrey Litt / Amelia Wattenberger; NotebookLM-style docs-chat
  (open-notebook, KnowNote, SurfSense).
- **Notebooks vs dashboards**: notebook = authoring (live kernel, code-forward); dashboard =
  publishing (code hidden, inputs pinned). Convert = hide code + pin inputs + lay out.
  Reactive notebooks (marimo/Observable) already are the dataflow DAG → the line blurs.

## Convergence (noted, then parked)

`anim` (AI-authored animated explainer, AGENTS.md grammar, atlas panel) + `sprefa/v5 dl`
(reactive datalog over code → SQLite, `--watch`, `--query-json`, `--lsp`) together =
the "AI-native notebook + interactive sessions with docs," specialized to code. The
`sql-graph` seam already renders dl facts (`examples/dl-engine/`). **Decision: no wiring;
let `anim` and `dl` evolve independently.** Seam is there if/when wanted.

## CSS-as-graph-renderer boundary (relevant to anim's atlas)

CSS does **placement + wiring**, never **layout-over-edges** or **graph algorithms**.

- CSS owns: style, render nodes/edges (anchors), pan/zoom, hover/select, **grid layout**,
  **circle/concentric layout** (`sibling-index()`/`sibling-count()` + `sin()`/`cos()`,
  all shipped) — pure CSS, zero layout lib.
- CSS can't: dagre/ELK/fcose (edge-structure-dependent), neighborhood/cone (traversal),
  centrality/BFS/Dijkstra (no iterate/reduce over a node set).
- **Hybrid** = the good version: run ELK/dagre once → write `transform: translate(x,y)` →
  anchor-positioned edges re-tether for free → `transition: transform` animates the relayout.
  This is how Cytoscape itself is architected (cytoscape-dagre / cytoscape-elk extensions),
  and how `anim/src/AtlasPanel.jsx` already works (delegates layout to ELK).
- Punchline: `node-editor.html` **is** Cytoscape's render+interact layer in pure CSS;
  AtlasPanel **is** real Cytoscape. The missing half is the engine — which you'd never
  want in CSS anyway.

## Possible next steps (none committed)

- Port kizu's pure-CSS Four-Quadrants direction → delete the JS `.flip`.
- Auto-layout button on the editor: ELK or dagre → positions → CSS transition animates,
  edges follow. ("auto-layout" version of the dashoffset-on-move delight.)
- Pure-CSS circle/concentric layout demo (`sibling-index()` + anchor edges, no JS layout).

## Context files (re-read on resume)

- `~/projects/anim/css-anchor-node-editor/node-editor.html` (this folder)
- `~/projects/claude-research/commands/reports/demos/node-editor.html` (source)
- `~/projects/claude-research/commands/reports/demos/anchor-node-editor.html` (static variant)
- `~/projects/claude-research/commands/reports/llm-learning-tools.md` (research report)
- `~/projects/claude-research/skills/native-observable/SKILL.md`
- `~/projects/anim/AGENTS.md`, `~/projects/sprefa/v5/README.md`

## Turn-by-turn

- (LLM): mapped kizu techniques onto the node editor (Four Quadrants = the edge trick).
- (User): "are there more tools like devenjarvis/lathe" → researched the LLM-learning-tool niche.
- (User): "write all to markdown for later" → created `llm-learning-tools.md`.
- (User): "might've been sizzle, open source versions?" → OSS Sizzle alternatives table.
- (User): "indie blogs/repos, jupyter-like notebook with AI, docs" → indie-notebook section.
- (User): "are jupyter notebooks just dashboards?" → notebook-vs-dashboard breakdown (saved).
- (User): map (avant garde), then "look at ~/projects/anim and ~/projects/sprefa/v5".
- (LLM): mapped anim (authoring) × dl (kernel) convergence onto the report's empty cell.
- (User): "no wiring yet, let them evolve, i vibed the fuck out of anim" → deleted wiring plan, reframed convergence as observation.
- (User): "can we do dagre/elk with this?" → CSS placement-vs-layout split + hybrid.
- (User): "cytoscape with pure css haha" → render/interact CSS owns, engine never does.
- (User): "save node-editor and this session to a folder in anim" → this folder.
