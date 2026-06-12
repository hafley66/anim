import { describe, expect, it } from 'vitest'
import { parseAnnotations, parseViewSeed } from './annotations'

describe('parseAnnotations', () => {
  it('parses notes, tags, diffs, refs, src', () => {
    const a = parseAnnotations([
      '# @ Engine : the core loop',
      '# @ Engine -> Db : writes facts',
      '# tag Engine : hub, type',
      '# diff add NewThing',
      '# ref sql Engine = facts:rel=type_edge',
      '# src Engine = src/engine.rs:42',
      '# src Engine -> Db = src/engine.rs:99',
    ].join('\n'))
    expect(a.ann.Engine).toBe('the core loop')
    expect(a.annE['Engine>>Db']).toBe('writes facts')
    expect(a.tags.Engine).toEqual(['hub', 'type'])
    expect(a.diff.NewThing).toBe('add')
    expect(a.reflist).toEqual([{ panel: 'sql', key: 'Engine', locator: 'facts:rel=type_edge' }])
    expect(a.src.Engine).toBe('src/engine.rs:42')
    expect(a.srcE['Engine>>Db']).toBe('src/engine.rs:99')
  })

  it('parses steps: id rounds and round captions', () => {
    const a = parseAnnotations([
      '# step Engine = 0',
      '# step Db = 1',
      '# step 0 : the hub lands first',
    ].join('\n'))
    expect(a.steps).not.toBeNull()
    expect(a.steps!.stepOf.get('Engine')).toBe(0)
    expect(a.steps!.stepOf.get('Db')).toBe(1)
    expect(a.steps!.caps[0]).toBe('the hub lands first')
    expect(a.steps!.max).toBe(1)
  })

  it('parses named tour steps (span and focus targets, optional comment)', () => {
    const a = parseAnnotations([
      '# tour walk 0 = Engine+Db : the core pair',
      '# tour walk 1 = src/engine.rs:42..80',
    ].join('\n'))
    expect(a.tourSteps).toEqual([
      { tour: 'walk', seq: 0, target: 'Engine+Db', comment: 'the core pair' },
      { tour: 'walk', seq: 1, target: 'src/engine.rs:42..80' },
    ])
  })

  it('returns null steps and viewSeed when absent', () => {
    const a = parseAnnotations('a -> b\n')
    expect(a.steps).toBeNull()
    expect(a.tourSteps).toEqual([])
    expect(a.viewSeed).toBeNull()
  })

  it('parses the view seed with a multi-id focus set', () => {
    const a = parseAnnotations('# view focus=net.nexthop+net.route mode=cone layout=elk dir=LR iso\n')
    expect(a.viewSeed).toEqual({ focus: ['net.nexthop', 'net.route'], mode: 'cone', layout: 'elk', dir: 'LR', iso: true })
  })
})

describe('parseViewSeed', () => {
  it('single focus is a one-element set', () => {
    expect(parseViewSeed('# view focus=Engine')).toEqual({ focus: ['Engine'] })
  })
  it('non-view lines are null', () => {
    expect(parseViewSeed('# step a = 1')).toBeNull()
  })
})
