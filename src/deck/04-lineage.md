## lineage: what came out of sprefa

Each step adds one era. Nodes are born left to right in time; later edges point back to what they reuse.

## March to May: sprefa v1 to v5

```d2 lineage0
direction: right
v1: "sprefa v1\n03-24"
v2: "v2\n04-14"
v3: "v3 rayon\n04-20"
v4: "v4 server sprawl\n05-02"
v5: "v5 dl + SQLite\n05-21"
v1 -> v2
v2 -> v3
v3 -> v4
v4 -> v5
```

## May 30: frame-anim strikes

```d2 lineage1
direction: right
v1: "sprefa v1\n03-24"
v2: "v2\n04-14"
v3: "v3 rayon\n04-20"
v4: "v4 server sprawl\n05-02"
v5: "v5 dl + SQLite\n05-21"
fanim: "frame-anim\nv5/anim 05-30"
v1 -> v2
v2 -> v3
v3 -> v4
v4 -> v5
v5 -> fanim
fanim -> v5: "sql-graph seam" {style.stroke-dash: 3}
```

## June: anim leaves home

```d2 lineage2
direction: right
v1: "sprefa v1\n03-24"
v2: "v2\n04-14"
v3: "v3 rayon\n04-20"
v4: "v4 server sprawl\n05-02"
v5: "v5 dl + SQLite\n05-21"
fanim: "frame-anim\nv5/anim 05-30"
anim: "~/projects/anim\n06-01"
v1 -> v2
v2 -> v3
v3 -> v4
v4 -> v5
v5 -> fanim
fanim -> anim
fanim -> v5: "sql-graph seam" {style.stroke-dash: 3}
```

## July: v6 and the extractor

```d2 lineage3
direction: right
v1: "sprefa v1\n03-24"
v2: "v2\n04-14"
v3: "v3 rayon\n04-20"
v4: "v4 server sprawl\n05-02"
v5: "v5 dl + SQLite\n05-21"
fanim: "frame-anim\nv5/anim 05-30"
anim: "~/projects/anim\n06-01"
v6: "v6 one crate\n07-20"
sx: "sprefa-extract\n07-23"
v1 -> v2
v2 -> v3
v3 -> v4
v4 -> v5
v5 -> fanim
fanim -> anim
v5 -> v6
v6 -> sx
fanim -> v5: "sql-graph seam" {style.stroke-dash: 3}
```

## August: tools split off

```d2 lineage4
direction: right
v1: "sprefa v1\n03-24"
v2: "v2\n04-14"
v3: "v3 rayon\n04-20"
v4: "v4 server sprawl\n05-02"
v5: "v5 dl + SQLite\n05-21"
fanim: "frame-anim\nv5/anim 05-30"
anim: "~/projects/anim\n06-01"
v6: "v6 one crate\n07-20"
sx: "sprefa-extract\n07-23"
boop: "boop\n08-13"
soopy: "soopy\n08-13"
obs: "hafley-observe\n08-24"
v7: "v7 Prolog + lisp\n08-27"
v1 -> v2
v2 -> v3
v3 -> v4
v4 -> v5
v5 -> fanim
fanim -> anim
v5 -> v6
v6 -> sx
v6 -> boop
v6 -> soopy
v6 -> obs
v6 -> v7
fanim -> v5: "sql-graph seam" {style.stroke-dash: 3}
```

## September: v8, engine, ryi

```d2 lineage5
direction: right
v1: "sprefa v1\n03-24"
v2: "v2\n04-14"
v3: "v3 rayon\n04-20"
v4: "v4 server sprawl\n05-02"
v5: "v5 dl + SQLite\n05-21"
fanim: "frame-anim\nv5/anim 05-30"
anim: "~/projects/anim\n06-01"
v6: "v6 one crate\n07-20"
sx: "sprefa-extract\n07-23"
boop: "boop\n08-13"
soopy: "soopy\n08-13"
obs: "hafley-observe\n08-24"
v7: "v7 Prolog + lisp\n08-27"
v8: "v8 dl8 Rust\n09-12"
ivm: "sqlite_ivm ext\n09-09"
hrs: "hafley-rs home\n09-14"
ryi: "ryi\n09-18"
scm: "hafley_scm\n09-21"
crates: "ivm-ir/engine/dd\n09-26"
v1 -> v2
v2 -> v3
v3 -> v4
v4 -> v5
v5 -> fanim
fanim -> anim
v5 -> v6
v6 -> sx
v6 -> boop
v6 -> soopy
v6 -> obs
v6 -> v7
v7 -> v8
v8 -> ivm
sx -> hrs
hrs -> ryi
ryi -> scm
ivm -> crates
v8 -> ryi: "ryi.resolve" {style.stroke-dash: 3}
v8 -> soopy: "git/fs" {style.stroke-dash: 3}
v8 -> obs: "memcap" {style.stroke-dash: 3}
fanim -> v5: "sql-graph seam" {style.stroke-dash: 3}
```

## October: DD only, v9 seed

```d2 lineage6
direction: right
v1: "sprefa v1\n03-24"
v2: "v2\n04-14"
v3: "v3 rayon\n04-20"
v4: "v4 server sprawl\n05-02"
v5: "v5 dl + SQLite\n05-21"
fanim: "frame-anim\nv5/anim 05-30"
anim: "~/projects/anim\n06-01"
v6: "v6 one crate\n07-20"
sx: "sprefa-extract\n07-23"
boop: "boop\n08-13"
soopy: "soopy\n08-13"
obs: "hafley-observe\n08-24"
v7: "v7 Prolog + lisp\n08-27"
v8: "v8 dl8 Rust\n09-12"
ivm: "sqlite_ivm ext\n09-09"
hrs: "hafley-rs home\n09-14"
ryi: "ryi\n09-18"
scm: "hafley_scm\n09-21"
crates: "ivm-ir/engine/dd\n09-26"
dd: "DD only engine\n10-10"
v9: "v9 skeleton\n10-22"
harden: "v8-harden plan\n10-23"
v1 -> v2
v2 -> v3
v3 -> v4
v4 -> v5
v5 -> fanim
fanim -> anim
v5 -> v6
v6 -> sx
v6 -> boop
v6 -> soopy
v6 -> obs
v6 -> v7
v7 -> v8
v8 -> ivm
sx -> hrs
hrs -> ryi
ryi -> scm
ivm -> crates
crates -> dd
dd -> v9
v8 -> harden
v8 -> ryi: "ryi.resolve" {style.stroke-dash: 3}
v8 -> soopy: "git/fs" {style.stroke-dash: 3}
v8 -> obs: "memcap" {style.stroke-dash: 3}
v9 -> ryi: "call edges" {style.stroke-dash: 3}
fanim -> v5: "sql-graph seam" {style.stroke-dash: 3}
```
