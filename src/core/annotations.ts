// core/annotations.ts — the `#` comment annotations the d2 compiler ignores but
// we scan: notes, tags, diffs, refs, src locators, the round-player steps and
// the frame's pinned opening view. Pure text -> data; no model knowledge.

import type { ViewSeed } from './model'
import type { TourStepRow } from './rows'

export type Steps = { stepOf: Map<string, number>; caps: Record<number, string>; max: number }

export type Annotations = {
  ann: Record<string, string>
  annE: Record<string, string>
  diff: Record<string, 'add' | 'del' | 'mod'>
  src: Record<string, string>
  srcE: Record<string, string>
  tags: Record<string, string[]>
  reflist: Array<{ panel: string; key: string; locator: string }>
  steps: Steps | null
  tourSteps: TourStepRow[]
  viewSeed: ViewSeed | null
}

const ek = (k: string): string => (k.includes('->') ? k.split('->').map(s => s.trim()).join('>>') : k)

export function parseAnnotations(text: string): Annotations {
  const ann: Record<string, string> = {}, annE: Record<string, string> = {}
  const diff: Record<string, 'add' | 'del' | 'mod'> = {}
  const src: Record<string, string> = {}, srcE: Record<string, string> = {}
  const tags: Record<string, string[]> = {}
  const reflist: Array<{ panel: string; key: string; locator: string }> = []
  const stepOf = new Map<string, number>(), caps: Record<number, string> = {}
  const tourSteps: TourStepRow[] = []
  let max = -1
  let viewSeed: ViewSeed | null = null
  for (const raw of text.split('\n')) {
    const tr = raw.trim(); let m: RegExpMatchArray | null
    if ((m = tr.match(/^#\s*@\s*(.+?)\s*:\s*(.+)$/))) {
      const k = m[1].trim(), v = m[2].trim()
      if (k.includes('->')) { const [a, b] = k.split('->').map(s => s.trim()); annE[a + '>>' + b] = v } else ann[k] = v
      continue
    }
    if ((m = tr.match(/^#\s*tag\s+(.+?)\s*:\s*(.+)$/i))) { tags[m[1].trim()] = m[2].split(',').map(s => s.trim()).filter(Boolean); continue }
    if ((m = tr.match(/^#\s*diff\s+(add|del|mod)\s+(.+)$/i))) { diff[m[2].trim()] = m[1].toLowerCase() as 'add' | 'del' | 'mod'; continue }
    // generic per-panel ref:  # ref <panel> <id|a->b> = <locator>
    if ((m = tr.match(/^#\s*ref\s+(\w+)\s+(.+?)\s*=\s*(.+)$/i))) {
      reflist.push({ panel: m[1].toLowerCase(), key: ek(m[2].trim()), locator: m[3].trim() }); continue
    }
    if ((m = tr.match(/^#\s*src\s+(.+?)\s*=\s*(.+)$/i))) {                 // fs shorthand for `# ref fs`
      const k = m[1].trim(), v = m[2].trim()
      if (k.includes('->')) { const [a, b] = k.split('->').map(s => s.trim()); srcE[a + '>>' + b] = v } else src[k] = v
      continue
    }
    // round player:  # step <id> = <n>   |   # step <n> : <caption>
    if ((m = tr.match(/^#\s*step\s+(\S+)\s*=\s*(\d+)\s*$/i))) { const n = +m[2]; stepOf.set(m[1].trim(), n); max = Math.max(max, n); continue }
    if ((m = tr.match(/^#\s*step\s+(\d+)\s*:\s*(.+)$/i))) { const n = +m[1]; caps[n] = m[2].trim(); max = Math.max(max, n); continue }
    // named tour, one step per line (a tour_step row in text form; same target
    // encoding as rel tour_step.target):  # tour <name> <seq> = <target> [: <comment>]
    if ((m = tr.match(/^#\s*tour\s+(\S+)\s+(\d+)\s*=\s*(\S+)(?:\s+:\s*(.+))?$/i))) {
      tourSteps.push({ tour: m[1].trim(), seq: +m[2], target: m[3].trim(), ...(m[4] ? { comment: m[4].trim() } : {}) }); continue
    }
    // pinned opening view:  # view focus=a+b mode=cone layout=elk dir=LR iso
    if (/^#\s*view\b/i.test(tr) && !viewSeed) viewSeed = parseViewSeed(tr)
  }
  const steps: Steps | null = (stepOf.size || Object.keys(caps).length) ? { stepOf, caps, max } : null
  return { ann, annE, diff, src, srcE, tags, reflist, steps, tourSteps, viewSeed }
}

// `# view focus=net.nexthop+net.route mode=cone layout=elk dir=LR iso`
// focus is '+'-joined (a multi-id set); bare tokens are boolean flags.
export function parseViewSeed(line: string): ViewSeed | null {
  if (!/^#\s*view\b/i.test(line.trim())) return null
  const seed: ViewSeed = {}
  for (const tok of line.trim().replace(/^#\s*view\s*/i, '').split(/\s+/)) {
    if (!tok) continue
    const [k, v] = tok.includes('=') ? tok.split('=') : [tok, '1']
    const key = k.toLowerCase()
    if (key === 'focus') seed.focus = v.split('+').filter(Boolean)
    else if (key === 'iso') seed.iso = v === '1' || v === 'true'
    else if (key === 'mode') seed.mode = v
    else if (key === 'layout') seed.layout = v
    else if (key === 'dir') seed.dir = v
  }
  return seed
}
