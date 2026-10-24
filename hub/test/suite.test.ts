// T3: detached suite workers outlive their CLI and survive hub restart.
// Public CLI/socket tests use tiny package fixtures, never the live project's full-suite queue.
import { fixtureEnvironment } from './fixture-environment.ts';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, stat, rm, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { cland, clandWithEnv, connectUi, eventually, startDaemon, spawnSpoke, tempProject, pidAlive, fakeCodex } from './harness.ts';
import { fixture, writeSuiteFixture, type ResultMessage } from './suite-fixture.ts';
import type { SuiteJob } from '../src/hub/suites.ts';
import { suiteSummary } from '../src/hub/suites.ts';
import { DatabaseSync } from 'node:sqlite';
import { onCleanup, ownProcess } from './process-cleanup.ts';
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
  // T3: the detached worker stays behind a file barrier while its CLI exits;
  // duplicate policy also has T2 coverage in verify-submission.test.ts.
  const f = await fixture(t, `${fileBarrierCommand} && node -e "console.log('ℹ tests 2\\nℹ pass 2\\nℹ fail 0')"`);
  const git = await cacheRepository(f);
  await writeFile(join(f.root, '.git/info/exclude'), 'finish\n');
  const submittedHead = await git('rev-parse', 'HEAD');
  const runner = await git('show', 'HEAD:hub/test/run-suite.ts');
  assert.match(runner, /inheritedLease/, 'worker keeps borrowing the lease');
  assert.doesNotMatch(runner, /reduceCoverage/, 'submission keeps coverage disabled');
  const config = parseConfig(await readFile(join(f.root, '.cland/config.toml'), 'utf8'), 'fixture');
  assert.equal(config.verification.check, 'npm run typecheck');
  assert.equal(config.verification.test, 'npm test');
  // Release on every exit path, before owned-process cleanup and directory removal.
  onCleanup(t, () => writeFile(join(f.root, 'finish'), 'ready'));
  const job = await f.launch();
  // The launch reply may have no PID. Observe and own the admitted worker before
  // any assertion can strand the barrier; ownProcess waits for its group to exit.
  await f.workerPid(job.id);
  assert.equal(job.position, 1);
  assert.equal((await f.results()).length, 0, 'caller exited while package command is still running');
  await eventually('held package test started', async () => {
    const log = await readFile(join(f.root, '.cland/run/suites', job.id, 'suite.log'), 'utf8');
    return log.includes('$ npm test') ? true : undefined;
  });
  const oneActiveRun = async () => {
    const queue = (await f.ui.request({ type: 'suite.queue' })).value as VerificationQueue;
    assert.equal(queue.holder?.id, job.id);
    assert.deepEqual(queue.waiters, [], 'no second verification run is queued');
    assert.deepEqual(queue.remote, []);
  };
  for (const row of [
    { mode: 'auto', changeHead: false, reused: true },
    { mode: 'hub', changeHead: false, reused: false },
    { mode: 'auto', changeHead: true, reused: false },
  ]) {
    if (row.changeHead) {
      await writeFile(join(f.root, 'next-head.txt'), 'different head');
      await git('add', 'next-head.txt'); await git('commit', '-m', 'advance head while original worker is active');
    }
    const duplicate = await clandWithEnv(f.root, f.env, 'suite', row.mode, '--report', f.topic, '--to', 'rev');
    if (row.reused) {
      assert.equal(duplicate.code, 0, duplicate.stderr);
      assert.equal(duplicate.stdout.trim(), `already queued/running: ${job.id}; no new run`);
    } else {
      assert.notEqual(duplicate.code, 0);
      assert.match(duplicate.stderr, /this session already has a suite queued or running/);
    }
    await oneActiveRun();
  }
  assert.equal((await f.results()).length, 0, 'concurrency assertions precede releasing the worker');
  // Restore this fixture's submitted candidate before the worker's final head/tree fence.
  await git('checkout', '--detach', submittedHead);
  await writeFile(join(f.root, 'finish'), 'ready');
  const completion = await eventually('worker completion receipt', async () => readFile(join(f.root, '.cland/run/suites', job.id, 'result.json'), 'utf8').then(text => JSON.parse(text), () => undefined));
  assert.equal(completion.code, 0);
  const result = await eventually('suite completion', async () => (await f.results())[0]);
  assert.equal(result.id, `suite:${job.id}`);
  assert.equal(result.from, 'impl'); assert.equal(result.fromRole, 'implementer');
  assert.deepEqual(result.to.sort(), ['impl', 'rev']);
  assert.match(result.text, /auto exit 0/); assert.match(result.text, /tests 2; pass 2; fail 0/);
  assert.match(result.text, /Executor local · \S+ \S+ · Node v[\d.]+ · Neovim none/);
  const artifact = result.artifacts[0]!;
  assert.equal(artifact.creator, 'impl');
  // T3: completion after the caller exits proves the detached worker ran one check.
  const log = await readFile(artifact.path, 'utf8');
  assert.equal(log.match(/\$ npm run typecheck/g)?.length, 1);
  assert.match(result.text, /typecheck: local/);
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
  assert.match(result.text, /auto exit 7/);
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
  assert.equal(results.length, 1); assert.match(results[0]!.text, /auto exit 0/);
  assert.match(results[0]!.text, /Executor local · \S+ \S+ · Node v[\d.]+ · Neovim none/);
  const recoveredStatus = (await ui.request({ type: 'hub.status', history: true })).value as HubStatus;
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
    const status = await f.ui.request({ type: 'hub.status', history: true });
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
    const status = await f.ui.request({ type: 'hub.status', history: true });
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
    const status = await f.ui.request({ type: 'hub.status', history: true });
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
  assert.match(result.text, /auto exit 0/);
  assert.match(result.text, /tests 1; pass 1; fail 0/);
  assert.ok(result.text.includes(`Log ${log.id}: ${path}`));
  assert.equal(result.artifacts.length, 1);
  assert.equal(result.artifacts[0]!.id, log.id);
  assert.equal(result.artifacts[0]!.path, path);
  assert.equal(await readFile(result.artifacts[0]!.path, 'utf8'), original);
  await eventually('suite report receipt settled', async () => {
    const status = await f.ui.request({ type: 'hub.status', history: true });
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
      const value = restored.prepare('select value from meta where key = ?').get(`suite-job:${job.id}`) as { value: string } | undefined;
      return value ? (JSON.parse(value.value) as { job: SuiteJob }).job.error : undefined;
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
    const key = `suite-job:${job.id}`;
    const value = db.prepare('select value from meta where key = ?').get(key) as { value: string } | undefined;
    assert.ok(value, 'completed report has a durable history row to rewind');
    const record = JSON.parse(value.value) as { position: number; job: SuiteJob };
    assert.equal(record.job.reported, true);
    record.job.reported = false; record.job.artifact = null;
    db.prepare('update meta set value = ? where key = ?').run(JSON.stringify(record), key);
  } finally { db.close(); }
  const next = await startDaemon(t, f.root);
  const ui = await connectUi(t, next.discovery);
  await eventually('receipt reconciled', async () => {
    const status = await ui.request({ type: 'hub.status', history: true });
    return (status.value as { suites: Array<{ id: string; reported: boolean }> }).suites.some(record => record.id === job.id && record.reported) ? true : undefined;
  });
  const history = await ui.request({ type: 'topic.history', topic: f.topic });
  assert.equal((history.value as { messages: ResultMessage[] }).messages.filter(m => m.id === `suite:${job.id}`).length, 1);
  const artifacts = await ui.request({ type: 'artifact.list', topic: f.topic });
  assert.equal((artifacts.value as { artifacts: unknown[] }).artifacts.length, 1);
});

