import type { AskCard } from '../../shared/wire/index.ts';

type Entry = { id: string; card: AskCard; order: number };
type Node = { entry?: Entry; children: (Node | undefined)[] };

/** Persistent radix map. An update copies at most four 16-slot nodes per UTF-16
 * code unit, independent of retained history. Published versions stay immutable.
 * Iteration alone collects entries in Map insertion order; replacement keeps its
 * original position. No iteration occurs during lookup or publication. */
export class AskCards implements ReadonlyMap<string, AskCard> {
  readonly #root: Node;
  readonly size: number;
  constructor(root: Node = { children: [] }, size = 0) { this.#root = root; this.size = size; }
  #find(id: string): Entry | undefined {
    let node: Node | undefined = this.#root;
    for (let n = 0; node && n < id.length * 4; n++) node = node.children[(id.charCodeAt(n >>> 2) >>> (12 - (n % 4) * 4)) & 15];
    return node?.entry;
  }
  get(id: string): AskCard | undefined { return this.#find(id)?.card; }
  has(id: string): boolean { return this.#find(id) !== undefined; }
  set(id: string, card: AskCard): AskCards {
    const old = this.#find(id);
    if (old?.card === card) return this;
    const entry = { id, card, order: old?.order ?? this.size };
    const update = (node: Node | undefined, n: number): Node => {
      if (n === id.length * 4) return { entry, children: node?.children ?? [] };
      const slot = (id.charCodeAt(n >>> 2) >>> (12 - (n % 4) * 4)) & 15;
      const children = node?.children.slice() ?? [];
      children[slot] = update(children[slot], n + 1);
      return { ...(node?.entry ? { entry: node.entry } : {}), children };
    };
    return new AskCards(update(this.#root, 0), this.size + (old ? 0 : 1));
  }
  *entries(): MapIterator<[string, AskCard]> {
    const entries: Entry[] = [], pending = [this.#root];
    while (pending.length) {
      const node = pending.pop()!;
      if (node.entry) entries.push(node.entry);
      for (const child of node.children) if (child) pending.push(child);
    }
    entries.sort((a, b) => a.order - b.order);
    for (const entry of entries) yield [entry.id, entry.card];
  }
  *keys(): MapIterator<string> { for (const [id] of this) yield id; }
  *values(): MapIterator<AskCard> { for (const [, card] of this) yield card; }
  [Symbol.iterator](): MapIterator<[string, AskCard]> { return this.entries(); }
  forEach(callback: (value: AskCard, key: string, map: ReadonlyMap<string, AskCard>) => void, thisArg?: unknown): void {
    for (const [id, card] of this) callback.call(thisArg, card, id, this);
  }
}
