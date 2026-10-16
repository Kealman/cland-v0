// Public CLI/socket tests use tiny package fixtures, never the live project's full-suite queue.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, stat, rm, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { projectHub, cland, clandWithEnv, connectUi, eventually, startDaemon, spawnSpoke, tempProject, pidAlive, fakeCodex } from './harness.ts';
import { fixture, type ResultMessage } from './suite-fixture.ts';
import { suiteSummary } from '../src/hub/suites.ts';
import { DatabaseSync } from 'node:sqlite';
import { ownProcess } from './process-cleanup.ts';
import type { Artifact } from '../src/protocol.ts';
import type { VerificationQueue, HubStatus } from '../src/protocol.ts';
import type { ItemSummary, ItemView } from '../src/tracker/tracker.ts';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { defaultConfig, parseConfig, renderConfig } from '../src/init/config.ts';
import { cacheRepository, humanRunnerFixture } from './suite-support.ts';


test('scratch daemon defaults to fixture leases when the project has no verification override', async t => {
  const root = await tempProject(t, 'cland-scratch-lease-');
  const { discovery } = await projectHub(t, root, { TZ: 'Pacific/Honolulu' });
  const lock = join(root, 'suite.lock');
  await mkdir(lock);
  await writeFile(`${lock}.owner`, JSON.stringify({ pid: process.pid, started: null, token: 'scratch', worktree: root, since: '2026-10-12T00:00:00Z' }));
  const ui = await connectUi(t, discovery);
  const q = (await ui.request({ type: 'suite.queue' })).value as VerificationQueue;
  assert.equal(q.holder?.kind, 'hand run');
  assert.equal(q.holder?.pid, process.pid);
  assert.equal(q.holder?.worktree, root);
});

for (const legacy of [false, true]) test(`verify queue preserves a live ${legacy ? 'legacy' : 'UTC'} package holder across observer timezones`, async t => {
  const f = await fixture(t, 'node -e "process.exit(0)"', undefined, '', { TZ: 'Pacific/Honolulu' });
  const lock = join(f.root, 'suite.lock');
  const runner = fileURLToPath(new URL('./run-suite.ts', import.meta.url));
  const marker = join(f.root, 'hand-started');
  const finish = join(f.root, 'hand-finish');
  const file = join(f.root, 'hand.mjs');
  await writeFile(file, `import test from 'node:test'; import { existsSync, writeFileSync } from 'node:fs'; test('hand holder', async () => { writeFileSync(${JSON.stringify(marker)}, 'ready'); while (!existsSync(${JSON.stringify(finish)})) await new Promise(r => setTimeout(r, 25)); });`);
  const child = spawn(process.execPath, ['--input-type=module', '-e', `import { runPackageSuite } from ${JSON.stringify(runner)}; process.exitCode = await runPackageSuite('all', [${JSON.stringify(file)}], { cwd: ${JSON.stringify(f.root)}, lockDirs: { hub: ${JSON.stringify(lock)}, nvim: ${JSON.stringify(`${lock}-nvim`)} } });`], {
    env: { ...process.env, NODE_TEST_CONTEXT: '', CLAND_TEST_SKIP_LOCK: '0', TZ: 'UTC' }, stdio: ['ignore', 'pipe', 'pipe'],
  });
  ownProcess(t, child.pid);
  let output = '';
  child.stdout.on('data', data => { output += String(data); });
  child.stderr.on('data', data => { output += String(data); });
  const done = new Promise<number | null>((resolve, reject) => { child.once('error', reject); child.once('close', resolve); });
  t.after(async () => { if (child.exitCode === null && child.signalCode === null) child.kill('SIGTERM'); await done; });
  await eventually('live package holder', () => readFile(marker, 'utf8').then(() => true, () => undefined));
  if (legacy) for (const dir of [lock, `${lock}-nvim`]) {
    const owner = JSON.parse(await readFile(`${dir}.owner`, 'utf8'));
    delete owner.startedUtc;
    await writeFile(`${dir}.owner`, JSON.stringify(owner));
    await writeFile(join(dir, 'holder.json'), JSON.stringify(owner));
  }
  const owner = JSON.parse(await readFile(`${lock}.owner`, 'utf8')) as { pid: number; since: string; token: string };
  assert.equal(owner.pid, child.pid);
  assert.equal((await f.ui.request({ type: 'subscribe' })).ok, true);
  const queue = (await f.ui.request({ type: 'suite.queue' })).value as VerificationQueue;
  assert.equal(queue.holder?.kind, 'hand run', output);
  assert.equal(queue.holder?.pid, child.pid);
  assert.equal(queue.holder?.worktree, f.root);
  assert.equal(queue.holder?.since, owner.since);
  const cli = await clandWithEnv(f.root, f.env, 'verify', 'queue', '--json');
  assert.equal(cli.code, 0, cli.stderr);
  assert.equal((JSON.parse(cli.stdout) as VerificationQueue).holder?.pid, child.pid);
  const text = await cland(f.root, 'verify', 'queue');
  assert.equal(text.code, 0, text.stderr);
  assert.ok(text.stdout.includes(`since ${owner.since}`), text.stdout);
  await f.ui.waitFor(frame => frame.type === 'verification.queue' && (frame.queue as VerificationQueue).holder?.pid === child.pid);
  const waiting = await f.launch();
  assert.equal(waiting.pid, null, 'hub admission must leave the live hand holder alone');
  assert.equal(child.signalCode, null, output);
  assert.equal(JSON.parse(await readFile(`${lock}.owner`, 'utf8')).token, owner.token);
  await writeFile(finish, 'done');
  assert.equal(await done, 0, output);
  await eventually('queued run completes after hand release', async () => (await f.results())[0]);
});

