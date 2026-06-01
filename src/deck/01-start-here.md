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
