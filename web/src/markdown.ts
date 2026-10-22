// Message-local subset ported from Q-405's prototype/web-shell thread/markdown.tsx.
// Tokens contain text, never HTML. Renderers create elements and supply item navigation.
export type MarkdownInline =
  | { kind: 'text'; text: string }
  | { kind: 'code'; text: string }
  | { kind: 'strong' | 'em'; children: MarkdownInline[] }
  | { kind: 'link'; href: string; text: string }
  | { kind: 'item'; id: string };
export type MarkdownBlock =
  | { kind: 'paragraph'; children: MarkdownInline[] }
  | { kind: 'heading'; level: number; children: MarkdownInline[] }
  | { kind: 'quote'; children: MarkdownInline[] }
  | { kind: 'table'; text: string }
  | { kind: 'code'; language: string; text: string }
  | { kind: 'list'; ordered: boolean; start: number; items: MarkdownInline[][] };

const bullet = /^\s{0,3}([-*+]|\d+[.)])\s+(.*)/;
const blockStart = /^\s{0,3}(`{3,}|~{3,}|#{1,6}\s|>|\||[-*+]\s|\d+[.)]\s)/;
const inlinePattern = /(?<html><!--[^]*?-->|<[^>\n]*>)|(?<code>`[^`\n]+`)|(?<bold>\*\*[^*\n]+\*\*)|(?<link>!?\[[^\]\n]*\]\((?<href>[^)\n]*)\))|(?<id>\b[A-Z]-\d+\b)|(?<em>(?<![\w*])\*[^*\s][^*\n]*?\*(?![\w*]))|(?<bare>https?:\/\/[^\s)<>"']+)/gi;

function safeAddress(value: string): boolean {
  return /^https?:\/\/[^/?#\s]+/i.test(value) && !/[<>"'\\]/.test(value)
    && [...value].every(character => character.charCodeAt(0) > 32 && character.charCodeAt(0) !== 127);
}

function inline(source: string, prefixes: readonly string[]): MarkdownInline[] {
  const out: MarkdownInline[] = [];
  function append(value: string): void {
    const last = out.at(-1);
    if (last?.kind === 'text') last.text += value;
    else if (value) out.push({ kind: 'text', text: value });
  }
  let last = 0;
  for (const match of source.matchAll(inlinePattern)) {
    append(source.slice(last, match.index));
    const whole = match[0];
    const { html, code, bold, link, href, id, em, bare } = match.groups!;
    if (html) append(html);
    else if (code) out.push({ kind: 'code', text: code.slice(1, -1) });
    else if (bold) out.push({ kind: 'strong', children: inline(bold.slice(2, -2), prefixes) });
    else if (link) {
      if (!link.startsWith('!') && href && safeAddress(href)) out.push({ kind: 'link', href, text: link.slice(1, link.indexOf(']')) });
      else append(link);
    }
    else if (id && prefixes.includes(id[0]!)) out.push({ kind: 'item', id });
    else if (em) out.push({ kind: 'em', children: inline(em.slice(1, -1), prefixes) });
    else if (bare) {
      const address = bare.replace(/[.,;:!?]+$/, '');
      if (safeAddress(address)) { out.push({ kind: 'link', href: address, text: address }); append(bare.slice(address.length)); }
      else append(bare);
    }
    else append(whole);
    last = match.index + whole.length;
  }
  append(source.slice(last));
  return out;
}

export function parseMarkdown(message: string, options: { itemPrefixes?: readonly string[] } = {}): MarkdownBlock[] {
  const parseInline = (value: string) => inline(value, options.itemPrefixes ?? ['T', 'E', 'R', 'Q', 'M', 'S', 'C']);
  const lines = message.replace(/\r\n?/g, '\n').split('\n');
  const tableStart = (at: number) => lines[at]!.includes('|')
    && /^\s{0,3}\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(lines[at + 1] ?? '');
  const blocks: MarkdownBlock[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i]!;
    if (!line.trim()) { i++; continue; }
    const fence = /^\s{0,3}(`{3,}|~{3,})(.*)$/.exec(line);
    if (fence) {
      const marker = fence[1]!;
      const close = new RegExp(`^\\s{0,3}${marker[0]}{${marker.length},}\\s*$`);
      const body: string[] = [];
      i++;
      while (i < lines.length && !close.test(lines[i]!)) body.push(lines[i++]!);
      if (i < lines.length) i++;
      blocks.push({ kind: 'code', language: fence[2]!.trim().split(/\s+/)[0]!, text: body.join('\n') });
      continue;
    }
    const heading = /^\s{0,3}(#{1,6})\s+(.*)/.exec(line);
    if (heading) {
      blocks.push({ kind: 'heading', level: heading[1]!.length, children: parseInline(heading[2]!.replace(/\s+#+\s*$/, '')) });
      i++; continue;
    }
    if (/^\s{0,3}>/.test(line)) {
      const body: string[] = [];
      while (i < lines.length && /^\s{0,3}>/.test(lines[i]!)) body.push(lines[i++]!.replace(/^\s{0,3}>\s?/, ''));
      blocks.push({ kind: 'quote', children: parseInline(body.join(' ')) });
      continue;
    }
    if (/^\s{0,3}\|/.test(line) || tableStart(i)) {
      const body: string[] = [];
      while (i < lines.length && lines[i]!.includes('|')) body.push(lines[i++]!.trim());
      blocks.push({ kind: 'table', text: body.join('\n') });
      continue;
    }
    const first = bullet.exec(line);
    if (first) {
      const ordered = /^\d/.test(first[1]!);
      const items: string[] = [];
      while (i < lines.length) {
        const next = bullet.exec(lines[i]!);
        if (next) {
          if (/^\d/.test(next[1]!) !== ordered) break;
          items.push(next[2]!); i++;
        } else if (lines[i]!.trim() && /^\s+/.test(lines[i]!) && !blockStart.test(lines[i]!) && items.length) {
          items[items.length - 1] += ` ${lines[i++]!.trim()}`;
        } else break;
      }
      blocks.push({ kind: 'list', ordered, start: ordered ? parseInt(first[1]!, 10) : 1, items: items.map(parseInline) });
      continue;
    }
    const body: string[] = [];
    while (i < lines.length && lines[i]!.trim() && !blockStart.test(lines[i]!) && !tableStart(i)) body.push(lines[i++]!.trim());
    // Unknown block prefixes must consume a line even when their handler fails.
    if (body.length === 0) body.push(lines[i++]!.trim());
    blocks.push({ kind: 'paragraph', children: parseInline(body.join(' ')) });
  }
  return blocks;
}
