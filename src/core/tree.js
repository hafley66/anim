// core/tree.js — turn a flat ref list into a nestable tree. Framework-neutral
// (no React/DOM). A panel supplies pathOf(locator) -> segments; buildTree groups
// rows by shared prefix, collapses single-child chains (frr/zebra/rib.c becomes
// one row, VSCode-style), and counts descendant leaves per branch.
//
// A path segment is a bare string, or {seg, leaf?, icon?, label?} for hints.
// TreeNode = { seg, key, depth, leaf, icon?, label?, ids[], rows[], children:Map, count }
//   key   = full path, the stable react key + collapse-state key
//   ids   = entity ids whose ref terminates exactly here (for focus/lighting)
//   rows  = the RefRows {id, panel, locator} that terminate here (tooltip/locator)
//   count = total descendant leaves (this node's rows + children's counts)

const norm = s => (typeof s === 'string' ? { seg: s } : s)
const makeNode = (seg, key) => ({ seg, key, depth: 0, leaf: false, icon: undefined, label: undefined, ids: [], rows: [], children: new Map(), count: 0 })

export function buildTree(rows, pathOf, { collapse = true } = {}) {
  const root = makeNode('', '')
  for (const r of rows) {
    let segs = (pathOf(r.locator) || []).map(norm)
    if (!segs.length) segs = [{ seg: String(r.locator) }]
    let cur = root, key = ''
    segs.forEach((s, i) => {
      key = key ? key + '/' + s.seg : s.seg
      let kid = cur.children.get(s.seg)
      if (!kid) { kid = makeNode(s.seg, key); cur.children.set(s.seg, kid) }
      if (s.icon) kid.icon = s.icon
      if (s.label) kid.label = s.label
      if (s.leaf) kid.leaf = true
      if (i === segs.length - 1) { kid.ids.push(r.id); kid.rows.push(r) }
      cur = kid
    })
  }
  if (collapse) collapseChains(root)
  finalize(root, -1)
  return root
}

// merge a pure passthrough branch (exactly 1 child, no rows of its own) into
// that child, repeatedly: a -> b -> c with nothing branching becomes "a/b/c".
function collapseChains(node) {
  for (const c of node.children.values()) collapseChains(c)
  for (const child of node.children.values()) {
    let c = child
    while (c.children.size === 1 && c.rows.length === 0 && !c.leaf) {
      const only = [...c.children.values()][0]
      c.seg = c.seg + '/' + only.seg
      c.key = only.key
      c.children = only.children
      c.rows = only.rows; c.ids = only.ids; c.leaf = only.leaf
      c.icon = c.icon || only.icon; c.label = only.label
    }
  }
}

const isBranch = n => n.children.size > 0
function finalize(node, depth) {
  node.depth = depth
  const kids = [...node.children.values()].sort((a, b) =>
    (isBranch(b) - isBranch(a)) || a.seg.localeCompare(b.seg, undefined, { numeric: true }))
  node.children = new Map(kids.map(k => [k.seg, k]))
  let count = node.rows.length
  for (const k of kids) { finalize(k, depth + 1); count += k.count }
  node.count = count
  if (!isBranch(node)) node.leaf = true
  return node
}

// pre-order DFS, skip the synthetic root -> [{node, depth}] for a flat render.
// isOpen(node) gates whether a branch's subtree is included (collapsed = hidden).
export function flattenTree(root, { isOpen } = {}) {
  const out = []
  const walk = n => {
    for (const c of n.children.values()) {
      out.push({ node: c, depth: c.depth })
      if (c.children.size && (!isOpen || isOpen(c))) walk(c)
    }
  }
  walk(root)
  return out
}

// convert a TreeNode into a react-arborist forest: [{ id, children, ...payload }].
// children:null marks a leaf. The bar is metric-agnostic: `weight(node)->number`
// is pluggable (default = leaf count; later LOC, churn, coverage, cost...). Per
// node we attach the RAW value plus, relative to its siblings, `share` (value /
// sibling total) and `offset` (cumulative share of preceding siblings, so the
// segments stack — each starts where the previous ended). A renderer picks how
// to draw these (share bar, absolute bar, sparkline, ...).
const convChildren = (nodes, weight) => {
  const total = nodes.reduce((s, n) => s + weight(n), 0)
  let acc = 0
  return nodes.map(n => {
    const share = total ? weight(n) / total : 1
    const offset = acc; acc += share
    return {
      id: n.key, label: n.label || n.seg, icon: n.icon, ids: n.ids, count: n.count,
      value: weight(n), share, offset,
      title: n.rows.map(r => r.locator).join('  ') || n.key,
      children: n.children.size ? convChildren([...n.children.values()], weight) : null,
    }
  })
}
export const toForest = (root, weight = n => n.count) => convChildren([...root.children.values()], weight)
export const nodeCount = root => {
  let c = 0
  const walk = n => { for (const k of n.children.values()) { c++; walk(k) } }
  walk(root); return c
}
