// Geometry port of nvim/lua/cland/graph_layout.lua (T-159), protected by
// nvim/test/web-graph-layout.test.ts. No DOM, text canvas or layout dependency.
// Input order breaks ties. Layers/chain indices are 1-based like the Lua;
// positions and route coordinates are 0-based display units, ready for SVG scaling.
export type Edge = [string, string];
export type GraphItem = { id: string; blocked_by?: readonly string[] };
export type LayoutOptions = {
  reduce?: boolean; sweeps?: number; rank?: Readonly<Record<string, number>>;
  keep_order?: boolean; include?: Readonly<Record<string, boolean>>;
};
export type Layout = {
  layers: string[][]; layer: Record<string, number>;
  succ: Record<string, string[]>; pred: Record<string, string[]>;
  chains: { from: string; to: string; path: string[] }[];
  via: Record<string, number>; hidden: Edge[]; cycles: Edge[]; inside: Edge[]; against: Edge[];
  crossings: number; edges: number; dummies: number;
};
export type ItemLayout = Layout & { nodes: string[]; tray: string[]; outside: Edge[] };
const dict = <T>(): Record<string, T> => Object.create(null) as Record<string, T>;
export const isDummy = (id: string): boolean => id.startsWith('~');
const copyLayers = (layers: string[][]) => layers.map(ids => [...ids]);

/** Cycle removal, transitive reduction, ASAP (or supplied) layers, long-edge
 * dummies, barycentre sweeps and adjacent transposition, in the Lua's order. */
