// Telegram text conversion. Entity offsets use UTF-16; message limits use code points.
import type { TgEntity } from './telegram-api.ts';

export type Formatted = { text: string; entities: TgEntity[] };

class Builder {
  text = '';
  entities: TgEntity[] = [];
  add(chunk: string): void { this.text += chunk; }
  wrap(type: string, body: () => void, extra: Partial<TgEntity> = {}): void {
    const offset = this.text.length;
    const firstEntity = this.entities.length;
    body();
    const length = this.text.length - offset;
    // Telegram permits emphasis inside quotes, but code/links cannot be nested
    // there. Keep those spans and their text instead of the outer quote style.
    if (type === 'blockquote' && this.entities.slice(firstEntity).some(entity =>
      !['bold', 'italic', 'underline', 'strikethrough', 'spoiler'].includes(entity.type))) return;
    if (length > 0) this.entities.push({ type, offset, length, ...extra });
  }
  /** Inline Markdown; inside emphasis or a link no code entity may nest (Telegram's nesting rule). */
  inline(s: string, nested = false): void {
    let i = 0;
    while (i < s.length) {
      const c = s[i]!;
      if (c === '\\' && i + 1 < s.length && /[\\`*_{}[\]()#+\-.!|~>]/.test(s[i + 1]!)) { this.add(s[i + 1]!); i += 2; continue; }
      if (c === '`') {
        const j = s.indexOf('`', i + 1);
        if (j > i + 1) {
          if (nested) this.add(s.slice(i + 1, j)); else this.wrap('code', () => this.add(s.slice(i + 1, j)));
          i = j + 1; continue;
        }
      }
      const pair = s.slice(i, i + 2);
      if (pair === '**' || pair === '__' || pair === '~~') {
        const j = s.indexOf(pair, i + 2);
        if (j > i + 2) { this.wrap(pair === '~~' ? 'strikethrough' : 'bold', () => this.inline(s.slice(i + 2, j), true)); i = j + 2; continue; }
      }
      if ((c === '*' || c === '_') && s[i + 1] && s[i + 1] !== ' ' && s[i + 1] !== c && (c === '*' || i === 0 || !/\w/.test(s[i - 1]!))) {
        let j = i + 1;
        while ((j = s.indexOf(c, j)) !== -1 && (s[j - 1] === ' ' || s[j + 1] === c || (c === '_' && /\w/.test(s[j + 1] ?? '')))) j++;
        if (j > i + 1) { this.wrap('italic', () => this.inline(s.slice(i + 1, j), true)); i = j + 1; continue; }
      }
      if (c === '[') {
        const m = /^\[([^\]]+)\]\(([^)\s]+)\)/.exec(s.slice(i));
        if (m) {
          if (/^https?:\/\//.test(m[2]!)) this.wrap('text_link', () => this.inline(m[1]!, true), { url: m[2]! });
          else { this.inline(m[1]!, nested); this.add(` (${m[2]!})`); }
          i += m[0].length; continue;
        }
      }
      this.add(c); i++;
    }
  }
}
const codePoints = (s: string): number => { let n = 0; for (const _ of s) n++; return n; };
const stripInline = (s: string): string => s.replace(/\*\*|__|~~|`/g, '').trim();

function table(rows: string[]): string {
  const parsed = rows.map(r => r.trim().replace(/^\||\|$/g, '').split('|').map(stripInline));
  const cells = parsed.filter((row, index) => !(index === 1 && row.length === parsed[0]!.length && row.every(cell => /^:?-+:?$/.test(cell))));
  const widths: number[] = [];
  for (const row of cells) row.forEach((cell, k) => { widths[k] = Math.max(widths[k] ?? 0, codePoints(cell)); });
  return cells.map(row => row.map((cell, k) => cell + ' '.repeat((widths[k] ?? 0) - codePoints(cell))).join('  ').trimEnd()).join('\n');
}

export function markdownToEntities(markdown: string): Formatted {
  const lines = markdown.replace(/\r\n?/g, '\n').split('\n');
  const b = new Builder();
  const newline = () => { if (b.text.length) b.add('\n'); };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const fence = /^ {0,3}(```+|~~~+)\s*([\w+#.-]*)\s*$/.exec(line);
    if (fence) {
      const body: string[] = [];
      for (i++; i < lines.length; i++) {
        const close = /^ {0,3}(`{3,}|~{3,})[ \t]*$/.exec(lines[i]!);
        if (close && close[1]![0] === fence[1]![0] && close[1]!.length >= fence[1]!.length) break;
        body.push(lines[i]!);
      }
      newline();
      b.wrap('pre', () => b.add(body.join('\n') || ' '), fence[2] ? { language: fence[2] } : {});
      continue;
    }
    if (/^\s*\|.*\|\s*$/.test(line)) {
      const rows = [line];
      while (i + 1 < lines.length && /^\s*\|.*\|\s*$/.test(lines[i + 1]!)) rows.push(lines[++i]!);
      newline();
      b.wrap('pre', () => b.add(table(rows)));
      continue;
    }
    if (/^\s*>/.test(line)) {
      const quoted = [line];
      while (i + 1 < lines.length && /^\s*>/.test(lines[i + 1]!)) quoted.push(lines[++i]!);
      newline();
      b.wrap('blockquote', () => quoted.forEach((q, k) => { if (k) b.add('\n'); b.inline(q.replace(/^\s*>\s?/, '')); }));
      continue;
    }
    newline();
    const heading = /^\s{0,3}#{1,6}\s+(.*?)\s*#*\s*$/.exec(line);
    if (heading) { b.wrap('bold', () => b.inline(heading[1]!, true)); continue; }
    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) { b.add('──────────'); continue; }
    const item = /^(\s*)([-*+]|\d+[.)])\s+(\[[ xX]\]\s+)?(.*)$/.exec(line);
    if (item) {
      const marker = item[3] ? (/x/i.test(item[3]) ? '☑' : '☐') : /\d/.test(item[2]!) ? item[2]! : '•';
      b.add(`${' '.repeat(Math.min(item[1]!.length, 8))}${marker} `);
      b.inline(item[4]!);
      continue;
    }
    b.inline(line);
  }
  return { text: b.text, entities: b.entities };
}

/** Keep text on conversion failure, including malformed/deeply nested Markdown. */
function convert(markdown: string): Formatted {
  try { return markdownToEntities(markdown); }
  catch { return { text: markdown, entities: [] }; }
}

function chunks(body: Formatted, budget: number): Formatted[] {
  // An entity larger than one message cannot remain styled without being split.
  // Remove only that style; preserve every character and any smaller spans.
  const entities = body.entities.filter(entity => codePoints(body.text.slice(entity.offset, entity.offset + entity.length)) <= budget)
    .sort((a, b) => a.offset - b.offset || b.length - a.length);
  const parts: Formatted[] = [];
  let start = 0;
  while (start < body.text.length) {
    let end = start;
    for (let count = 0; end < body.text.length && count < budget; count++)
      end += body.text.codePointAt(end)! > 0xffff ? 2 : 1;
    // Header consumes one of the hundred styled entities.
    const spans = entities.filter(entity => entity.offset >= start && entity.offset < end);
    if (spans.length > 99) end = Math.min(end, spans[99]!.offset);
    const safe = (cut: number) => !entities.some(entity => entity.offset < cut && entity.offset + entity.length > cut);
    while (end > start && !safe(end)) {
      end = Math.min(...entities.filter(entity => entity.offset < end && entity.offset + entity.length > end).map(entity => entity.offset));
    }
    if (end === start) {
      // Overlapping/nested styles can collectively exceed either bound. The text
      // is still deliverable: discard this connected style group, then retry.
      const index = entities.findIndex(entity => entity.offset === start);
      if (index < 0) throw new Error('Telegram text split has no safe boundary');
      entities.splice(index, 1);
      continue;
    }
    if (end < body.text.length) {
      // Prefer whole blocks, then whole lines, while retaining all whitespace.
      const blockIndex = body.text.lastIndexOf('\n\n', end - 2);
      const block = blockIndex < start ? start : blockIndex + 2;
      const line = body.text.lastIndexOf('\n', end - 1) + 1;
      if (block > start && block <= end && safe(block)) end = block;
      else if (line > start && line <= end && safe(line)) end = line;
    }
    parts.push({ text: body.text.slice(start, end), entities: entities
      .filter(entity => entity.offset >= start && entity.offset + entity.length <= end)
      .map(entity => ({ ...entity, offset: entity.offset - start })) });
    start = end;
  }
  return parts.length ? parts : [{ text: '', entities: [] }];
}

/** Repeat the header, budget numbering, and never clip or truncate an entity. */
export function plainParts(header: string, markdown: string): Formatted[] {
  const body = convert(markdown);
  let total = 1;
  for (;;) {
    const suffix = total > 1 ? ` · ${total}/${total}` : '';
    const parts = chunks(body, Math.max(1, 4096 - codePoints(header + suffix) - 1));
    // Only grow the reserved width: a tighter budget may turn an oversized
    // style plain and reduce the count around a numbering digit boundary.
    if (parts.length > total) { total = parts.length; continue; }
    total = parts.length;
    return parts.map((part, index) => {
      const title = `${header}${total > 1 ? ` · ${index + 1}/${total}` : ''}`;
      return { text: `${title}\n${part.text}`, entities: [{ type: 'bold', offset: 0, length: title.length },
        ...part.entities.map(entity => ({ ...entity, offset: entity.offset + title.length + 1 }))] };
    });
  }
}
