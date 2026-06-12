import React from 'react'
import { createRoot } from 'react-dom/client'
import { createHighlighter } from 'shiki'
import 'shiki-magic-move/style.css'
import './app.css'
import Frames from './Frames'
import framesData from './frames.json'
import glossary from './glossary.json'
import type { Frame } from './deck'

// frames.json is build output: the literal type tsc infers from the current
// file contents is an accident of this build, not the contract. deck.d.ts is.
const frames = framesData as unknown as Frame[]

const theme = 'nord'
const langs = [...new Set(frames.map((f) => f.lang))]

const root = createRoot(document.getElementById('root')!)

createHighlighter({ themes: [theme], langs }).then((highlighter) => {
  root.render(<Frames frames={frames} highlighter={highlighter} theme={theme} glossary={glossary} />)
})
