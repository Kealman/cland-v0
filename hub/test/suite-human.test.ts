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
import { fileURLToPath } from 'node:url';
import { defaultConfig, parseConfig, renderConfig } from '../src/init/config.ts';
import { cacheRepository, humanRunnerFixture } from './suite-support.ts';


test('a human package runner waits in the hub order and takes the compatibility slot after admission', async t => {
  const f = await humanRunnerFixture(t);
  await f.launch();
  await eventually('crew holder started', async () => await stat(join(f.root, 'crew-started')).catch(() => undefined));
  await writeFile(join(f.root, 'human-hold'), 'yes');
  const human = f.start();
  await eventually('human queue diagnostic', () => human.output().includes('waiting for the suite queue: place 1 of 1') ? true : undefined);
  assert.match(human.output(), /ETA ~/);
  const cli = await cland(f.root, 'verify', 'queue', '--json');
  assert.equal(cli.code, 0, cli.stderr);
  const q = JSON.parse(cli.stdout) as VerificationQueue;
  assert.equal(q.waiters[0]?.session, 'human'); assert.equal(q.waiters[0]?.kind, 'hand run');
  await assert.rejects(stat(join(f.root, 'human-started')), { code: 'ENOENT' });
  await writeFile(join(f.root, 'crew-finish'), 'yes');
  await eventually('human admitted and running', async () => await stat(join(f.root, 'human-started')).catch(() => undefined));
  assert.equal((await f.queue()).holder?.session, 'human');
  const admitted = await cland(f.root, 'verify', 'queue');
  assert.equal(admitted.code, 0, admitted.stderr);
  assert.match(admitted.stdout, /^local: human ·/);
  await writeFile(join(f.root, 'human-finish'), 'yes');
  assert.equal(await human.done, 0, human.output());
  await eventually('human slot left', async () => (await f.journal()).find(e => e.event === 'verification-human-left'));
  const events = await f.journal();
  assert.ok(events.some(e => e.event === 'verification-human-queued'));
  assert.ok(events.some(e => e.event === 'verification-human-admitted' && Number(e.waitMs) > 0));
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) test(`an interrupted human waiter leaves the hub queue on ${signal}`, async t => {
  const f = await humanRunnerFixture(t);
  await mkdir(f.locks.hub); // An isolated ownerless compatibility holder keeps admission closed.
  const human = f.start();
  await eventually('human queued', async () => (await f.queue()).waiters.find(w => w.session === 'human'));
  human.child.kill(signal);
  assert.equal(await human.done, signal === 'SIGINT' ? 130 : 143, human.output());
  await eventually('human waiter removed', async () => (await f.queue()).waiters.length === 0 ? true : undefined);
  assert.ok(await stat(f.locks.hub), 'interruption preserves the unrelated holder');
  assert.ok((await f.journal()).some(e => e.event === 'verification-human-left' && e.reason === 'connection closed'));
});

test('a forced human package runner starts beside a holder and journals the exact bypass', async t => {
  const f = await humanRunnerFixture(t);
  await f.launch();
  await eventually('crew holder started', async () => await stat(join(f.root, 'crew-started')).catch(() => undefined));
  const forced = f.start(['--force']);
  assert.equal(await forced.done, 0, forced.output());
  assert.ok(await stat(join(f.root, 'human-started')));
  await assert.rejects(stat(join(f.root, 'crew-finish')), { code: 'ENOENT' });
  const events = await f.journal();
  const entry = events.find(e => e.event === 'verification-forced');
  assert.equal(entry?.worktree, f.root); assert.equal(entry?.mode, 'hub-only');
  assert.equal((entry?.holder as VerificationQueue['holder'])?.session, 'impl');
  assert.equal(events.some(e => e.event === 'verification-human-queued'), false);
  await writeFile(join(f.root, 'crew-finish'), 'yes');
  await eventually('crew finished', async () => (await f.results())[0]);
});

test('session-shell and inherited-worker package runners never request a human slot', async t => {
  const f = await humanRunnerFixture(t);
  const session = f.start([], { CLAND_SESSION_NAME: 'isolated-session' });
  assert.equal(await session.done, 0, session.output());
  assert.doesNotMatch(session.output(), /suite queue|no hub queue/);
  // The real worker acquires and exports its verified lease to this package runner.
  await mkdir(join(f.root, 'hub', 'test'), { recursive: true });
  await writeFile(join(f.root, 'hub', 'test', 'run-suite.ts'), await readFile(fileURLToPath(new URL('./run-suite.ts', import.meta.url)), 'utf8'));
  await writeFile(join(f.root, 'package.json'), JSON.stringify({ scripts: { typecheck: 'node -e "process.exit(0)"', test: `${process.execPath} human-entry.mjs` } }));
  await f.launch();
  const result = await eventually('borrowed human entry finished', async () => (await f.results())[0]);
  assert.match(result.text, /all exit 0/);
  assert.equal((await f.journal()).some(e => e.event === 'verification-human-queued'), false);
});

test('a human slot reserves admission briefly and releases a client that never takes its lease', async t => {
  const f = await humanRunnerFixture(t);
  const client = await connectUi(t, f.discovery, 'cli');
  const input = { type: 'suite.slot', mode: 'hub-only', cwd: f.root, head: 'fixture-head', pid: process.pid, token: 'abandoned-human' };
  assert.equal((await client.request(input)).ok, true);
  await eventually('human reservation admitted', async () => (await f.queue()).holder?.session === 'human' ? true : undefined);
  assert.equal((await f.queue()).holder?.kind, 'hand run');
  await eventually('human grace expired', async () => (await f.journal()).find(e => e.event === 'verification-human-left' && e.reason === 'admission grace expired'));
  assert.equal((await f.queue()).holder, null);
  assert.equal((await client.request(input)).ok, false, 'an expired client cannot silently restart its abandoned request');
});

test('without an answering hub plain human runs retain the lease and --force runs unlocked', async t => {
  const f = await humanRunnerFixture(t);
  await mkdir(f.locks.hub);
  const missing = { CLAND_HUB_FILE: join(f.root, 'no-hub.json') };
  const normal = f.start([], missing);
  await eventually('no hub fallback waiting on compatibility lock', () => normal.output().includes('waiting for the suite lock') ? true : undefined);
  assert.match(normal.output(), /no hub queue is in use; using the compatibility lease/);
  const forced = f.start(['--force'], missing);
  assert.equal(await forced.done, 0, forced.output());
  assert.match(forced.output(), /no hub queue is in use; --force runs unlocked/);
  assert.ok(await stat(f.locks.hub));
  await rm(f.locks.hub, { recursive: true });
  assert.equal(await normal.done, 0, normal.output());
  assert.equal((await f.journal()).some(e => e.event === 'verification-forced' || e.event === 'verification-human-queued'), false);
});

test('frames admit integrated dev, then a human slot, then ranked item work', async t => {
  const f = await fixture(t, `${process.execPath} admission.mjs`);
  const git = async (...args: string[]) => promisify(execFile)('git', args, { cwd: f.root });
  await writeFile(join(f.root, 'admission.mjs'), `import { appendFileSync, existsSync, readFileSync } from 'node:fs';
const n = existsSync('admissions') ? readFileSync('admissions', 'utf8').trim().split('\\n').length + 1 : 1;
appendFileSync('admissions', n + '\\n'); while (!existsSync('finish-' + n)) await new Promise(r => setTimeout(r, 25));`);
  await git('init', '--initial-branch=dev');
  await git('config', 'user.name', 'Admission test');
  await git('config', 'user.email', 'admission@example.invalid');
  await writeFile(join(f.root, '.gitignore'), '.cland/\nsuite.lock*\nadmissions\nfinish-*\n');
  await git('add', '.'); await git('commit', '-m', 'base');
  await mkdir(join(f.root, 'suite.lock'));
  const submit = async (name: string) => {
    const r = await f.ui.request({ type: 'suite.start', as: { name }, mode: 'all', fresh: true, cwd: f.root, report: f.topic, to: ['rev'] });
    assert.equal(r.ok, true, JSON.stringify(r));
    const job = r.value as { id: string; pid: number | null };
    assert.equal(job.pid, null);
    return job;
  };
  const ranked = await submit('impl');
  const human = await connectUi(t, f.discovery, 'cli');
  const slot = await human.request({ type: 'suite.slot', mode: 'hub-only', cwd: f.root, head: 'fixture-head', pid: process.pid, token: 'priority-human' });
  assert.equal(slot.ok, true, JSON.stringify(slot));
  const humanId = (slot.value as { id: string }).id;
  assert.equal((await f.ui.request({ type: 'role.set', session: 'coord', role: 'coordinator' })).ok, true);
  const coord = await spawnSpoke({ discover: true, cwd: f.root, name: 'coord', sessionId: 'coord-admission', role: 'coordinator' });
  t.after(() => coord.close()); await coord.waitForPresence(['coord']);
  const integrated = await submit('coord');
  const queue = async () => (await f.ui.request({ type: 'suite.queue' })).value as VerificationQueue;
  assert.deepEqual((await queue()).waiters.map(w => w.id), [integrated.id, humanId, ranked.id]);
  await rm(join(f.root, 'suite.lock'), { recursive: true });
  await eventually('integrated dev admitted first', async () => (await queue()).holder?.id === integrated.id ? true : undefined);
  await eventually('first worker executing', async () => (await readFile(join(f.root, 'admissions'), 'utf8').catch(() => '')) === '1\n' ? true : undefined);
  assert.deepEqual((await queue()).waiters.map(w => w.id), [humanId, ranked.id]);
  await writeFile(join(f.root, 'finish-1'), 'yes');
  await eventually('human admitted second', async () => (await queue()).holder?.id === humanId ? true : undefined);
  assert.equal((await queue()).holder?.session, 'human');
  assert.deepEqual((await queue()).waiters.map(w => w.id), [ranked.id]);
  assert.equal(await readFile(join(f.root, 'admissions'), 'utf8'), '1\n', 'ranked worker has not started');
  human.close();
  await eventually('ranked item admitted last', async () => (await queue()).holder?.id === ranked.id ? true : undefined);
  await eventually('second worker executing', async () => (await readFile(join(f.root, 'admissions'), 'utf8')) === '1\n2\n' ? true : undefined);
  assert.deepEqual((await queue()).waiters, []);
  await writeFile(join(f.root, 'finish-2'), 'yes');
  await eventually('both exact-head results posted', async () => (await f.results()).length === 2 ? true : undefined);
  const head = (await git('rev-parse', 'HEAD')).stdout.trim();
  for (const result of await f.results()) {
    assert.match(result.text, /exit 0/);
    assert.ok(result.text.includes(`head ${head}`));
  }
});

test('human slots retain enqueue order ahead of ranked item requests', async t => {
  const f = await humanRunnerFixture(t);
  await mkdir(f.locks.hub);
  const first = await connectUi(t, f.discovery, 'cli');
  const input = { type: 'suite.slot', mode: 'hub-only', cwd: f.root, head: 'fixture-head', pid: process.pid, token: 'first-human' };
  const a = (await first.request(input)).value as { id: string };
  const job = await f.launch();
  const second = await connectUi(t, f.discovery, 'cli');
  const b = (await second.request({ ...input, token: 'second-human' })).value as { id: string };
  assert.deepEqual((await f.queue()).waiters.map(w => w.id), [a.id, b.id, job.id]);
  first.close(); second.close();
  await eventually('both human sockets left', async () => (await f.queue()).waiters.length === 1 ? true : undefined);
  await writeFile(join(f.root, 'crew-finish'), 'yes');
  await rm(f.locks.hub, { recursive: true });
  await eventually('ranked worker finished', async () => (await f.results())[0]);
});
