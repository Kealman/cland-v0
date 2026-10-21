// The Lua summary rule (nvim/lua/cland/explorer_summary.lua), spec v0.1.2 §3.9.
// Evaluated on parsed bodies only; the differential frame test guards this port.
const META = new Set(['parent', 'comments', 'notes', 'sources', 'references', 'acceptance criteria', 'definition of done']);

const PROVENANCE = [
  'found by', 'found in', 'found while', 'seen by', 'seen in', 'seen on', 'seen once by', 'seen once in', 'seen once on',
  'observation from', 'observation of', 'observed by', 'observed in', 'observed during', 'proposed by', 'asked by',
  'raised by', 'reported by', 'relayed by', 'filed by', 'recorded by', 'split from', 'from the human',
  'from the stand-in', 'the human reported', 'the human observed', 'the human asked', 'follow-up of', 'follow-up from',
  'follow-up to',
];

type Kind = 'blank' | 'code' | 'heading' | 'quote' | 'rule' | 'list' | 'table' | 'html' | 'indented' | 'prose';

/** CommonMark's "up to three spaces of indentation": the rest of the line, or null past three. */
function lstrip3(line: string): string | null {
  const spaces = /^( *)/.exec(line)![1]!.length;
  return spaces <= 3 ? line.slice(spaces) : null;
}

