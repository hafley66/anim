import { describe, expect, it } from 'vitest'
import { diff, runTransition, transitionRefs, transitionViews } from './transition'
import type { View } from './model'

const view = (ids: string[], eids: string[] = []): View =>
  ({ entityIds: new Set(ids), edgeIds: new Set(eids), focus: [] })

describe('diff', () => {
  it('partitions into keep/enter/exit', () => {
    const d = diff(['a', 'b'], ['b', 'c'])
    expect([...d.keep]).toEqual(['b'])
    expect([...d.enter]).toEqual(['c'])
    expect([...d.exit]).toEqual(['a'])
  })
  it('treats null prev as all-enter', () => {
    const d = diff(null, ['a'])
    expect([...d.enter]).toEqual(['a'])
    expect(d.keep.size).toBe(0)
    expect(d.exit.size).toBe(0)
  })
})

describe('runTransition', () => {
  it('fires enter, then move, then exit', () => {
    const calls: string[] = []
    runTransition({
      prev: ['a', 'b'], next: ['b', 'c'],
      enter: id => calls.push('enter:' + id),
      move: id => calls.push('move:' + id),
      exit: id => calls.push('exit:' + id),
    })
    expect(calls).toEqual(['enter:c', 'move:b', 'exit:a'])
  })
})

describe('transitionViews', () => {
  it('diffs nodes and edges together; layout sees kept+born', () => {
    let visible: Set<string> | null = null
    const r = transitionViews(view(['a', 'b'], ['e1']), view(['b', 'c'], ['e2']), {
      layout: v => { visible = v },
    })
    expect([...r.nodes.enter]).toEqual(['c'])
    expect([...r.edges.exit]).toEqual(['e1'])
    expect([...visible!].sort()).toEqual(['b', 'c'])
  })
})

describe('transitionRefs', () => {
  it('keys by panel:locator and hands rows to hooks', () => {
    const entered: string[] = []
    transitionRefs(
      [{ id: 'x', panel: 'fs', locator: 'a.rs' }],
      [{ id: 'x', panel: 'fs', locator: 'a.rs' }, { id: 'y', panel: 'fs', locator: 'b.rs' }],
      { enter: r => entered.push(r.locator) },
    )
    expect(entered).toEqual(['b.rs'])
  })
})
