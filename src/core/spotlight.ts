// core/spotlight.ts — the code-spotlight math: a Span (1-based inclusive line
// range, the rel tour_step 'file:lo..hi' encoding) -> a highlight band and a
// scroll target, in pixels given a line height. Pure geometry; the renderer
// (CodeSpotlight) owns the DOM, the transition CSS and the smooth scroll.

import type { Span } from './model'

export type Band = { top: number; height: number }

// lo/hi into [1, lineCount], lo <= hi. A span past EOF collapses to the last line.
export function clampSpan(span: Span, lineCount: number): Span {
  const n = Math.max(1, lineCount)
  const lo = Math.min(Math.max(1, span.lo), n)
  const hi = Math.min(Math.max(lo, span.hi), n)
  return { file: span.file, lo, hi }
}

export function bandFor(span: Span, lineH: number, lineCount: number): Band {
  const s = clampSpan(span, lineCount)
  return { top: (s.lo - 1) * lineH, height: (s.hi - s.lo + 1) * lineH }
}

// center the band in the viewport, clamped to the scrollable range. A band
// taller than the viewport pins to its top.
export function scrollFor(band: Band, viewH: number, docH: number): number {
  const want = band.height >= viewH ? band.top : band.top + band.height / 2 - viewH / 2
  return Math.min(Math.max(0, want), Math.max(0, docH - viewH))
}
