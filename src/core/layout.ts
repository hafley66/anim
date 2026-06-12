// core/layout.ts — pure layout prep for the d2-grid feel: every node sits in an
// exact (tier, column) cell. Tiers come from tarjan.topoTiers; this assigns a
// stable column within each tier and maps (tier, col) to a grid cell per rankDir.

import type { Entity } from './model'

export type RankDir = 'TB' | 'LR' | 'BT' | 'RL'

// stable column index within each tier, in entity order.
export function tierCells(entities: Entity[], tierMap: Map<string, number>): { tcol: Map<string, number>; maxTier: number } {
  const tcol = new Map<string, number>(), fill = new Map<number, number>()
  let maxTier = 0
  for (const e of entities) {
    const t = tierMap.get(e.id) || 0
    maxTier = Math.max(maxTier, t)
    const c = fill.get(t) || 0
    tcol.set(e.id, c)
    fill.set(t, c + 1)
  }
  return { tcol, maxTier }
}

// (tier, col) -> grid cell; rankDir picks the tier axis and its direction.
export function gridCell(tier: number, tcol: number, maxTier: number, rankDir: RankDir): { row: number; col: number } {
  switch (rankDir) {
    case 'LR': return { row: tcol, col: tier }
    case 'RL': return { row: tcol, col: maxTier - tier }
    case 'BT': return { row: maxTier - tier, col: tcol }
    default:   return { row: tier, col: tcol }   // TB
  }
}