export function layout(nodes: readonly string[], edges: readonly Edge[], opts: LayoutOptions = {}): Layout {
  const idx = dict<number>(), out = dict<string[]>(), seen = new Set<string>();
  nodes.forEach((id, i) => { idx[id] = i + 1; out[id] = []; });
  let total = 0;
  for (const [u, v] of edges) {
    const key = `${u}\0${v}`;
    if (idx[u] !== undefined && idx[v] !== undefined && !seen.has(key)) {
      seen.add(key); total++; out[u]!.push(v);
    }
  }
  for (const id of nodes) out[id]!.sort((a, b) => idx[a]! - idx[b]!);
  const given = opts.rank, inside: Edge[] = [], against: Edge[] = [];
  if (given) for (const u of nodes) out[u] = out[u]!.filter(v => {
    if (given[u]! < given[v]!) return true;
    (given[u] === given[v] ? inside : against).push([u, v]); return false;
  });
  const mark = dict<number>(), cycles: Edge[] = [];
  function walk(u: string) {
    mark[u] = 1;
    out[u] = out[u]!.filter(v => {
      if (mark[v] === 1) { cycles.push([u, v]); return false; }
      if (mark[v] === undefined) walk(v);
      return true;
    });
    mark[u] = 2;
  }
  for (const id of nodes) if (mark[id] === undefined) walk(id);
  const hidden: Edge[] = [];
  if (opts.reduce !== false) {
    const desc = dict<Set<string>>();
    function reach(u: string): Set<string> {
      if (desc[u]) return desc[u]!;
      const s = new Set<string>(); desc[u] = s;
      for (const v of out[u]!) { s.add(v); for (const w of reach(v)) s.add(w); }
      return s;
    }
    for (const u of nodes) reach(u);
    for (const u of nodes) out[u] = out[u]!.filter(v => {
      if (out[u]!.some(w => w !== v && desc[w]!.has(v))) { hidden.push([u, v]); return false; }
      return true;
    });
  }
  const inn = dict<string[]>(), rank = dict<number>();
  for (const id of nodes) inn[id] = [];
  for (const u of nodes) for (const v of out[u]!) inn[v]!.push(u);
  function rankOf(v: string): number {
    if (rank[v] !== undefined) return rank[v]!;
    const r = given ? given[v]! : Math.max(1, ...inn[v]!.map(u => rankOf(u) + 1));
    rank[v] = r; return r;
  }
  let nl = 0;
  for (const id of nodes) nl = Math.max(nl, rankOf(id));
  let layers = Array.from({ length: nl }, () => [] as string[]);
  const layer = dict<number>(), succ = dict<string[]>(), pred = dict<string[]>(), via = dict<number>();
  const chains: Layout['chains'] = [];
  function vertex(v: string, l: number) { layer[v] = l; succ[v] = []; pred[v] = []; }
  for (const id of nodes) vertex(id, rank[id]!);
  let n = 0;
  for (const u of nodes) for (const v of out[u]!) {
    const path = [u]; let prev = u;
    for (let l = rank[u]! + 1; l < rank[v]!; l++) {
      const d = `~${++n}`; vertex(d, l); via[d] = chains.length + 1;
      succ[prev]!.push(d); pred[d]!.push(prev); path.push(d); prev = d;
    }
    succ[prev]!.push(v); pred[v]!.push(prev); path.push(v); chains.push({ from: u, to: v, path });
  }
  const key = { ...idx };
  for (const [d, c] of Object.entries(via)) key[d] = idx[chains[c - 1]!.to]! + idx[chains[c - 1]!.from]! / 1e4;
  const byKey = (a: string, b: string) => key[a]! - key[b]!;
  const placed = new Set<string>();
  function visit(v: string) {
    if (placed.has(v)) return;
    placed.add(v); layers[layer[v]! - 1]!.push(v);
    for (const w of [...succ[v]!].sort(byKey)) visit(w);
  }
  if (opts.keep_order) {
    for (const id of nodes) layers[layer[id]! - 1]!.push(id);
    for (const d of Object.keys(via).sort(byKey)) layers[layer[d]! - 1]!.push(d);
  } else {
    for (const v of [...nodes].sort((a, b) => rank[a]! - rank[b]! || idx[a]! - idx[b]!)) visit(v);
  }
  const pos = dict<number>();
  function positions() { for (const ids of layers) ids.forEach((v, i) => { pos[v] = i + 1; }); }
  function crossings() {
    let c = 0;
    for (const ids of layers.slice(0, -1)) {
      const es = ids.flatMap(a => succ[a]!.map(b => [pos[a]!, pos[b]!] as const));
      for (let i = 0; i < es.length; i++) for (let j = i + 1; j < es.length; j++) {
        if ((es[i]![0] - es[j]![0]) * (es[i]![1] - es[j]![1]) < 0) c++;
      }
    }
    return c;
  }
  positions();
  let best = copyLayers(layers), bestC = crossings(), stale = 0;
  for (let s = 1; s <= (opts.keep_order ? 0 : (opts.sweeps ?? 24)); s++) {
    if (bestC === 0) break;
    const down = s % 2 === 1, nb = down ? pred : succ;
    for (let l = down ? 1 : layers.length - 2; down ? l < layers.length : l >= 0; l += down ? 1 : -1) {
      const ids = layers[l]!, bc = dict<number>(), movable: string[] = [], fixed = new Map<number, string>();
      ids.forEach((v, i) => {
        const ns = nb[v]!;
        if (ns.length) { bc[v] = ns.reduce((sum, w) => sum + pos[w]!, 0) / ns.length; movable.push(v); }
        else fixed.set(i, v);
      });
      movable.sort((a, b) => bc[a]! - bc[b]! || pos[a]! - pos[b]!);
      let k = 0;
      const ordered = ids.map((_, i) => fixed.get(i) ?? movable[k++]!);
      layers[l] = ordered; ordered.forEach((v, i) => { pos[v] = i + 1; });
    }
    const c = crossings();
    if (c < bestC) { best = copyLayers(layers); bestC = c; stale = 0; }
    else if (++stale >= 4) break;
  }
  layers = best; positions();
  function pairCost(u: string, v: string) {
    let c = 0;
    for (const nbrs of [pred, succ]) for (const a of nbrs[u]!) for (const b of nbrs[v]!) if (pos[a]! > pos[b]!) c++;
    return c;
  }
  for (let pass = 0; pass < (opts.keep_order ? 0 : 20); pass++) {
    let improved = false;
    for (const ids of layers) for (let i = 0; i < ids.length - 1; i++) {
      const u = ids[i]!, v = ids[i + 1]!;
      if (pairCost(v, u) < pairCost(u, v)) {
        ids[i] = v; ids[i + 1] = u; pos[u] = i + 2; pos[v] = i + 1; improved = true;
      }
    }
    if (!improved) break;
  }
  return { layers, layer, succ, pred, chains, via, hidden, cycles, inside, against, crossings: crossings(), edges: total, dummies: n };
}

