// Public CLI/socket tests use tiny package fixtures, never the live project's full-suite queue.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, stat, rm, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { cland, clandWithEnv, connectUi, eventually, startDaemon, spawnSpoke, tempProject, pidAlive, fakeCodex } from './harness.ts';
import { fixture, type ResultMessage } from './suite-fixture.ts';
import { suiteSummary } from '../src/hub/suites.ts';
import { DatabaseSync } from 'node:sqlite';
import { ownProcess } from './process-cleanup.ts';
import type { Artifact } from '../src/protocol.ts';
import type { VerificationQueue, HubStatus } from '../src/protocol.ts';
import type { ItemSummary, ItemView } from '../src/tracker/tracker.ts';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileBarrierCommand } from './file-barrier.ts';
import { fileURLToPath } from 'node:url';
import { defaultConfig, parseConfig, renderConfig } from '../src/init/config.ts';
import { cacheRepository, humanRunnerFixture } from './suite-support.ts';


test('suite CLI exits before its worker, posts one artifact-backed result as caller, and rejects duplicate active runs', async t => {
  // Artificial work: leave the package running while the caller exits and duplicate admission is refused.
  const f = await fixture(t, 'node -e "setTimeout(()=>{console.log(\'ℹ tests 2\\nℹ pass 2\\nℹ fail 0\')},1200)"');
  const job = await f.launch();
  assert.equal(job.position, 1);
  assert.equal((await f.results()).length, 0, 'caller exited while package command is still running');
  const duplicate = await clandWithEnv(f.root, f.env, 'suite', '--report', f.topic, '--to', 'rev');
  assert.notEqual(duplicate.code, 0);
  assert.match(duplicate.stderr, /already has a suite/);
  const result = await eventually('suite completion', async () => (await f.results())[0]);
  assert.equal(result.id, `suite:${job.id}`);
  assert.equal(result.from, 'impl'); assert.equal(result.fromRole, 'implementer');
  assert.deepEqual(result.to.sort(), ['impl', 'rev']);
  assert.match(result.text, /all exit 0/); assert.match(result.text, /tests 2; pass 2; fail 0/);
  assert.match(result.text, /Executor local · \S+ \S+ · Node v[\d.]+ · Neovim none/);
  const artifact = result.artifacts[0]!;
  assert.equal(artifact.creator, 'impl');
  assert.match(await readFile(artifact.path, 'utf8'), /\$ npm run typecheck/);
  assert.match(await readFile(artifact.path, 'utf8'), /\$ npm test/);
  assert.equal((await f.results()).length, 1);
});

test('suite worker SIGKILL produces one crash result with its log', async t => {
  // Artificial hold: this test kills or cancels the worker before the 30-second failure ceiling.
  const f = await fixture(t, 'node -e "setTimeout(()=>{},30000)"');
  const job = await f.launch();
  const pid = await f.workerPid(job.id);
  await eventually('package test started', async () => {
    const log = await readFile(join(f.root, '.cland', 'run', 'suites', job.id, 'suite.log'), 'utf8');
    return log.includes('$ npm test') ? true : undefined;
  });
  process.kill(pid, 'SIGKILL');
  const result = await eventually('crash report', async () => (await f.results())[0]);
  assert.match(result.text, /worker killed by SIGKILL/);
  assert.equal(result.artifacts.length, 1);
  assert.equal((await f.results()).length, 1);
});

test('typecheck failure stops before tests and reports the failure', async t => {
  const f = await fixture(t, 'node -e "console.log(\'should not run\')"', 'node -e "console.error(\'typecheck failed\');process.exit(7)"');
  await f.launch();
  const result = await eventually('failure report', async () => (await f.results())[0]);
  assert.match(result.text, /all exit 7/);
  const log = await readFile(result.artifacts[0]!.path, 'utf8');
  assert.match(log, /typecheck failed/); assert.doesNotMatch(log, /\$ npm test/);
});

