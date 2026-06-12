import { describe, expect, it } from 'vitest'
import { modelFromRows, parseTarget } from './rows'

describe('parseTarget', () => {
  it('file:lo..hi is a span', () => {
    expect(parseTarget('src/engine.rs:120..280')).toEqual({ span: { file: 'src/engine.rs', lo: 120, hi: 280 } })
  })
  it('ids (single or +-joined) are a focus set', () => {
    expect(parseTarget('Engine')).toEqual({ focus: ['Engine'] })
    expect(parseTarget('Engine+Db')).toEqual({ focus: ['Engine', 'Db'] })
  })
})

describe('modelFromRows', () => {
  const model = modelFromRows({
    nodes: [{ id: 'Engine', kind: 'type' }, { id: 'Db' }, { id: 'pkg.Inner' }],
    edges: [{ f: 'Engine', t: 'Db', kind: 'field' }],
    tags: [
      { node: 'Engine', ns: 'tag', value: 'hub' },
      { node: 'Engine', ns: 'audience', value: 'frontend' },
    ],
    tours: [{ id: 'onboarding', title: 'start here' }],
    tour_steps: [
      { tour: 'onboarding', seq: 2, target: 'src/db.rs:1..40', comment: 'then the seam' },
      { tour: 'onboarding', seq: 1, target: 'Engine+Db', comment: 'the core pair' },
    ],
    cards: [{ id: 'card.why', body: 'Engine drives everything' }],
    card_about: [{ card: 'card.why', node: 'Engine' }],
    views: [{ id: 'default', focus: 'Engine', mode: 'cone' }],
    refs: [{ node: 'Engine', panel: 'fs', locator: 'src/engine.rs:1' }],
  })

  it('nodes become entities; dotted ids nest; tags fold ns:value', () => {
    const eng = model.entities.find(e => e.id === 'Engine')!
    expect(eng.kind).toBe('type')
    expect(eng.tags).toEqual(['hub', 'audience:frontend'])
    expect(model.entities.find(e => e.id === 'pkg.Inner')!.container).toBe('pkg')
  })

  it('cards are entities with the body as note, linked by about-edges', () => {
    const card = model.entities.find(e => e.id === 'card.why')!
    expect(card.kind).toBe('card')
    expect(card.note).toBe('Engine drives everything')
    expect(model.edges.some(e => e.source === 'card.why' && e.target === 'Engine' && e.kind === 'about')).toBe(true)
  })

  it('tour steps sort by seq and parse targets', () => {
    const t = model.tours[0]
    expect(t.id).toBe('onboarding')
    expect(t.steps[0]).toEqual({ target: { focus: ['Engine', 'Db'] }, comment: 'the core pair' })
    expect(t.steps[1].target).toEqual({ span: { file: 'src/db.rs', lo: 1, hi: 40 } })
  })

  it('refs and named view seeds land', () => {
    expect(model.refs.get('Engine')).toEqual([{ panel: 'fs', locator: 'src/engine.rs:1' }])
    expect(model.seeds!.default).toEqual({ focus: ['Engine'], mode: 'cone' })
  })
})
