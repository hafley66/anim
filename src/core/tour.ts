// core/tour.ts — the ONE sequencing concept. The `# step` round player, the
// legacy named-tour sequences, and span walks are all Tours: ordered TourSteps
// whose target says what to look at and whose comment says why.
// tourView turns (tour, i) into a View; the renderer diffs Views, nothing else.

import type { Model, Tour, TourStep } from './model'
import type { Steps } from './annotations'
import type { TourRow, TourStepRow } from './rows'
import type { Adj } from './views'
import { parseTarget } from './codec'
import { buildAdj, cone, pathFrontier } from './views'

// '# step' rounds -> one reveal step per round (0..max), caption as comment.
export function tourFromSteps(steps: Steps, id = 'rounds'): Tour {
  const byRound = new Map<number, string[]>()
  for (const [nid, n] of steps.stepOf) (byRound.get(n) || byRound.set(n, []).get(n)!).push(nid)
  const out: TourStep[] = []
  for (let n = 0; n <= steps.max; n++) {
    out.push({ target: { reveal: (byRound.get(n) || []).sort() }, ...(steps.caps[n] ? { comment: steps.caps[n] } : {}) })
  }
  return { id, steps: out }
}

export type LegacyTourStep = { focus?: string; path?: string[]; note?: string }

// legacy tours-prop sequences ({focus} / {path} objects) -> a Tour.
export function tourFromSequence(name: string, seq: LegacyTourStep[]): Tour {
  return {
    id: name,
    steps: seq.map(s => ({
      target: s.path ? { path: s.path } : { focus: s.focus ? [s.focus] : [] },
      ...(s.note ? { comment: s.note } : {}),
    })),
  }
}

// raw tour_step rows (rel table or `# tour` annotation) -> Tours. Tour order:
// the tour-row list first, then ids that only appear in steps (first appearance).
// Row shapes live in rows.ts (the rel schema mirror); the import is type-only.
export function toursFromRows(steps: TourStepRow[], tours: TourRow[] = []): Tour[] {
  const stepsOf = new Map<string, TourStepRow[]>()
  for (const s of steps) (stepsOf.get(s.tour) || stepsOf.set(s.tour, []).get(s.tour)!).push(s)
  const rows: TourRow[] = [...tours]
  for (const id of stepsOf.keys()) if (!rows.some(t => t.id === id)) rows.push({ id })
  return rows.map(t => ({
    id: t.id, ...(t.title ? { title: t.title } : {}),
    steps: (stepsOf.get(t.id) || []).sort((a, b) => a.seq - b.seq)
      .map(s => ({ target: parseTarget(s.target), ...(s.comment ? { comment: s.comment } : {}) })),
  }))
}

const isReveal = (t: TourStep['target']): t is { reveal: string[] } => 'reveal' in t

// (tour, i) -> View. Reveal semantics reproduce the round player exactly:
// ids never revealed by ANY step are permanent context; revealed ids appear
// cumulatively. Span steps return null (a document surface, not a graph view).
export function tourView(model: Model, tour: Tour, i: number, adj: Adj = buildAdj(model)): import('./model').View | null {
  const s = tour.steps[i]
  if (!s) return null
  const t = s.target
  if ('span' in t) return null
  if ('focus' in t) return cone(model, t.focus, t.mode || 'cone', adj)
  if ('path' in t) return pathFrontier(model, t.path, t.at ?? t.path.length - 1)
  // reveal: cumulative
  const mentioned = new Set<string>()
  for (const st of tour.steps) if (isReveal(st.target)) for (const id of st.target.reveal) mentioned.add(id)
  const shown = new Set<string>()
  for (let k = 0; k <= i; k++) { const st = tour.steps[k]; if (st && isReveal(st.target)) for (const id of st.target.reveal) shown.add(id) }
  const ids = new Set<string>()
  for (const e of model.entities) if (!mentioned.has(e.id) || shown.has(e.id)) ids.add(e.id)
  const edgeIds = new Set(model.edges.filter(e => ids.has(e.source) && ids.has(e.target)).map(e => e.id))
  return { entityIds: ids, edgeIds, focus: [] }
}
