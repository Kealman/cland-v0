// `cland task import-github [--repo owner/name] [--all]`: a one-shot, idempotent import of a repository's
// GitHub Issues into the tracker (spec 6, tracker bootstrap). This side reads GitHub through the `gh` CLI
// (the user's own login; no token is ever stored) and hands the issues to the hub in `task.import` frames;
// the hub numbers, links and writes the items.
import { execFile } from 'node:child_process';
import { parseArgs } from 'node:util';
import { layout, pidAlive, projectRoot, readDiscovery } from '../project.ts';
import type { ImportedIssue, ImportOutcome, IssueRef } from '../tracker/import-github.ts';
import { askHubFrame } from './socket-client.ts';

export const IMPORT_USAGE = `  task import-github [--repo owner/name] [--all]
                  GitHub Issues → items, through \`gh\`; open issues (--all: closed too); re-runs update in place
`;

type Io = { out: (s: string) => void; err: (s: string) => void };

/** Runs `gh <args>` and resolves its stdout. */
export type GhRunner = (args: string[], cwd: string) => Promise<string>;

const ghRunner: GhRunner = (args, cwd) =>
  new Promise((resolve, reject) => {
    execFile('gh', args, { cwd, maxBuffer: 256 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) {
        const code = (err as NodeJS.ErrnoException).code;
        reject(new Error(code === 'ENOENT' ? 'the GitHub CLI `gh` is not installed or not on PATH' : `gh ${args.join(' ')} failed: ${String(stderr).trim() || err.message}`));
      } else resolve(String(stdout));
    });
  });

const gitRunner = (args: string[], cwd: string): Promise<string> =>
  new Promise((resolve, reject) => {
    execFile('git', args, { cwd }, (err, stdout) => (err ? reject(err) : resolve(String(stdout))));
  });

/** `owner/name` from a GitHub remote URL (https, ssh or scp-like), or null. */
export function repoOfRemote(url: string): string | null {
  const m = /github\.com[:/]+([^/\s]+)\/([^/\s]+?)(?:\.git)?\/?$/.exec(url.trim());
  return m ? `${m[1]}/${m[2]}` : null;
}

type GhIssue = {
  number: number;
  html_url: string;
  title: string;
  body: string | null;
  state: string;
  labels: Array<{ name: string } | string>;
  assignees?: Array<{ login: string }>;
  assignee?: { login: string } | null;
  pull_request?: unknown;
  parent_issue_url?: string | null;
  issue_dependencies_summary?: { total_blocked_by?: number };
  comments: number;
  created_at: string;
};
type GhComment = { id: number; user: { login: string } | null; created_at: string; body: string | null };

/** `repos/o/r/issues/12` (an API URL) → the reference; null when it is not one. */
function refOfApiUrl(url: string | null | undefined): IssueRef | null {
  const m = url ? /repos\/([^/]+\/[^/]+)\/issues\/(\d+)$/.exec(url) : null;
  return m ? { repo: m[1] as string, number: Number(m[2]) } : null;
}

/** Every page of a list endpoint, flattened (`gh api --paginate --slurp` prints an array of pages). */
async function ghList<T>(gh: GhRunner, cwd: string, path: string): Promise<T[]> {
  // a read is safe to repeat: a transient network failure (a TLS handshake timeout) gets two more tries
  let out = '';
  for (let attempt = 1; ; attempt++) {
    try {
      out = await gh(['api', '--paginate', '--slurp', path], cwd);
      break;
    } catch (err) {
      if (attempt >= 3 || /not installed/.test(String(err))) throw err;
      await new Promise((r) => setTimeout(r, 500 * attempt));
    }
  }
  const pages = JSON.parse(out) as unknown;
  if (!Array.isArray(pages)) throw new Error(`gh api ${path}: expected a list`);
  return pages.flatMap((p) => (Array.isArray(p) ? (p as T[]) : [p as T]));
}

