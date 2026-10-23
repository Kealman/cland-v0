// Copy durable startup inputs; never connect to the source hub or recover its workers.
// node hub/scripts/measure-startup.ts /absolute/project/.cland
import test from 'node:test';
import { DatabaseSync, backup } from 'node:sqlite';
import { cp, mkdir, writeFile, readFile } from 'node:fs/promises';
import { join, dirname, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { projectHub, tempProject, frameClient, startDaemon, connectUi, clandWithEnv, killDaemon } from '../test/harness.ts';
import { fixtureEnvironment } from '../../test-support/fixture-environment.ts';
import { FakeClock } from '../test/fake-clock.ts';

if (process.argv.length < 3 || process.argv.length > 4 || process.argv[3] !== undefined && process.argv[3] !== '--cli') throw new Error('usage: node hub/scripts/measure-startup.ts /absolute/project/.cland [--cli]');
const source = resolve(process.argv[2]!);
test('measure copied durable startup state', async t => {
  const root = await tempProject(t, 'cland-startup-copy-');
  const dest = join(root, '.cland');
  await mkdir(dest, { recursive: true });
  for (const name of ['tasks', 'RULES.md', 'roles.toml', 'crew.toml', 'journal.jsonl']) {
    await cp(join(source, name), join(dest, name), { recursive: true });
  }
  // A consistent SQLite backup includes WAL data without modifying the source database.
  const original = new DatabaseSync(join(source, 'hub.db'), { readOnly: true });
  try { await backup(original, join(dest, 'hub.db')); } finally { original.close(); }
  const db = new DatabaseSync(join(dest, 'hub.db'));
  // Rebase all stored paths, and retain only reported terminal suite history. No live
  // PIDs, leases, pending reports, queue or automatic schedules may be recovered.
  const history = db.prepare("select key, value from meta where key glob 'suite-job:*'").all();
  db.prepare("delete from meta where key not glob 'suite-job:*'").run();
  for (const row of history) {
    const record = JSON.parse(String(row.value).split(dirname(source)).join(root));
    if (record.job.state !== 'finished' || !record.job.reported) db.prepare('delete from meta where key = ?').run(String(row.key));
    else db.prepare('update meta set value = ? where key = ?').run(JSON.stringify(record), String(row.key));
  }
  // Artifact listing uses metadata; file bytes are not read by any startup request.
  for (const row of db.prepare('select number, value from artifacts').all()) {
    db.prepare('update artifacts set value = ? where number = ?').run(String(row.value).split(dirname(source)).join(root), row.number);
  }
  db.exec('delete from harness_pending_stops');
  db.prepare('update harness_processes set cwd = replace(cwd, ?, ?), pid = null, account_env = null').run(dirname(source), root);
  db.close();
  await writeFile(join(dest, 'config.toml'), '[verification]\nexecutor = "local"\n');
  const env = fixtureEnvironment(root, process.env);
  const setup = performance.now();
  if (process.argv[3] === '--cli') {
    // A separate measurement of the actual CLI, native daemon and socket reply.
    // Worker/schedule credentials were removed above; all child environments are sealed.
    const { discovery } = await startDaemon(t, root, env);
    try {
      const ui = await connectUi(t, discovery);
      try {
        const reply = await ui.request({ type: 'hub.status' }, 60_000);
        if (!reply.ok) throw new Error(JSON.stringify(reply));
        const firstStatusMs = performance.now() - setup;
        console.log(JSON.stringify({ platform: `${process.platform}/${process.arch}`, source, firstStatusMs,
          note: 'Actual cland hub start, native daemon, UI hello and first hub.status socket receipt; excludes copy/setup. Scratch accounts/config, no source hub or workers.' }));
        const entries = (await readFile(join(dest, 'log/hub.log'), 'utf8')).split('\n').flatMap(line => { try { return [JSON.parse(line)]; } catch { return []; } });
        for (const entry of entries) if (entry.event === 'hub-startup-step' || entry.event === 'hub-startup-step-completed' || entry.event === 'serving') console.log(JSON.stringify(entry));
        if (firstStatusMs >= 5000) throw new Error(`first hub.status took ${firstStatusMs.toFixed(3)} ms; budget 5000 ms`);
      } finally { ui.close(); }
    } finally {
      try { await clandWithEnv(root, env, 'hub', 'stop'); }
      finally { await killDaemon(discovery.pid); }
    }
    return;
  }
  let recomputes = 0, listeningAt: number | undefined, servingAt: number | undefined;
  const hub = await projectHub(t, root, env, { clock: new FakeClock(Date.now()), log: entry => {
    if (entry.event === 'explorer-recomputed') recomputes++;
    if (entry.event === 'listening') listeningAt ??= performance.now();
    if (entry.event === 'serving') servingAt = performance.now();
    if (entry.event === 'hub-startup-step' || entry.event === 'hub-startup-step-completed' || entry.event === 'serving') console.error(JSON.stringify({ ...entry, elapsedMs: +(performance.now() - setup).toFixed(3) }));
  } });
  const startupRecomputes = recomputes;
  try {
    const startupMs = performance.now() - setup;
    console.log('READY ' + startupMs.toFixed(3) + ' ms');
    console.log(JSON.stringify({ startupRecomputes, listeningToServingMs: listeningAt !== undefined && servingAt !== undefined ? +(servingAt - listeningAt).toFixed(3) : null }));
    let receive = (_line: string) => {};
    let open = true;
    const composed = new Map<string, number>();
    let started = 0;
    const conversation = hub.dispatcher.open({
      send: frame => {
        if (frame.type === 'result') composed.set(frame.id, performance.now() - started);
        receive(JSON.stringify(frame) + '\n');
      }, close: () => { open = false; }, isOpen: () => open,
    }, { authenticated: true, edge: 'socket' });
    const ui = frameClient(line => conversation.receive(line.trimEnd()), fn => { receive = fn; }, () => { open = false; conversation.closed(); }, root, () => {});
    ui.send({ type: 'hello', protocol: 2, client: 'ui' });
    await ui.waitFor(frame => frame.type === 'welcome');
    const frames = [
      { type: 'hub.status' }, { type: 'rule.list', all: true },
      { type: 'topic.history', topic: 'general', limit: 200 }, { type: 'artifact.list' },
      { type: 'task.list', state: 'open', projection: 'summary' },
      { type: 'events.list', limit: 200 }, { type: 'session.list' }, { type: 'account.list' },
    ];
    const rows = [];
    for (const request of frames) {
      const start = performance.now();
      started = start;
      let reply;
      try { reply = await ui.request(request, 60_000); } catch (error) {
        rows.push({ request: request.type, bytes: null, requestMs: +(performance.now() - start).toFixed(3), error: String(error) });
        console.error(request.type, String(error));
        continue;
      }
      const ms = performance.now() - start;
      if (!reply.ok) throw new Error(JSON.stringify(reply));
      const value = reply.value as Record<string, unknown>;
      console.error(request.type, ms.toFixed(3));
      rows.push({ request: request.type, bytes: Buffer.byteLength(JSON.stringify(reply) + '\n'), requestMs: +ms.toFixed(3), composeMs: composed.has((reply as unknown as { id: string }).id) ? +composed.get((reply as unknown as { id: string }).id)!.toFixed(3) : null, fields: Object.fromEntries(Object.entries(value).map(([k,v]) => [k, { bytes: Buffer.byteLength(JSON.stringify(v)), ...(Array.isArray(v) ? { count: v.length } : {}) }])) });
    }
    ui.close();
    console.log(JSON.stringify({ platform: `${process.platform}/${process.arch}`, source, startupMs: +startupMs.toFixed(3), note: 'Copied tasks/rules/roles/crew/journal and consistent DB backup; only reported terminal suite history retained. Scratch config, accounts and adapters. composeMs is dispatcher receive-to-result before JSON encoding (including awaited I/O); requestMs includes encoding and synchronous frame-client decoding. No socket transport; copy/setup/startup excluded. Accounts/config/adapters are isolated substitutes, not live measurements.', totalBytes: rows.reduce((n,r) => n+(r.bytes ?? 0),0), rows }, null, 2));
  } finally { await hub.stop(); await hub.stopped; console.log('SCRATCH HUB STOPPED'); }
});
