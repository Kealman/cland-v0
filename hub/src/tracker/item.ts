// A tracker item as a file (spec 4.6, ADR 0002): `.cland/tasks/T-<n>-<slug>.md`, YAML frontmatter, the
// item's text as the body, comments under `## Comments`, verdicts as comments with a structured header.
// Pure: text in, text out; nothing here touches the disk.
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';

export const KINDS = ['epic', 'spec', 'task', 'question', 'map'] as const;
export type Kind = (typeof KINDS)[number];
export const STATES = ['open', 'closed'] as const;
export type State = (typeof STATES)[number];
export const VERDICT_KINDS = ['review', 'qa'] as const;
export type VerdictKind = (typeof VERDICT_KINDS)[number];
export const RESULTS = ['clear', 'not clear'] as const;
export type VerdictResult = (typeof RESULTS)[number];

/** The frontmatter, in the order it is written. */
export type Frontmatter = {
  id: string;
  kind: Kind;
  title: string;
  state: State;
  labels: string[];
  assignee: string | null;
  parent: string | null;
  blocked_by: string[];
  topic: string | null;
  branch: string | null;
  created: string;
  updated: string;
  /** Where the item was imported from (`cland task import-github`); absent on items made here. */
  github?: GithubRef;
};

/** The GitHub issue an item was imported from: kept through every write, otherwise ignored by the hub. */
export type GithubRef = { repo: string; number: number; url: string };

export type Verdict = { verdict: VerdictKind; result: VerdictResult; by: string; run: string };

export type Comment = {
  author: string;
  at: string;
  /** The comment's text, without the verdict header when it has one. */
  text: string;
  verdict?: Verdict;
};

export type Item = { fm: Frontmatter; body: string; comments: Comment[] };

export const COMMENTS_HEADING = '## Comments';
const COMMENT_HEADER = /^### (.+?) · (\S+)\s*$/;
const VERDICT_LINE = /^(verdict|result|by|run):\s*(.*?)\s*$/;
const FILE_NAME = /^T-(\d+)(?:-[^/]*)?\.md$/;

/** `T-12`, `t-12`, `12` → `T-12`; null when it is not an item id. */
export function normalizeId(raw: string): string | null {
  const m = /^(?:[Tt]-)?(\d+)$/.exec(raw.trim());
  return m ? `T-${Number(m[1])}` : null;
}

export const idNumber = (id: string): number => Number(id.slice(2));

/** The item number a file name carries, or null when the name is not an item file. */
export function fileNumber(name: string): number | null {
  const m = FILE_NAME.exec(name);
  return m ? Number(m[1]) : null;
}

/** A short slug from a title: lowercase words joined by hyphens, cut at a word boundary. */
export function slugOf(title: string, max = 40): string {
  const words = title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  let slug = '';
  for (const w of words) {
    const next = slug ? `${slug}-${w}` : w;
    if (next.length > max) break;
    slug = next;
  }
  return slug || (words[0]?.slice(0, max) ?? '') || 'item';
}

export const fileNameOf = (id: string, title: string): string => `${id}-${slugOf(title)}.md`;

export const formatVerdictBy = (session: string, role: string | null | undefined): string => (role ? `${session} [${role}]` : session);

/** `review=clear`, `qa=not clear`, `qa=not-clear` → the pair; null when malformed. */
export function parseVerdictFilter(raw: string): { verdict: VerdictKind; result: VerdictResult } | null {
  const [k, v] = raw.split('=', 2).map((s) => s.trim().toLowerCase());
  const result = v === 'not-clear' ? 'not clear' : v;
  if (!VERDICT_KINDS.includes(k as VerdictKind) || !RESULTS.includes(result as VerdictResult)) return null;
  return { verdict: k as VerdictKind, result: result as VerdictResult };
}

// ------------------------------------------------------------------ reading

export class ItemParseError extends Error {}

const str = (v: unknown): string | null => (v === null || v === undefined || v === '' ? null : String(v));
const list = (v: unknown): string[] => (v === null || v === undefined ? [] : Array.isArray(v) ? v.map(String).filter(Boolean) : [String(v)]);
const ref = (v: unknown): string | null => {
  const s = str(v);
  return s === null ? null : (normalizeId(s) ?? s);
};

/**
 * Parse an item file. A hand-edited file is read leniently: a missing field takes its default, a single
 * label is a list of one, `12` is `T-12`. Only a file with no frontmatter, unparsable YAML, an unknown
 * kind or state, or no id at all (neither in the frontmatter nor in `fileName`) is refused.
 */
