// core/panels.ts — declares how each panel kind segments a locator into a tree
// path. The panel set is OPEN: a panel exists for any `# ref <panel>` key in the
// model; unknown keys fall back to DEFAULT_SPEC (split on '/'). Add a kind by
// pushing a PanelSpec (or calling registerPanel) — the renderer never names kinds.

import type { Model } from './model'
import type { Segment, TreeNode } from './tree'

export type BarConfig = { weight?: (n: TreeNode) => number; mode?: 'share' | 'absolute'; color?: string }
export type PanelSpec = {
  key: string
  title: string
  pathOf: (locator: string) => Segment[]
  icon?: string
  leafIcon?: string
  bar?: BarConfig
}

const clean = (a: string[]): string[] => a.filter(Boolean)

// fs: frr/zebra/zebra_rib.c:120 -> dirs, then "file:line" baked into the leaf
// segment (not a label override), so a collapsed lone chain keeps its full path.
const fsPath = (loc: string): Segment[] => {
  const [path, line] = String(loc).split(/:(?=\d+$)/)
  const segs: Segment[] = clean(path.split('/'))
  if (!segs.length) return segs
  const i = segs.length - 1
  const seg = segs[i] as string
  segs[i] = { seg: line ? `${seg}:${line}` : seg, leaf: true }
  return segs
}
// sql: table:predicate, with db.table.column nesting before the predicate.
//   routes:dest=10.0.0.0/8 -> [routes, {dest=10.0.0.0/8 leaf}]  (CIDR /8 stays put)
const sqlPath = (loc: string): Segment[] => {
  const s = String(loc), i = s.indexOf(':')
  const head = i < 0 ? s : s.slice(0, i), pred = i < 0 ? '' : s.slice(i + 1)
  const segs: Segment[] = clean(head.split('.'))
  if (pred) segs.push({ seg: pred, leaf: true, icon: '•' })
  return segs
}
// api: GET /v1/nexthops/{id} -> path folders, method as the leaf so verbs fan at the tip.
const apiPath = (loc: string): Segment[] => {
  const m = String(loc).trim().match(/^([A-Z]+)\s+(.*)$/)
  const [method, rest] = m ? [m[1], m[2]] : ['', String(loc)]
  const segs: Segment[] = clean(rest.split('/'))
  if (method) segs.push({ seg: method, leaf: true, icon: '⇥' })
  return segs
}
// url: https://host/a/b?q -> host, path segments (a sitemap).
const urlPath = (loc: string): Segment[] => {
  try { const u = new URL(loc); return [u.host, ...clean(u.pathname.split('/'))] }
  catch { return clean(String(loc).split('/')) }
}
// code: pkg/mod/sym or pkg.mod.sym -> the trailing symbol is the leaf.
const codePath = (loc: string): Segment[] => {
  const segs: Segment[] = clean(String(loc).split(/[./]/))
  if (segs.length) segs[segs.length - 1] = { seg: segs[segs.length - 1] as string, leaf: true, icon: 'ƒ' }
  return segs
}
const slashPath = (loc: string): Segment[] => clean(String(loc).split('/'))

// bar: optional row-decoration config. weight(node)->magnitude; mode 'share' =
// relative to parent (cumulative segments); color overrides the fill. Opt-in per
// panel, and globally toggle-able in the UI. Only fs ships one by default.
const COUNT_BAR: BarConfig = { weight: n => n.count, mode: 'share' }

export const DEFAULT_SPEC: PanelSpec = { key: '*', title: 'refs', pathOf: slashPath, icon: '▸', leafIcon: '·' }
export const PANEL_SPECS: PanelSpec[] = [
  { key: 'fs',   title: 'fs · files',      pathOf: fsPath,   icon: '▸', leafIcon: '·', bar: COUNT_BAR },
  { key: 'sql',  title: 'sql · rows',      pathOf: sqlPath,  icon: '▸', leafIcon: '•' },
  { key: 'api',  title: 'api · endpoints', pathOf: apiPath,  icon: '▸', leafIcon: '⇥' },
  { key: 'url',  title: 'url · sitemap',   pathOf: urlPath,  icon: '▸', leafIcon: '·' },
  { key: 'code', title: 'code · symbols',  pathOf: codePath, icon: '▸', leafIcon: 'ƒ' },
]
const BY_KEY = new Map(PANEL_SPECS.map(s => [s.key, s]))
export const panelSpec = (k: string): PanelSpec => BY_KEY.get(k) || { ...DEFAULT_SPEC, key: k, title: k }
export const pathOfFor = (k: string): PanelSpec['pathOf'] => panelSpec(k).pathOf
export function registerPanel(spec: PanelSpec): void { PANEL_SPECS.push(spec); BY_KEY.set(spec.key, spec) }

// derive the panel set from the model's refs (registry order first, then discovery).
export function panelKeysOf(model: Model): string[] {
  const seen = new Set<string>()
  for (const list of model.refs.values()) for (const r of list) seen.add(r.panel)
  const reg = PANEL_SPECS.map(s => s.key).filter(k => seen.has(k))
  return [...reg, ...[...seen].filter(k => !reg.includes(k))]
}
