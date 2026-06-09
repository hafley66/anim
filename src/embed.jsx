// <atlas-graph> — a custom element that mounts the EXISTING React AtlasPanel.
// No port: the d2 config is this element's `<script type="application/atlas">`
// child (or its text), and we just createRoot().render(<AtlasPanel d2={...}/>).
// Light DOM (not shadow) so app.css + the :root --atlas-* theme reach the panel.
import './embed-shim.js'   // MUST be first: defines globalThis.process before react-dom evaluates
import { createRoot } from 'react-dom/client'
import AtlasPanel from './AtlasPanel.jsx'
import './app.css'

class AtlasGraph extends HTMLElement {
  connectedCallback() {
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
  disconnectedCallback() { this._root?.unmount() }
}
if (!customElements.get('atlas-graph')) customElements.define('atlas-graph', AtlasGraph)
