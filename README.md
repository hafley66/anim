# anim

Write plain markdown, get an animated slide deck. Each step animates: code tweens
token by token, graphs draw themselves on, file trees slide. Meant for building
intuition about algorithms, data models, and architecture — a bespoke animated
explainer you can spin up per topic, and easy for an AI to author.

## Quick start

```bash
npm install
npm run dev        # open the printed http://localhost:5173
```

Arrow keys to step. `o` = outline, `m` = map. The default deck (`src/deck/`) is a
short, self-documenting **template** — read it once, then replace it with yours.

Authoring an AI? Point it at [AGENTS.md](AGENTS.md) — the full grammar in one file.

## The idea in one minute

- A **deck** is a folder of markdown chapter files: `src/deck/01-foo.md`, `02-bar.md`, …
  The filesystem is the table of contents. (A single `src/frames.md` also works.)
- Each `## ` heading is one **frame** — one idea.
- A frame has prose (the narration) and, optionally, a **left panel** (a code block)
  and a **right panel** (a graph or a file tree). Any can be omitted.
- Stepping between frames **animates** the panels. The one rule behind every
  animation: things with the same key slide to their new place, new things fade in,
  gone things fade out. Code keys on tokens, graphs on node ids, file trees on paths.

That's the whole model: *a frame is a moment, a panel is a lens, stepping is time.*

## What you can put in a frame

| piece | how | panel |
|---|---|---|
| narration | markdown prose under the `## ` heading | left |
| code | a fenced block with a language | left |
| code from a file | `code: ../path.rs#L10-24 as rust` | left |
| graph (hand-drawn) | a ` ```d2 name ` fenced block | right |
| graph (from a DB) | a ` ```sql-graph name file.sqlite ` block | right |
| file tree | a ` ```fs ` block (`+` add, `~` change, `*` focus) | right |
| reuse a graph | `graph: name` | right |
| reuse a whole panel | `![[chapter#frame title]]` | both |
| cross-link | `[[frame title]]` in prose → builds the `m` map | — |
| glossary hover | define `term :: definition` in `src/glossary.md` | — |
| bind code↔graph | `anchor: token -> NodeName` | hover chip |

Full detail and examples: [AGENTS.md](AGENTS.md), or just read `src/deck/`.

## Navigation

| key | action |
|---|---|
| `→` / space | next frame |
| `←` | previous frame |
| `o` | outline — the deck tree, click to jump |
| `m` | map — the deck's own `[[link]]` graph, click a node to jump |
| esc | close outline/map |
| scroll / drag | zoom / pan a graph |

## Commands

| command | what |
|---|---|
| `npm run dev` | live-reloading dev server (rebuilds on every save) |
| `npm run build` | production build to `dist/` |
| `npm run check` | lint the deck — broken `[[links]]`, undefined graphs, missing `code:` files, unknown tags, empty frames. Exits nonzero on errors. |
| `npm run build:md` | one-shot build of `frames.json` + graph SVGs |
| `npm run frames -- <range> <path> [lang]` | turn a git commit range into frames (snapshot = code, message = narration) |
| `npm run shoot` | headless screenshot of each frame (needs `npm run dev` running) |
| `npm run seed` | create a tiny demo SQLite DB for the `sql-graph` example |

## How it's wired

```
src/deck/*.md  ──build──▶  src/frames.json   ──▶  the React app
   │  (bin/build-frames.mjs)                        (src/Frames.jsx)
   ├─ ```d2``` / ```sql-graph``` ──▶ d2 ──▶ public/*.svg
   ├─ ```fs``` ──▶ frame.fs
   ├─ code: spans ──▶ read real files
   └─ glossary.md ──▶ glossary.json
```

A Vite plugin reruns the build on every save, so editing a chapter live-reloads
the deck. Code tween: [shiki-magic-move](https://github.com/shikijs/shiki-magic-move).
Graphs: [d2](https://d2lang.com). File tree: a small keyed-FLIP routine. SQLite is
read via Node's built-in `node:sqlite` (no dependency).

## Requirements

- Node 18+ (Node 22.5+ only if you use the `sql-graph` fence).
- `d2` on PATH for graphs to render (`brew install d2`). Without it, frames still
  show; graph panels are just empty.
- `playwright` (a devDependency) only for `npm run shoot`.

## Examples

`examples/dl-engine/` is a real multi-chapter deck (a Datalog-over-code engine:
reachability, cycles, relations, filesystem, history). To run it, point the deck
source at it — copy `examples/dl-engine/deck/*` into `src/deck/` and
`examples/dl-engine/glossary.md` into `src/glossary.md`, or symlink.

## Caveats

- **Lightly tested.** Most features have a screenshot but not a test suite. Large
  decks, deep folder nesting, unusual SQL shapes, and the fs leave-animation are
  the least proven.
- Generated files (`frames.json`, `glossary.json`, `public/*.svg`, `graphs/*.d2`)
  are gitignored and rebuilt.
