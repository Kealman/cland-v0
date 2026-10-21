// Diagnostic only: copy durable tracker/history and Git objects, never source workers or credentials.
import test from 'node:test';
import { DatabaseSync, backup } from 'node:sqlite';
import { cp, mkdir, writeFile, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { projectHub, tempProject, connectUi } from '../test/harness.ts';
import { fixtureEnvironment } from '../../test-support/fixture-environment.ts';
import { gitIn } from '../src/tracker/verdict-git.ts';
import { FakeClock } from '../test/fake-clock.ts';

const sourceArg = process.argv[2];
if (!sourceArg || process.argv.length > 4 || process.argv[3] !== undefined && process.argv[3] !== '--recompute') throw new Error('usage: node hub/scripts/measure-freshness.ts /absolute/project [--recompute]');
const source = resolve(sourceArg);
test('measure copied stage-cover restoration', async t => {
  const root = await tempProject(t, 'cland-freshness-copy-');
  const dest = join(root, '.cland');
  await mkdir(dest, { recursive: true });
  for (const name of ['tasks', 'RULES.md', 'roles.toml', 'crew.toml', 'journal.jsonl']) await cp(join(source, '.cland', name), join(dest, name), { recursive: true });
  // Copy objects and refs only: source hooks, remotes and configuration are never used.
  const alternates = await readFile(join(source, '.git/objects/info/alternates'), 'utf8').catch(error => {
    if (error.code === 'ENOENT') return '';
    throw error;
  });
  if (alternates.trim()) throw new Error('Source uses Git alternates; copy its objects into a self-contained repository first');
  await mkdir(join(root, '.git'), { recursive: true });
  for (const name of ['objects', 'refs', 'packed-refs']) await cp(join(source, '.git', name), join(root, '.git', name), { recursive: true });
  await writeFile(join(root, '.git/HEAD'), 'ref: refs/heads/dev\n');
  await writeFile(join(root, '.git/config'), '[core]\nrepositoryformatversion = 0\nbare = false\n');
  const original = new DatabaseSync(join(source, '.cland/hub.db'), { readOnly: true });
  try { await backup(original, join(dest, 'hub.db')); } finally { original.close(); }
  const db = new DatabaseSync(join(dest, 'hub.db'));
  const history = db.prepare("select key, value from meta where key glob 'suite-job:*'").all();
  db.prepare("delete from meta where key not glob 'suite-job:*'").run();
  for (const row of history) {
    const record = JSON.parse(String(row.value).split(source).join(root));
    if (record.job.state !== 'finished' || !record.job.reported) db.prepare('delete from meta where key = ?').run(String(row.key));
    else db.prepare('update meta set value = ? where key = ?').run(JSON.stringify(record), String(row.key));
  }
  db.exec('delete from harness_pending_stops');
  // Recreate T-1049's restart before the derived closure checkpoint was saved.
  if (process.argv.includes('--recompute')) db.exec("delete from tracker_meta where key like 'stage-closure:%'");
  db.prepare('update harness_processes set cwd = replace(cwd, ?, ?), pid = null, account_env = null').run(source, root);
  db.close();
  await writeFile(join(dest, 'config.toml'), '[verification]\nexecutor = "local"\n');
  const env = fixtureEnvironment(root, process.env);
  const native = gitIn(root, env);
  const calls: Record<string, number> = {};
  const scans: string[][] = [];
  const started = performance.now();
  const hub = await projectHub(t, root, env, {
    clock: new FakeClock(Date.now()), readBase: async () => 'dev',
    git: (args, input, signal) => {
      calls[args[0]!] = (calls[args[0]!] ?? 0) + 1;
      if (args[0] === 'log' || args[0] === 'rev-list') scans.push(args);
      return native(args, input, signal);
    },
  });
  const ui = await connectUi(t, hub.discovery);
  let receipt;
  const progress = setInterval(() => console.log(JSON.stringify({ elapsedMs: performance.now() - started, calls, receipt })), 30_000);
  try {
    const deadline = started + 20 * 60_000;
    do {
      const response = await ui.request({ type: 'task.plan', item: 'E-412', op: 'show' }, 60_000);
      if (!response.ok) throw new Error(response.error);
      const stage = (response.value as { stages: Array<{ name: string; cover?: { linux?: string; macos?: string; missing: string[]; pending?: string[] } }> }).stages[2]!;
      receipt = stage;
      if (stage.cover?.linux && stage.cover.macos && !stage.cover.missing.length && !stage.cover.pending?.length) {
        console.log(JSON.stringify({ completeMs: performance.now() - started, platform: `${process.platform}/${process.arch}`, recompute: process.argv.includes('--recompute'), calls, scans, receipt }));
        return;
      }
      await new Promise(resolve => setTimeout(resolve, 25));
    } while (performance.now() < deadline);
    throw new Error('stage cover not complete within 20 minutes');
  } finally {
    clearInterval(progress); ui.close(); await hub.stop(); await hub.stopped;
  }
});
