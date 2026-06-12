# anim design model (captured 2026-06-12 outpour)

One sentence: keyed graph states + tours over them, rendered as animated diffs.
Every use case below is that primitive with a different subject kind.

## The contract: a relational schema in sqlite

```
# the graph — one node set; constancy comes from these keys
rel node(id: text, kind: text, label: text).         # kind: type | file | card | concept | ...
rel edge(id: text, f: text, t: text, kind: text).

# multi-clustering: a node belongs to many groupings; a grouping is a tag namespace
rel tag(node: text, ns: text, value: text).           # ns="layer", ns="audience", ns="hub"

# tours: sequenced walks with per-step per-scenario commentary
rel tour(id: text, title: text).
rel tour_step(tour: text, seq: int, target: text, comment: text).
#   target is '+'-joined node ids (a multi-focus set) OR a byte span
#   "file:lo..hi" — the two target kinds, total. (Named target, not subject:
#   RxJS owns Subject.)

# cards are nodes (prose lives in the graph, animates with it)
rel card(id: text, body: text).
rel card_about(card: text, node: text).

# named camera/filter states
rel view(id: text, focus: text, mode: text, layout: text).
```

Transport: sqlite `rel_*` tables. anim's sql-graph fences already read these at
render time. The gen()-into-markdown-markers path remains for human-readable
decks but is not the integration spine.

## Producers and consumers

```
producers                          consumers
---------                          ---------
dl (sprefa v5): code facts    ->   web: deck / atlas / <atlas-graph> embed   [exists]
d2 + # annotations (d2.js)    ->   VS Code hover/webview ext                 [thin]
hand-written facts in .dl     ->   LSP server (tower-lsp, SELECT per method) [thin]
AI emitting tour_step rows    ->   egui binary in v5 ("dl ui", rusqlite)     [native path]
```

dl fact coverage: module_import + ref spine + type_edge for rust/kotlin.
Gap: JS/TS producer (oxc) — the one missing producer for work-shaped codebases.

## Animation model

d3-join generalized: `diff(prev, next) -> {keep, enter, exit}` on stable keys.
- exit: fade/collapse  ·  keep: FLIP move  ·  enter: draw-on / scale-from-parent
- `core/transition.js` implements this (diff, runTransition, transitionViews,
  transitionRefs). 52 lines, renderer-agnostic, currently imported by nothing.
- Immediate-mode port (egui) is simpler, not harder: re-derive frame from
  state + eased t per paint.

## Rendering: resolved

cytoscape canvas for the overview + DOM overlay (cytoscape-dom-node /
node-html-label) for rich nodes near focus. Level-of-detail per node, keyed by
distance-from-focus. DOM residency pain and canvas pizazz limits both dissolve.
egui is a second consumer of the same rows, not a rival.

## Audit (2026-06-12, corrected after the core refactor)

The first pass of this table claimed `# step`/`# view` were never parsed —
wrong: they were parsed and played, but inside AtlasPanel.jsx (renderer-trapped
pure logic), and a separate legacy `tours` prop coexisted. The 2026-06-12 core
refactor (TypeScript via tsgo) extracted all of it:

| piece | state now |
|---|---|
| core (all .ts, tsgo strict) | model · annotations · tour · views · layout · metrics · codec · rows · transition · tree · panels · bus · d2 |
| `# step` / `# view` | parsed in core/annotations.ts; `# step` becomes model.tours[0] (a reveal Tour), `# view` becomes model.seed |
| Tour (core/tour.ts) | THE sequencing concept: Target = focus[] / reveal[] / path / span; tourFromSteps + tourFromSequence converge the old mechanisms; tourView -> View |
| transition.ts | wired: the round player + FsTree exit set go through diff/transitionViews |
| cone (core/views.ts) | multi-focus base case (NodeId[]); AtlasPanel select() consumes it; shift/cmd-click grows the set |
| codec.ts | ?av= payload incl. '+'-joined focus sets |
| rows.ts | modelFromRows: the sqlite/rel_* loader, driver-agnostic. WIRED end-to-end (2026-06-12): the `atlas-db <db>` fence embeds rel_* rows at build time (bin/build-frames rowsFromDb), AtlasPanel renders them (`rows` prop), and anim-deck.dl derives/authors the rows (`ref` is dl-reserved -> table is rel_node_ref; a view row id 'seed' pins the opening view) |
| tests | vitest unit suites on core + playwright e2e (mount/rounds/cone/multi/elk/?av=) |

## Specced reps

### 1. Tour player — DONE (2026-06-12)

Lives in core/tour.ts + AtlasPanel applyView/setStepTo/select. Round player
visibility routes through transitionViews; `.step-new` rings each round's
reveal set; captions come from TourStep.comment.

### 2. Code spotlight panel (target kind: span) — DONE (2026-06-12)

Multi-file code-surfer with constancy: file stays resident, highlight FLIPs
between ranges, scroll eases. Coordinates come from the ref spine
(`ref(id, ident, file, lo, hi)`). Landed as:
- core/spotlight.ts: clampSpan/bandFor/scrollFor (pure band + scroll math; lo..hi
  are 1-based inclusive lines)
- parseTarget moved to codec.ts (one string codec for rel tour_step.target and
  the `# tour` annotation); toursFromRows in tour.ts shared by rows.ts and d2.ts
- `# tour <name> <seq> = <target> [: <comment>]` annotation -> named model tours
- CodeSpotlight.jsx docked over .atlas-graph; AtlasPanel stepTour routes span
  steps there (graph view untouched); `doc:` deck directive inlines file text
  into f.docs at build time
Use cases: PR/AI-session explainer (AI emits span-anchored tour_step rows —
claims are mechanically checkable, prose capped at comment).

### 3. Periscope (hover -> refs-in-fs) — DONE (2026-06-12)

HOVER(ident) [atlasBus] -> resolveIdent/identRefs (core/views.ts: id|label|lastSeg,
case-insensitive, fs panel) -> PERISCOPE bus event ({ident, rows}|null) -> the
Periscope dock in Frames.jsx (fixed, screen edge). Kept rows FLIP (flipRows);
entering rows + connector draw on with an index stagger (`--i` ->
animation-delay). AtlasPanel emits from both hover sources: the prose HOVER
listener and cy node mouseover/mouseout. Frame change and hover-out clear it.
e2e hook: window.__peri { hover(tok), state() }.

## Use-case ledger (subject kind per row)

| use case | subject | tour author |
|---|---|---|
| PR / AI session explainer | span | AI emits rows while working |
| book/textbook material | concept node + span | hand or one reviewed pass |
| graph explore | node | none (free-roam) |
| big markdown -> slides | heading/section | derived from heading tree |
| doc daemon | span + comment facts | dl rules; dl --watch + vite HMR |
| find-refs / periscope | ident -> files | none (query) |
| counting decks (4 ways etc.) | concept nodes | hand; aggregates = sum/product rules |
| per-audience multiplicity | any | tag ns="audience" + tour per audience |

## Why deterministic when tokens get cheap

- latency floor: hover/keystroke/save frequency needs index lookups, not inference
- checkability: --move edits are verifiable by construction; model edits queue on
  human review, which is the remaining bottleneck
- slop control: AI output constrained to rows referencing real spans is diffable
  against the db; free-generated prose is not (cf. book-supplements drift)

## Open

- oxc JS/TS producer in dl
- one-world-per-deck vs adjacency lint (anim backlog, still unchosen)
- native d2 syntax migration; per-fence d2 compile errors in npm run check
- css-anchor-node-editor/ experiment: fold its anchoring findings into the DOM
  overlay layer when reps 1–3 land
