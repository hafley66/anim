// core/bus.ts — framework-neutral selection/view bus. Vanilla atlas and React anim
// panels both speak emit/on. Swap in an RxJS Subject if you want full stream operators
// (the user prefers RxJS): `const sel$ = new Subject(); bus.on('select', x=>sel$.next(x))`.

export const SELECT = 'select'   // a panel selected an entity id
export const VIEW = 'view'       // the active View changed (cone / tour step)
export const HOVER = 'hover'     // transient highlight, no commit

export class Bus extends EventTarget {
  emit(type: string, detail?: unknown): void { this.dispatchEvent(new CustomEvent(type, { detail })) }
  on<T = unknown>(type: string, fn: (detail: T) => void): () => void {
    const h = (e: Event): void => fn((e as CustomEvent<T>).detail)
    this.addEventListener(type, h)
    return () => this.removeEventListener(type, h)   // call to unsubscribe
  }
}