test('suite summary adds both phases and bounds failure excerpts', () => {
  assert.equal(suiteSummary('ℹ tests 2\nℹ pass 1\nℹ fail 1\n✖ broken\n# tests 3\n# pass 3\n# fail 0\n'), 'tests 5; pass 4; fail 1\nFailures:\n✖ broken');
});

async function verificationLines(f: Awaited<ReturnType<typeof fixture>>, commands: { check: string; test: string; prepare?: string }) {
  const path = join(f.root, '.cland/config.toml');
  const config = parseConfig(await readFile(path, 'utf8'), 'commands');
  Object.assign(config.verification, { prepare: '', ...commands });
  await writeFile(path, renderConfig(config));
}

// T3: a detached worker executes another stack's shell test and publishes its durable receipt.
test('another stack verifies green locally then reports a planted shell failure', async t => {
  const f = await fixture(t, '', undefined, { stack: 'other', check: 'sh -n test.sh', test: 'sh test.sh', verification: '' });
  await writeFile(join(f.root, 'test.sh'), 'printf "shell assertion passed\\n"\n');
  // A directory named hub is not proof that this project uses cland's runner.
  // Invalid cland-only manifests must not enter generic project admission.
  await mkdir(join(f.root, 'hub/test'), { recursive: true });
  await writeFile(join(f.root, 'hub/test/tiers.json'), '{');
  await writeFile(join(f.root, 'hub/test/durations.json'), '{');
  const git = await cacheRepository(f);
  const green = await f.launch();
  const passed = await eventually('other-stack green result', async () => (await f.results()).find(m => m.id === `suite:${green.id}`));
  assert.match(passed.text, /exit 0/);
  assert.match(passed.text, /mode full; project test runs in full/);
  const repeated = await f.launch();
  assert.equal(repeated.cached?.run, green.id, 'the same clean project tree reuses its green');
  await eventually('other-stack cached result', async () => (await f.results()).find(m => m.id === `suite:${repeated.id}`));
  await writeFile(join(f.root, 'test.sh'), 'printf "$ echo preparing\\nplanted assertion failed: expected green\\n" >&2\nexit 1\n');
  await git('add', 'test.sh'); await git('commit', '-m', 'plant failing shell assertion');
  const red = await f.launch();
  assert.equal(red.cached, undefined);
  const failed = await eventually('other-stack red result', async () => (await f.results()).find(m => m.id === `suite:${red.id}`));
  assert.match(failed.text, /test exited 1: sh test.sh/);
  assert.match(failed.text, /Failures:\n\$ echo preparing\nplanted assertion failed: expected green/);
  assert.doesNotMatch(failed.text, /counts unavailable|load gate|coverage map/);
});

