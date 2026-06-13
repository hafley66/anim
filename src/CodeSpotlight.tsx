// CodeSpotlight — the document surface for span tour steps. The file stays
// resident in a scroll container; the highlight band is one absolutely
// positioned element whose top/height CSS-transition between spans (the FLIP),
// and the scroll eases to keep the band centered (scroll constancy). All
// geometry comes from core/spotlight.ts; this file owns only DOM and easing.
// A file switch remounts the doc (keyed by file) — no cross-file tween.
//
// Syntax highlighting is OPTIONAL: pass the deck's shiki highlighter and lines
// render as colored tokens (lang from the file extension, light theme loaded
// lazily); without one (the embed) the doc stays plain monospace. Tokenizing
// never changes geometry — one .sline per line at LINE_H either way.
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { bandFor, clampSpan, scrollFor } from './core/spotlight'
import type { Span } from './core/model'

export const LINE_H = 18   // px; must match .spotlight-pre line-height in app.css
const SPOT_THEME = 'github-light'   // the spotlight surface is light; the deck theme (nord) is dark
const LANG_BY_EXT: Record<string, string> = {
  rs: 'rust', ts: 'typescript', tsx: 'tsx', js: 'javascript', jsx: 'jsx', mjs: 'javascript',
  py: 'python', go: 'go', c: 'c', h: 'c', cc: 'cpp', cpp: 'cpp', java: 'java', rb: 'ruby',
  sql: 'sql', sh: 'bash', bash: 'bash', json: 'json', toml: 'toml', yaml: 'yaml', yml: 'yaml',
  md: 'markdown', css: 'css', html: 'html', d2: 'text', dl: 'prolog',
}
export const langOf = (file: string) => LANG_BY_EXT[file.split('.').pop()!.toLowerCase()] || 'text'

type Token = { content: string; color?: string }

export type CodeSpotlightProps = {
  docs?: Record<string, string>
  span: Span
  commentHTML?: string
  onClose?: () => void
  highlighter?: any   // shiki highlighter instance; absent -> plain text
}

export default function CodeSpotlight({ docs = {}, span, commentHTML, onClose, highlighter }: CodeSpotlightProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const doc = docs[span.file]
  const lines = useMemo(() => (doc == null ? [] : doc.replace(/\n$/, '').split('\n')), [doc])
  const s = clampSpan(span, lines.length || 1)
  const band = bandFor(span, LINE_H, lines.length || 1)
  const [toks, setToks] = useState<Token[][] | null>(null)

  // tokenize per file (not per span): lang + theme load lazily, plain on any failure
  useEffect(() => {
    let alive = true
    setToks(null)
    if (!highlighter || doc == null) return
    ;(async () => {
      try {
        const lang = langOf(span.file)
        if (lang === 'text') return
        if (!highlighter.getLoadedLanguages().includes(lang)) await highlighter.loadLanguage(lang)
        if (!highlighter.getLoadedThemes().includes(SPOT_THEME)) await highlighter.loadTheme(SPOT_THEME)
        const out = highlighter.codeToTokensBase(doc.replace(/\n$/, ''), { lang, theme: SPOT_THEME }) as Token[][]
        if (alive) setToks(out)
      } catch (e) { console.warn('spotlight highlight failed, staying plain:', e) }
    })()
    return () => { alive = false }
  }, [span.file, doc, highlighter])

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
                    <span className="sno">{i + 1}</span>
                    {toks && toks[i]
                      ? toks[i].map((t, j) => <span key={j} style={t.color ? { color: t.color } : undefined}>{t.content}</span>)
                      : l}
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