export function parseItem(text: string, fileName?: string): Item {
  const src = text.replace(/\r\n/g, '\n');
  const m = /^---\n([\s\S]*?)\n---[ \t]*(?:\n|$)/.exec(src);
  if (!m) throw new ItemParseError('no YAML frontmatter (the file must start with a --- line)');
  let raw: unknown;
  try {
    raw = parseYaml(m[1] ?? '');
  } catch (err) {
    throw new ItemParseError(`frontmatter is not valid YAML: ${err instanceof Error ? err.message.split('\n')[0] : String(err)}`);
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new ItemParseError('frontmatter is not a mapping');
  const r = raw as Record<string, unknown>;
  const fromName = fileName !== undefined ? fileNumber(fileName) : null;
  const id = ref(r.id) ?? (fromName !== null ? `T-${fromName}` : null);
  if (id === null || normalizeId(id) === null) throw new ItemParseError(`no item id (frontmatter id: ${JSON.stringify(r.id ?? null)})`);
  const kind = (str(r.kind) ?? 'task') as Kind;
  if (!KINDS.includes(kind)) throw new ItemParseError(`unknown kind "${kind}" (one of ${KINDS.join(', ')})`);
  const state = (str(r.state) ?? 'open') as State;
  if (!STATES.includes(state)) throw new ItemParseError(`unknown state "${state}" (open or closed)`);
  const fm: Frontmatter = {
    id,
    kind,
    title: str(r.title) ?? '',
    state,
    labels: list(r.labels),
    assignee: str(r.assignee),
    parent: ref(r.parent),
    blocked_by: list(r.blocked_by).map((b) => normalizeId(b) ?? b),
    topic: str(r.topic),
    branch: str(r.branch),
    created: str(r.created) ?? '',
    updated: str(r.updated) ?? '',
  };
  const github = githubOf(r.github);
  if (github) fm.github = github;

  const rest = src.slice(m[0].length);
  const lines = rest.split('\n');
  const at = lines.findIndex((l) => l.trim() === COMMENTS_HEADING);
  const body = (at < 0 ? lines : lines.slice(0, at)).join('\n').trim();
  const comments = at < 0 ? [] : parseComments(lines.slice(at + 1));
  return { fm, body, comments };
}

function githubOf(v: unknown): GithubRef | null {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return null;
  const g = v as Record<string, unknown>;
  const number = Number(g.number);
  if (typeof g.repo !== 'string' || !Number.isInteger(number) || number <= 0) return null;
  return { repo: g.repo, number, url: str(g.url) ?? '' };
}

function parseComments(lines: string[]): Comment[] {
  const comments: Comment[] = [];
  let current: { author: string; at: string; lines: string[] } | null = null;
  const flush = () => {
    if (current) comments.push(commentOf(current.author, current.at, current.lines.join('\n').trim()));
  };
  for (const line of lines) {
    const h = COMMENT_HEADER.exec(line);
    if (h) {
      flush();
      current = { author: h[1] ?? '', at: h[2] ?? '', lines: [] };
    } else if (current) current.lines.push(line);
  }
  flush();
  return comments;
}

/** A comment text whose first lines are a verdict header, split into the verdict's fields and the rest (its `by`,
 *  whatever it says, is not kept: the hub writes who recorded it). Null when it does not read as a verdict. */
export function verdictOfText(text: string): { verdict: VerdictKind; result: VerdictResult; run: string; text: string } | null {
  const c = commentOf('', '', text.trim());
  return c.verdict ? { verdict: c.verdict.verdict, result: c.verdict.result, run: c.verdict.run, text: c.text } : null;
}

/** Whether a comment's text reads back as a verdict (its first lines a verdict header), as every reader takes it. */
export const readsAsVerdict = (text: string): boolean => commentOf('', '', text.trim()).verdict !== undefined;

/** A comment whose first lines are `verdict:`, `result:`, `by:`, `run:` is a verdict; the rest is its text. */
function commentOf(author: string, at: string, text: string): Comment {
  const lines = text.split('\n');
  const header: Record<string, string> = {};
  let i = 0;
  for (; i < lines.length; i++) {
    const m = VERDICT_LINE.exec(lines[i] ?? '');
    if (!m) break;
    header[m[1] ?? ''] = m[2] ?? '';
  }
  const verdict = header.verdict?.toLowerCase();
  const result = header.result?.toLowerCase().replace('not-clear', 'not clear');
  if (verdict && VERDICT_KINDS.includes(verdict as VerdictKind) && result && RESULTS.includes(result as VerdictResult)) {
    return {
      author,
      at,
      text: lines.slice(i).join('\n').trim(),
      verdict: { verdict: verdict as VerdictKind, result: result as VerdictResult, by: header.by ?? author, run: header.run ?? '' },
    };
  }
  return { author, at, text };
}

// ------------------------------------------------------------------ writing

export function serializeItem(item: Item): string {
  const fm = item.fm;
  const ordered: Frontmatter = {
    id: fm.id,
    kind: fm.kind,
    title: fm.title,
    state: fm.state,
    labels: fm.labels,
    assignee: fm.assignee,
    parent: fm.parent,
    blocked_by: fm.blocked_by,
    topic: fm.topic,
    branch: fm.branch,
    created: fm.created,
    updated: fm.updated,
    ...(fm.github ? { github: { repo: fm.github.repo, number: fm.github.number, url: fm.github.url } } : {}),
  };
  const yaml = stringifyYaml(ordered, { lineWidth: 0, flowCollectionPadding: false });
  let out = `---\n${yaml}---\n`;
  if (item.body.trim()) out += `\n${item.body.trim()}\n`;
  if (item.comments.length) {
    out += `\n${COMMENTS_HEADING}\n`;
    for (const c of item.comments) out += `\n${serializeComment(c)}`;
  }
  return out;
}

export function serializeComment(c: Comment): string {
  let text = '';
  if (c.verdict) text += `verdict: ${c.verdict.verdict}\nresult: ${c.verdict.result}\nby: ${c.verdict.by}\nrun: ${c.verdict.run}\n`;
  if (c.text.trim()) text += `${c.verdict ? '\n' : ''}${c.text.trim()}\n`;
  return `### ${c.author} · ${c.at}\n\n${text}`;
}
