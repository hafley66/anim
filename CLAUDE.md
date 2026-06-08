# anim — pinned constraints

## Tree-view weight bar: left origin = content indent (NOT panel-absolute left)

INVARIANT (implemented): the per-row weight bar (`.trow-bar`, fs panel,
share/cumulative) starts at the row's content indent — the left edge of the
leaf/branch label — and ends at the panel's right edge. No nested item's bar reaches
the panel's absolute left.

How: renderRow echoes react-arborist's `paddingLeft` to the bar as `--indent`, and
`.trow-bar { left: var(--indent, 0); right: 0 }`. Right edge stays the fixed origin
(gradient `to left`); only the left moves in by the row's indent. Do not revert to
`left: 0`.

Ref: `src/AtlasPanel.jsx` renderRow (`.trow-bar`), `src/app.css` `.trow-bar`,
`src/core/tree.js` toForest (`share`/`offset`).
