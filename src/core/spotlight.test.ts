import { describe, expect, it } from 'vitest'
import { bandFor, clampSpan, scrollFor } from './spotlight'

const span = (lo: number, hi: number) => ({ file: 'a.rs', lo, hi })

describe('clampSpan', () => {
  it('keeps an in-range span', () => {
    expect(clampSpan(span(3, 7), 10)).toEqual(span(3, 7))
  })
  it('clamps lo to 1 and hi to lineCount', () => {
    expect(clampSpan(span(0, 99), 10)).toEqual(span(1, 10))
  })
  it('a span past EOF collapses to the last line', () => {
    expect(clampSpan(span(20, 30), 10)).toEqual(span(10, 10))
  })
  it('hi never drops below lo', () => {
    expect(clampSpan(span(5, 2), 10)).toEqual(span(5, 5))
  })
})

describe('bandFor', () => {
  it('1-based inclusive lines -> pixel band', () => {
    expect(bandFor(span(1, 1), 18, 10)).toEqual({ top: 0, height: 18 })
    expect(bandFor(span(3, 7), 18, 10)).toEqual({ top: 36, height: 90 })
  })
})

describe('scrollFor', () => {
  it('centers the band in the viewport', () => {
    expect(scrollFor({ top: 500, height: 100 }, 300, 2000)).toBe(400)
  })
  it('clamps to the top of the document', () => {
    expect(scrollFor({ top: 0, height: 18 }, 300, 2000)).toBe(0)
  })
  it('clamps to the bottom of the scroll range', () => {
    expect(scrollFor({ top: 1980, height: 18 }, 300, 2000)).toBe(1700)
  })
  it('a band taller than the viewport pins to its top', () => {
    expect(scrollFor({ top: 200, height: 600 }, 300, 2000)).toBe(200)
  })
  it('a doc shorter than the viewport stays at 0', () => {
    expect(scrollFor({ top: 10, height: 18 }, 300, 100)).toBe(0)
  })
})