/** Run `fn` over `xs`, `n` at a time, keeping the order. */
async function pool<T, R>(xs: T[], n: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(xs.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, xs.length) }, async () => {
      while (next < xs.length) {
        const i = next++;
        out[i] = await fn(xs[i] as T);
      }
    }),
  );
  return out;
}

/** The repository's issues (pull requests left out), oldest first, with their comments and blockers. */
export async function fetchIssues(gh: GhRunner, cwd: string, repo: string, all: boolean): Promise<{ issues: ImportedIssue[]; pulls: number }> {
  const listed = await ghList<GhIssue>(gh, cwd, `repos/${repo}/issues?state=${all ? 'all' : 'open'}&per_page=100`);
  const raw = listed.filter((i) => i.pull_request === undefined || i.pull_request === null).sort((a, b) => a.number - b.number);
  const issues = await pool(raw, 6, async (i): Promise<ImportedIssue> => {
    const comments = i.comments > 0 ? await ghList<GhComment>(gh, cwd, `repos/${repo}/issues/${i.number}/comments?per_page=100`) : [];
    const blockers = (i.issue_dependencies_summary?.total_blocked_by ?? 0) > 0 ? await ghList<GhIssue & { url?: string }>(gh, cwd, `repos/${repo}/issues/${i.number}/dependencies/blocked_by?per_page=100`) : [];
    return {
      number: i.number,
      url: i.html_url,
      title: i.title,
      body: i.body ?? '',
      labels: i.labels.map((l) => (typeof l === 'string' ? l : l.name)),
      state: i.state === 'closed' ? 'closed' : 'open',
      assignee: i.assignees?.[0]?.login ?? i.assignee?.login ?? null,
      parent: refOfApiUrl(i.parent_issue_url),
      blocked_by: blockers.map((b) => refOfApiUrl(b.url) ?? { repo, number: b.number }),
      comments: comments.map((c) => ({ id: c.id, author: c.user?.login ?? 'ghost', at: c.created_at, body: c.body ?? '' })),
      created: i.created_at,
    };
  });
  return { issues, pulls: listed.length - raw.length };
}

/** Batches of issues whose frames stay well under the hub's 1 MiB frame limit. */
function batches(issues: ImportedIssue[], maxBytes = 768 * 1024): ImportedIssue[][] {
  const out: ImportedIssue[][] = [];
  let cur: ImportedIssue[] = [];
  let size = 0;
  for (const i of issues) {
    const n = Buffer.byteLength(JSON.stringify(i));
    if (n > maxBytes) throw new Error(`issue #${i.number} is too large to import (${n} bytes)`);
    if (cur.length && size + n > maxBytes) {
      out.push(cur);
      cur = [];
      size = 0;
    }
    cur.push(i);
    size += n;
  }
  if (cur.length) out.push(cur);
  return out;
}

type Summary = { repo: string; all: boolean; pulls_skipped: number; created: number; updated: number; unchanged: number; comments_added: number; items: Array<ImportOutcome & { title: string }> };

