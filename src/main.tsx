import React from 'react'
import { createRoot } from 'react-dom/client'
import { createHighlighterCore } from 'shiki/core'
import 'shiki-magic-move/style.css'
import './app.css'
import Frames from './Frames'
import { langOf } from './CodeSpotlight'
import framesData from './frames.json'
import glossary from './glossary.json'
import type { Frame } from './deck'

// frames.json is build output: the literal type tsc infers from the current
// file contents is an accident of this build, not the contract. deck.d.ts is.
const frames = framesData as unknown as Frame[]

const theme = 'nord'

// Fine-grained shiki, not the bundled entry: the single-file deck build folds
// every dynamic import in, so the reachable set must stay at the langs a deck
// can actually use (frame code blocks + spotlight doc extensions). The wasm
// engine arrives base64-inlined — no fetch, so file:// works.
const LANG_IMPORTS: Record<string, () => Promise<unknown>> = {
  rust: () => import('shiki/langs/rust.mjs'),
  prolog: () => import('shiki/langs/prolog.mjs'),
  typescript: () => import('shiki/langs/typescript.mjs'),
  tsx: () => import('shiki/langs/tsx.mjs'),
  javascript: () => import('shiki/langs/javascript.mjs'),
  json: () => import('shiki/langs/json.mjs'),
  bash: () => import('shiki/langs/bash.mjs'),
  sql: () => import('shiki/langs/sql.mjs'),
  markdown: () => import('shiki/langs/markdown.mjs'),
  c: () => import('shiki/langs/c.mjs'),
  go: () => import('shiki/langs/go.mjs'),
  python: () => import('shiki/langs/python.mjs'),
}

const wanted = new Set<string>(frames.map((f) => f.lang))
for (const f of frames) for (const p of Object.keys(f.docs || {})) wanted.add(langOf(p))
const missing = [...wanted].filter((l) => l !== 'text' && !LANG_IMPORTS[l])
if (missing.length) console.warn('deck langs without a grammar import (render plain):', missing)

const root = createRoot(document.getElementById('root')!)

createHighlighterCore({
  themes: [import('shiki/themes/nord.mjs'), import('shiki/themes/github-light.mjs')],
  langs: [...wanted].filter((l) => LANG_IMPORTS[l]).map((l) => LANG_IMPORTS[l]() as never),
  loadWasm: import('shiki/wasm'),
}).then((highlighter) => {
  root.render(<Frames frames={frames} highlighter={highlighter} theme={theme} glossary={glossary} />)
})