test('submission requires caller artifact and send permissions before spawning', async t => {
  const f = await fixture(t, 'node -e "process.exit(0)"');
  const refused = await clandWithEnv(f.root, f.env, 'suite', '--report', 'general', '--to', 'rev');
  assert.notEqual(refused.code, 0); assert.match(refused.stderr, /own item topic/);
  const human = await clandWithEnv(f.root, f.env, 'suite', '--report', f.topic);
  assert.notEqual(human.code, 0); assert.match(human.stderr, /forbidden.*send/);
  assert.equal((await f.results()).length, 0);
});

test('hub restart recovers a worker that outlives it, without replaying the result', async t => {
  // Artificial work: the worker must outlive the hub stop/restart to prove recovery without replay.
  const f = await fixture(t, 'node -e "setTimeout(()=>{console.log(\'ℹ tests 1\\nℹ pass 1\')},1800)"', undefined, undefined, undefined, undefined, undefined, startDaemon);
  const job = await f.launch();
  assert.equal((await cland(f.root, 'hub', 'stop')).code, 0);
  const { discovery } = await startDaemon(t, f.root);
  const ui = await connectUi(t, discovery);
  const history = async () => {
    const r = await ui.request({ type: 'topic.history', topic: f.topic });
    return (r.value as { messages: ResultMessage[] }).messages.filter(m => m.id === `suite:${job.id}`);
  };
  const results = await eventually('restart result', async () => { const r = await history(); return r.length ? r : undefined; });
  assert.equal(results.length, 1); assert.match(results[0]!.text, /all exit 0/);
  assert.match(results[0]!.text, /Executor local · \S+ \S+ · Node v[\d.]+ · Neovim none/);
  const recoveredStatus = (await ui.request({ type: 'hub.status' })).value as HubStatus;
  assert.equal(recoveredStatus.suites!.find(run => run.id === job.id)!.executor, 'local');
  assert.equal(recoveredStatus.suites!.find(run => run.id === job.id)!.platform?.nvim, 'none');
  assert.equal((await cland(f.root, 'hub', 'stop')).code, 0);
  const next = await startDaemon(t, f.root);
  const nextUi = await connectUi(t, next.discovery);
  const r = await nextUi.request({ type: 'topic.history', topic: f.topic });
  assert.equal((r.value as { messages: ResultMessage[] }).messages.filter(m => m.id === `suite:${job.id}`).length, 1);
});

test('revoked report permissions hold the result until restored, without a duplicate', async t => {
  const f = await fixture(t, fileBarrierCommand);
  await f.launch();
  assert.equal((await f.ui.request({ type: 'role.clear', session: 'impl' })).ok, true);
  await writeFile(join(f.root, 'finish'), 'ready');
  await eventually('report held by permissions', async () => {
    const status = await f.ui.request({ type: 'hub.status' });
    const jobs = (status.value as { suites: Array<{ error: string | null }> }).suites;
    return jobs.some(job => job.error?.includes('forbidden')) ? true : undefined;
  });
  assert.equal((await f.results()).length, 0);
  assert.equal((await f.ui.request({ type: 'role.set', session: 'impl', role: 'implementer' })).ok, true);
  await eventually('report after restoring permissions', async () => (await f.results())[0]);
  assert.equal((await f.results()).length, 1);
});

test('a muted named recipient keeps the single result pending across restart until all recipients can receive it', async t => {
  const f = await fixture(t, fileBarrierCommand, undefined, '[hygiene]\nloop_breaker_max = 2\n', undefined, undefined, undefined, startDaemon);
  for (let n = 0; n < 3; n++) await f.spoke.call('send', { to: ['rev'], topic: f.topic, text: `seed ${n}` });
  const job = await f.launch();
  await writeFile(join(f.root, 'finish'), 'ready');
  await eventually('recipient refusal retained', async () => {
    const status = await f.ui.request({ type: 'hub.status' });
    const record = (status.value as { suites: Array<{ reported: boolean; error: string | null }> }).suites[0]!;
    return !record.reported && record.error?.includes('loop breaker') ? true : undefined;
  });
  assert.equal((await f.results()).length, 0, 'no partial topic post or caller delivery');
  assert.equal((await cland(f.root, 'hub', 'stop')).code, 0);
  const next = await startDaemon(t, f.root);
  const ui = await connectUi(t, next.discovery);
  assert.equal((await ui.request({ type: 'hygiene.unmute', a: 'impl', b: 'rev' })).ok, true);
  const result = await eventually('complete recipient delivery after restart', async () => {
    const r = await ui.request({ type: 'topic.history', topic: f.topic });
    return (r.value as { messages: ResultMessage[] }).messages.find(m => m.id === `suite:${job.id}`);
  });
  assert.deepEqual(result.to.sort(), ['impl', 'rev']);
  const history = await ui.request({ type: 'topic.history', topic: f.topic });
  assert.equal((history.value as { messages: ResultMessage[] }).messages.filter(m => m.id === `suite:${job.id}`).length, 1);
  const artifacts = await ui.request({ type: 'artifact.list', topic: f.topic });
  assert.equal((artifacts.value as { artifacts: unknown[] }).artifacts.length, 1);
});

