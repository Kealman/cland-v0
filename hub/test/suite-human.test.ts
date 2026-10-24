// T3: real package runners acquire compatibility leases, bypass them with --force,
// and leave the hub queue on SIGINT/SIGTERM or fall back when the hub is unreachable.
// Public CLI/socket tests use tiny package fixtures, never the live project's full-suite queue.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, stat, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { cland, eventually } from './harness.ts';
import type { VerificationQueue } from '../src/protocol.ts';
import { fileURLToPath } from 'node:url';
import { humanRunnerFixture } from './suite-support.ts';


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
  const session = f.start([], f.env);
  assert.equal(await session.done, 0, session.output());
  assert.doesNotMatch(session.output(), /suite queue|no hub queue/);
  // The real worker acquires and exports its verified lease to this package runner.
  await mkdir(join(f.root, 'hub', 'test'), { recursive: true });
  await writeFile(join(f.root, 'hub', 'test', 'run-suite.ts'), await readFile(fileURLToPath(new URL('./run-suite.ts', import.meta.url)), 'utf8'));
  await writeFile(join(f.root, 'package.json'), JSON.stringify({ scripts: { typecheck: 'node -e "process.exit(0)"', test: `${process.execPath} human-entry.mjs` } }));
  await f.launch();
  const result = await eventually('borrowed human entry finished', async () => (await f.results())[0]);
  assert.match(result.text, /auto exit 0/);
  assert.equal((await f.journal()).some(e => e.event === 'verification-human-queued'), false);
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