// T3: a detached worker executes shell commands and durably receipts their ordered exits.
test('legacy task verify executes its whole test with the merge queue off', async t => {
  const f = await fixture(t, 'exit 91', 'exit 92');
  const commands = { prepare: 'exit 93', check: 'printf check > executions', test: 'printf test >> executions' };
  const git = await cacheRepository(f);
  await git('branch', '-m', 't/T-717-legacy');
  assert.equal(parseConfig(await readFile(join(f.root, '.cland/config.toml'), 'utf8'), 'fixture').merge.queue, false);
  await verificationLines(f, commands);
  const job = await f.launch();
  const result = await eventually('configured commands reported', async () => (await f.results()).find(m => m.id === `suite:${job.id}`));
  assert.match(result.text, /exit 0/);
  assert.equal(await readFile(join(f.root, 'executions'), 'utf8'), 'checktest');
  const log = await readFile(join(f.root, '.cland/run/suites', job.id, 'suite.log'), 'utf8');
  assert.match(log, /Commands: check printf check > executions · test printf test >> executions/);
  assert.ok(log.indexOf('$ ' + commands.check) < log.indexOf('$ ' + commands.test));
  assert.doesNotMatch(log, /\$ (npm|exit 93)/);
});

test('verify inherits root commands in a task worktree without command keys', async t => {
  const f = await fixture(t, 'exit 91', 'exit 92');
  await verificationLines(f, { check: 'printf inherited-check', test: 'printf inherited-test' });
  const git = await cacheRepository(f);
  const cwd = await tempProject(t, 'command-worktree-');
  await git('worktree', 'add', '-b', 'task-commands', cwd);
  await mkdir(join(cwd, '.cland'), { recursive: true });
  await writeFile(join(cwd, '.cland/config.toml'), '[project]\nname="old task"\n');
  const launch = await clandWithEnv(cwd, { ...f.env, CLAND_HUB_FILE: join(f.root, '.cland/hub.json') }, 'verify', '--report', f.topic, '--to', 'rev', '--json');
  assert.equal(launch.code, 0, launch.stderr);
  const job = JSON.parse(launch.stdout) as { id: string };
  const result = await eventually('inherited commands reported', async () => (await f.results()).find(m => m.id === `suite:${job.id}`));
  assert.match(result.text, /exit 0/, result.text);
  const log = await readFile(join(f.root, '.cland/run/suites', job.id, 'suite.log'), 'utf8');
  assert.match(log, /Commands: check printf inherited-check · test printf inherited-test/);
  assert.match(log, /\$ printf inherited-check[\s\S]*\$ printf inherited-test/);
});

