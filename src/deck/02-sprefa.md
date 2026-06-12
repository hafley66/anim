## sprefa: datalog over your files

**sprefa v5** (`dl`) is a single Rust binary. Point it at a repo: `scan`
selects files, matchers extract **facts**, datalog rules run over them as a
SQLite fixpoint, and results leave through three doors. `?` queries print
tables, `diag` rows become CI failures or editor squiggles, `gen` writes files.

This chapter is live data. Every graph on the right is real engine output, and
the [[atlas: written by the engine]] frame is maintained *by* the engine.

```fs
sprefa/v5/src/parse.rs
sprefa/v5/src/lower.rs
sprefa/v5/src/engine.rs *
sprefa/v5/src/db.rs
sprefa/v5/src/modgraph.rs
sprefa/v5/src/spine.rs
sprefa/v5/examples/anim-deck.dl +
```

## one tick

Each tick: select files, extract rows, run rules to fixpoint, fire the sinks.
`gen` writes back into the same tree the next tick scans. A second tick renders
byte-identical output, skips the write, and the system is **converged**. The
loop below tints itself because it is a cycle.

```d2 tick
files -> scan
scan -> extract: "match / ast / json / cmd"
extract -> facts: "rows in SQLite"
facts -> fixpoint
fixpoint -> query: "? tables"
fixpoint -> diag: "squiggles / CI"
fixpoint -> gen
gen -> files: "write between markers"
```

## facts: scan picks files, a matcher binds rows

`scan` selects files by repo, rev, and glob. A matcher runs per file and binds
captures: `match` is regex, `ast` is tree-sitter, `json` is dotted paths,
`cmd` is any shell tool. This rule scans the engine's own source, which wakes
the built-in `syn` extractor and populates `type_edge(from, to, kind)`.

code: ../sprefa/v5/examples/anim-deck.dl#L8-10 as prolog

graph: tick

## rules: joins, filters, aggregates

Plain datalog over the facts. `edge0` filters the type graph, `fan_out` counts
each type's outgoing edges, `hub` keeps the heavy ones. The panel on the right
is that result, read straight from a SQLite file the engine wrote via `--db`.

code: ../sprefa/v5/examples/anim-deck.dl#L14-22 as prolog

```sql-graph hubs data/sprefa.sqlite
SELECT "from", "to" FROM rel_type_edge
WHERE kind != 'variant' AND "from" IN (
  SELECT "from" FROM rel_type_edge WHERE kind != 'variant'
  GROUP BY "from" HAVING count(*) >= 5)
```

## recursion: closure

`closure(type_edge)` is transitive reachability as one body atom: 278 edges
in, 976 reachable pairs out, computed inside the same fixpoint. The panel is
the **blast radius** of `Engine`: every edge whose source Engine can reach.

```prolog
type_reaches(src, dst) <- closure(type_edge).
```

```sql-graph engine-cone data/sprefa.sqlite
SELECT e."from", e."to" FROM rel_type_edge e
WHERE e.kind != 'variant' AND (e."from" = 'Engine'
  OR e."from" IN (SELECT dst FROM rel_type_reaches WHERE src = 'Engine'))
```

## gen: the engine writes its own deck

`comment` turns marker pairs into line coordinates, and a `gen` splice rule
replaces the lines strictly between them. Splices from every rule batch into
one bottom-up write per file, applied only when bytes change. The next frame's
graph sits between markers in *this markdown file*; these rules own it.

code: ../sprefa/v5/examples/anim-deck.dl#L26-35 as prolog

```fs
sprefa/v5/examples/anim-deck.dl *
anim/data/sprefa.sqlite ~
anim/src/deck/02-sprefa.md ~
```

## atlas: written by the engine

Everything between the BEGIN and END comments in this block was spliced in by
`dl`. Click **Engine** for its cone, hit ⤢ for layout and isolate knobs. Edit
a struct in `v5/src`, rerun the program, and the graph re-splices itself.

