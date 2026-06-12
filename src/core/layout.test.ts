import { describe, expect, it } from 'vitest'
import { gridCell, tierCells } from './layout'
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

describe('gridCell', () => {
  it('rankDir picks the tier axis', () => {
    expect(gridCell(1, 2, 3, 'TB')).toEqual({ row: 1, col: 2 })
    expect(gridCell(1, 2, 3, 'BT')).toEqual({ row: 2, col: 2 })
    expect(gridCell(1, 2, 3, 'LR')).toEqual({ row: 2, col: 1 })
    expect(gridCell(1, 2, 3, 'RL')).toEqual({ row: 2, col: 2 })
  })
})