test('verify queue shows a hand holder, ordered waiters and unknown ETA; survives restart', async t => {
  const f = await fixture(t, 'node -e "process.exit(0)"', undefined, undefined, undefined, undefined, undefined, startDaemon);
  const lock = join(f.root, 'suite.lock');
  await mkdir(lock);
  await writeFile(join(lock, 'holder.json'), JSON.stringify({ pid: process.pid, started: null, since: new Date().toISOString(), token: 'hand', worktree: '/hand/worktree' }));
  const first = await f.launch();
  assert.equal((await f.ui.request({ type: 'subscribe' })).ok, true);
  await f.ui.waitFor(frame => frame.type === 'verification.queue' && (frame.queue as VerificationQueue).waiters.some(w => w.id === first.id));
  assert.equal(first.pid, null);
  assert.equal((await f.ui.request({ type: 'role.set', session: 'other', role: 'implementer' })).ok, true);
  const other = await spawnSpoke({ discover: true, cwd: f.root, name: 'other', sessionId: 'queue-other', role: 'implementer' });
  t.after(() => other.close()); await other.waitForPresence(['other']);
  const item = JSON.parse((await cland(f.root, 'task', 'create', '--size', 'M', 'other queue request', '--assignee', 'other', '--json')).stdout) as { item: { id: string } };
  const topic = await f.ui.request({ type: 'topic.create', title: 'Other queue request', item: item.item.id });
  const otherTopic = (topic.value as { topic: { id: string } }).topic.id;
  const submitted = await clandWithEnv(f.root, { CLAND_SESSION_NAME: 'other', CLAND_SESSION_ID: 'queue-other' }, 'verify', 'all', '--report', otherTopic, '--to', 'rev', '--json');
  assert.equal(submitted.code, 0, submitted.stderr);
  const second = JSON.parse(submitted.stdout) as { id: string };
  const check = async () => {
    const cli = await clandWithEnv(f.root, f.env, 'verify', 'queue', '--json');
    assert.equal(cli.code, 0, cli.stderr);
    const q = JSON.parse(cli.stdout) as VerificationQueue;
    assert.equal(q.version, 1);
    assert.equal(q.holder?.kind, 'hand run');
    assert.equal(q.holder?.pid, process.pid);
    assert.equal(q.holder?.worktree, '/hand/worktree');
    assert.deepEqual(q.waiters.map(w => [w.id, w.position, w.session]), [[first.id, 1, 'impl'], [second.id, 2, 'other']]);
    assert.ok(q.waiters.every(w => w.waitMs >= 0 && w.etaMs === null));
    assert.equal(q.metrics.window, 20); assert.equal(q.metrics.run.count, 0);
    const text = await cland(f.root, 'verify', 'queue');
    assert.equal(text.code, 0, text.stderr);
    assert.match(text.stdout, /local: hand run/); assert.match(text.stdout, /1\. impl.*wait .*ETA unknown/);
    const invalid = await cland(f.root, 'verify', 'queue', '--fresh');
    assert.notEqual(invalid.code, 0);
  };
  await check();
  await cland(f.root, 'hub', 'stop'); await startDaemon(t, f.root);
  await check();
});

