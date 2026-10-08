// The hub's side of `cland task import-github` (spec 6, tracker bootstrap): a batch of GitHub issues, already
// fetched by the CLI, becomes items. An issue is found again by the `github` reference its item carries, so a
// re-run updates in place; an item whose text would not change is not written at all.
import { COMMENTS_HEADING, type Comment, type Item, type Kind } from './item.ts';
import { TrackerError, type Actor, type Tracker } from './tracker.ts';

export type IssueRef = { repo: string; number: number };
export type ImportedComment = { id: number; author: string; at: string; body: string };
export type ImportedIssue = {
  number: number;
  url: string;
  title: string;
  body: string;
  labels: string[];
  state: 'open' | 'closed';
  assignee: string | null;
  parent: IssueRef | null;
  blocked_by: IssueRef[];
  comments: ImportedComment[];
  created: string;
};

export type ImportRequest = { type: 'task.import'; id: string; repo: string; issues: ImportedIssue[] };

export type ImportOutcome = {
  number: number;
  id: string;
  outcome: 'created' | 'updated' | 'unchanged';
  comments_added: number;
  /** Edges to issues that have no item here, kept as `github:#<n>` (or `github:<owner>/<repo>#<n>`). */
  unresolved: IssueRef[];
};

/** `epic` → epic, `wayfinder:map` → map, `wayfinder:task` → task, any other `wayfinder:*` → question, else task (the kinds the own-tracker template gives them). */
export function kindOfLabels(labels: string[]): Kind {
  if (labels.includes('epic')) return 'epic';
  if (labels.includes('wayfinder:map')) return 'map';
  if (labels.some((l) => l.startsWith('wayfinder:') && l !== 'wayfinder:task')) return 'question';
  return 'task';
}

const MARKER = /^<!-- github-comment: (\d+) -->$/;
export const commentMarker = (id: number): string => `<!-- github-comment: ${id} -->`;

/** The GitHub comment id an imported comment carries on its first line, or null. */
export function githubCommentId(c: Comment): number | null {
  const m = MARKER.exec(c.text.split('\n')[0]?.trim() ?? '');
  return m ? Number(m[1]) : null;
}

/**
 * GitHub text as an item can hold it: CRLF made LF, and a line the file format would read as structure (the
 * comments heading, a comment header) escaped with a backslash, which Markdown renders the same.
 */
