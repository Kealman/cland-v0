import { matchesGlob } from 'node:path';
import { requireTypeScript } from './typescript-capability.ts';
import { normalizeId, parseItem } from './tracker/item.ts';

export type Document = { path: string; text: string };
export const documentPatterns = ['**/README*.md', 'docs/**/*.md', 'site/src/content/docs/**/*.{md,mdx}'];

function mdxProse(text: string): string {
  const ts = requireTypeScript('closed-item wording MDX parser');
  const blank = (value: string): string => value.replace(/[^\r\n]/g, ' ');
  let fence: { marker: string; length: number } | undefined;
  let frontmatter = false;
  let prose = text.split(/\r?\n/).map((line, index) => {
    if (index === 0 && line === '---') { frontmatter = true; return blank(line); }
    if (frontmatter) {
      if (line === '---') frontmatter = false;
      return blank(line);
    }
    const marker = /^\s{0,3}(`{3,}|~{3,})(.*)$/.exec(line);
    if (fence) {
      if (marker && marker[1]![0] === fence.marker && marker[1]!.length >= fence.length && !marker[2]!.trim()) fence = undefined;
      return blank(line);
    }
    if (marker) { fence = { marker: marker[1]![0]!, length: marker[1]!.length }; return blank(line); }
    return line;
  }).join('\n');
  // MDX ESM can span lines and omit semicolons. Let the existing compiler
  // parser identify its statement boundary rather than guessing at braces.
  const esm = /^[ \t]*(?:import|export)\s/gm;
  let match: RegExpExecArray | null;
  while ((match = esm.exec(prose))) {
    const statement = ts.createSourceFile('document.tsx', prose.slice(match.index), ts.ScriptTarget.Latest, false, ts.ScriptKind.TSX).statements[0];
    if (!statement) continue;
    const statementEnd = match.index + statement.end;
    const commentEnd = ts.getTrailingCommentRanges(prose, statementEnd)?.at(-1)?.end ?? statementEnd;
    const newline = prose.indexOf('\n', commentEnd);
    const end = newline < 0 ? prose.length : newline;
    prose = prose.slice(0, match.index) + blank(prose.slice(match.index, end)) + prose.slice(end);
    esm.lastIndex = end;
  }
  // Strip tags and their attributes, retaining children (including same-line prose).
  return prose.replace(/<\/?[A-Za-z][\w.:-]*(?:"[^"]*"|'[^']*'|\{[^}]*\}|[^'"<>])*\/?\s*>/g, blank);
}

export function findings(documents: Document[], tracker: string[]): string[] {
  const closed = new Set(tracker.map(text => parseItem(text).fm).filter(item => item.state === 'closed').map(item => normalizeId(item.id)));
  return closedItemFindings(documents, closed);
}

export function closedItemFindings(documents: Document[], closed: ReadonlySet<string | null>): string[] {
  const failures: string[] = [];
  for (const document of documents) {
    const lines = (document.path.endsWith('.mdx') ? mdxProse(document.text) : document.text).split(/\r?\n/);
    const exempt = (line: string): boolean => Boolean(/<!--\s*cland-allow-closed-wording:\s*([^\n]*?)\s*-->/.exec(line)?.[1]?.trim());
    lines.forEach((line, index) => {
      const previous = lines[index - 1] ?? '';
      if (exempt(line) || /^\s*<!--[^\n]*-->\s*$/.test(previous) && exempt(previous)) return;
      const wording = /\b(until|stand-in|pending|later ticket)\b/i.exec(line)?.[1]?.toLowerCase();
      if (!wording) return;
      const ids = new Set([...line.matchAll(/\b[A-Z]-\d+\b/gi)].map(match => match[0].toUpperCase()));
      for (const id of ids) if (closed.has(normalizeId(id))) failures.push(`${document.path}:${index + 1}: closed item ${id} with ${wording} wording`);
    });
  }
  return failures;
}

export function isWordingDocument(path: string): boolean {
  return !path.split('/').some(part => ['node_modules', '.git', '.cland'].includes(part)) && documentPatterns.some(pattern => matchesGlob(path, pattern));
}

