# Authoring a deck (for AIs)

This is the complete grammar for writing an `anim` deck. You write markdown; the
build turns it into an animated slideshow. After writing, run `npm run check` — it
prints compiler-style errors you can fix in one pass.

## The model

- One **deck** = the folder `src/deck/`. Each `.md` file is a **chapter** (its name,
  minus the number prefix, is the breadcrumb). Files load in sorted order, so
  number them: `01-intro.md`, `02-…`. A single `src/frames.md` also works.
- One `## ` heading = one **frame** (one slide, one idea).
- A frame = prose + an optional **left panel** (code) + an optional **right panel**
  (graph OR file tree — not both). Anything can be omitted; prose-only is fine.
- Stepping animates: same-key things slide, new fade in, gone fade out. Keep
  adjacent frames *similar* so the diff reads as motion.

## Frame skeleton

```markdown
## the frame title

Narration prose. Real markdown: **bold**, lists, `inline code`, [links](url),
tables, > quotes. Use [[another frame title]] to cross-link (builds the `m` map).

```rust
fn main() { run(); }
```
```

## Left panel — code

A fenced block with a language info-string. The next frame's block **tweens** from
this one, token by token. Make small deltas between consecutive frames.

Pull from a real file instead of pasting (never drifts):

```markdown
code: ../src/scc.rs#L63-71 as rust
```

Path is relative to the repo root. Line range and `as <lang>` are optional.

## Right panel — graph (hand-drawn)

A [d2](https://d2lang.com) block. Name it so later frames can reuse it.

````markdown
```d2 pipeline
read -> parse
parse -> build
build -> read
```
````

- **Cycles auto-color** (a Tarjan pass tints loop nodes). Never style a loop by
  hand. Opt out with a `# noautocolor` line in the block.
- Reuse it later with a `graph: pipeline` line (no fence).
- A **node vocabulary** (`src/kit.d2`) is prepended to every graph. Tag a node
  instead of styling it: `myNode.class: hub`. Classes: `fn`, `relation`, `type`,
  `module`, `sink`, `dead`, `hub`, `ghost`. (Edit `src/kit.d2` to change them.)

## Right panel — interactive atlas

Same d2 grammar, but as an `atlas` block: the panel becomes a **live cytoscape
graph** the reader explores (instead of a static drawn-on SVG). Click a node →
its **cone** (everything it reaches); the layout is fixed, only the subset fades,
so nothing flickers.

````markdown
```atlas netstack
net.ip -> net.route
net.route -> net.nexthop

# @ net.route : RIB lookup, longest-prefix match
# src net.route = frr/zebra/zebra_rib.c:120
# ref sql net.route = routes:dest=10.0.0.0/8
# ref api net.nexthop = GET /v1/nexthops/{id}
```
````

- `# @ id : text` annotates a node (shows in the detail panel).
- `# src id = path:line` and `# ref <panel> id = locator` give a node a per-panel
  **address**. As nodes come into the cone, their addresses stream into that panel.
  `# src` is the fs shorthand. Built-in panels: `fs` (path), `sql` (`table:pred`,
  `db.table.col`), `api` (`GET /v1/x/{id}`), `url` (a sitemap), `code` (`pkg.mod.sym`).
  Any other `<panel>` key works too — it gets a default `/`-split panel. Each panel
  renders its locators as a **collapsible file-tree** (folders, twisties, counts);
  segmentation per kind lives in `src/core/panels.js`, the builder in `src/core/tree.js`.
- `# tag id : hub,sink` styles a node by category (hub/sink/dead/ghost + fn/type/
  module/relation). `# diff add|del|mod id` tints add/del/mod. Cycles auto-color.
- d2 **containers** (`net: L3 { ip; route }`) render as compound boxes you can lay out.
- **Pin the slice** the slide opens on with one comment:
  `# view focus=net.nexthop mode=cone layout=elk dir=LR iso`
  (mode = cone|neighbors|downstream|upstream; layout = dagre|elk|tree|rings|force|grid;
  dir = TB|LR|BT|RL). The reader hits **⤢ expand** to open the same picture full-screen
  with every knob (layout, direction, cone mode, isolate, tooltips), Esc to collapse.
- Backed by `src/core/` (the shared model) + `src/AtlasPanel.jsx`. The static
  graph and the atlas are two renderers over one model; the node id is the join
  key. One frame uses one right panel: atlas OR graph OR fs OR git.

## Right panel — graph (from a database)

Render a SQL query result as a graph (DB opened **read-only**):

````markdown
```sql-graph callgraph data/demo.sqlite
SELECT caller, callee FROM call_edge
```
````

2 columns → edges (a 3rd column → edge label); 1 column → bare nodes. Needs Node
22.5+. `npm run seed` makes a tiny demo DB.

## Right panel — file tree

````markdown
```fs
src/
src/main.rs
src/scc.rs +        # + added, ~ changed, * focus
```
````

FLIP-animates between frames: rows present in both slide, new fade in, gone fade out.

## Cross-frame reuse

- `graph: name` — reuse a named graph from any frame.
- `![[chapter#frame title]]` — transclude another frame's graph AND code. Forms:
  `![[03-relations#zoom out]]`, `![[#some title]]`, `![[03-relations]]`.

## Bind code to a graph

```markdown
anchor: reaches -> reaches
```

Adds a hover chip: hovering lights the matching code token and graph node together.
`anchor: token -> NodeA, NodeB` lights multiple nodes.

## Glossary

In `src/glossary.md`, one definition per line: `term :: definition`. The first
occurrence of each term in any frame's prose gets a hover card automatically.

## Checklist before you finish

1. `npm run check` returns `0 error(s)`. Fix every ERROR; WARN is usually fine.
2. Every `graph:` / `![[...]]` reference points at something that exists.
3. Adjacent code frames are similar enough to tween.
4. Each frame has at least one of: prose, code, graph, fs.

## Don't

- Don't put two right panels (graph + fs) in one frame — fs wins, graph is ignored.
- Don't reinvent layout. d2 lays out graphs; you only write nodes and edges.
- Don't hand-color cycles; the build does it.
