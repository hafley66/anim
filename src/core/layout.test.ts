import { describe, expect, it } from 'vitest'
import { gridCell, laneColumns, tierCells, topGroup } from './layout'
import { entity } from './model'

describe('tierCells', () => {
  it('assigns stable columns within each tier', () => {
    const ents = ['a', 'b', 'c', 'd'].map(id => entity({ id }))
    const tiers = new Map([['a', 0], ['b', 1], ['c', 1], ['d', 2]])
    const { tcol, maxTier } = tierCells(ents, tiers)
    expect(maxTier).toBe(2)
    expect(tcol.get('a')).toBe(0)
    expect(tcol.get('b')).toBe(0)
    expect(tcol.get('c')).toBe(1)   // second node in tier 1
    expect(tcol.get('d')).toBe(0)
  })
  it('missing tier defaults to 0', () => {
    const { tcol } = tierCells([entity({ id: 'z' })], new Map())
    expect(tcol.get('z')).toBe(0)
  })
})

describe('topGroup', () => {
  it('returns the ancestor just under root', () => {
    expect(topGroup('root')).toBe('')
    expect(topGroup('')).toBe('')
    expect(topGroup('vpn')).toBe('vpn')
    expect(topGroup('vpn.tunnels.wg')).toBe('vpn')
  })
})

describe('laneColumns', () => {
  const cols = (m: Map<string, number>, ids: string[]) => ids.map(i => m.get(i)!).sort((a, b) => a - b)

  it('gives each group a contiguous, disjoint column band', () => {
    // group A: a1,a2 at tier 0, a3 at tier 1 -> band width 2.  group B: b1 tier0, b2 tier1 -> width 1.
    const ents = [
      entity({ id: 'a1', container: 'A' }), entity({ id: 'a2', container: 'A' }), entity({ id: 'a3', container: 'A' }),
      entity({ id: 'b1', container: 'B' }), entity({ id: 'b2', container: 'B' }),
    ]
    const tiers = new Map([['a1', 0], ['a2', 0], ['a3', 1], ['b1', 0], ['b2', 1]])
    const { tcol } = laneColumns(ents, tiers)
    const A = cols(tcol, ['a1', 'a2', 'a3']), B = cols(tcol, ['b1', 'b2'])
    // each band is a contiguous run of columns
    expect(A).toEqual([0, 0, 1])      // width 2: {0,1}
    expect(B).toEqual([2, 2])          // width 1: {2}
    // bands don't overlap
    expect(Math.max(...A)).toBeLessThan(Math.min(...B))
  })

  it('packs same-tier members of a group into adjacent columns', () => {
    const ents = ['x1', 'x2', 'x3'].map(id => entity({ id, container: 'G' }))
    const { tcol } = laneColumns(ents, new Map([['x1', 0], ['x2', 0], ['x3', 0]]))
    expect(cols(tcol, ['x1', 'x2', 'x3'])).toEqual([0, 1, 2])
  })

  it('ungrouped nodes get their own width-1 lanes', () => {
    const ents = [entity({ id: 'g1', container: 'G' }), entity({ id: 'u' }), entity({ id: 'g2', container: 'G' })]
    const { tcol } = laneColumns(ents, new Map([['g1', 0], ['u', 0], ['g2', 1]]))
    // G is one lane (g1 col0, g2 col0); u is its own lane at the next offset
    expect(tcol.get('g1')).toBe(0)
    expect(tcol.get('g2')).toBe(0)
    expect(tcol.get('u')).toBe(1)
  })
})

describe('gridCell', () => {
  it('rankDir picks the tier axis', () => {
    expect(gridCell(1, 2, 3, 'TB')).toEqual({ row: 1, col: 2 })
    expect(gridCell(1, 2, 3, 'BT')).toEqual({ row: 2, col: 2 })
    expect(gridCell(1, 2, 3, 'LR')).toEqual({ row: 2, col: 1 })
    expect(gridCell(1, 2, 3, 'RL')).toEqual({ row: 2, col: 2 })
  })
})