/** Sibling edges only; unlinked children go to the tray before cycle removal. */
export function fromItems(items: readonly GraphItem[], opts: LayoutOptions = {}): ItemLayout {
  const known = new Set(items.map(item => item.id)), linked = new Set<string>();
  const edges: Edge[] = [], outside: Edge[] = [];
  for (const item of items) for (const blocker of item.blocked_by ?? []) {
    if (known.has(blocker)) { edges.push([blocker, item.id]); linked.add(blocker); linked.add(item.id); }
    else outside.push([blocker, item.id]);
  }
  const nodes: string[] = [], tray: string[] = [];
  for (const item of items) (linked.has(item.id) || opts.include?.[item.id] ? nodes : tray).push(item.id);
  return { ...layout(nodes, edges, opts), nodes, tray, outside };
}

/** Weighted least-squares placement, then legal rows which cannot imply a
 * false join. Size is along a layer; dummies occupy one unit plus the gap. */
export function rows(L: Layout, height?: (id: string) => number, extra?: (id: string) => number, pack = false): Record<string, number> {
  const { layers, succ, pred } = L, row = dict<number>();
  const h = (v: string) => isDummy(v) ? 1 : (height?.(v) ?? 1);
  const ex = (v: string, i: number) => i > 0 && !isDummy(v) ? (extra?.(v) ?? 0) : 0;
  function place(ids: string[], want: number[], weight: number[]) {
    const blocks: { w: number; wx: number; n: number }[] = [], offs: number[] = [];
    let off = 0;
    ids.forEach((v, i) => {
      off += ex(v, i); offs[i] = off; off += h(v) + 1;
      blocks.push({ w: weight[i]!, wx: weight[i]! * (want[i]! - offs[i]!), n: 1 });
      while (blocks.length > 1) {
        const b = blocks.at(-1)!, a = blocks.at(-2)!;
        if (a.wx / a.w <= b.wx / b.w) break;
        a.w += b.w; a.wx += b.wx; a.n += b.n; blocks.pop();
      }
    });
    let i = 0;
    for (const b of blocks) {
      const s = Math.max(0, Math.floor(b.wx / b.w + 0.5));
      for (let j = 0; j < b.n; j++, i++) row[ids[i]!] = s + offs[i]!;
    }
  }
  function sweep(l: number, nbrs: Record<string, string[]>) {
    const ids = layers[l]!, want: number[] = [], weight: number[] = [];
    for (const v of ids) {
      const rs = nbrs[v]!.map(w => row[w]!).sort((a, b) => a - b);
      want.push(rs.length ? rs[Math.floor((rs.length - 1) / 2)]! : row[v]!);
      weight.push(rs.length ? (isDummy(v) ? 2 : 1) : 0.25);
    }
    place(ids, want, weight);
  }
  for (const ids of layers) {
    let r = 0; ids.forEach((v, i) => { r += ex(v, i); row[v] = r; r += h(v) + 1; });
  }
  if (!pack) {
    for (let l = 1; l < layers.length; l++) sweep(l, pred);
    for (let l = layers.length - 2; l >= 0; l--) sweep(l, succ);
    for (let l = 1; l < layers.length; l++) sweep(l, pred);
  }
  const at: Map<number, string>[] = [];
  layers.forEach((ids, l) => {
    const current = new Map<number, string>(); at[l] = current;
    let min = 0;
    ids.forEach((v, i) => {
      let r = Math.max(row[v]!, min + ex(v, i));
      const s = at[l - 1]?.get(r);
      if (s && succ[s]!.length > 0 && !(succ[s]!.includes(v) && (succ[s]!.length === 1 || pred[v]!.length === 1))) r++;
      row[v] = r; current.set(r, v); min = r + h(v) + 1;
    });
  });
  return row;
}

