import { describe, expect, it } from 'vitest'
import { tourFromSequence, tourFromSteps, tourView } from './tour'
import { entity, makeModel } from './model'
import type { Steps } from './annotations'

// a -> b -> c, plus ctx (never stepped) and an edge into the revealed set
const model = makeModel({
  entities: ['a', 'b', 'c', 'ctx'].map(id => entity({ id })),
  edges: [
    { id: 'a>>b#0', source: 'a', target: 'b', label: '', kind: 'dep' },
    { id: 'b>>c#0', source: 'b', target: 'c', label: '', kind: 'dep' },
    { id: 'ctx>>a#0', source: 'ctx', target: 'a', label: '', kind: 'dep' },
  ],
})

const steps: Steps = {
  stepOf: new Map([['a', 0], ['b', 1], ['c', 1]]),
  caps: { 0: 'the root' },
  max: 1,
}

describe('tourFromSteps', () => {
  it('one reveal step per round with captions as comments', () => {
    const t = tourFromSteps(steps)
    expect(t.steps).toHaveLength(2)
    expect(t.steps[0]).toEqual({ target: { reveal: ['a'] }, comment: 'the root' })
    expect(t.steps[1].target).toEqual({ reveal: ['b', 'c'] })
    expect(t.steps[1].comment).toBeUndefined()
  })
})

describe('tourView reveal semantics (must match the old round player)', () => {
  const tour = tourFromSteps(steps)
  it('unstepped nodes are permanent context', () => {
    const v0 = tourView(model, tour, 0)!
    expect(v0.entityIds.has('ctx')).toBe(true)   // never stepped -> always visible
    expect(v0.entityIds.has('a')).toBe(true)
    expect(v0.entityIds.has('b')).toBe(false)    // round 1, hidden at round 0
  })
  it('reveal is cumulative and edges need both endpoints', () => {
    const v0 = tourView(model, tour, 0)!
    expect(v0.edgeIds.has('ctx>>a#0')).toBe(true)
    expect(v0.edgeIds.has('a>>b#0')).toBe(false)
    const v1 = tourView(model, tour, 1)!
    expect(v1.entityIds.has('b')).toBe(true)
    expect(v1.entityIds.has('a')).toBe(true)     // still there from round 0
    expect(v1.edgeIds.has('a>>b#0')).toBe(true)
  })
  it('out-of-range step is null', () => {
    expect(tourView(model, tour, 5)).toBeNull()
  })
})

describe('tourView focus/path/span targets', () => {
  it('focus target cones from the focus set', () => {
    const t = { id: 't', steps: [{ target: { focus: ['b'] } }] }
    const v = tourView(model, t, 0)!
    expect(v.focus).toEqual(['b'])
    expect(v.entityIds.has('a')).toBe(true)      // upstream
    expect(v.entityIds.has('c')).toBe(true)      // downstream
  })
  it('path target is a frontier', () => {
    const t = { id: 't', steps: [{ target: { path: ['a', 'b', 'c'], at: 1 } }] }
    const v = tourView(model, t, 0)!
    expect([...v.entityIds].sort()).toEqual(['a', 'b'])
    expect(v.focus).toEqual(['b'])
  })
  it('span target is a document surface: null view', () => {
    const t = { id: 't', steps: [{ target: { span: { file: 'src/a.rs', lo: 1, hi: 9 } } }] }
    expect(tourView(model, t, 0)).toBeNull()
  })
})

describe('tourFromSequence (legacy tours prop)', () => {
  it('converts focus and path steps', () => {
    const t = tourFromSequence('walk', [{ focus: 'a' }, { path: ['a', 'b'], note: 'why' } as never])
    expect(t.id).toBe('walk')
    expect(t.steps[0].target).toEqual({ focus: ['a'] })
    expect(t.steps[1].target).toEqual({ path: ['a', 'b'] })
  })
})
