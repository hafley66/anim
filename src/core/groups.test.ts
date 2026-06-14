import { describe, expect, it } from 'vitest'
import { groupRows, kindOf, groupForest } from './groups'
import { entity, edge, makeModel, type Ref } from './model'

const model = (entities: any[], edges: any[] = [], refs = new Map<string, Ref[]>()) =>
  makeModel({ entities, edges, refs })

describe('groupRows', () => {
  it('container: dotted container becomes a slash path ending at the label', () => {
    const m = model([entity({ id: 'wg', label: 'wg', container: 'vpn.tunnels' }), entity({ id: 'top', label: 'top' })])
    const rows = groupRows(m, 'container')
    expect(rows.find(r => r.id === 'wg')!.locator).toBe('vpn/tunnels/wg')
    expect(rows.find(r => r.id === 'top')!.locator).toBe('top')   // root -> no bucket
  })

  it('tag: a multi-tag node appears once per tag; untagged gets a bucket', () => {
    const m = model([entity({ id: 'a', label: 'a', tags: ['net', 'core'] }), entity({ id: 'b', label: 'b' })])
    const rows = groupRows(m, 'tag')
    expect(rows.filter(r => r.id === 'a').map(r => r.locator).sort()).toEqual(['core/a', 'net/a'])
    expect(rows.find(r => r.id === 'b')!.locator).toBe('(untagged)/b')
  })

  it('source: folder of the fs ref; missing source falls into a bucket', () => {
    const refs = new Map<string, Ref[]>([['a', [{ panel: 'fs', locator: 'src/server/api.ts:42' }]]])
    const m = model([entity({ id: 'a', label: 'a' }), entity({ id: 'b', label: 'b' })], [], refs)
    const rows = groupRows(m, 'source')
    expect(rows.find(r => r.id === 'a')!.locator).toBe('src/server/a')
    expect(rows.find(r => r.id === 'b')!.locator).toBe('(no source)/b')
  })
})

describe('kindOf', () => {
  it('classifies api (no incoming), leaf (no outgoing), cycle, node', () => {
    // app -> mid -> store ; x <-> y cycle
    const ents = ['app', 'mid', 'store', 'x', 'y'].map(id => entity({ id }))
    const edges = [
      edge({ source: 'app', target: 'mid' }),
      edge({ source: 'mid', target: 'store' }),
      edge({ source: 'x', target: 'y' }, 0),
      edge({ source: 'y', target: 'x' }, 1),
    ]
    const k = kindOf(model(ents, edges))
    expect(k.get('app')).toBe('api')     // nothing points at app
    expect(k.get('store')).toBe('leaf')  // store points at nothing
    expect(k.get('mid')).toBe('node')    // has both
    expect(k.get('x')).toBe('cycle')
    expect(k.get('y')).toBe('cycle')
  })
})

describe('groupForest', () => {
  it('buckets entities under their dimension with leaf ids intact', () => {
    const m = model([entity({ id: 'wg', label: 'wg', container: 'vpn' }), entity({ id: 'fw', label: 'fw', container: 'vpn' })])
    const forest = groupForest(m, 'container')
    const vpn = forest.find(n => n.label === 'vpn')!
    expect(vpn.children!.map(c => c.ids[0]).sort()).toEqual(['fw', 'wg'])
  })
})
