// CodeSpotlight — the document surface for span tour steps. The file stays
// resident in a scroll container; the highlight band is one absolutely
// positioned element whose top/height CSS-transition between spans (the FLIP),
// and the scroll eases to keep the band centered (scroll constancy). All
// geometry comes from core/spotlight.ts; this file owns only DOM and easing.
// A file switch remounts the doc (keyed by file) — no cross-file tween.
import React, { useLayoutEffect, useMemo, useRef } from 'react'
import { bandFor, clampSpan, scrollFor } from './core/spotlight'

export const LINE_H = 18   // px; must match .spotlight-pre line-height in app.css

export default function CodeSpotlight({ docs = {}, span, commentHTML, onClose }) {
  const scrollRef = useRef(null)
  const doc = docs[span.file]
  const lines = useMemo(() => (doc == null ? [] : doc.replace(/\n$/, '').split('\n')), [doc])
  const s = clampSpan(span, lines.length || 1)
  const band = bandFor(span, LINE_H, lines.length || 1)

  useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el || doc == null) return
    el.scrollTo({ top: scrollFor(band, el.clientHeight, lines.length * LINE_H), behavior: 'smooth' })
  }, [span.file, span.lo, span.hi, doc])

  return (
    <div className="spotlight">
      <div className="spotlight-head">
        <span className="spotlight-file">{span.file}</span>
        <span className="spotlight-range">{s.lo}..{s.hi}</span>
        {onClose && <button className="atlas-btn spotlight-close" onClick={onClose} title="close spotlight">✕</button>}
      </div>
      {doc == null
        ? <div className="spotlight-missing">no doc loaded for <code>{span.file}</code> — add <code>doc: {span.file}</code> to the frame</div>
        : (
          <div className="spotlight-scroll" ref={scrollRef}>
            <div className="spotlight-doc" key={span.file} style={{ height: lines.length * LINE_H }}>
              <div className="spotlight-band" style={{ top: band.top, height: band.height }} />
              <pre className="spotlight-pre">
                {lines.map((l, i) => (
                  <div key={i} className={`sline${i + 1 >= s.lo && i + 1 <= s.hi ? ' lit' : ''}`}>
                    <span className="sno">{i + 1}</span>{l}
                  </div>
                ))}
              </pre>
            </div>
          </div>
        )}
      {commentHTML && <div className="spotlight-cap" dangerouslySetInnerHTML={{ __html: commentHTML }} />}
    </div>
  )
}