function fenceOf(line: string): string | null {
  const s = lstrip3(line);
  if (s === null) return null;
  return /^(`{3,})/.exec(s)?.[1] ?? /^(~{3,})/.exec(s)?.[1] ?? null;
}

const isWord = (c: string) => /[A-Za-z0-9_]/.test(c);
const isAlnum = (c: string) => /[A-Za-z0-9]/.test(c);

export function lineKind(line: string): Kind {
  if (!/\S/.test(line)) return 'blank';
  if (fenceOf(line)) return 'code';
  const s = lstrip3(line);
  if (s !== null) {
    const hashes = /^(#+)/.exec(s)?.[1];
    if (hashes && hashes.length <= 6) {
      const after = s.charAt(hashes.length);
      if (after === '' || after === ' ' || after === '\t') return 'heading';
    }
    if (s.startsWith('>')) return 'quote';
    const c = s.charAt(0);
    if (c === '-' || c === '*' || c === '_') {
      const rest = s.replace(/[ \t]/g, '');
      if (rest.length >= 3 && rest === c.repeat(rest.length)) return 'rule';
    }
    if (/^[-*+][ \t]+/.test(s) || /^\d+[.)][ \t]+/.test(s)) return 'list';
    if (s.startsWith('|')) return 'table';
    if (/^<!--/.test(s) || /^<\/?[A-Za-z]/.test(s)) return 'html';
  }
  if (line.startsWith('    ') || line.startsWith('\t')) return 'indented';
  return 'prose';
}

export type Section = { heading: string | null; lines: string[] };

/** The body's `##` sections in order; fenced lines never start a section. */
export function sections(body: string): Section[] {
  const out: Section[] = [];
  let cur: Section = { heading: null, lines: [] };
  let fence: string | null = null;
  const push = () => {
    if (cur.heading !== null || cur.lines.some((l) => /\S/.test(l))) out.push(cur);
  };
  for (const line of (body ?? '').split('\n')) {
    const f = fenceOf(line);
    if (fence) {
      cur.lines.push(line);
      if (f && f[0] === fence[0] && f.length >= fence.length) fence = null;
    } else if (f) {
      fence = f;
      cur.lines.push(line);
    } else {
      const h = /^##[ \t]+(.*?)[ \t#]*$/.exec(line);
      if (h && !line.startsWith('###')) {
        push();
        cur = { heading: h[1]!.trim(), lines: [] };
      } else {
        cur.lines.push(line);
      }
    }
  }
  push();
  return out;
}

type Block = { kind: Kind; text: string; count: number };

export function blocks(lines: string[]): Block[] {
  const out: Block[] = [];
  const n = lines.length;
  let i = 0;
  while (i < n) {
    const line = lines[i]!;
    const k = lineKind(line);
    if (k === 'blank') {
      i += 1;
    } else if (k === 'code') {
      const fence = fenceOf(line)!;
      let j = i + 1;
      while (j < n) {
        const f = fenceOf(lines[j]!);
        j += 1;
        if (f && f[0] === fence[0] && f.length >= fence.length) break;
      }
      out.push({ kind: 'code', text: lines.slice(i, j).join('\n'), count: 0 });
      i = j;
    } else if (k === 'heading' || k === 'rule') {
      out.push({ kind: k, text: line.trim(), count: 0 });
      i += 1;
    } else if (k === 'quote') {
      let j = i;
      while (j < n && /\S/.test(lines[j]!) && (lineKind(lines[j]!) === 'quote' || lineKind(lines[j]!) === 'prose')) j += 1;
      out.push({ kind: 'quote', text: lines.slice(i, j).join('\n'), count: 0 });
      i = j;
    } else if (k === 'table') {
      let j = i;
      while (j < n && lineKind(lines[j]!) === 'table') j += 1;
      out.push({ kind: 'table', text: lines.slice(i, j).join('\n'), count: 0 });
      i = j;
    } else if (k === 'list') {
      let j = i;
      let count = 0;
      while (j < n) {
        const lj = lines[j]!;
        const kj = lineKind(lj);
        if (kj === 'list' && lj.slice(0, 2) !== '  ') {
          count += 1;
          j += 1;
        } else if (kj === 'blank') {
          let next: string | undefined;
          for (let x = j; x < n; x += 1) if (/\S/.test(lines[x]!)) { next = lines[x]; break; }
          if (next !== undefined && (lineKind(next) === 'list' || next.slice(0, 2) === '  ')) j += 1; else break;
        } else if (lj.startsWith(' ') || lj.startsWith('\t') || kj === 'prose' || kj === 'list') {
          j += 1;
        } else {
          break;
        }
      }
      out.push({ kind: 'list', text: lines.slice(i, j).join('\n'), count });
      i = j;
    } else {
      let j = i + 1;
      while (j < n) {
        const kj = lineKind(lines[j]!);
        if (kj === 'blank' || kj === 'code' || kj === 'heading' || kj === 'quote' || kj === 'rule') break;
        if (kj === 'list') {
          const s = lstrip3(lines[j]!) ?? '';
          const o = /^(\d+)[.)][ \t]+/.exec(s)?.[1];
          if (!o || o === '1') break;
        }
        j += 1;
      }
      out.push({ kind: k === 'prose' || k === 'indented' ? 'prose' : k, text: lines.slice(i, j).join('\n'), count: 0 });
      i = j;
    }
  }
  return out;
}

const CLOSERS = new Set(['"', "'", ')', ']', '*', '”', '’']);
const OPENERS = new Set(['`', '"', "'", '(', '[', '*', '“', '‘']);

function abbrev(piece: string): boolean {
  const p = piece.toLowerCase();
  for (const a of ['e.g.', 'i.e.', 'etc.', 'vs.', 'cf.', 'approx.', 'incl.']) {
    if (p.endsWith(a)) {
      const before = p.charAt(p.length - a.length - 1);
      if (before === '' || !isWord(before)) return true;
    }
  }
  // a single letter and a period ("J."), or a section number (§3.1.)
  if (/(^|[^A-Za-z0-9])[A-Za-z]\.$/.test(p)) return true;
  if (/§\d+[\d.]*$/.test(p)) return true;
  return false;
}

/** Prose split into sentences: a period, ! or ? (with closing quotes or brackets) followed by a space and the next
 *  word; never inside a code span, never after e.g., i.e., etc. or vs. */
export function sentences(text: string): string[] {
  const flat = (text ?? '').split('\n').map((l) => l.trim()).join(' ');
  const out: string[] = [];
  let start = 0;
  let inCode = false;
  let i = 0;
  const n = flat.length;
  while (i < n) {
    const ch = flat.charAt(i);
    if (ch === '`') {
      inCode = !inCode;
    } else if ((ch === '.' || ch === '!' || ch === '?') && !inCode) {
      let j = i + 1;
      while (j < n && CLOSERS.has(flat.charAt(j))) j += 1;
      let ends = j >= n;
      if (!ends && flat.charAt(j) === ' ' && j + 1 < n) {
        const nx = flat.charAt(j + 1);
        if (isAlnum(nx) || OPENERS.has(nx)) {
          ends = true;
        } else {
          // the Lua port's approximation of Python's isalnum() on a non-ASCII character: letters yes, the
          // U+0080–U+00BF and U+2000–U+2FFF punctuation blocks no
          const cp = nx.codePointAt(0) ?? 0;
          ends = cp >= 0xc0 && !(cp >= 0x2000 && cp <= 0x2fff);
        }
      }
      if (ends) {
        if (ch === '.' && abbrev(flat.slice(start, i + 1))) {
          i += 1;
          continue;
        }
        const piece = flat.slice(start, j).trim();
        if (piece) out.push(piece);
        start = j;
        i = j;
        continue;
      }
    }
    i += 1;
  }
  const tail = flat.slice(start).trim();
  if (tail) out.push(tail);
  return out;
}

export function words(text: string): number {
  return ((text ?? '').match(/\S+/g) ?? []).length;
}

function provenance(sentence: string): boolean {
  const s = sentence.toLowerCase().replace(/^\*\*/, '');
  return PROVENANCE.some((p) => s.startsWith(p) && (s.length === p.length || !isWord(s.charAt(p.length))));
}

function stripListMarker(text: string): string {
  const first = text.split('\n')[0]!;
  let s = lstrip3(first) ?? first;
  s = s.replace(/^[-*+][ \t]+/, '').replace(/^\d+[.)][ \t]+/, '');
  return s.replace(/^\[[ xX]\][ \t]+/, '');
}

