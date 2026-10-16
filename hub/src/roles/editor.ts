// Edit the human's roles.toml by source spans; never re-render its other settings or clauses.
import { parse } from 'smol-toml';
import { randomUUID } from 'node:crypto';
import { readFile, writeFile, rename, unlink } from 'node:fs/promises';
import { ROLE_NAMES } from '../names.ts';
import { parseRoles } from './config.ts';
import type { Resumed } from '../hub/budget.ts';

const HARNESSES = ['claude-code', 'codex', 'opencode'];

type Statement = { start: number; end: number; equals: number; comment: number };

/** Logical TOML lines: strings, arrays and inline tables can span physical lines. */
function statements(text: string): Statement[] {
  const out: Statement[] = [];
  let start = 0;
  let equals = -1;
  let comment = -1;
  let depth = 0;
  let quote = '';
  let multiline = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (quote) {
      if (quote === '"' && c === '\\') { i++; continue; }
      if (c !== quote) continue;
      if (multiline) {
        let end = i;
        while (text[end] === quote) end++;
        if (end - i >= 3) { quote = ''; multiline = false; }
        i = end - 1;
      } else quote = '';
      continue;
    }
    if (c === '"' || c === "'") {
      quote = c;
      multiline = text.slice(i, i + 3) === c.repeat(3);
      if (multiline) i += 2;
    } else if (c === '#') {
      if (depth === 0) comment = i;
      while (i < text.length && text[i] !== '\n') i++;
      i--; // Let the newline finish this statement, or continue an array.
    } else if (c === '[' || c === '{') depth++;
    else if (c === ']' || c === '}') depth--;
    else if (c === '=' && depth === 0 && equals === -1) equals = i;
    else if (c === '\n' && depth === 0) {
      out.push({ start, end: i + 1, equals, comment });
      start = i + 1; equals = -1; comment = -1;
    }
  }
  if (start < text.length) out.push({ start, end: text.length, equals, comment });
  return out;
}

/** Decode quoted/dotted keys with the same TOML parser as the hub. */
function keyPath(source: string): string[] {
  const path: string[] = [];
  let value: unknown = parse(source);
  while (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    const entries = Object.entries(value);
    if (entries.length !== 1) break;
    const [key, child] = entries[0]!;
    path.push(key); value = child;
  }
  return path;
}

/** Set one key, retaining its spacing and trailing comment unless a replacement comment is supplied.
 * `comment` is the comment text, with an optional leading #. An empty comment removes the old one.
 * The returned text always passes the hub's roles parser; its errors propagate unchanged.
 */
export function setRoleKey(text: string, role: string, table: 'launch' | 'permissions', key: string, value: string | readonly string[], comment?: string): string {
  if (!ROLE_NAMES.includes(role)) throw new Error(`unknown role [${role}]`);
  if (table !== 'launch' && table !== 'permissions') throw new Error('role table must be launch or permissions');
  if (!/^[A-Za-z0-9_-]+$/.test(key)) throw new Error('role key must be a bare TOML key');
  if (comment?.includes('\n') || comment?.includes('\r')) throw new Error('role key comment must be a single line');
  parse(text); // Reject broken source syntax, but allow a missing launch table to be supplied.
  const lines = statements(text);
  const headers = lines.flatMap((line, index) => text.slice(line.start, line.end).trimStart().startsWith('[')
    ? [{ index, path: keyPath(text.slice(line.start, line.end)) }] : []);
  const header = headers.find(h => h.path.length === 2 && h.path[0] === role && h.path[1] === table);
  const newline = text.match(/\r?\n/)?.[0] ?? '\n';
  const encoded = JSON.stringify(value);
  const newComment = comment === undefined || comment === '' ? '' : ` # ${comment.replace(/^#\s*/, '')}`;
  let result: string;
  if (header) {
    const end = headers.find(h => h.index > header.index)?.index ?? lines.length;
    const existing = lines.slice(header.index + 1, end).find(line => line.equals >= 0
      && keyPath(`${text.slice(line.start, line.equals)}=0`).join('.') === key);
    if (existing) {
      const valueStart = existing.equals + 1 + text.slice(existing.equals + 1, existing.end).match(/^[ \t]*/)![0].length;
      const valueEnd = text.slice(0, existing.comment >= 0 ? existing.comment : existing.end).trimEnd().length;
      const suffix = comment === undefined ? text.slice(valueEnd, existing.end)
        : newComment + (text.slice(existing.start, existing.end).match(/\r?\n$/)?.[0] ?? '');
      result = text.slice(0, valueStart) + encoded + suffix + text.slice(existing.end);
    } else {
      const at = lines[end]?.start ?? text.length;
      result = text.slice(0, at) + (at && text[at - 1] !== '\n' ? newline : '') + `${key} = ${encoded}${newComment}${newline}` + text.slice(at);
    }
  } else {
    const last = headers.filter(h => h.path[0] === role).at(-1);
    const next = last && headers.find(h => h.index > last.index);
    const at = next ? lines[next.index]!.start : text.length;
    result = text.slice(0, at) + (at && text[at - 1] !== '\n' ? newline : '') + `[${role}.${table}]${newline}${key} = ${encoded}${newComment}${newline}` + text.slice(at);
  }
  parseRoles(result, null, HARNESSES);
  return result;
}

/** Atomically publish an edited snapshot, comparing against the caller's original read immediately
 * before rename, as crew set does. Callers serialize their setters and can recheck authority at both
 * boundaries through `authorize`; `resumed` keeps hub continuations inside their request budget.
 */
export async function writeRolesFile(path: string, original: string, text: string, resumed: Resumed = work => work(), authorize: () => void = () => {}): Promise<void> {
  resumed(() => { authorize(); parseRoles(text, null, HARNESSES); });
  const temporary = `${path}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, text, { flag: 'wx' });
    const current = await readFile(path, 'utf8');
    resumed(() => { authorize(); if (current !== original) throw new Error('roles.toml changed while setting it; retry'); });
    await rename(temporary, path);
  } finally { await unlink(temporary).catch(() => {}); }
}
