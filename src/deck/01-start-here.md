## you write markdown, you get a deck

Every `## ` heading is one **frame** — one idea. Step with the **arrow keys**.
A frame has prose (this), and optionally a **code panel** on the left and a
**graph** or **file tree** on the right.

Press `→` to step. Press `o` for the outline, `m` for the deck's link map.

This starter deck is also a **template**: copy `src/deck/`, delete these files,
write your own. Everything you can put in a frame is shown across the next few
slides. The companion guide is `AGENTS.md`.

## code tweens between frames

```rust
fn main() {
    println!("hello");
}
```

Put a code block on a frame and the next frame's code **tweens** into place,
token by token. Keep consecutive blocks *similar* so the delta reads as motion.

Watch the next frame: one line is added and the string changes.

## code tweens between frames — step 2

```rust
fn main() {
    let name = "world";
    println!("hello, {name}");
}
```

That move — `println!("hello")` becoming `println!("hello, {name}")` plus a new
`let` line — animated because the surrounding tokens stayed the same. This is
[shiki-magic-move]; you get it for free by keeping frames close.

You can also pull code from a real file so it never drifts:
`code: ../some/file.rs#L10-24 as rust`.

## a graph draws itself on

A [d2] diagram on the right. Name it (`pipeline`) so a later frame can reuse it.
Edges animate on; any **cycle colors itself** automatically (Tarjan pass).

```d2 pipeline
read -> parse
parse -> build
build -> render
render -> read
```

The `read → … → read` loop is tinted without you styling it.

## reuse a graph, add a file tree

This frame **reuses** the graph above with `graph: pipeline`, and shows a
**file tree** is the other right-panel option (one graph OR one tree per frame).

A file tree FLIP-animates between frames: rows that persist slide, new rows fade
in. Marks: `+` added, `~` changed, `*` focus.

```fs
src/
src/deck/01-start-here.md
src/deck/02-yours.md +
src/Frames.jsx *
```

## that's the whole model

A **frame** is a moment. A **panel** is a lens. **Stepping** is time.

- prose-only frames are fine (a discussion note)
- `[[start here]]` makes a cross-link — these build the `m` map
- terms in `glossary.md` get a hover card on first use, e.g. **FLIP**

Run `npm run check` to lint a deck (broken links, missing files, empty frames) —
it prints compiler-style errors. Now go write `02-yours.md`. See [[you write markdown, you get a deck]].

## the graph goes interactive

The same d2 grammar, but as an ` ```atlas ` block: the right panel becomes a
**live cytoscape graph**. Click a node for its **cone** (what it reaches); the
graph stays put and only fades the subset, so nothing flickers. The `# ref`
comments stream each node's **fs / sql / api** addresses into the side panels as
they come into view — one model, many lenses.

```atlas netstack
net: L3 {
  ip
  route
  nexthop
}
overlay: VXLAN {
  vxlan
  vtep
}
l2: L2 {
  ethernet
  mac
}
net.ip -> net.route
net.route -> net.nexthop
net.nexthop -> net.route
net.nexthop -> l2.ethernet
overlay.vxlan -> overlay.vtep
overlay.vxlan -> l2.ethernet
overlay.vtep -> net.ip
l2.ethernet -> l2.mac

# @ net.route : RIB lookup, longest-prefix match
# @ net.nexthop : recursive resolution (the SCC)
# src net.route = frr/zebra/zebra_rib.c:120
# src net.nexthop = frr/zebra/zebra_nhg.c:88
# src l2.ethernet = linux/net/ethernet/eth.c:40
# ref sql net.route = routes:dest=10.0.0.0/8
# ref sql net.ip = addrs:ifindex=2
# ref sql overlay.vtep = vteps:vni=4097
# ref api net.nexthop = GET /v1/nexthops/{id}
# ref api overlay.vxlan = POST /v1/overlays
# tag net.nexthop : hub
# tag l2.mac : sink
# diff add overlay.vtep
# diff mod net.route
# view focus=overlay.vxlan mode=downstream dir=LR
```

The `net.route → net.nexthop → net.route` loop tints itself, same Tarjan pass as
the static graphs. This is the [atlas] renderer left-joined onto the deck.

## a tour spotlights code

A `# tour` line per step — the target is a **focus set** (`a+b`) or a **span**
(`file:lo..hi`), the same encoding as a `tour_step` row. Focus steps drive the
graph; span steps open a **document surface** over it: the file stays resident,
the highlight band FLIPs between ranges, the scroll eases to follow. `doc:`
inlines the file at build time. Press ▶ spotlit to walk it.

doc: src/core/codec.ts
doc: src/core/spotlight.ts

```atlas spotlit
core: anim core {
  codec
  tour
  spotlight
}
core.tour -> core.codec
core.tour -> core.spotlight: span steps land here {style.stroke-dash: 3}

# @ core.codec : parseTarget: one string codec for rel rows and `# tour` lines
# @ core.spotlight : pure band + scroll math; the renderer owns DOM and easing
# src core.codec = src/core/codec.ts:27
# src core.spotlight = src/core/spotlight.ts:1
# tour spotlight 0 = core.codec+core.spotlight : the two pure pieces behind the spotlight
# tour spotlight 1 = src/core/codec.ts:23..31 : a target string is a span (`file:lo..hi`) or a '+'-joined focus set
# tour spotlight 2 = src/core/spotlight.ts:10..21 : lines clamp, then become a pixel band
# tour spotlight 3 = src/core/spotlight.ts:23..28 : the scroll target centers the band, clamped to the doc
```

## a spotlight without a graph

`spot: <file>:<lo>..<hi>` mounts the same **document surface** as a plain
frame's right panel — no atlas, no tour. The target string is the same
encoding a tour span uses, and the file arrives through the same `doc:` line.
Syntax colors come from the deck's own [shiki] highlighter.

doc: src/core/spotlight.ts

spot: src/core/spotlight.ts:10..21

## the band moves, the file stays

Step back and forth between this frame and the last one: the file is resident
across frames, so only the **band** and the scroll move — the same FLIP the
tour player drives, now driven by the deck itself.

doc: src/core/spotlight.ts

spot: src/core/spotlight.ts:23..28
