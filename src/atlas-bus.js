// One shared Bus so the narration (left) and the AtlasPanel (right) light each
// other up. Hovering a node name in the prose emits HOVER; the atlas lights the
// matching cytoscape node + its rows. This is what finally uses core/bus.js.
import { Bus } from './core/bus.js'

export const atlasBus = new Bus()
export const HOVER = 'hover'   // detail = node id/name string, or null to clear
