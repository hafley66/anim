// core/panels.js — declares how each panel kind segments a locator into a tree
// path. The panel set is OPEN: a panel exists for any `# ref <panel>` key in the
// model; unknown keys fall back to DEFAULT_SPEC (split on '/'). Add a kind by
// pushing a PanelSpec (or calling registerPanel) — the renderer never names kinds.
//
// PanelSpec = { key, title, pathOf, icon?, leafIcon? }
// pathOf(locator) -> Array<string | {seg, leaf?, icon?, label?}>, root-first, last = leaf.

const clean = a => a.filter(Boolean)

// fs: frr/zebra/zebra_rib.c:120 -> dirs, then "file:line" baked into the leaf
// segment (not a label override), so a collapsed lone chain keeps its full path.
const fsPath = loc => {
  const [path, line] = String(loc).split(/:(?=\d+$)/)
  const segs = clean(path.split('/'))
  if (!segs.length) return segs
  const i = segs.length - 1
  segs[i] = { seg: line ? `${segs[i]}:${line}` : segs[i], leaf: true }
  return segs
}
// sql: table:predicate, with db.table.column nesting before the predicate.
//   routes:dest=10.0.0.0/8 -> [routes, {dest=10.0.0.0/8 leaf}]  (CIDR /8 stays put)
const sqlPath = loc => {
  const s = String(loc), i = s.indexOf(':')
  const head = i < 0 ? s : s.slice(0, i), pred = i < 0 ? '' : s.slice(i + 1)
  const segs = clean(head.split('.'))
  if (pred) segs.push({ seg: pred, leaf: true, icon: '•' })
  return segs
}
// api: GET /v1/nexthops/{id} -> path folders, method as the leaf so verbs fan at the tip.
const apiPath = loc => {
  const m = String(loc).trim().match(/^([A-Z]+)\s+(.*)$/)
  const [method, rest] = m ? [m[1], m[2]] : ['', String(loc)]
  const segs = clean(rest.split('/'))
  if (method) segs.push({ seg: method, leaf: true, icon: '⇥' })
  return segs
}
// url: https://host/a/b?q -> host, path segments (a sitemap).
const urlPath = loc => {
  try { const u = new URL(loc); return [u.host, ...clean(u.pathname.split('/'))] }
  catch { return clean(String(loc).split('/')) }
}
// code: pkg/mod/sym or pkg.mod.sym -> the trailing symbol is the leaf.
const codePath = loc => {
  const segs = clean(String(loc).split(/[./]/))
  if (segs.length) segs[segs.length - 1] = { seg: segs[segs.length - 1], leaf: true, icon: 'ƒ' }
  return segs
}
const slashPath = loc => clean(String(loc).split('/'))

// bar: optional row-decoration config. weight(node)->magnitude; mode 'share' =
// relative to parent (cumulative segments); color overrides the fill. Opt-in per
// panel, and globally toggle-able in the UI. Only fs ships one by default.
/** @typedef {{ weight?: (n:any)=>number, mode?: 'share'|'absolute', color?: string }} BarConfig */
const COUNT_BAR = { weight: n => n.count, mode: 'share' }

export const DEFAULT_SPEC = { key: '*', title: 'refs', pathOf: slashPath, icon: '▸', leafIcon: '·' }
export const PANEL_SPECS = [
  { key: 'fs',   title: 'fs · files',      pathOf: fsPath,   icon: '▸', leafIcon: '·', bar: COUNT_BAR },
  { key: 'sql',  title: 'sql · rows',      pathOf: sqlPath,  icon: '▸', leafIcon: '•' },
  { key: 'api',  title: 'api · endpoints', pathOf: apiPath,  icon: '▸', leafIcon: '⇥' },
  { key: 'url',  title: 'url · sitemap',   pathOf: urlPath,  icon: '▸', leafIcon: '·' },
  { key: 'code', title: 'code · symbols',  pathOf: codePath, icon: '▸', leafIcon: 'ƒ' },
]
const BY_KEY = new Map(PANEL_SPECS.map(s => [s.key, s]))
export const panelSpec = k => BY_KEY.get(k) || { ...DEFAULT_SPEC, key: k, title: k }
export const pathOfFor = k => panelSpec(k).pathOf
export function registerPanel(spec) { PANEL_SPECS.push(spec); BY_KEY.set(spec.key, spec) }

// derive the panel set from the model's refs (registry order first, then discovery).
export function panelKeysOf(model) {
  const seen = new Set()
  for (const list of model.refs.values()) for (const r of list) seen.add(r.panel)
  const reg = PANEL_SPECS.map(s => s.key).filter(k => seen.has(k))
  return [...reg, ...[...seen].filter(k => !reg.includes(k))]
}
