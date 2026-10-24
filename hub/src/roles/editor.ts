// Edit the human's roles.toml by source spans; never re-render its other settings or clauses.
import { parse } from 'smol-toml';
import { randomUUID } from 'node:crypto';
import { readFile, writeFile, rename, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { ROLE_NAMES } from '../names.ts';
import { CLAND_DIR } from '../project.ts';
import { parseRoles } from './config.ts';
import type { Resumed } from '../hub/budget.ts';

const HARNESSES = ['claude-code', 'codex', 'opencode'];

/** Setup writes this trailing comment on [aide.launch] harness after the human chooses. */
export const CHOSEN = "# the human's favourite, chosen in cland setup";

/** Read setup's mark without changing the file or preventing open on invalid roles. */
export async function projectSetUp(root: string): Promise<boolean> {
  try {
    const text = await readFile(join(root, CLAND_DIR, 'roles.toml'), 'utf8');
    parseRoles(text);
    let table = '';
    for (const line of statements(text)) {
      const source = text.slice(line.start, line.end);
      if (source.trimStart().startsWith('[')) table = keyPath(source).join('.');
      else if (table === 'aide.launch' && line.equals >= 0
        && keyPath(`${text.slice(line.start, line.equals)}=0`).join('.') === 'harness') {
        return line.comment >= 0 && text.slice(line.comment, line.end).trim() === CHOSEN;
      }
    }
    return false;
  } catch { return false; }
}

const AIDE_TOOLS_MARK = '# cland: aide-tools-0.1.4 migrated';
const AIDE_TOOLS = ['session.launch', 'session.stop', 'session.resume', 'task.import', 'push'];
const OLD_AIDE_RESTRICTION = '- You cannot ask the human, resolve a topic\'s wait, launch, stop or resume sessions, merge, hand over a role, release, sync or `cland push`: the Coordinator owns those operations.';
const NEW_AIDE_LINES = [
  '- On the human\'s word, launch, stop and resume sessions of any role, the Coordinator first of all: use `session.launch` or `cland session launch | stop | resume` from your shell. Say what you will launch before doing it. During a build the Coordinator keeps the crew\'s staffing, so launch only when the human asks.',
  '- On the human\'s confirmation, import an existing project\'s open GitHub issues with `cland task import-github`. After committing the onboarding\'s work on root `dev`, publish it with `cland push` from your own shell.',
  '- You cannot ask the human, resolve a topic\'s wait, merge, hand over a role, release or sync: the Coordinator owns those operations.',
];

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

/** The one-time 0.1.4 edit. Only explicit grants opt in; the mark respects later human removals.
 * Source spans keep comments, existing grant order and all unrelated bytes intact.
 * Invalid files throw before an edit is returned, so startup can defer without writing.
 */
export function migrateAideTools(text: string): { text: string; added: string[]; customClause: boolean } {
  parseRoles(text);
  const doc = parse(text) as { aide?: { permissions?: { tools?: string[] } } };
  const tools = doc.aide?.permissions?.tools;
  const unchanged = { text, added: [], customClause: false };
  if (!tools) return unchanged;
  const lines = statements(text);
  const headers = lines.flatMap((line, index) => text.slice(line.start, line.end).trimStart().startsWith('[')
    ? [{ index, path: keyPath(text.slice(line.start, line.end)).join('.') }] : []);
  const header = headers.find(h => h.path === 'aide.permissions');
  if (!header) return unchanged;
  const end = headers.find(h => h.index > header.index)?.index ?? lines.length;
  const body = lines.slice(header.index + 1, end);
  if (body.some(line => text.slice(line.start, line.end).trim() === AIDE_TOOLS_MARK)) return unchanged;
  const added = AIDE_TOOLS.filter(tool => !tools.includes(tool));
  if (!added.length) return unchanged;
  const grants = body.find(line => line.equals >= 0 && keyPath(`${text.slice(line.start, line.equals)}=0`).join('.') === 'tools');
  if (!grants) return unchanged;
  const newline = text.match(/\r?\n/)?.[0] ?? '\n';
  // Locate the closing array bracket before its trailing comment. In a parsed logical
  // statement it follows all strings and interior comments, even ones containing ].
  const close = text.lastIndexOf(']', grants.comment >= 0 ? grants.comment - 1 : grants.end - 1);
  // A comma at the beginning of the inserted line works with an existing last value
  // or its trailing comment. A parsed probe distinguishes an existing trailing comma.
  const prefix = text.slice(grants.equals + 1, close);
  let separator = '';
  if (tools.length) {
    try { parse(`tools = ${prefix}\n"send"]`); }
    catch { separator = ','; }
  }
  const at = lines[header.index]!.end;
  const edits = [
    { start: close, end: close, value: `${separator}${added.map(tool => JSON.stringify(tool)).join(',')}` },
    { start: at, end: at, value: (text[at - 1] === '\n' ? '' : newline) + AIDE_TOOLS_MARK + newline },
  ];
  // Only the Aide's actual clause statement can be changed, never another role,
  // a comment or a header-looking line embedded in somebody else's clause.
  const aide = headers.find(h => h.path === 'aide');
  const aideEnd = aide ? headers.find(h => h.index > aide.index)?.index ?? lines.length : 0;
  const clause = aide && lines.slice(aide.index + 1, aideEnd).find(line => line.equals >= 0
    && keyPath(`${text.slice(line.start, line.equals)}=0`).join('.') === 'clause');
  const source = clause ? text.slice(clause.start, clause.end) : '';
  const oldLine = source.split(/\r?\n/).find(line => line === OLD_AIDE_RESTRICTION);
  if (clause && oldLine) {
    edits.push({ start: clause.start, end: clause.end, value: source.split(/(\r?\n)/).map(line => line === OLD_AIDE_RESTRICTION ? NEW_AIDE_LINES.join(newline) : line).join('') });
  }
  let result = text;
  for (const edit of edits.sort((a, b) => b.start - a.start)) result = result.slice(0, edit.start) + edit.value + result.slice(edit.end);
  parseRoles(result);
  return { text: result, added, customClause: !oldLine };
}

/** Set one key, retaining its spacing and trailing comment unless a replacement comment is supplied.
 * `comment` is the comment text, with an optional leading #. An empty comment removes the old one.
 * The returned text always passes the hub's roles parser; its errors propagate unchanged.
 */
export function setRoleKey(text: string, role: string, table: 'launch' | 'permissions', key: string, value: string | readonly string[], comment?: string): string {
  if (!parseRoles(text).has(role)) throw new Error(`unknown role [${role}]`);
  const prefix = ROLE_NAMES.includes(role) ? [role] : ['custom', role];
  if (table !== 'launch' && table !== 'permissions') throw new Error('role table must be launch or permissions');
  if (!/^[A-Za-z0-9_-]+$/.test(key)) throw new Error('role key must be a bare TOML key');
  if (comment?.includes('\n') || comment?.includes('\r')) throw new Error('role key comment must be a single line');
  parse(text); // Reject broken source syntax, but allow a missing launch table to be supplied.
  const lines = statements(text);
  const headers = lines.flatMap((line, index) => text.slice(line.start, line.end).trimStart().startsWith('[')
    ? [{ index, path: keyPath(text.slice(line.start, line.end)) }] : []);
  const header = headers.find(h => h.path.length === prefix.length + 1 && prefix.every((part, i) => h.path[i] === part) && h.path.at(-1) === table);
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
    const last = headers.filter(h => prefix.every((part, i) => h.path[i] === part)).at(-1);
    const next = last && headers.find(h => h.index > last.index);
    const at = next ? lines[next.index]!.start : text.length;
    result = text.slice(0, at) + (at && text[at - 1] !== '\n' ? newline : '') + `[${prefix.join('.')}.${table}]${newline}${key} = ${encoded}${newComment}${newline}` + text.slice(at);
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
