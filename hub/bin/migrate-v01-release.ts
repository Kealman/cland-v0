#!/usr/bin/env node
// T-118's one-off repository migration. Run from the main project root after merging and restarting the hub.
// Every read/write uses cland task; reruns reuse one open 0.1.0 release and skip already-parented epics.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const exec = promisify(execFile);
const cli = fileURLToPath(new URL('./cland.ts', import.meta.url));
type Item = { id: string; kind: string; title: string; version?: string; state: string; labels: string[]; parent: string | null };
const epicIds = Array.from({ length: 11 }, (_, n) => `T-${107 + n}`);
const body = `## Goal

v0.1 makes cland scale past one Coordinator over a flat crew and makes the workbench show less at once: a release above epics, explicit item status and order, a session hierarchy with crew configuration and event subscriptions, an epic plan, visibility levels, a session for the human, and the panel, palette, thread and graph work the v0 run asked for.

## Notes

Everything in docs/spec/v0.1.md section 3 is in v0.1; nothing is deferred. The release covers eleven epics: release and status; a quiet Coordinator; workbench basics; threads that read; the human's own session; criteria that live; leads and the crew; the epic plan; visibility and artifacts; the task graph; and release from the item.

Two lanes run in parallel: the hub lane 1 → 2 → 6 → 7 → 8 → 11 and the Neovim lane 3 → 4 → 5 → 10 → 9. Epic 5 also waits for 2; epic 11 waits for every other. The blocking edges stay on the epics.

The build uses what it has shipped: the release item first, item leads after epic 2, an Aide after epic 5, crew.toml after epic 7, and the epic plan for epics 8 to 11 after epic 8. The v0 tail is not a prerequisite and stays unscheduled.

Done means the human has run each epic's demo on v0.1; v0.1.0 ships with cland release --item, using this item's notes and its epics; and the run retrospective is an artifact.`;

async function task<T>(...args: string[]): Promise<T> {
  try {
    const { stdout } = await exec(process.execPath, [cli, 'task', ...args, '--json'], { timeout: 30_000 });
    return JSON.parse(stdout) as T;
  } catch (error) {
    const stderr = (error as { stderr?: string }).stderr;
    throw new Error(stderr?.trim() || String(error));
  }
}

async function migrate(): Promise<void> {
  const { items } = await task<{ items: Item[] }>('list');
  const matches = items.filter(item => item.kind === 'release' && item.state === 'open' && item.version === '0.1.0');
  if (matches.length > 1) throw new Error(`multiple open releases with version 0.1.0: ${matches.map(item => `${item.id} (${item.title})`).join(', ')}; resolve the duplicates before migrating`);
  const epics = epicIds.map(id => {
    const item = items.find(item => item.id === id);
    if (!item || item.kind !== 'epic' || !item.labels.includes('v0.1')) throw new Error(`${id} must be an epic labelled v0.1; nothing was changed`);
    return item;
  });
  let release = matches[0];
  if (release) console.log(`reuse ${release.id}: ${release.title}`);
  else {
    release = (await task<{ item: Item }>('create', 'Release: v0.1', '--kind', 'release', '--version', '0.1.0', '--label', 'v0.1', '--body', body)).item;
    console.log(`created ${release.id}: ${release.title}`);
  }
  for (const epic of epics) {
    if (epic.parent === release.id) continue;
    await task('link', epic.id, '--parent', release.id);
    console.log(`${epic.id} → ${release.id}`);
  }
  const subtree = await task<{ items: Item[] }>('list', '--under', release.id, '--kind', 'epic');
  if (JSON.stringify(subtree.items.map(item => item.id)) !== JSON.stringify(epicIds)) throw new Error(`${release.id}: expected exactly T-107 through T-117; inspect the subtree before committing`);
  console.log(`${release.id}: verified eleven v0.1 epics; no v0 item was changed`);
}

await migrate().catch(error => {
  process.stderr.write(`migration refused: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