test('verify records wait/run timings, zero-time cache hits, recent median/p90 and a mode-aware ETA', async t => {
  const f = await fixture(t, `node -e "const fs=require('fs');fs.appendFileSync('executions','run\\n');const p=setInterval(()=>{if(fs.existsSync('finish'))clearInterval(p)},25)"`, undefined, '[hygiene]\nrate_limit_max = 100\nloop_breaker_max = 100\n', undefined, undefined, undefined, startDaemon);
  const git = await cacheRepository(f);
  await git('config', 'user.name', 'Metrics test');
  // Fixture signals are outside the candidate tree, so completing a run can seed the cache.
  await writeFile(join(f.root, '.gitignore'), (await readFile(join(f.root, '.gitignore'), 'utf8')) + 'finish\n');
  await git('add', '.gitignore'); await git('commit', '-m', 'ignore completion signal');
  const lock = join(f.root, 'suite.lock');
  await mkdir(lock);
  const first = await f.launch();
  const waiting = await f.ui.request({ type: 'suite.queue' });
  assert.equal(waiting.ok, true, waiting.error);
  assert.ok((waiting.value as VerificationQueue).waiters[0]!.waitMs > 0);
  await rm(lock, { recursive: true });
  await eventually('running queue holder', async () => {
    const q = (await f.ui.request({ type: 'suite.queue' })).value as VerificationQueue;
    return q.holder?.id === first.id && q.holder.runMs !== null ? q : undefined;
  });
  await writeFile(join(f.root, 'finish'), '');
  await eventually('measured execution', async () => (await f.results())[0]);
  const measured = (await f.ui.request({ type: 'hub.status' })).value as HubStatus;
  const run = measured.suites!.find(j => j.id === first.id)!;
  assert.ok(run.waitMs! > 0); assert.ok(run.runMs! > 0);
  assert.ok(run.admittedAt && run.completedAt);
  await mkdir(lock);
  const hit = await f.launch();
  assert.equal(hit.cached?.run, first.id);
  await eventually('zero-time cache completion', async () => (await f.results())[1]);
  const status = (await f.ui.request({ type: 'hub.status', flushLogs: true })).value as HubStatus;
  const cached = status.suites!.find(j => j.id === hit.id)!;
  assert.equal(cached.waitMs, 0); assert.equal(cached.runMs, 0);
  assert.equal(cached.finished, run.finished, 'expiry still refers to original completion');
  assert.notEqual(cached.completedAt, run.completedAt, 'metrics refer to this request');
  assert.equal(run.executor, 'local');
  assert.ok(run.platform);
  assert.equal(cached.executor, run.executor);
  assert.deepEqual(cached.platform, run.platform);
  const stats = status.verification!.metrics;
  assert.equal(stats.count, 2);
  assert.equal(stats.run.count, 2);
  assert.equal(stats.run.medianMs, run.runMs! / 2);
  assert.equal(stats.run.p90Ms, run.runMs);
  assert.equal(stats.wait.medianMs, run.waitMs! / 2);
  assert.equal(stats.wait.p90Ms, run.waitMs);
  const journal = (await readFile(join(f.root, '.cland', 'journal.jsonl'), 'utf8')).trim().split('\n').map(line => JSON.parse(line) as Record<string, unknown>);
  const recorded = journal.filter(e => e.event === 'verification-timing');
  assert.equal(recorded.length, 2);
  assert.equal(recorded.find(e => e.id === hit.id)?.runMs, 0);
  for (const id of [first.id, hit.id]) for (const event of ['verification-timing', 'suite-result']) {
    const entry = journal.find(e => e.id === id && e.event === event);
    assert.equal(entry?.executor, 'local');
    assert.deepEqual(entry?.platform, run.platform);
  }
  await writeFile(join(lock, 'holder.json'), JSON.stringify({ pid: process.pid, started: null, since: new Date().toISOString(), token: 'hand' }));
  const fresh = await f.launch('all', '--fresh');
  const queue = (await f.ui.request({ type: 'suite.queue' })).value as VerificationQueue;
  assert.equal(queue.waiters[0]!.id, fresh.id);
  assert.equal(queue.waiters[0]!.expectedRunMs, run.runMs, 'cache zeros do not shorten executed-run estimates');
  assert.ok(queue.waiters[0]!.etaMs !== null && queue.waiters[0]!.etaMs! >= 0);
  assert.equal((await f.ui.request({type:'role.set', session:'next', role:'implementer'})).ok, true);
  const nextSpoke = await spawnSpoke({discover:true, cwd:f.root, name:'next', sessionId:'metrics-next', role:'implementer'});
  t.after(() => nextSpoke.close()); await nextSpoke.waitForPresence(['next']);
  await f.spoke.call('send', {to:['next'], topic:f.topic, text:'Verify the metrics fixture'});
  await nextSpoke.waitForEvent(e => e.params.content.includes('Verify the metrics fixture'));
  const nextRequest = await clandWithEnv(f.root, {CLAND_SESSION_NAME:'next', CLAND_SESSION_ID:'metrics-next'}, 'verify', 'all', '--fresh', '--report', f.topic, '--to','rev','--json');
  assert.equal(nextRequest.code, 0, nextRequest.stderr);
  const nextJob = JSON.parse(nextRequest.stdout) as {id:string};
  const ordered = (await f.ui.request({type:'suite.queue'})).value as VerificationQueue;
  assert.deepEqual(ordered.waiters.map(w => w.id), [fresh.id, nextJob.id]);
  assert.equal(ordered.waiters[1]!.etaMs! - ordered.waiters[0]!.etaMs!, run.runMs, 'second ETA includes the first execution duration');
  await cland(f.root, 'hub', 'stop');
  const next = await startDaemon(t, f.root);
  const ui = await connectUi(t, next.discovery);
  const restored = (await ui.request({ type: 'hub.status' })).value as HubStatus;
  assert.deepEqual(restored.verification!.metrics, stats);
  assert.equal(restored.suites!.find(j => j.id === first.id)!.runMs, run.runMs);
  assert.equal((await ui.request({ type: 'suite.cancel', suite: fresh.id })).ok, true);
  assert.equal((await ui.request({ type: 'suite.cancel', suite: nextJob.id })).ok, true);
  await eventually('queued cancellation measured', async () => {
    const s = (await ui.request({ type: 'hub.status' })).value as HubStatus;
    const cancelled = s.suites!.find(j => j.id === fresh.id)!;
    if (!cancelled.reported) return undefined;
    assert.equal(cancelled.runMs, 0); assert.ok(cancelled.waitMs! > 0);
    return true;
  });
  await rm(lock, {recursive:true});
  const replacement = await f.launch('all', '--fresh');
  await eventually('new green after fresh cancellation', async () => ((await ui.request({type:'hub.status'})).value as HubStatus).suites!.find(j => j.id === replacement.id && j.reported));
  await mkdir(lock);
  for (let n = 0; n < 20; n++) {
    const hit = await f.launch();
    assert.equal(hit.cached?.run, replacement.id);
    await eventually('cache timing settled', async () => ((await ui.request({type:'hub.status'})).value as HubStatus).suites!.find(j => j.id === hit.id && j.reported));
  }
  const bounded = (await ui.request({ type: 'suite.queue' })).value as VerificationQueue;
  assert.equal(bounded.waiters.length, 0, 'hits complete even while the compatibility lock is held');
  const { queueWait, ...legacyMetrics } = bounded.metrics;
  assert.deepEqual(legacyMetrics, { window: 20, count: 20, wait: { count: 20, medianMs: 0, p90Ms: 0 }, run: { count: 20, medianMs: 0, p90Ms: 0 } });
  assert.equal(queueWait?.last50Runs.local.count, 2, 'only executed requests contribute wait samples');
  assert.equal(queueWait?.last50Runs.local.cacheHits, 21);
});
