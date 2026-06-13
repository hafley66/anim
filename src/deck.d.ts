// The frames.json record shape (one frame per `## ` heading), as emitted by
// bin/build-frames.mjs. Optional fields appear only when the deck used them.
import type { RelRows } from './core/rows'

export type Anchor = { token: string; nodes: string[] }
export type FsItem = { path: string; mark: string }
export type GitCommit = { sha: string; subject: string; parents: string[] }

export type Frame = {
  title: string
  narration: string
  lang: string
  code: string
  graph: string | null
  graphSvg?: string
  chapter?: string
  chapterSlug?: string
  links?: string[]
  anchors?: Anchor[]
  fs?: FsItem[]
  git?: GitCommit[]
  atlas?: string
  atlasDb?: string
  atlasRows?: RelRows
  docs?: Record<string, string>
  spot?: string
  codeRef?: string
  include?: string
}