type TrackEdge = { to: string; row: number; lo: number; hi: number };
type Block = { row: number; lo: number; hi: number; edges: TrackEdge[]; straight: boolean };
const inside = (r: number, lo: number, hi: number) => r > lo && r < hi;
function blockCost(a: Block, b: Block) {
  let c = 0;
  for (const e of a.edges) {
    if (!b.straight && inside(b.row, e.lo, e.hi)) c++;
    for (const f of b.edges) if (inside(e.row, f.lo, f.hi)) c++;
  }
  return c;
}
function orderBlocks(S: string[], info: Record<string, Block>): string[] {
  const n = S.length;
  if (n <= 1) return S;
  if (n > 12) return [...S].sort((a, b) => info[a]!.lo + info[a]!.hi - info[b]!.lo - info[b]!.hi || info[a]!.row - info[b]!.row);
  const cost = S.map(a => S.map(b => a === b ? 0 : blockCost(info[a]!, info[b]!)));
  const full = (1 << n) - 1, f: (number | undefined)[] = [0], last: number[] = [];
  for (let mask = 0; mask < full; mask++) {
    const base = f[mask]; if (base === undefined) continue;
    for (let j = 0; j < n; j++) if ((mask & (1 << j)) === 0) {
      let c = base;
      for (let i = 0; i < n; i++) if (mask & (1 << i)) c += cost[i]![j]!;
      const m2 = mask | (1 << j);
      if (f[m2] === undefined || c < f[m2]!) { f[m2] = c; last[m2] = j; }
    }
  }
  const order: string[] = [];
  for (let m = full; m !== 0;) { const j = last[m]!; order.unshift(S[j]!); m &= ~(1 << j); }
  return order;
}
function sourceBlocks(ids: string[], succ: Layout['succ'], pos: Record<string, number>) {
  const S: string[] = [], info = dict<Block>();
  for (const a of ids) {
    const edges: TrackEdge[] = []; let straight = false, lo = pos[a]!, hi = pos[a]!;
    for (const b of succ[a]!) {
      if (pos[b] === pos[a]) straight = true;
      else { edges.push({ to: b, row: pos[b]!, lo: Math.min(pos[a]!, pos[b]!), hi: Math.max(pos[a]!, pos[b]!) }); lo = Math.min(lo, pos[b]!); hi = Math.max(hi, pos[b]!); }
    }
    if (edges.length) {
      edges.sort((e, f) => Math.abs(f.row - pos[a]!) - Math.abs(e.row - pos[a]!) || e.row - f.row);
      S.push(a); info[a] = { row: pos[a]!, lo, hi, edges, straight };
    }
  }
  return { sources: orderBlocks(S, info), info };
}

// h = row,col1,col2,chain; v = col,row1,row2,chain;
// p = row,col,direction-bits,chain (the Lua's coincident vertical port).
export type Segment = ['h' | 'v' | 'p', number, number, number, number];
export type RouteOptions = { orient: 'horizontal' | 'vertical'; width: number; top?: number; left?: number; height: (id: string) => number; labelWidth: (id: string) => number };
export type Routed = { segments: Segment[]; bounds: { col: number[]; right: number } | { y: number[]; bottom: number } };
/** Orthogonal routes grouped by 1-based chain id. SVG consumers can retain
 * crossing ownership rather than merging crossing edges into junctions. */
export function route(L: Layout, pos: Record<string, number>, opts: RouteOptions): Routed {
  const top = opts.top ?? 0, left = opts.left ?? 0, vertical = opts.orient === 'vertical';
  const bands: number[] = [], track = dict<Record<string, number>>();
  let cursor = vertical ? top : left;
  for (const ids of L.layers) {
    bands.push(cursor);
    const { sources, info } = sourceBlocks(ids, L.succ, pos);
    if (vertical) {
      const H = Math.max(1, ...ids.filter(v => !isDummy(v)).map(opts.height));
      const shelves: [number, number][][] = [];
      for (const a of sources) {
        track[a] = dict<number>();
        for (const e of info[a]!.edges) {
          let r = shelves.length;
          while (r > 0 && shelves[r - 1]!.every(sp => e.hi + 1 < sp[0] || sp[1] + 1 < e.lo)) r--;
          (shelves[r] ??= []).push([e.lo, e.hi]); track[a]![e.to] = cursor + H + r + 1;
        }
      }
      cursor += H + (shelves.length ? shelves.length + 2 : 1);
    } else {
      let k = 0;
      for (const a of sources) {
        track[a] = dict<number>();
        for (const e of info[a]!.edges) track[a]![e.to] = cursor + opts.width + 1 + ++k;
      }
      cursor += opts.width + k + 4;
    }
  }
  const segments: Segment[] = [];
  const exit = (a: string) => bands[L.layer[a]! - 1]! + (isDummy(a) ? 0 : vertical ? 1 : opts.labelWidth(a) + 1);
  const entry = (b: string) => bands[L.layer[b]! - 1]! - (isDummy(b) ? 0 : 1);
  L.chains.forEach((ch, ci) => {
    for (let k = 0; k < ch.path.length - 1; k++) {
      const a = ch.path[k]!, b = ch.path[k + 1]!, e = ci + 1;
      const pa = (vertical ? left : top) + pos[a]!, pb = (vertical ? left : top) + pos[b]!;
      if (vertical) {
        if (pa === pb) {
          if (exit(a) === entry(b)) segments.push(['p', exit(a), pa, 3, e]);
          else segments.push(['v', pa, exit(a), entry(b), e]);
        } else {
          const ty = track[a]![b]!;
          segments.push(['v', pa, exit(a), ty, e], ['h', ty, pa, pb, e], ['v', pb, ty, entry(b), e]);
        }
      } else if (pa === pb) segments.push(['h', pa, exit(a), entry(b), e]);
      else {
        const tx = track[a]![b]!;
        segments.push(['h', pa, exit(a), tx, e], ['v', tx, pa, pb, e], ['h', pb, tx, entry(b), e]);
      }
    }
  });
  return { segments, bounds: vertical ? { y: bands, bottom: cursor } : { col: bands, right: cursor } };
}