```atlas typegraph
# BEGIN: edges
Cli -> Option
Cli -> PathBuf
Cli -> String
Cli -> Vec
Coord -> FileId
Coord -> From
Coord -> RepoId
Coord -> RevId
Db -> Connection
Db -> HashMap
Db -> RefCell
Db -> String
Desc -> DescKind
Desc -> Segment
Desc -> String
Desc -> Vec
Engine -> ClosureCache
Engine -> DiagRow
Engine -> HashMap
Engine -> PathBuf
Engine -> Rels
Engine -> String
Engine -> Vec
GenRule -> BodyItem
GenRule -> GenTarget
GenRule -> String
GenRule -> Vec
ProjectCx -> Fn
ProjectCx -> HashMap
ProjectCx -> HashSet
ProjectCx -> KotlinIndex
ProjectCx -> OnceLock
ProjectCx -> Option
ProjectCx -> Path
ProjectCx -> RustCrates
ProjectCx -> Send
ProjectCx -> String
ProjectCx -> Sync
Rule -> AggFn
Rule -> Atom
Rule -> BodyItem
Rule -> Option
Rule -> Vec
WhereBytes -> FileId
WhereBytes -> From
WhereBytes -> RepoId
WhereBytes -> RevId
WhereBytes -> StringId
# END:
# BEGIN: tags
# tag Cli : hub
# tag Coord : hub
# tag Db : hub
# tag Desc : hub
# tag Engine : hub
# tag GenRule : hub
# tag ProjectCx : hub
# tag Rule : hub
# tag WhereBytes : hub
# END:
# BEGIN: notes
# @ Cli : fan-out 4
# @ Coord : fan-out 4
# @ Db : fan-out 4
# @ Desc : fan-out 4
# @ Engine : fan-out 7
# @ GenRule : fan-out 4
# @ ProjectCx : fan-out 11
# @ Rule : fan-out 5
# @ WhereBytes : fan-out 5
# END:
# BEGIN: steps
# step Cli = 2
# step Coord = 2
# step Db = 2
# step Desc = 2
# step Engine = 0
# step GenRule = 2
# step ProjectCx = 0
# step Rule = 1
# step WhereBytes = 1
# step AggFn = 1
# step Atom = 1
# step BodyItem = 1
# step ClosureCache = 0
# step Connection = 2
# step DescKind = 2
# step DiagRow = 0
# step FileId = 1
# step Fn = 0
# step From = 1
# step GenTarget = 2
# step HashMap = 0
# step HashSet = 0
# step KotlinIndex = 0
# step OnceLock = 0
# step Option = 0
# step Path = 0
# step PathBuf = 0
# step RefCell = 2
# step Rels = 0
# step RepoId = 1
# step RevId = 1
# step RustCrates = 0
# step Segment = 2
# step Send = 0
# step String = 0
# step StringId = 1
# step Sync = 0
# step Vec = 0
# END:
# step 0 : the heavy core lands first
# step 1 : the rule and span types join
# step 2 : the rest of the hubs arrive
# src Engine = sprefa/v5/src/engine.rs:539
# src Db = sprefa/v5/src/db.rs:19
# src Rule = sprefa/v5/src/ast.rs:147
# src GenRule = sprefa/v5/src/ast.rs:215
# src ProjectCx = sprefa/v5/src/modgraph.rs:57
# src Cli = sprefa/v5/src/main.rs:7
# src Coord = sprefa/v5/src/spine.rs:141
# src WhereBytes = sprefa/v5/src/spine.rs:150
# view focus=Engine mode=cone layout=elk dir=LR
```

## the atlas straight from the database

No d2 at all this time. The fence below names a SQLite file and nothing else:
the build reads the engine's `rel_node` / `rel_edge` / `rel_tag` /
`rel_node_ref` / `rel_tour` / `rel_tour_step` / `rel_card` / `rel_view`
tables and the panel renders them as a model. The `# tour`-shaped rows were
written as datalog **facts**; the nodes, edges, tags, and file refs were
**derived** from the type graph by the same rules. Press ▶ rows to walk the
authored tour; hover a node for its declaration file in the periscope.

```atlas-db data/sprefa.sqlite
```

## the loop you are inside

The deck reads the database, the engine writes the database and the deck, you
read the deck and edit the source the engine scans. Four arrows, one cycle,
and it tints itself like every other loop here.

```d2 dogfood
source: v5/src
engine: dl
deck: this deck
source -> engine: "scan"
engine -> deck: "db + gen splice"
deck -> you: "frames"
you -> source: "edit"
```

See [[one tick]] for the same loop one level down.