export function escapeText(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    .trim() // before escaping: trimming afterwards could uncover a header that was hidden behind leading whitespace
    .split('\n')
    .map((line) => (line.trim() === COMMENTS_HEADING || /^### .+ · \S+\s*$/.test(line) ? `\\${line}` : line))
    .join('\n');
}

const key = (r: IssueRef): string => `${r.repo.toLowerCase()}#${r.number}`;
const refText = (r: IssueRef, repo: string): string => (r.repo.toLowerCase() === repo.toLowerCase() ? `github:#${r.number}` : `github:${r.repo}#${r.number}`);

/** The item an issue makes, on top of the item it already has (whose topic, branch and own comments stay). */
export function mergeIssue(
  existing: Item | null,
  issue: ImportedIssue,
  ctx: { id: string; repo: string; resolve: (r: IssueRef) => string | null },
): { item: Item; commentsAdded: number; unresolved: IssueRef[] } {
  const unresolved: IssueRef[] = [];
  const ref = (r: IssueRef): string => {
    const id = ctx.resolve(r);
    if (id) return id;
    unresolved.push(r);
    return refText(r, ctx.repo);
  };
  const comments = [...(existing?.comments ?? [])];
  const have = new Set(comments.map(githubCommentId).filter((n) => n !== null));
  let commentsAdded = 0;
  for (const c of issue.comments) {
    if (have.has(c.id)) continue;
    const body = escapeText(c.body);
    comments.push({ author: c.author, at: c.at, text: body ? `${commentMarker(c.id)}\n\n${body}` : commentMarker(c.id) });
    commentsAdded++;
  }
  const labels = [...new Set(issue.labels)];
  const item: Item = {
    fm: {
      id: ctx.id,
      kind: kindOfLabels(labels),
      title: issue.title.trim(),
      state: issue.state,
      labels,
      assignee: issue.assignee,
      parent: issue.parent ? ref(issue.parent) : null,
      blocked_by: [...new Set(issue.blocked_by.map(ref))],
      topic: existing?.fm.topic ?? null,
      branch: existing?.fm.branch ?? null,
      created: existing?.fm.created || issue.created,
      updated: existing?.fm.updated ?? '',
      github: { repo: ctx.repo, number: issue.number, url: issue.url },
    },
    body: escapeText(issue.body),
    comments,
  };
  return { item, commentsAdded, unresolved };
}

const isStr = (v: unknown): v is string => typeof v === 'string';
const isRef = (v: unknown): v is IssueRef => typeof v === 'object' && v !== null && isStr((v as IssueRef).repo) && Number.isInteger((v as IssueRef).number);

function checkIssue(i: unknown): asserts i is ImportedIssue {
  const x = i as Record<string, unknown>;
  const ok =
    typeof x === 'object' &&
    x !== null &&
    Number.isInteger(x.number) &&
    isStr(x.url) &&
    isStr(x.title) &&
    x.title.trim() !== '' &&
    isStr(x.body) &&
    Array.isArray(x.labels) &&
    x.labels.every(isStr) &&
    (x.state === 'open' || x.state === 'closed') &&
    (x.assignee === null || isStr(x.assignee)) &&
    (x.parent === null || isRef(x.parent)) &&
    Array.isArray(x.blocked_by) &&
    x.blocked_by.every(isRef) &&
    Array.isArray(x.comments) &&
    x.comments.every((c: Record<string, unknown>) => Number.isInteger(c?.id) && isStr(c.author) && isStr(c.at) && isStr(c.body)) &&
    isStr(x.created);
  if (!ok) throw new TrackerError(`task.import: issue ${JSON.stringify(x?.number ?? null)} is malformed`);
}

/** Import one batch: number the new issues first, then build and write every item with its edges resolved. */
export function importIssues(tracker: Tracker, actor: Actor, req: ImportRequest): { repo: string; results: ImportOutcome[] } {
  if (!isStr(req.repo) || !/^[^/\s]+\/[^/\s]+$/.test(req.repo)) throw new TrackerError('task.import: `repo` must be <owner>/<name>');
  if (!Array.isArray(req.issues)) throw new TrackerError('task.import: `issues` must be a list');
  for (const i of req.issues) checkIssue(i);

  const byKey = new Map<string, { id: string; file: string; text: string; item: Item }>();
  for (const f of tracker.files()) {
    const g = f.item.fm.github;
    if (g && !byKey.has(key(g))) byKey.set(key(g), { id: f.item.fm.id, ...f });
  }
  const ids = new Map<string, string>();
  for (const [k, v] of byKey) ids.set(k, v.id);
  for (const issue of req.issues) {
    const k = key({ repo: req.repo, number: issue.number });
    if (!ids.has(k)) ids.set(k, tracker.reserveId());
  }
  const resolve = (r: IssueRef): string | null => ids.get(key(r)) ?? null;

  const results: ImportOutcome[] = [];
  for (const issue of req.issues) {
    const k = key({ repo: req.repo, number: issue.number });
    const existing = byKey.get(k) ?? null;
    const id = ids.get(k) as string;
    const { item, commentsAdded, unresolved } = mergeIssue(existing?.item ?? null, issue, { id, repo: req.repo, resolve });
    const outcome = tracker.writeItem(actor, 'import', item, existing);
    results.push({ number: issue.number, id, outcome, comments_added: commentsAdded, unresolved });
  }
  return { repo: req.repo, results };
}
