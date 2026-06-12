import { describe, expect, it } from 'vitest'
import { buildAdj, cone, detailFor, detailForEdge, fullView, hopDistances, identRefs, pathFrontier, reachableRefs, resolveIdent } from './views'
import { entity, makeModel } from './model'

// a -> b -> c ; x -> b (so b has two callers' worth of upstream)
const model = makeModel({
  entities: ['a', 'b', 'c', 'x'].map(id => entity({ id, note: id === 'a' ? 'root note' : undefined })),
  edges: [
    { id: 'a>>b#0', source: 'a', target: 'b', label: '', kind: 'dep' },
    { id: 'b>>c#0', source: 'b', target: 'c', label: '', kind: 'dep' },
    { id: 'x>>b#0', source: 'x', target: 'b', label: '', kind: 'dep' },
  ],
  refs: new Map([
    ['a', [{ panel: 'fs', locator: 'src/a.rs:1' }]],
    ['a>>b', [{ panel: 'fs', locator: 'src/ab.rs:9' }]],
  ]),
})
const adj = buildAdj(model)

describe('cone over a focus set', () => {
  it('single focus: both directions by default', () => {
    const v = cone(model, ['b'], 'cone', adj)
    expect([...v.entityIds].sort()).toEqual(['a', 'b', 'c', 'x'])
    expect(v.focus).toEqual(['b'])
  })
  it('downstream / upstream / neighbors modes', () => {
    expect([...cone(model, ['a'], 'downstream', adj).entityIds].sort()).toEqual(['a', 'b', 'c'])
    expect([...cone(model, ['c'], 'upstream', adj).entityIds].sort()).toEqual(['a', 'b', 'c', 'x'])
    expect([...cone(model, ['b'], 'neighbors', adj).entityIds].sort()).toEqual(['a', 'b', 'c', 'x'])
  })
  it('multi-focus unions per-focus reach and keeps all focal ids', () => {
    const v = cone(model, ['a', 'x'], 'downstream', adj)
    expect([...v.entityIds].sort()).toEqual(['a', 'b', 'c', 'x'])
    expect(v.focus).toEqual(['a', 'x'])
  })
  it('edges are those among visible ids', () => {
    const v = cone(model, ['a'], 'downstream', adj)
    expect(v.edgeIds.has('a>>b#0')).toBe(true)
    expect(v.edgeIds.has('x>>b#0')).toBe(false)
  })
})

describe('hopDistances', () => {
  it('positive downstream, negative upstream', () => {
    const d = hopDistances(adj, 'b')
    expect(d.get('b')).toBe(0)
    expect(d.get('c')).toBe(1)
    expect(d.get('a')).toBe(-1)
    expect(d.get('x')).toBe(-1)
  })
})

describe('fullView / pathFrontier', () => {
  it('fullView shows everything, focuses nothing', () => {
    const v = fullView(model)
    expect(v.entityIds.size).toBe(4)
    expect(v.edgeIds.size).toBe(3)
    expect(v.focus).toEqual([])
  })
  it('pathFrontier walks a prefix', () => {
    const v = pathFrontier(model, ['a', 'b', 'c'], 1)
    expect([...v.entityIds].sort()).toEqual(['a', 'b'])
    expect(v.edgeIds.has('a>>b#0')).toBe(true)
    expect(v.focus).toEqual(['b'])
  })
})

describe('details and refs', () => {
  it('detailFor groups refs by panel', () => {
    const d = detailFor(model, 'a')!
    expect(d.note).toBe('root note')
    expect(d.byPanel.fs).toEqual(['src/a.rs:1'])
    expect(detailFor(model, 'nope')).toBeNull()
  })
  it('detailForEdge reads `src>>tgt` refs', () => {
    const d = detailForEdge(model, 'a', 'b', 'calls into')
    expect(d.id).toBe('a → b')
    expect(d.note).toBe('calls into')
    expect(d.byPanel.fs).toEqual(['src/ab.rs:9'])
  })
  it('reachableRefs filters by panel and view', () => {
    const rows = reachableRefs(model, { entityIds: new Set(['a']) }, 'fs')
    expect(rows).toEqual([{ id: 'a', panel: 'fs', locator: 'src/a.rs:1' }])
  })
})

describe('periscope: resolveIdent / identRefs', () => {
  const m = makeModel({
    entities: [
      entity({ id: 'net.route', label: 'route' }),
      entity({ id: 'net.ip', label: 'IP' }),
      entity({ id: 'route' }),                       // bare id colliding with a lastSeg
    ],
    refs: new Map([
      ['net.route', [{ panel: 'fs', locator: 'frr/zebra/zebra_rib.c:120' }, { panel: 'sql', locator: 'routes:dest=10/8' }]],
      ['route', [{ panel: 'fs', locator: 'src/route.rs:1' }]],
    ]),
  })
  it('matches id, label, and last id segment, case-insensitive', () => {
    expect(resolveIdent(m, 'net.route')).toEqual(['net.route'])
    expect(resolveIdent(m, 'ip')).toEqual(['net.ip'])
    expect(resolveIdent(m, 'ROUTE').sort()).toEqual(['net.route', 'route'])
    expect(resolveIdent(m, 'nope')).toEqual([])
  })
  it('identRefs filters to one panel across all matches', () => {
    expect(identRefs(m, 'route').map(r => r.locator).sort()).toEqual(['frr/zebra/zebra_rib.c:120', 'src/route.rs:1'])
    expect(identRefs(m, 'route', 'sql')).toEqual([{ id: 'net.route', panel: 'sql', locator: 'routes:dest=10/8' }])
    expect(identRefs(m, 'ip')).toEqual([])
  })
})