/** Continue wide vertical bands below themselves, reserving pass-through dummy
 * space. The returned origin identifies each drawing band's original layer. */
export function fitWindow(L: ItemLayout, room: number, minimum: number, maximum: number): { layout: ItemLayout; width: number; origin: number[] } {
  const reals: string[][] = [], nodes: string[] = [], reserve: number[] = [];
  L.layers.forEach((ids, l) => {
    reals[l] = []; reserve[l] = 0;
    for (const id of ids) {
      if (isDummy(id)) reserve[l]! += 2;
      else { reals[l]!.push(id); nodes.push(id); }
    }
  });
  const edges: Edge[] = L.chains.map(ch => [ch.from, ch.to]);
  function fits(lay: Layout, W: number) {
    const pos = rows(lay, () => W + 2, undefined, true);
    return lay.layers.every(ids => ids.every(id => pos[id]! + (isDummy(id) ? 1 : W + 2) <= room));
  }
  const origin = L.layers.map((_, l) => l + 1);
  minimum = Math.max(1, Math.min(minimum, room - 2));
  maximum = Math.max(minimum, Math.min(maximum, room - 2));
  for (let W = maximum; W >= minimum; W--) if (fits(L, W)) return { layout: L, width: W, origin };
  function wrap(W: number) {
    const reserved = [...reserve];
    let lay: Layout = L, originalLayer: number[] = [];
    // Recut until added dummy reservations settle, bounded by real node count.
    for (let pass = 0; pass <= nodes.length; pass++) {
      const ranks = dict<number>(); let base = 0;
      originalLayer = [];
      reals.forEach((ids, l) => {
        let row = 1, used = 0;
        for (const id of ids) {
          if (used > 0 && used + W + 3 > room - reserved[l]!) { row++; used = 0; }
          ranks[id] = base + row; used += W + 3;
        }
        for (let k = 0; k < row; k++) originalLayer[base + k] = l + 1;
        base += row;
      });
      lay = layout(nodes, edges, { rank: ranks, keep_order: true, reduce: false });
      if (fits(lay, W)) break;
      let changed = false;
      lay.layers.forEach((ids, l) => {
        const n = ids.filter(isDummy).length, at = originalLayer[l]! - 1;
        if (2 * n > reserved[at]!) { reserved[at] = 2 * n; changed = true; }
      });
      if (!changed) break;
    }
    return { layout: { ...lay, nodes: L.nodes, tray: L.tray, outside: L.outside,
      hidden: L.hidden, cycles: L.cycles, edges: L.edges, inside: L.inside, against: L.against }, origin: originalLayer };
  }
  const best = wrap(minimum);
  for (let W = maximum; W > minimum; W--) {
    const fitted = wrap(W);
    if (fitted.layout.layers.length <= best.layout.layers.length && fits(fitted.layout, W)) return { ...fitted, width: W };
  }
  return { ...best, width: minimum };
}
