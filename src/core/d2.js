// core/d2.js — d2 text (+ `#` annotation comments) -> Model. The bundled
// @terrastruct/d2 WASM compiler is the ONLY parser; on file:// the worker-shim
// runs its compile worker on the main thread.

import { entity, makeModel } from './model.js';
import { installMainThreadWorkerShim } from './worker-shim.js';

const lastSeg = id => id.includes('.') ? id.slice(id.lastIndexOf('.') + 1) : id;
const parentOf = id => id.includes('.') ? id.slice(0, id.lastIndexOf('.')) : 'root';
function dropContainers(nodes) {
  const ids = nodes.map(n => n.id);
  const isC = id => ids.some(o => o !== id && o.startsWith(id + '.'));
  return nodes.filter(n => !isC(n.id));
}

// dynamic import so the ~8MB d2 chunk loads only when a graph asks for it.
export async function loadD2() {
  installMainThreadWorkerShim();   // no-op off file://
  const m = await import('@terrastruct/d2');
  return m.D2;
}

export async function parseD2WASM(text, D2) {
  if (!D2) throw new Error('no D2 compiler');
  const res = await new D2().compile(text);
  const dg = res.diagram || res;
  const shapes = dg.shapes || [], conns = dg.connections || [];
  if (!shapes.length) throw new Error('no shapes from wasm');
  let i = 0;
  const nodes = shapes.map(s => ({ id: s.id, name: s.label || lastSeg(s.id), mod: parentOf(s.id) }));
  const edges = conns.map(c => ({ id: c.src + '>>' + c.dst + '#' + (i++), source: c.src, target: c.dst, label: c.label || '' }));
  return { nodes: dropContainers(nodes), edges, engine: 'wasm' };
}

// Prose-hover id scrape — NOT a d2 parser. Frames.jsx needs node ids
// synchronously to wrap mentions in narration; the real model arrives async
// from the WASM compiler. Bare idents and edge endpoints only.
export function proseHoverIds(text) {
  const map = new Map(); const stack = [];
  for (const raw of text.split('\n')) {
    const line = raw.replace(/#.*$/, '').trim();
    if (!line) continue;
    if (line === '}') { stack.pop(); continue; }
    const open = line.match(/^([\w.\-]+)\s*(?::[^{]*)?\{$/);
    if (open) { stack.push(open[1].trim()); continue; }
    for (const seg of line.split('->')) {
      const m = seg.trim().match(/^([\w.\-]+)/);
      if (!m) continue;
      const id = stack.length ? stack.join('.') + '.' + m[1] : m[1];
      map.set(id.toLowerCase(), id); map.set(lastSeg(id).toLowerCase(), id);
    }
  }
  return map;
}

// `#` comment annotations the d2 compiler ignores but we scan.
export function parseAnnotations(text) {
  const ann = {}, annE = {}, diff = {}, src = {}, srcE = {}, tags = {}, reflist = [];
  const ek = k => k.includes('->') ? k.split('->').map(s => s.trim()).join('>>') : k;
  for (const raw of text.split('\n')) {
    const tr = raw.trim(); let m;
    if (m = tr.match(/^#\s*@\s*(.+?)\s*:\s*(.+)$/)) {
      const k = m[1].trim(), v = m[2].trim();
      if (k.includes('->')) { const [a, b] = k.split('->').map(s => s.trim()); annE[a + '>>' + b] = v; } else ann[k] = v; continue;
    }
    if (m = tr.match(/^#\s*tag\s+(.+?)\s*:\s*(.+)$/i)) { tags[m[1].trim()] = m[2].split(',').map(s => s.trim()).filter(Boolean); continue; }
    if (m = tr.match(/^#\s*diff\s+(add|del|mod)\s+(.+)$/i)) { diff[m[2].trim()] = m[1].toLowerCase(); continue; }
    // generic per-panel ref:  # ref <panel> <id|a->b> = <locator>
    if (m = tr.match(/^#\s*ref\s+(\w+)\s+(.+?)\s*=\s*(.+)$/i)) {
      reflist.push({ panel: m[1].toLowerCase(), key: ek(m[2].trim()), locator: m[3].trim() }); continue;
    }
    if (m = tr.match(/^#\s*src\s+(.+?)\s*=\s*(.+)$/i)) {                 // fs shorthand for `# ref fs`
      const k = m[1].trim(), v = m[2].trim();
      if (k.includes('->')) { const [a, b] = k.split('->').map(s => s.trim()); srcE[a + '>>' + b] = v; } else src[k] = v; continue;
    }
  }
  return { ann, annE, diff, src, srcE, tags, reflist };
}

// text -> Model via the WASM compiler. A compile failure yields an empty model
// carrying the error in `note` — surfaced, never silently re-parsed.
export async function buildModel(text, { D2 = null, tours = {} } = {}) {
  let g; try { g = await parseD2WASM(text, D2); } catch (e) { g = { nodes: [], edges: [], engine: 'none', note: e.message }; }
  const a = parseAnnotations(text);
  const entities = g.nodes.map(n => entity({
    id: n.id, label: n.name, container: n.mod, tags: a.tags[n.id] || [],
    kind: a.diff[n.id] ? 'diff-' + a.diff[n.id] : 'node', note: a.ann[n.id],
  }));
  const edges = g.edges.map(e => ({
    id: e.id, source: e.source, target: e.target, label: e.label || '', kind: 'dep',
    note: a.annE[e.source + '>>' + e.target], src: a.srcE[e.source + '>>' + e.target],
  }));
  const refs = new Map();
  const add = (id, ref) => (refs.get(id) || refs.set(id, []).get(id)).push(ref);
  for (const [id, loc] of Object.entries(a.src)) add(id, { panel: 'fs', locator: loc });
  for (const [k, loc] of Object.entries(a.srcE)) add(k, { panel: 'fs', locator: loc });   // edge refs keyed a>>b
  for (const r of a.reflist) add(r.key, { panel: r.panel, locator: r.locator });          // # ref <panel> ...
  return makeModel({ entities, edges, refs, tours, engine: g.engine, note: g.note });
}