test('a muted suite report follows its moved log after unmute and publishes once', async t => {
  const f = await fixture(t, 'node -e "console.log(\'ℹ tests 1\\nℹ pass 1\\nℹ fail 0\')"', undefined, '[hygiene]\nloop_breaker_max = 2\n');
  for (let n = 0; n < 3; n++) await f.spoke.call('send', { to: ['rev'], topic: f.topic, text: `seed ${n}` });
  const job = await f.launch();
  await eventually('suite report paused after log registration', async () => {
    const status = await f.ui.request({ type: 'hub.status' });
    const record = (status.value as { suites: Array<{ reported: boolean; error: string | null }> }).suites[0]!;
    return !record.reported && record.error?.includes('loop breaker') ? true : undefined;
  });
  assert.equal((await f.results()).length, 0);
  const listed = await f.ui.request({ type: 'artifact.list', topic: f.topic });
  assert.equal(listed.ok, true, listed.error);
  const logs = (listed.value as { artifacts: Artifact[] }).artifacts;
  assert.equal(logs.length, 1, 'the pending report has registered one log');
  const log = logs[0]!;
  const original = await readFile(log.path, 'utf8');
  const created = await f.ui.request({ type: 'artifact.create', kind: 'file', title: 'Suite logs', topic: f.topic, folder: true });
  assert.equal(created.ok, true, created.error);
  const folder = (created.value as { artifact: Artifact }).artifact;
  const moved = await f.ui.request({ type: 'artifact.move', artifact: log.id, folder: folder.id, name: 'suite.log' });
  assert.equal(moved.ok, true, moved.error);
  const path = join(folder.path, 'suite.log');
  assert.equal(await readFile(path, 'utf8'), original);
  await assert.rejects(stat(log.path), { code: 'ENOENT' });
  assert.equal((await f.ui.request({ type: 'hygiene.unmute', a: 'impl', b: 'rev' })).ok, true);
  const result = await eventually('suite publication with moved log', async () => (await f.results())[0]);
  assert.equal(result.id, `suite:${job.id}`);
  assert.deepEqual(result.to.sort(), ['impl', 'rev']);
  assert.match(result.text, /all exit 0/);
  assert.match(result.text, /tests 1; pass 1; fail 0/);
  assert.ok(result.text.includes(`Log ${log.id}: ${path}`));
  assert.equal(result.artifacts.length, 1);
  assert.equal(result.artifacts[0]!.id, log.id);
  assert.equal(result.artifacts[0]!.path, path);
  assert.equal(await readFile(result.artifacts[0]!.path, 'utf8'), original);
  await eventually('suite report receipt settled', async () => {
    const status = await f.ui.request({ type: 'hub.status' });
    return (status.value as { suites: Array<{ reported: boolean }> }).suites.every(record => record.reported) ? true : undefined;
  });
  assert.equal((await f.results()).length, 1);
  const artifacts = await f.ui.request({ type: 'artifact.list', topic: f.topic });
  assert.equal((artifacts.value as { artifacts: Artifact[] }).artifacts.length, 1, 'only the destination folder is listed; no replacement log was created');
});

