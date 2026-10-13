// A tracker item as a file (spec 4.6, ADR 0002): `.cland/tasks/T-<n>-<slug>.md`, YAML frontmatter, the
// item's text as the body, comments under `## Comments`, verdicts as comments with a structured header.
// Pure: text in, text out; nothing here touches the disk.
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import { parseItemReference } from './prefixes.ts';
import { validTimestamp } from './criteria.ts';
import { DEFAULT_LEVELS, kindsFor, kindWithArticle, ladderOf, type LadderInput } from './kinds.ts';
// Keep Kind visible to the compiler after inference/destructuring; every configured string remains assignable.
export type Kind = string & {};
export const STATES = ['open', 'closed'] as const;
export type State = (typeof STATES)[number];
export const STATUSES = ['backlog', 'planned', 'in progress', 'review', 'qa', 'ready', 'done'] as const;
export type Status = (typeof STATUSES)[number];
export const VERDICT_KINDS = ['review', 'qa'] as const;
export type VerdictKind = (typeof VERDICT_KINDS)[number];
export const RESULTS = ['clear', 'not clear'] as const;
export type VerdictResult = (typeof RESULTS)[number];

/** The frontmatter, in the order it is written. */
export type Frontmatter = {
  id: string;
  kind: Kind;
  /** Release semver, without the v; absent until planned. */
  version?: string;
  title: string;
  state: State;
  /** Task workflow status; other kinds have none. */
  status?: Status;
  /** Explicit sibling rank; absent means the numeric id times ten. */
  rank?: number;
  /** Highest criterion id allocated, including removed criteria. */
  criterion_seq?: number;
  plan_approval?: { hash: string; by: string; at: string };
  labels: string[];
  assignee: string | null;
  parent: string | null;
  blocked_by: string[];
  topic: string | null;
  branch: string | null;
  created: string;
  updated: string;
  /** Closing time supplied by a hub close or the offline backfill; absent for unresolved legacy closes. */
  closed?: string;
  /** Where the item was imported from (`cland task import-github`); absent on items made here. */
  github?: GithubRef;
};

/** The GitHub issue an item was imported from: kept through every write, otherwise ignored by the hub. */
export type GithubRef = { repo: string; number: number; url: string };

export type Verdict = { verdict: VerdictKind; result: VerdictResult; by: string; run: string; commit?: string; stage?: string; stage_hash?: string };

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
const VERDICT_LINE = /^(verdict|result|by|run|commit|stage|stage_hash):\s*(.*?)\s*$/;
/** Stable numeric lookup key; display ids are supplied by the index, from the kind. */
export function normalizeId(raw: string, kinds?: readonly string[]): string | null {
  const ref = parseItemReference(raw, kinds);
  return ref ? `T-${ref.n}` : null;
}

export const idNumber = (id: string): number => Number(/(?:^|-)(\d+)$/.exec(id)?.[1] ?? NaN);

