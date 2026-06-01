# Example: dl-engine deck

A real six-chapter deck explaining a Datalog-over-code engine — reachability,
cycles, relations, filesystem, history, and a session-arc finale. Use it as a
reference for a substantial deck (graph reuse, anchors, fs/git lenses, sql-graph).

## To run it

Copy it over the default deck:

```bash
cp examples/dl-engine/deck/*.md   src/deck/
cp examples/dl-engine/glossary.md src/glossary.md
rm src/deck/01-start-here.md
npm run seed     # for the sql-graph fence
npm run dev
```

## Heads up: external references

These chapters were authored inside the `sprefa` repo and point at it:

- `code: ../src/scc.rs#L63-71` (chapter 3) — expects a Rust source tree at the
  repo root. Will report "did not resolve" here; repoint it at a real file.
- `git: ../.. HEAD~4 5` (chapter 5) — reads `git log` of the surrounding repo.
  Shows the commits of *this* repo when run here.
- `sql-graph … data/callgraph.sqlite` (chapter 3) — run from `src/deck/`, so the
  path resolves against the repo root `data/`; `npm run seed` creates it.

`npm run check` will flag the unresolved `code:`/graph refs — that's expected for a
deck lifted out of its home repo. Fix or delete those lines for a clean run.
