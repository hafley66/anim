// core/bus.js — framework-neutral selection/view bus. Vanilla atlas and React anim
// panels both speak emit/on. Swap in an RxJS Subject if you want full stream operators
// (the user prefers RxJS): `const sel$ = new Subject(); bus.on('select', x=>sel$.next(x))`.

export const SELECT = 'select';   // a panel selected an entity id
export const VIEW = 'view';       // the active View changed (cone / tour step)
export const HOVER = 'hover';     // transient highlight, no commit

export class Bus extends EventTarget {
  emit(type, detail) { this.dispatchEvent(new CustomEvent(type, { detail })); }
  on(type, fn) {
    const h = e => fn(e.detail);
    this.addEventListener(type, h);
    return () => this.removeEventListener(type, h);   // call to unsubscribe
  }
}
