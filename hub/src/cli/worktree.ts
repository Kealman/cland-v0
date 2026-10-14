// `cland worktree list|prune`: the task worktrees through the project's hub (T-58). `prune` is the human's: the hub
// refuses it from a session's shell before anything is shown.
import { createInterface } from 'node:readline/promises';
import { relative } from 'node:path';
import { hubDiscovery, readDiscovery } from '../project.ts';
import { askHubFrame } from './socket-client.ts';
import type { WorktreeEntry } from '../hub/worktrees.ts';

import { WORKTREE_USAGE } from './usage.ts';
export { WORKTREE_USAGE } from './usage.ts';

type Removed = { item: string; path: string; branch: string | null };

export async function runWorktree(args: string[], cwd: string = process.cwd(), input: NodeJS.ReadableStream = process.stdin): Promise<number> {
  const [sub, ...rest] = args;
  const json = rest.includes('--json');
  const d = readDiscovery(hubDiscovery(cwd));
  if (!d) {
    process.stderr.write('cland: no hub runs for this project — run `cland hub start`\n');
    return 1;
  }
  const root = (d as { root?: string }).root ?? cwd;
  const shown = (path: string): string => relative(root, path) || '.';
  const describe = (w: WorktreeEntry): string => {
    const ahead = w.ahead.length ? `${w.ahead.length} commit${w.ahead.length === 1 ? '' : 's'} not on ${w.base ?? 'its base'}` : `nothing beyond ${w.base ?? 'its base'}`;
    return `${w.item}  ${w.state ?? 'not in the tracker'}  ${w.branch ?? '(detached)'}  ${shown(w.path)}\n    ${w.title ?? '-'}\n    ${ahead}; sessions inside: ${w.sessions.length ? w.sessions.join(', ') : '-'}`;
  };
  switch (sub) {
    case 'list': {
      const v = (await askHubFrame(d, { type: 'worktree.list' })) as { worktrees: WorktreeEntry[] };
      process.stdout.write(json ? `${JSON.stringify(v)}\n` : `${v.worktrees.length ? v.worktrees.map(describe).join('\n') : 'no task worktrees'}\n`);
      return 0;
    }
    case 'prune': {
      const yes = rest.includes('--yes');
      const { candidates } = (await askHubFrame(d, { type: 'worktree.prune', dryRun: true })) as { candidates: WorktreeEntry[] };
      if (!candidates.length) {
        process.stdout.write(json ? `${JSON.stringify({ removed: [], failed: [], kept: [] })}\n` : 'no worktrees of closed items\n');
        return 0;
      }
      const chosen: string[] = [];
      const kept: string[] = [];
      // with --json, only the answer's JSON goes to stdout; the questions go to stderr
      const say = (s: string) => (json ? process.stderr : process.stdout).write(s);
      const rl = yes ? null : createInterface({ input, terminal: false });
      const lines = rl?.[Symbol.asyncIterator]();
      for (const w of candidates) {
        const commits = w.ahead.length ? `${w.ahead.map((c) => `      ${c}`).join('\n')}\n` : '';
        say(`${describe(w)}\n${w.ahead.length ? `    unmerged commits (not on ${w.base ?? 'its base'}):\n${commits}` : ''}`);
        if (w.sessions.length) {
          say('    kept: a session stands inside\n');
          kept.push(w.item);
          continue;
        }
        let answer = 'y';
        if (lines) {
          say(`remove ${shown(w.path)} and ${w.branch ?? 'no branch'}? [y/N] `);
          const next = await lines.next();
          answer = next.done ? '' : String(next.value).trim().toLowerCase();
          say('\n');
        }
        if (answer === 'y' || answer === 'yes') chosen.push(w.item);
        else kept.push(w.item);
      }
      rl?.close();
      const v = chosen.length ? ((await askHubFrame(d, { type: 'worktree.prune', items: chosen }, 60_000)) as { removed: Removed[]; failed: Array<{ item: string; error: string }> }) : { removed: [], failed: [] };
      if (json) process.stdout.write(`${JSON.stringify({ ...v, kept })}\n`);
      else {
        for (const r of v.removed) process.stdout.write(`removed ${r.item}: ${shown(r.path)}${r.branch ? ` and ${r.branch}` : ''}\n`);
        for (const f of v.failed) process.stdout.write(`not removed ${f.item}: ${f.error}\n`);
        if (kept.length) process.stdout.write(`kept ${kept.join(', ')}\n`);
      }
      return v.failed.length ? 1 : 0;
    }
    default:
      process.stderr.write(`cland: unknown worktree command "${sub ?? ''}"\n\nusage: cland worktree <command>\n\n${WORKTREE_USAGE}`);
      return 2;
  }
}
