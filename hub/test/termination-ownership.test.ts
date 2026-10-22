// T3: process lifecycle: concurrent session stop and doctor terminate one harness tree;
// competing doctors reap one deleted hub process and its descendants exactly once.
import { completeJournalLines } from './journal-lines.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase } from '../src/database.ts';
import { readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { clandWithEnv, sleep, connectUi, eventually, fakeCodex, pidAlive, startDaemon, tempProject } from './harness.ts';
import { ownProcess } from './process-cleanup.ts';

test('session stop and doctor share one termination owner and report the tree once', async t => {
  const root = await tempProject(t);
  const fake = await fakeCodex(t, { env: { FAKE_CODEX_TERM_DELAY_MS: '10000', CLAND_STOP_GRACE_MS: '2000' } });
  const daemon = await startDaemon(t, root, fake.env, { sweep: true });
  const ui = await connectUi(t, daemon.discovery);
  const launched = await ui.request({ type: 'session.launch', name: 'impl', harness: 'codex' }, 30_000);
  assert.equal(launched.ok, true, launched.error);
  const { pid } = (launched.value as { process: { pid: number } }).process;
  // An exited row can still own a live server; both stop and doctor must settle it.
  const db = openDatabase(join(root, '.cland/hub.db'));
  try { db.prepare("update harness_processes set status = 'exited' where name = 'impl'").run(); }
  finally { db.close(); }
  const stopping = ui.request({ type: 'session.stop', session: 'impl' }, 15_000);
  const log = join(fake.home, 'log', `${pid}.log`);
  await eventually('stop has sent TERM while the server remains alive', async () =>
    (await readFile(log, 'utf8')).includes('SIGTERM') || undefined);
  const fixed = await clandWithEnv(root, fake.env, 'doctor', '--fix', '--json');
  const stopped = await stopping;
  assert.equal(stopped.ok, true, stopped.error);
  assert.equal(pidAlive(pid), false);
  assert.equal((await readFile(log, 'utf8')).match(/SIGTERM/g)?.length, 1, 'only the owner signals the harness');
  assert.equal((await ui.request({ type: 'hub.status', flushLogs: true })).ok, true);
  const events = completeJournalLines(await readFile(join(root, '.cland/journal.jsonl'), 'utf8')).map(line => JSON.parse(line));
  assert.equal(events.filter(e => e.pid === pid && ['harness-ended', 'orphan-ended'].includes(e.event)).length, 1, 'one completion result');
  await sleep(100);
  assert.equal((await ui.request({ type: 'hub.status', flushLogs: true })).ok, true);
  const settled = completeJournalLines(await readFile(join(root, '.cland/journal.jsonl'), 'utf8')).map(line => JSON.parse(line));
  assert.equal(settled.filter(e => e.pid === pid && ['harness-ended', 'orphan-ended'].includes(e.event)).length, 1, 'still one completion after settling');
  assert.ok(events.find(e => e.pid === pid && e.event === 'harness-ended').pids.every((child: number) => !pidAlive(child)), 'no captured descendant survives');
  assert.doesNotMatch(fixed.stdout, new RegExp(`ended pid ${pid}:`), 'the doctor observes settlement without reporting another kill');
});

test('doctors from different projects end one deleted hub and its fake harness tree once', async t => {
  const scope = await tempProject(t, 'cland-doctor-owners-');
  const a = await tempProject(t, 'a-', scope), b = await tempProject(t, 'b-', scope);
  const removed = await tempProject(t, 'removed-', scope);
  const home = await tempProject(t, 'fake-opencode-');
  const fake = { env: {
    CLAND_OPENCODE_BIN: fileURLToPath(new URL('./fakes/opencode/opencode', import.meta.url)),
    FAKE_OPENCODE_HOME: home, FAKE_OPENCODE_IGNORE_TERM: '1', FAKE_OPENCODE_CHILD: '1',
    FAKE_OPENCODE_TURN_MS: '30', CLAND_ADAPTER_POLL_MS: '50',
  } };
  const signals = join(scope, 'hub-signals');
  const preload = join(scope, 'slow-shutdown.mjs');
  // Delay only the native hub's signal handler, keeping real discovery, protocol,
  // process identity and tree termination. Both doctors can discover the same hub.
  await writeFile(preload, `import { appendFileSync } from 'node:fs';
const on = process.on;
process.on = function(signal, handler) {
  if (signal === 'SIGTERM') return on.call(this, signal, (...args) => {
    appendFileSync(${JSON.stringify(signals)}, 'TERM\\n');
    setTimeout(() => handler(...args), 10000);
  });
  return on.call(this, signal, handler);
};
process.on('SIGCONT', () => appendFileSync(${JSON.stringify(signals)}, 'CONT\\n'));
`);
  const cli = fileURLToPath(new URL('../bin/cland.ts', import.meta.url));
  const child = spawn(process.execPath, ['--import', preload, cli, 'hub', 'serve'], {
    cwd: removed, env: { ...process.env, ...fake.env }, stdio: 'ignore',
  });
  ownProcess(t, child.pid);
  const discovery = await eventually('foreground hub listening', async () =>
    JSON.parse(await readFile(join(removed, '.cland/hub.json'), 'utf8')));
  const ui = await connectUi(t, discovery);
  const launch = await ui.request({ type: 'session.launch', name: 'impl', harness: 'opencode' }, 30_000);
  assert.equal(launch.ok, true, launch.error);
  const { pid } = (launch.value as { process: { pid: number } }).process;
  const { childPid } = JSON.parse(await readFile(join(home, 'servers', `${pid}.json`), 'utf8')) as { childPid: number };
  ownProcess(t, childPid);
  await rm(removed, { recursive: true, maxRetries: 10, retryDelay: 50 });
  const env = { ...fake.env, CLAND_TEST_ORPHAN_ROOT: scope };
  const first = clandWithEnv(a, env, 'doctor', '--fix', '--json');
  const second = clandWithEnv(b, { ...env, TMPDIR: b }, 'doctor', '--fix', '--json');
  await eventually('first doctor owns termination', async () =>
    (await readFile(signals, 'utf8')).includes('TERM') || undefined);
  const reports = await Promise.all([first, second]);
  assert.equal(pidAlive(child.pid!), false);
  assert.equal(pidAlive(pid), false, 'the fake harness cannot be left orphaned by its hub');
  assert.equal(pidAlive(childPid), false, 'its TERM-resistant descendant must also be ended');
  assert.equal(await readFile(signals, 'utf8'), 'TERM\n', 'no competing TERM or thaw');
  assert.equal(reports.reduce((count, report) => count + (report.stdout.match(new RegExp(`ended pid ${child.pid}:`, 'g'))?.length ?? 0), 0), 1, 'only the terminating doctor reports completion');
});