test('failure cleanup preserves a live worker whose recorded start identity is unavailable', async t => {
  const f = await fixture(t, fileBarrierCommand, undefined, undefined, undefined, undefined, undefined, startDaemon);
  const job = await f.launch();
  assert.equal((await cland(f.root, 'hub', 'stop')).code, 0);
  const db = new DatabaseSync(join(f.root, '.cland', 'hub.db'));
  try {
    const value = db.prepare("select value from meta where key = 'suite-jobs'").get() as { value: string };
    const records = JSON.parse(value.value) as Array<{ started: string | null; outcome: { code: number; cause: string } | null }>;
    records[0]!.started = null;
    records[0]!.outcome = { code: 1, cause: 'fixture admission failed without a readable identity' };
    db.prepare("update meta set value = ? where key = 'suite-jobs'").run(JSON.stringify(records));
  } finally { db.close(); }
  const next = await startDaemon(t, f.root);
  const ui = await connectUi(t, next.discovery);
  assert.equal((await ui.request({ type: 'subscribe' })).ok, true);
  const restored = new DatabaseSync(join(f.root, '.cland', 'hub.db'), { readOnly: true });
  try {
    const cleanupError = () => {
      const value = restored.prepare("select value from meta where key = 'suite-jobs'").get() as { value: string };
      return (JSON.parse(value.value) as Array<{ id: string; error: string | null }>).find(record => record.id === job.id)?.error;
    };
    // Subscribe before reading: cleanup may finish before connection, between the
    // read and the wait, or later. Buffered task events cover the latter two cases.
    if (!cleanupError()?.includes('process preserved')) {
      await ui.waitFor(frame => frame.type === 'task' && (frame.item as ItemSummary | null)?.verify?.id === job.id
        && (frame.item as ItemSummary).verify?.state === 'finished', 15000);
    }
    assert.match(cleanupError() ?? '', /suite cleanup waiting for a verified worker identity; process preserved/);
  } finally { restored.close(); }
  assert.equal(pidAlive(job.pid!), true);
  const initial = await ui.request({ type: 'topic.history', topic: f.topic });
  assert.equal((initial.value as { messages: ResultMessage[] }).messages.filter(m => m.id === `suite:${job.id}`).length, 0);
  await writeFile(join(f.root, 'finish'), 'ready');
  await eventually('worker naturally completed', () => !pidAlive(job.pid!) ? true : undefined);
});

test('restart recognizes a committed result even if its run receipt did not settle', async t => {
  const f = await fixture(t, 'node -e "process.exit(0)"', undefined, undefined, undefined, undefined, undefined, startDaemon);
  const job = await f.launch();
  await eventually('initial result', async () => (await f.results())[0]);
  assert.equal((await cland(f.root, 'hub', 'stop')).code, 0);
  // Storage boundary: reconstruct the checkpoint immediately before the report's receipt update.
  const db = new DatabaseSync(join(f.root, '.cland', 'hub.db'));
  try {
    const value = db.prepare("select value from meta where key = 'suite-jobs'").get() as { value: string };
    const jobs = JSON.parse(value.value) as Array<{ reported: boolean; artifact: string | null }>;
    for (const record of jobs) { record.reported = false; record.artifact = null; }
    db.prepare("update meta set value = ? where key = 'suite-jobs'").run(JSON.stringify(jobs));
  } finally { db.close(); }
  const next = await startDaemon(t, f.root);
  const ui = await connectUi(t, next.discovery);
  await eventually('receipt reconciled', async () => {
    const status = await ui.request({ type: 'hub.status' });
    return (status.value as { suites: Array<{ reported: boolean }> }).suites.every(job => job.reported) ? true : undefined;
  });
  const history = await ui.request({ type: 'topic.history', topic: f.topic });
  assert.equal((history.value as { messages: ResultMessage[] }).messages.filter(m => m.id === `suite:${job.id}`).length, 1);
  const artifacts = await ui.request({ type: 'artifact.list', topic: f.topic });
  assert.equal((artifacts.value as { artifacts: unknown[] }).artifacts.length, 1);
});

test('suite summary adds both phases and bounds failure excerpts', () => {
  assert.equal(suiteSummary('ℹ tests 2\nℹ pass 1\nℹ fail 1\n✖ broken\n# tests 3\n# pass 3\n# fail 0\n'), 'tests 5; pass 4; fail 1\nFailures:\n✖ broken');
});
