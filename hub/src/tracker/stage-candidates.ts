import type { StageCover } from '../hub/suites.ts';

type Node = { cover: StageCover; active: boolean; newer: Node | null; older: Node | null; sourceNewer: Node | null; sourceOlder: Node | null };

/** Newest-first traversal without copying retained history on each stage read.
 * Rejected heads unlink in constant time. A retry restores original order using
 * immutable neighbours; only that changed fact may walk removed neighbours. */
export class StageCandidates implements Iterable<StageCover> {
  #newest: Node | null = null;
  readonly #nodes = new Map<StageCover, Node>();
  constructor(covers: readonly StageCover[]) {
    for (const cover of covers) {
      const node: Node = { cover, active: true, newer: null, older: this.#newest, sourceNewer: null, sourceOlder: this.#newest };
      if (this.#newest) { this.#newest.newer = node; this.#newest.sourceNewer = node; }
      this.#nodes.set(cover, node); this.#newest = node;
    }
  }
  set(cover: StageCover, active: boolean): void {
    const node = this.#nodes.get(cover);
    if (!node || node.active === active) return;
    if (!active) {
      if (node.newer) node.newer.older = node.older; else this.#newest = node.older;
      if (node.older) node.older.newer = node.newer;
    } else {
      let newer = node.sourceNewer, older = node.sourceOlder;
      while (newer && !newer.active) newer = newer.sourceNewer;
      while (older && !older.active) older = older.sourceOlder;
      node.newer = newer; node.older = older;
      if (newer) newer.older = node; else this.#newest = node;
      if (older) older.newer = node;
    }
    node.active = active;
  }
  *[Symbol.iterator](): Iterator<StageCover> {
    for (let node = this.#newest; node; node = node.older) if (node.active) yield node.cover;
  }
}
