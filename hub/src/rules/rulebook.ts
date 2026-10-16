// Pure rulebook codec. Source spans let a write leave every other entry byte for byte intact.
import { ROLE_NAMES } from '../names.ts';

export const RULEBOOK_HEADER = '# Project rules\n<!-- cland: rule high-water 0 -->\n';
export type Rule = {
  number: number;
  title: string;
  scope: 'all' | string[];
  date: string;
  status: 'active' | 'retired';
  retired?: string;
  origin: string;
  retired_origin?: string;
  reason: string;
  text: string;
};
export type Rulebook = { source: string; rules: Rule[]; spans: Array<{ start: number; end: number }>; highWater: number; recordedHighWater: number | null; counterSpan: { start: number; end: number } | null };

export class RulebookError extends Error {
  readonly line: number;
  constructor(line: number, reason: string) { super(`line ${line}: ${reason}`); this.line = line; }
}
const dateValid = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
export const originValid = (value: string): boolean => /^(shell|workbench|session:[^\s]+|memory:[^\r\n]+|message:[^\s/]+\/[^\s/]+)$/.test(value);
export function parseScope(value: string, roles: Iterable<string> = ROLE_NAMES): Rule['scope'] {
  if (value === 'all') return 'all';
  const names = value.split(',').map(s => s.trim());
  const known = new Set(roles);
  for (const name of names) if (!known.has(name)) throw new Error(`unknown role ${name || '(empty)'}`);
  if (new Set(names).size !== names.length) throw new Error('duplicate scope role');
  return names;
}

