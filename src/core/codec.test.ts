import { describe, expect, it } from 'vitest'
import { decodeAtlasState, decodeFocus, encodeAtlasState, encodeFocus } from './codec'

describe('atlas state codec', () => {
  it('roundtrips, dropping empty values', () => {
    const enc = encodeAtlasState({ focus: 'a+b', mode: 'cone', layout: 'elk', dir: 'LR', iso: '' })
    expect(enc).toBe('focus:a+b,mode:cone,layout:elk,dir:LR')
    expect(decodeAtlasState(enc)).toEqual({ focus: 'a+b', mode: 'cone', layout: 'elk', dir: 'LR' })
  })
  it('booleans encode as 1 / dropped', () => {
    expect(encodeAtlasState({ iso: true, heat: false })).toBe('iso:1')
  })
  it('decode of empty input is null', () => {
    expect(decodeAtlasState('')).toBeNull()
    expect(decodeAtlasState(null)).toBeNull()
  })
})

describe('focus set codec', () => {
  it('multi-id focus is +-joined', () => {
    expect(encodeFocus(['a', 'b'])).toBe('a+b')
    expect(decodeFocus('a+b')).toEqual(['a', 'b'])
    expect(decodeFocus('')).toEqual([])
    expect(decodeFocus(undefined)).toEqual([])
  })
})
