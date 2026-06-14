import './embed-shim.js'   // MUST be first: defines globalThis.process before react-dom evaluates
// <atlas-graph> — a custom element that mounts the EXISTING React AtlasPanel.
// No port: the d2 config is this element's `<script type="application/atlas">`
// child (or its text), and we just createRoot().render(<AtlasPanel d2={...}/>).
// Light DOM (not shadow) so app.css + the :root --atlas-* theme reach the panel.
import { createRoot } from 'react-dom/client'
import AtlasPanel from './AtlasPanel'
import './app.css'

class AtlasGraph extends HTMLElement {
  connectedCallback() {
    // If our loader ran before this element was parsed (e.g. <script> in <head>),
    // connectedCallback fires before the child config <script> exists. Wait for the
    // document to finish parsing so the config is present, then mount.
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => this._mount(), { once: true })
    else this._mount()
  }
  _root: ReturnType<typeof createRoot> | null = null
  _mount() {
    if (this._root) return
    // Two config shapes:
    //   <script type="application/atlas+json">{"d2":"...","tours":{...},"docs":{...}}</script>
    //   <script type="application/atlas">raw d2 text</script>   (back-compat; tours dropped)
    // The +json form is what bin/atlas-file.mjs emits so a standalone file can carry tours.
    const json = this.querySelector('script[type="application/atlas+json"]')
    const raw = this.querySelector('script[type="application/atlas"]')
    let d2 = '', tours: Record<string, any> = {}, docs: Record<string, string> = {}
    if (json?.textContent) {
      try {
        const cfg = JSON.parse(json.textContent)
        d2 = cfg.d2 || ''
        tours = cfg.tours || {}
        docs = cfg.docs || {}
      } catch (e) { console.error('atlas+json parse failed:', e) }
    } else {
      d2 = (raw ? raw.textContent : this.textContent) || ''
    }
    this.style.display = 'block'
    if (!this.style.height) this.style.height = '100%'
    const mount = document.createElement('div')
    mount.style.height = '100%'
    this.replaceChildren(mount)          // config captured; swap it for the mount
    this._root = createRoot(mount)
    this._root.render(<AtlasPanel d2={d2} tours={tours} docs={docs} />)
  }
  disconnectedCallback() { this._root?.unmount(); this._root = null }
}
if (!customElements.get('atlas-graph')) customElements.define('atlas-graph', AtlasGraph)