for (const check of ['', 'exit 7']) test(`verify ${check ? 'stops on the configured check exit' : 'runs test when check is unset'}`, async t => {
  const f = await fixture(t, 'exit 91', 'exit 92');
  await verificationLines(f, { check, test: 'printf ran > executions' });
  const job = await f.launch();
  const result = await eventually('optional check reported', async () => (await f.results()).find(m => m.id === `suite:${job.id}`));
  const log = await readFile(join(f.root, '.cland/run/suites', job.id, 'suite.log'), 'utf8');
  if (check) {
    assert.match(result.text, /exit 7/);
    assert.match(log, /\$ exit 7/);
    assert.doesNotMatch(log, /\$ printf ran/);
    await assert.rejects(stat(join(f.root, 'executions')), { code: 'ENOENT' });
  } else {
    assert.match(result.text, /exit 0/);
    assert.match(log, /check: not set/);
    assert.equal(await readFile(join(f.root, 'executions'), 'utf8'), 'ran');
  }
});

// T3: real workers write their durable receipts before the task and batch runs are reported.
test('Python command stubs execute the recorded task and batch plans', async t => {
  const { Store } = await import('../src/hub/store.ts');
  const { Suites } = await import('../src/hub/suites.ts');
  const root = await tempProject(t, 'tier-worker-');
  await writeSuiteFixture(root, '', undefined, { stack: 'other', check: './python3 -m compileall .', test: '',
    text: '[merge]\nqueue=true\n', verification: 'test_unit="./python3 -m pytest unit"\ntest_integration="./python3 -m pytest integration"\n' });
  await writeFile(join(root, 'python3'), `#!${process.execPath}
const fs = require('node:fs');
const phase = process.argv.includes('compileall') ? 'check' : process.argv.at(-1);
fs.appendFileSync('executions', phase + '\\n');
console.log('python ' + phase);
`, { mode: 0o700 });
  await writeFile(join(root, '.gitignore'), '.cland/\nexecutions\nworker.lock*\n');
  const git = (...args: string[]) => promisify(execFile)('git', args, { env: fixtureEnvironment(root, process.env), cwd: root });
  await git('init', '-b', 't/T-717');
  await git('-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', '-c', 'commit.gpgsign=false', 'add', '.');
  await git('-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', '-c', 'commit.gpgsign=false', 'commit', '-m', 'Python fixture');
  const config = parseConfig(await readFile(join(root, '.cland/config.toml'), 'utf8'), 'python');
  const store = new Store(join(root, '.cland/test.db'));
  const suites = new Suites(store, root, async () => {}, { projectConfig: () => config, locks: [join(root, 'worker.lock')] });
  onCleanup(t, async () => { await suites.close(); store.close(); });
  for (const kind of ['task', 'batch'] as const) {
    await writeFile(join(root, 'executions'), '');
    const submitted = await suites.start({ cwd: root, mode: kind === 'task' ? 'auto' : 'all', topic: 'python', to: [], actor: null, fresh: true,
      ...(kind === 'batch' ? { occasion: 'batch' } : {}) }, () => {});
    assert.ok('id' in submitted);
    const job = await eventually('worker admission', () => suites.status().find(job => job.id === submitted.id && job.pid));
    ownProcess(t, job.pid!);
    await eventually('durable worker result reported', () => suites.status().find(job => job.id === submitted.id && job.reported));
    const directory = join(root, '.cland/run/suites', submitted.id);
    const output = await readFile(join(directory, 'suite.log'), 'utf8');
    assert.equal(JSON.parse(await readFile(join(directory, 'result.json'), 'utf8')).code, 0, output);
    assert.equal(await readFile(join(root, 'executions'), 'utf8'), kind === 'task' ? 'check\nunit\n' : 'check\nunit\nintegration\n');
    assert.match(output, /tier T0: exit 0; duration \d+ s; output tail: python check/);
    assert.match(output, /tier T1: exit 0; duration \d+ s; output tail: python unit/);
    if (kind === 'task') assert.doesNotMatch(output, /python integration/);
    else assert.match(output, /tier T3: exit 0; duration \d+ s; output tail: python integration/);
  }
});