export function parseRulebook(source: string, roles: Iterable<string> = ROLE_NAMES): Rulebook {
  const lines = source.split('\n');
  const clean = lines.map(line => line.replace(/\r$/, ''));
  if (!/^# [^\r\n]+$/.test(clean[0] ?? '')) throw new RulebookError(1, 'expected a one-line rulebook header');
  const offsets: number[] = [];
  let offset = 0;
  for (const line of lines) { offsets.push(offset); offset += line.length + 1; }
  const starts: number[] = [];
  for (let i = 1; i < clean.length; i++) if (clean[i]!.startsWith('## ')) starts.push(i);
  const first = starts[0] ?? clean.length;
  let recordedHighWater: number | null = null;
  let counterSpan: Rulebook['counterSpan'] = null;
  for (let i = 1; i < first; i++) {
    if (!clean[i]!.trim()) continue;
    const counter = /^<!-- cland: rule high-water (0|[1-9]\d*) -->$/.exec(clean[i]!);
    if (!counter || counterSpan) throw new RulebookError(i + 1, 'expected a rule heading or one high-water marker');
    recordedHighWater = Number(counter[1]);
    if (!Number.isSafeInteger(recordedHighWater)) throw new RulebookError(i + 1, 'rule high-water mark must be a safe nonnegative number');
    counterSpan = { start: offsets[i]!, end: offsets[i]! + clean[i]!.length };
  }
  const rules: Rule[] = [];
  const spans: Rulebook['spans'] = [];
  const roleNames = [...roles];
  let previous = 0;
  for (const [index, start] of starts.entries()) {
    const end = starts[index + 1] ?? clean.length;
    const heading = /^## ([1-9]\d*) (\S.*)$/.exec(clean[start]!);
    if (!heading) throw new RulebookError(start + 1, 'expected ## <number> <title>');
    const number = Number(heading[1]);
    if (!Number.isSafeInteger(number) || number <= previous) throw new RulebookError(start + 1, 'rule numbers must be safe, positive and increasing');
    previous = number;
    const fields = ['Scope', 'Date', 'Status', 'Origin', 'Reason'] as const;
    const values: Record<string, string> = {};
    for (const [j, field] of fields.entries()) {
      const line = start + 1 + j;
      const prefix = `${field}: `;
      if (!clean[line]?.startsWith(prefix) || !clean[line]!.slice(prefix.length).trim()) throw new RulebookError(line + 1, `expected nonempty ${field.toLowerCase()}`);
      values[field] = clean[line]!.slice(prefix.length).trim();
    }
    let scope: Rule['scope'];
    try { scope = parseScope(values.Scope!, roleNames); }
    catch (error) { throw new RulebookError(start + 2, (error as Error).message); }
    if (!dateValid(values.Date!)) throw new RulebookError(start + 3, 'invalid date (expected YYYY-MM-DD)');
    const status = /^(active|retired (\d{4}-\d{2}-\d{2}))$/.exec(values.Status!);
    if (!status || (status[2] && !dateValid(status[2]))) throw new RulebookError(start + 4, 'invalid status (expected active or retired YYYY-MM-DD)');
    if (!originValid(values.Origin!)) throw new RulebookError(start + 5, 'invalid origin');
    let blank = start + 6;
    let retiredOrigin: string | undefined;
    if (clean[blank]?.startsWith('Retired-origin:')) {
      retiredOrigin = clean[blank]!.slice('Retired-origin:'.length).trim();
      if (!originValid(retiredOrigin)) throw new RulebookError(blank + 1, 'invalid retirement origin');
      if (!status[2]) throw new RulebookError(blank + 1, 'retirement origin requires retired status');
      blank++;
    }
    if (clean[blank] !== '') throw new RulebookError(blank + 1, 'expected a blank line before rule text');
    const text = clean.slice(blank + 1, end).join('\n').trim();
    if (!text) throw new RulebookError(blank + 2, 'expected rule text');
    rules.push({ number, title: heading[2]!.trim(), scope, date: values.Date!, status: values.Status === 'active' ? 'active' : 'retired', ...(status[2] ? { retired: status[2] } : {}), origin: values.Origin!, ...(retiredOrigin !== undefined ? { retired_origin: retiredOrigin } : {}), reason: values.Reason!, text });
    spans.push({ start: offsets[start]!, end: starts[index + 1] === undefined ? source.length : offsets[end]! });
  }
  return { source, rules, spans, highWater: Math.max(recordedHighWater ?? 0, previous), recordedHighWater, counterSpan };
}

export function renderRule(rule: Rule): string {
  return `## ${rule.number} ${rule.title}\nScope: ${rule.scope === 'all' ? 'all' : rule.scope.join(', ')}\nDate: ${rule.date}\nStatus: ${rule.status === 'active' ? 'active' : `retired ${rule.retired}`}\nOrigin: ${rule.origin}\nReason: ${rule.reason}\n${rule.retired_origin !== undefined ? `Retired-origin: ${rule.retired_origin}\n` : ''}\n${rule.text}\n\n`;
}
export function renderRulebook(book: Rulebook, rules: readonly Rule[] = book.rules): string {
  let out = book.source.slice(0, book.spans[0]?.start ?? book.source.length);
  if (rules !== book.rules) {
    const highWater = Math.max(book.highWater, ...rules.map(rule => rule.number));
    const marker = `<!-- cland: rule high-water ${highWater} -->`;
    if (book.counterSpan) out = out.slice(0, book.counterSpan.start) + marker + out.slice(book.counterSpan.end);
    else {
      const newline = out.indexOf('\n');
      const end = newline < 0 ? out.length : newline + 1;
      out = out.slice(0, end) + (newline < 0 ? '\n' : '') + marker + '\n' + out.slice(end);
    }
  }
  for (const rule of rules) {
    const index = book.rules.findIndex(old => old.number === rule.number);
    const span = book.spans[index];
    const raw = span && JSON.stringify(rule) === JSON.stringify(book.rules[index]) ? book.source.slice(span.start, span.end) : renderRule(rule);
    if (index < 0 && out && !out.endsWith('\n\n') && !out.endsWith('\r\n\r\n')) out += out.endsWith('\n') ? '\n' : '\n\n';
    out += raw;
  }
  return out;
}