function firstListItem(text: string): string {
  const lines = text.split('\n');
  const item = [stripListMarker(lines[0]!)];
  for (let x = 1; x < lines.length; x += 1) {
    const line = lines[x]!;
    if (!/\S/.test(line) || (lineKind(line) === 'list' && line.slice(0, 2) !== '  ')) break;
    item.push(line.trim());
  }
  return item.join(' ');
}

function cap(text: string, maxWords: number): string {
  const ws = text.match(/\S+/g) ?? [];
  if (ws.length <= maxWords) return text;
  let cut = ws.slice(0, maxWords);
  for (let x = cut.length; x >= Math.floor((2 * maxWords) / 3) + 2; x -= 1) {
    const last = cut[x - 1]!.slice(-1);
    if (last === ';' || last === ',' || last === ':') { cut = cut.slice(0, x); break; }
  }
  let out = cut.join(' ').replace(/[;,:]+$/, '');
  if (((out.match(/`/g) ?? []).length) % 2 === 1) out = out.slice(0, out.lastIndexOf('`')).trim();
  return `${out} …`;
}

function trimTo(ss: string[], maxSentences: number, maxWords: number): string {
  if (!ss[0] || ss[0].trim().endsWith(':')) return '';
  const out = [ss[0]];
  for (let x = 1; x < Math.min(ss.length, maxSentences); x += 1) {
    const s = ss[x]!;
    if (s.trim().endsWith(':')) break;
    if (words(`${out.join(' ')} ${s}`) > maxWords) break;
    out.push(s);
  }
  return cap(out.join(' '), maxWords);
}

/** The summary of a parsed body, and where it came from: 'written', a section's heading, or null (the preamble). */
export function summary(body: string, maxSentences = 2, maxWords = 50): { text: string; from: string | null } {
  const secs = sections(body);
  for (const sec of secs) {
    if (sec.heading && sec.heading.toLowerCase() === 'summary') return { text: sec.lines.join('\n').trim(), from: 'written' };
  }
  for (const sec of secs) {
    if (META.has((sec.heading ?? '').toLowerCase())) continue;
    const bs = blocks(sec.lines);
    for (const b of bs) {
      if (b.kind !== 'prose') continue;
      const ss = sentences(b.text);
      while (ss[0] !== undefined && provenance(ss[0])) ss.shift();
      if (ss.length > 0) return { text: trimTo(ss, maxSentences, maxWords), from: sec.heading };
    }
    for (const b of bs) {
      if (b.kind === 'list') return { text: trimTo(sentences(firstListItem(b.text)), maxSentences, maxWords), from: sec.heading };
    }
  }
  return { text: '', from: null };
}

/** The body's `##` headings in order (the agents'-text fold line names them), and its size in words. */
export function outline(body: string): { names: string[]; words: number } {
  return { names: sections(body).flatMap((s) => (s.heading ? [s.heading] : [])), words: words(body ?? '') };
}