// T3: a real runner-absent candidate fetches origin/dev and its worker executes occasion tiers.
test('another stack integrated occasion fetches dev proof and executes configured tiers', async t => {
  const { Store } = await import('../src/hub/store.ts');
  const { Suites } = await import('../src/hub/suites.ts');
  const root = await tempProject(t, 'other-stack-occasion-');
  await writeSuiteFixture(root, '', undefined, { stack: 'other', check: 'printf check', test: '',
    verification: 'test_unit="printf unit"\ntest_component="printf component"\ntest_integration="printf integration"\ntest_soak="printf soak"\n' });
  await writeFile(join(root, '.gitignore'), '.cland/\nworker.lock*\n');
  const git = async (...args: string[]) => (await promisify(execFile)('git', args, { env: fixtureEnvironment(root, process.env), cwd: root })).stdout.trim();
  await git('init', '-b', 'dev');
  await git('remote', 'add', 'origin', root);
  await writeFile(join(root, 'project.txt'), 'another stack\n');
  await git('add', '.');
  await git('-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', '-c', 'commit.gpgsign=false', 'commit', '-m', 'other-stack occasion');
  await assert.rejects(stat(join(root, 'hub/test/run-suite.ts')), { code: 'ENOENT' });
  const config = parseConfig(await readFile(join(root, '.cland/config.toml'), 'utf8'), 'other-stack');
  const store = new Store(join(root, '.cland/test.db'));
  const suites = new Suites(store, root, async () => {}, { projectConfig: () => config, locks: [join(root, 'worker.lock')] });
  onCleanup(t, async () => { await suites.close(); store.close(); });
  const submitted = await suites.start({ cwd: root, mode: 'all', occasion: 'stage', integrated: true,
    topic: 'other-stack', to: [], actor: null, fresh: true }, () => {});
  assert.ok('id' in submitted);
  const job = await eventually('occasion worker admission', () => suites.status().find(job => job.id === submitted.id && job.pid));
  ownProcess(t, job.pid!);
  const directory = join(root, '.cland/run/suites', submitted.id);
  const receipt = await eventually('occasion worker completion receipt', async () => readFile(join(directory, 'result.json'), 'utf8').then(JSON.parse, () => undefined));
  assert.equal(receipt.code, 0);
  await eventually('occasion downstream report', () => suites.status().find(job => job.id === submitted.id && job.reported));
  assert.equal(job.selection?.fetchedDev, await git('rev-parse', 'HEAD'));
  assert.equal(job.selection?.loadGate, undefined);
  assert.equal(job.selection?.recordCoverage, undefined);
  const log = await readFile(join(directory, 'suite.log'), 'utf8');
  for (const [tier, output] of [['T1', 'unit'], ['T2', 'component'], ['T3', 'integration'], ['T4', 'soak']]) {
    assert.match(log, new RegExp(`tier ${tier}: exit 0; duration \\d+ s; output tail: ${output}`));
  }
});
