// <graph-atlas> — drop the atlas into any page as a custom element.
//   import 'graph-atlas.js';                         (or <script type="module" src>)
//   <graph-atlas src="networking" style="height:100vh"></graph-atlas>
//
// attributes:
//   src    = topic name → loads atlases/<src>.atlas.js inside the frame
//   base   = path to the folder holding atlas.html (default: same dir as this module)
//   params = extra atlas URL state, e.g. "tour=vxlan%20overlay%20encap&dark=1"
// property:
//   el.data = { d2, tours }   → push inline content (no file needed), via postMessage
//
// The frozen atlas.html does all the work; this element just frames + feeds it.
// iframe = full isolation, so many instances coexist with zero collision.

const HERE = new URL('.', import.meta.url).href;   // dir this module lives in

class GraphAtlas extends HTMLElement {
  static get observedAttributes() { return ['src', 'base', 'params']; }

  connectedCallback() { this._render(); }
  attributeChangedCallback() { if (this.isConnected) this._render(); }

  set data(v) { this._data = v; if (this._ready) this._post(); }
  get data() { return this._data; }

  _url() {
    const base = this.getAttribute('base');
    const dir = base ? new URL(base, location.href).href.replace(/\/?$/, '/') : HERE;
    const q = new URLSearchParams(this.getAttribute('params') || '');
    const src = this.getAttribute('src');
    if (src) q.set('src', src);
    const qs = q.toString();
    return dir + 'atlas.html' + (qs ? '?' + qs : '');
  }
  _post() { try { this._frame.contentWindow.postMessage({ type: 'atlas', data: this._data }, '*'); } catch (e) {} }

  _render() {
    if (!this.shadowRoot) {
      const root = this.attachShadow({ mode: 'open' });
      root.innerHTML = `<style>:host{display:block;width:100%;height:100%}iframe{border:0;width:100%;height:100%;display:block}</style>`;
      this._frame = document.createElement('iframe');
      this._frame.setAttribute('title', 'graph atlas');
      root.append(this._frame);
      this._onMsg = e => { if (e.source === this._frame.contentWindow && e.data?.type === 'atlas-ready') { this._ready = true; if (this._data) this._post(); } };
      window.addEventListener('message', this._onMsg);
    }
    this._ready = false;
    this._frame.src = this._url();
  }
  disconnectedCallback() { window.removeEventListener('message', this._onMsg); }
}
customElements.define('graph-atlas', GraphAtlas);
export { GraphAtlas };
