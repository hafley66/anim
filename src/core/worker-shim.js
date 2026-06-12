// core/worker-shim.js — run Worker code on the main thread for file:// pages.
// Chromium refuses to construct workers on a file:// origin, and d2.js routes
// every compile through a Blob-URL module worker, so on file:// we execute the
// worker source inline instead: remember each Blob handed to createObjectURL,
// and replace Worker with a class that evaluates the blob's code against a fake
// port. Reads on the port fall through to bound globals (binding avoids
// "Illegal invocation" on natives like fetch/setTimeout); writes (onmessage)
// stay local. Compiles block the main thread; acceptable for a deck.
let installed = false

export function installMainThreadWorkerShim() {
  if (installed) return
  if (typeof location === 'undefined' || location.protocol !== 'file:') return
  installed = true

  const blobs = new Map()
  const origCreate = URL.createObjectURL.bind(URL)
  URL.createObjectURL = (b) => { const u = origCreate(b); blobs.set(u, b); return u }

  globalThis.Worker = class MainThreadWorker {
    constructor(url) {
      this.onmessage = null; this.onerror = null
      this._port = null; this._queue = []
      const blob = blobs.get(url)
      if (!blob) { queueMicrotask(() => this.onerror?.({ message: 'worker-shim: unknown blob URL' })); return }
      blob.text().then(src => {
        const local = { onmessage: null, postMessage: (data) => queueMicrotask(() => this.onmessage?.({ data })) }
        const port = new Proxy(local, {
          get(t, k) {
            if (k in t) return t[k]
            const v = globalThis[k]
            // bind lowercase natives so they keep their real `this`; leave
            // constructors (capitalized) raw for `new`
            return typeof v === 'function' && !/^[A-Z]/.test(String(k)) ? v.bind(globalThis) : v
          },
          set(t, k, v) { t[k] = v; return true },
        })
        // worker blobs are ES modules; new Function rejects export syntax
        const body = src.replace(/\bexport\s+(async\s+)?(function|class|const|let|var)\b/g, '$1$2')
        new Function('self', body)(port)
        this._port = local
        for (const d of this._queue) local.onmessage?.({ data: d })
        this._queue.length = 0
      }).catch(e => this.onerror?.({ message: String(e) }))
    }
    postMessage(data) { this._port ? this._port.onmessage?.({ data }) : this._queue.push(data) }
    terminate() { this._port = null }
  }
}