/** The item number a recognized file name carries. Configured kinds supply their prefixes. */
export function fileNumber(name: string, kinds?: readonly string[]): number | null {
  const match = /^([a-z]-\d+)(?:-[^/]*)?\.md$/i.exec(name);
  return match ? parseItemReference(match[1]!, kinds)?.n ?? null : null;
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

/** Configured ladder; maps sit outside it and hold wayfinder questions/tasks. */
export function parentingRefusal(child: Kind, parent: Kind, levels: LadderInput = DEFAULT_LEVELS): string | null {
  const ladder = ladderOf(levels);
  const level = ladder.levelOf(child);
  const allowed = level >= 0 ? level > 0 && ladder.levels[level - 1]!.includes(parent)
    : child === 'map' ? false
    : ladder.containers.includes(parent) || parent === 'map' && (child === 'question' || child === 'task');
  return allowed ? null : `parenting rule: ${kindWithArticle(child)} cannot be under ${kindWithArticle(parent)}; containers take the preceding level (${ladder.levels.map(level => level.join(' / ')).join(' › ') || 'none'}), leaves take any container, and map takes question or task`;
}

/** The top-level container starts with a Notes section, preserving text the author already prepared. */
export function withReleaseNotes(body: string): string {
  const text = body.replace(/\r\n/g, '\n').trim();
  return /^## Notes[ \t]*$/m.test(text) ? text : [text, '## Notes'].filter(Boolean).join('\n\n');
}

// SemVer 2.0: core and numeric prerelease identifiers have no leading zero; build identifiers may.
const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/;
export const isSemverVersion = (version: unknown): version is string => typeof version === 'string' && SEMVER.test(version) && !/\s/.test(version);
export function versionRefusal(kind: Kind, version: unknown, levels: LadderInput = DEFAULT_LEVELS): string | null {
  if (kind !== ladderOf(levels).top) return `version belongs only to ${kindWithArticle(ladderOf(levels).top ?? 'top-level container')} item`;
  return isSemverVersion(version) ? null : 'version must be semver without the v (for example 0.1.0)';
}

/** Tasks and containers below the configured top level are ranked among siblings. */
export const rankable = (kind: Kind, levels: LadderInput): boolean => kind === 'task' || ladderOf(levels).levelOf(kind) > 0;

export function statusRefusal(kind: Kind, status: unknown): string | null {
  if (kind !== 'task') return 'status belongs only to a task';
  return STATUSES.includes(status as Status) ? null : `status must be one of ${STATUSES.join(', ')}`;
}

// ------------------------------------------------------------------ reading

export class ItemParseError extends Error {}
export class UnknownKindError extends ItemParseError {}

const str = (v: unknown): string | null => (v === null || v === undefined || v === '' ? null : String(v));
const list = (v: unknown): string[] => (v === null || v === undefined ? [] : Array.isArray(v) ? v.map(String).filter(Boolean) : [String(v)]);
const referenceId = (raw: string, kinds?: readonly string[]): string | null => {
  const parsed = parseItemReference(raw, kinds);
  return parsed ? `${parsed.prefix ?? 'T'}-${parsed.n}` : null;
};
const ref = (v: unknown, kinds?: readonly string[]): string | null => {
  const s = str(v);
  return s === null ? null : (referenceId(s, kinds) ?? s);
};

/**
 * Parse an item file. A hand-edited file is read leniently: a missing field takes its default, a single
 * label is a list of one, `12` is `T-12`. Only a file with no frontmatter, unparsable YAML, an unknown
 * kind, state or status, status on a non-task, an invalid release version, or no id at all (neither in the frontmatter nor in `fileName`) is refused.
 */
export function parseItem(text: string, fileName?: string, levels: LadderInput = DEFAULT_LEVELS): Item {
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
  const kinds = [...kindsFor(levels), 'category'];
  const kind = (str(r.kind) ?? 'task') as Kind;
  const acceptedKinds = kindsFor(levels);
  if (!acceptedKinds.includes(kind)) throw new UnknownKindError(`unknown kind "${kind}" (one of ${acceptedKinds.join(', ')})`);
  const fromName = fileName !== undefined ? fileNumber(fileName, kinds) : null;
  const id = ref(r.id, kinds) ?? (fromName !== null ? `T-${fromName}` : null);
  if (id === null || normalizeId(id, kinds) === null) throw new ItemParseError(`no item id (frontmatter id: ${JSON.stringify(r.id ?? null)})`);
  const state = (str(r.state) ?? 'open') as State;
  if (!STATES.includes(state)) throw new ItemParseError(`unknown state "${state}" (open or closed)`);
  const fm: Frontmatter = {
    id,
    kind,
    title: str(r.title) ?? '',
    state,
    labels: list(r.labels),
    assignee: str(r.assignee),
    parent: ref(r.parent, kinds),
    blocked_by: list(r.blocked_by).map((b) => referenceId(b, kinds) ?? b),
    topic: str(r.topic),
    branch: str(r.branch),
    created: str(r.created) ?? '',
    updated: str(r.updated) ?? '',
  };
  if (r.closed !== undefined) {
    if (typeof r.closed !== 'string' || !validTimestamp(r.closed)) throw new ItemParseError('closed must be an ISO timestamp');
    fm.closed = r.closed;
  }
  if (r.version !== undefined && r.version !== null) {
    const refusal = versionRefusal(kind, r.version, levels);
    if (refusal) throw new ItemParseError(refusal);
    fm.version = r.version as string;
  }
  if (r.status !== undefined && r.status !== null) {
    const refusal = statusRefusal(kind, r.status);
    if (refusal) throw new ItemParseError(refusal);
    fm.status = r.status as Status;
  }
  if (r.rank !== undefined && r.rank !== null) {
    if (!rankable(kind, levels)) throw new ItemParseError('rank belongs only to tasks and containers below the top level');
    if (!Number.isSafeInteger(r.rank)) throw new ItemParseError('rank must be a safe integer');
    fm.rank = r.rank as number;
  }
  if (r.criterion_seq !== undefined) {
    if (!Number.isSafeInteger(r.criterion_seq) || Number(r.criterion_seq) < 0) throw new ItemParseError('criterion_seq must be a nonnegative safe integer');
    fm.criterion_seq = r.criterion_seq as number;
  }
  const approval = r.plan_approval as Record<string, unknown> | undefined;
  if (approval !== undefined) {
    if (!approval || typeof approval !== 'object' || typeof approval.hash !== 'string' || typeof approval.by !== 'string' || typeof approval.at !== 'string') throw new ItemParseError('invalid plan_approval record');
    fm.plan_approval = { hash: approval.hash, by: approval.by, at: approval.at };
  }
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
export function verdictOfText(text: string): { verdict: VerdictKind; result: VerdictResult; run: string; commit?: string; stage?: string; text: string } | null {
  const c = commentOf('', '', text.trim());
  return c.verdict ? { verdict: c.verdict.verdict, result: c.verdict.result, run: c.verdict.run, ...(c.verdict.commit ? { commit: c.verdict.commit } : {}), ...(c.verdict.stage ? { stage: c.verdict.stage } : {}), text: c.text } : null;
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
      verdict: { verdict: verdict as VerdictKind, result: result as VerdictResult, by: header.by ?? author, run: header.run ?? '', ...(header.commit ? { commit: header.commit } : {}), ...(header.stage ? { stage: header.stage } : {}), ...(header.stage_hash ? { stage_hash: header.stage_hash } : {}) },
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
    ...(fm.version !== undefined ? { version: fm.version } : {}),
    title: fm.title,
    state: fm.state,
    ...(fm.status !== undefined ? { status: fm.status } : {}),
    ...(fm.rank !== undefined ? { rank: fm.rank } : {}),
    ...(fm.criterion_seq !== undefined ? { criterion_seq: fm.criterion_seq } : {}),
    ...(fm.plan_approval ? { plan_approval: fm.plan_approval } : {}),
    labels: fm.labels,
    assignee: fm.assignee,
    parent: fm.parent,
    blocked_by: fm.blocked_by,
    topic: fm.topic,
    branch: fm.branch,
    created: fm.created,
    updated: fm.updated,
    ...(fm.closed !== undefined ? { closed: fm.closed } : {}),
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
  if (c.verdict?.commit) text += `commit: ${c.verdict.commit}\n`;
  if (c.verdict?.stage) text += `stage: ${c.verdict.stage}\n`;
  if (c.verdict?.stage_hash) text += `stage_hash: ${c.verdict.stage_hash}\n`;
  if (c.text.trim()) text += `${c.verdict ? '\n' : ''}${c.text.trim()}\n`;
  return `### ${c.author} · ${c.at}\n\n${text}`;
}