/** `cland task import-github …`; the process exit code. */
export async function runImportGithub(args: string[], cwd: string, io: Io, env: NodeJS.ProcessEnv, gh: GhRunner = ghRunner): Promise<number> {
  let values: { repo?: string; all?: boolean; json?: boolean; as?: string; role?: string };
  try {
    values = parseArgs({ args, options: { repo: { type: 'string' }, all: { type: 'boolean' }, json: { type: 'boolean' }, as: { type: 'string' }, role: { type: 'string' } }, allowPositionals: false, strict: true }).values;
  } catch (err) {
    io.err(`cland: ${err instanceof Error ? err.message : String(err)}\n\nusage:\n${IMPORT_USAGE}`);
    return 2;
  }
  const root = projectRoot(cwd);
  const d = readDiscovery(layout(root).discovery);
  if (!d || !pidAlive(d.pid)) {
    io.err(`cland: no hub running for ${root} — start it with \`cland hub start\`\n`);
    return 1;
  }
  let repo = values.repo?.trim();
  if (!repo) {
    const url = await gitRunner(['remote', 'get-url', 'origin'], root).catch(() => '');
    repo = repoOfRemote(url) ?? undefined;
    if (!repo) {
      io.err(`cland: no GitHub repository in \`git remote get-url origin\` of ${root}; pass --repo owner/name\n`);
      return 1;
    }
  }
  if (!/^[^/\s]+\/[^/\s]+$/.test(repo)) {
    io.err(`cland: --repo must be owner/name, not "${repo}"\n`);
    return 2;
  }
  const name = (values.as ?? env.CLAND_SESSION_NAME)?.trim();
  const role = (values.role ?? env.CLAND_ROLE)?.trim();
  const as = name ? { name, ...(role ? { role } : {}) } : undefined;

  let fetched: { issues: ImportedIssue[]; pulls: number };
  try {
    fetched = await fetchIssues(gh, root, repo, values.all === true);
  } catch (err) {
    io.err(`cland: reading ${repo} from GitHub: ${err instanceof Error ? err.message : String(err)}\n`);
    return 1;
  }

  const outcomes = new Map<number, ImportOutcome>();
  const send = async (issues: ImportedIssue[]): Promise<ImportOutcome[]> => {
    const value = (await askHubFrame(d, { type: 'task.import', repo, issues, ...(as ? { as } : {}) }, 60_000)) as { results: ImportOutcome[] };
    return value.results;
  };
  const rank = { unchanged: 0, updated: 1, created: 2 } as const;
  const record = (r: ImportOutcome): void => {
    const prev = outcomes.get(r.number);
    outcomes.set(r.number, prev ? { ...r, outcome: rank[prev.outcome] >= rank[r.outcome] ? prev.outcome : r.outcome, comments_added: prev.comments_added + r.comments_added } : r);
  };
  try {
    const chunks = batches(fetched.issues);
    for (const chunk of chunks) for (const r of await send(chunk)) record(r);
    // an edge into a later batch could not be resolved when its batch went: send those issues once more
    if (chunks.length > 1) {
      const numbers = new Set(fetched.issues.map((i) => i.number));
      const again = fetched.issues.filter((i) => outcomes.get(i.number)?.unresolved.some((u) => u.repo.toLowerCase() === repo.toLowerCase() && numbers.has(u.number)));
      for (const chunk of batches(again)) for (const r of await send(chunk)) record(r);
    }
  } catch (err) {
    io.err(`cland: ${err instanceof Error ? err.message : String(err)}\n`);
    return 1;
  }

  const titles = new Map(fetched.issues.map((i) => [i.number, i.title]));
  const items = fetched.issues.map((i) => ({ ...(outcomes.get(i.number) as ImportOutcome), title: titles.get(i.number) ?? '' }));
  const count = (o: ImportOutcome['outcome']): number => items.filter((i) => i.outcome === o).length;
  const summary: Summary = {
    repo,
    all: values.all === true,
    pulls_skipped: fetched.pulls,
    created: count('created'),
    updated: count('updated'),
    unchanged: count('unchanged'),
    comments_added: items.reduce((n, i) => n + i.comments_added, 0),
    items,
  };
  if (values.json) {
    io.out(`${JSON.stringify(summary)}\n`);
    return 0;
  }
  const lines = [
    `imported ${repo} (${summary.all ? 'all issues' : 'open issues'}): ${items.length} issue${items.length === 1 ? '' : 's'}, ${summary.pulls_skipped} pull request${summary.pulls_skipped === 1 ? '' : 's'} skipped`,
    `created ${summary.created}, updated ${summary.updated}, unchanged ${summary.unchanged}, comments added ${summary.comments_added}`,
    ...items.map((i) => {
      const loose = i.unresolved.length ? `  (not imported: ${i.unresolved.map((u) => `${u.repo === repo ? '' : u.repo}#${u.number}`).join(', ')})` : '';
      return `  ${i.id.padEnd(6)} #${String(i.number).padEnd(5)} ${i.outcome.padEnd(9)} ${i.title}${loose}`;
    }),
  ];
  io.out(`${lines.join('\n')}\n`);
  return 0;
}
