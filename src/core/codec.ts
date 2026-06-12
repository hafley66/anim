// core/codec.ts — the shareable view-state payload: 'k:v,k:v' (the ?av= URL
// param). Pure string <-> object; reading location / writing history stays in
// the renderer. A multi-id focus set is '+'-joined: focus:a+b,mode:cone.

export function encodeAtlasState(s: Record<string, string | boolean | null | undefined>): string {
  return Object.entries(s)
    .map(([k, v]) => [k, v === true ? '1' : v === false ? '' : v] as const)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${k}:${v}`)
    .join(',')
}

export function decodeAtlasState(str: string | null | undefined): Record<string, string> | null {
  if (!str) return null
  const s: Record<string, string> = {}
  for (const kv of str.split(',')) { const [k, v] = kv.split(':'); if (k) s[k] = v ?? '' }
  return s
}

// the focus set inside a payload: '+'-joined ids.
export const encodeFocus = (ids: string[]): string => ids.join('+')
export const decodeFocus = (v: string | undefined | null): string[] => (v ? v.split('+').filter(Boolean) : [])

// a tour-step target string (the rel tour_step.target encoding, also used by the
// `# tour` annotation): 'file:lo..hi' is a span; otherwise '+'-joined node ids
// form a (multi-)focus.
export function parseTarget(s: string): import('./model').Target {
  const m = s.match(/^(.+):(\d+)\.\.(\d+)$/)
  if (m) return { span: { file: m[1] as string, lo: +(m[2] as string), hi: +(m[3] as string) } }
  return { focus: decodeFocus(s) }
}
