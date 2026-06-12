// core/worker-shim.ts — run Worker code on the main thread for file:// pages.
// Chromium refuses to construct workers on a file:// origin, and d2.js routes
// every compile through a Blob-URL module worker, so on file:// we execute the
// worker source inline instead: remember each Blob handed to createObjectURL,
// and replace Worker with a class that evaluates the blob's code against a fake
// port. Reads on the port fall through to bound globals (binding avoids
// "Illegal invocation" on natives like fetch/setTimeout); writes (onmessage)
// stay local. Compiles block the main thread; acceptable for a deck.
let installed = false

type Port = { onmessage: ((e: { data: unknown }) => void) | null; postMessage: (data: unknown) => void }

export function installMainThreadWorkerShim(): void {
  if (installed) return
  if (typeof location === 'undefined' || location.protocol !== 'file:') return
  installed = true

  const blobs = new Map<string, Blob>()
  const origCreate = URL.createObjectURL.bind(URL)
  URL.createObjectURL = (b: Blob | MediaSource): string => { const u = origCreate(b); if (b instanceof Blob) blobs.set(u, b); return u }

  ;(globalThis as Record<string, unknown>).Worker = class MainThreadWorker {
    onmessage: ((e: { data: unknown }) => void) | null = null
    onerror: ((e: { message: string }) => void) | null = null
    private _port: Port | null = null
    private _queue: unknown[] = []
    constructor(url: string) {
      const blob = blobs.get(url)
      if (!blob) { queueMicrotask(() => this.onerror?.({ message: 'worker-shim: unknown blob URL' })); return }
      blob.text().then(src => {
        const local: Port = { onmessage: null, postMessage: (data: unknown) => queueMicrotask(() => this.onmessage?.({ data })) }
        const port = new Proxy(local, {
          get(t, k) {
            if (k in t) return (t as unknown as Record<PropertyKey, unknown>)[k]
            const v = (globalThis as Record<PropertyKey, unknown>)[k]
            // bind lowercase natives so they keep their real `this`; leave
            // constructors (capitalized) raw for `new`
            return typeof v === 'function' && !/^[A-Z]/.test(String(k)) ? v.bind(globalThis) : v
          },
          set(t, k, v) { (t as unknown as Record<PropertyKey, unknown>)[k] = v; return true },
        })
        // worker blobs are ES modules; new Function rejects export syntax
        const body = src.replace(/\bexport\s+(async\s+)?(function|class|const|let|var)\b/g, '$1$2')
        new Function('self', body)(port)
        this._port = local
        for (const d of this._queue) local.onmessage?.({ data: d })
        this._queue.length = 0
      }).catch((e: unknown) => this.onerror?.({ message: String(e) }))
    }
    postMessage(data: unknown): void { this._port ? this._port.onmessage?.({ data }) : this._queue.push(data) }
    terminate(): void { this._port = null }
  }
}
