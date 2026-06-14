import { describe, expect, it } from 'vitest'
import { scc, topoTiers } from './tarjan'

const N = (...ids: string[]) => ids.map(id => ({ id }))
const E = (...pairs: [string, string][]) => pairs.map(([source, target]) => ({ source, target }))

describe('scc', () => {
  it('groups a cycle and flags its members', () => {
    const { cyclic, components } = scc(N('a', 'b', 'c'), E(['a', 'b'], ['b', 'a'], ['b', 'c']))
    expect(cyclic.has('a')).toBe(true)
    expect(cyclic.has('b')).toBe(true)
    expect(cyclic.has('c')).toBe(false)
    expect(components.some(g => g.length === 2)).toBe(true)
  })

  it('flags a self-loop', () => {
    expect(scc(N('a'), E(['a', 'a'])).cyclic.has('a')).toBe(true)
  })
})

describe('topoTiers', () => {
  // edge from->to means "from depends on to"; tier 0 = no dependencies.
  it('puts no-dep nodes at tier 0 and stacks consumers above', () => {
    // app -> service -> store ; store has no deps.
    const nodes = N('app', 'service', 'store')
    const edges = E(['app', 'service'], ['service', 'store'])
    const { comp } = scc(nodes, edges)
    const tier = topoTiers(nodes, edges, comp)
    expect(tier.get('store')).toBe(0)   // no outgoing deps
    expect(tier.get('service')).toBe(1)
    expect(tier.get('app')).toBe(2)     // deepest consumer
  })

  it('uses the longest dependency chain (diamond)', () => {
    // app depends on both a and b; both depend on base.
    const nodes = N('app', 'a', 'b', 'base')
    const edges = E(['app', 'a'], ['app', 'b'], ['a', 'base'], ['b', 'base'])
    const tier = topoTiers(nodes, edges, scc(nodes, edges).comp)
    expect(tier.get('base')).toBe(0)
    expect(tier.get('a')).toBe(1)
    expect(tier.get('b')).toBe(1)
    expect(tier.get('app')).toBe(2)
  })

  it('a whole cycle shares one tier', () => {
    const nodes = N('x', 'y', 'leaf')
    const edges = E(['x', 'y'], ['y', 'x'], ['x', 'leaf'])
    const tier = topoTiers(nodes, edges, scc(nodes, edges).comp)
    expect(tier.get('leaf')).toBe(0)
    expect(tier.get('x')).toBe(tier.get('y'))
    expect(tier.get('x')).toBe(1)
  })
})
