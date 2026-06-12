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
    const script = this.querySelector('script[type="application/atlas"]')
    const d2 = (script ? script.textContent : this.textContent) || ''
    this.style.display = 'block'
    if (!this.style.height) this.style.height = '100%'
    const mount = document.createElement('div')
    mount.style.height = '100%'
    this.replaceChildren(mount)          // config captured; swap it for the mount
    this._root = createRoot(mount)
    this._root.render(<AtlasPanel d2={d2} />)
  }
  disconnectedCallback() { this._root?.unmount(); this._root = null }
}
if (!customElements.get('atlas-graph')) customElements.define('atlas-graph', AtlasGraph)
