// T1: durable queue reconciliation with real tracker/store, FakeClock and injected Git facts.
import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MergeQueue } from '../src/hub/merge-queue.ts';
import { Store } from '../src/hub/store.ts';
import { Tracker } from '../src/tracker/tracker.ts';
import type { Git } from '../src/tracker/verdict-git.ts';
import { FakeClock } from './fake-clock.ts';

async function fixture(t: TestContext) {
  const root = await mkdtemp(join(tmpdir(), 'merge-queue-unit-'));
  const clock = new FakeClock(), store = new Store();
  const heads = new Map<string, string>([['dev', 'a'.repeat(40)], ...Array.from({ length: 6 }, (_, i) => [`t/${i + 1}`, String(i + 1).repeat(40)] as const)]);
  const listing = () => [...heads].map(([branch, head]) => `${head} refs/heads/${branch}`).join('\n');
  let read: () => string | null = listing;
  let absent: ((input: string) => string | null) | undefined;
  const manifests = new Map<string, string>();
  const ancestor = heads.get('dev')!;
  const git: Git = async (args, input) => {
    if (args[0] === 'rev-parse') return heads.get(args.at(-1)!.replace(/^refs\/heads\//, '').replace(/\^\{commit\}$/, '')) ?? null;
    if (args[0] === 'merge-base') return ancestor;
    if (args[0] === 'diff') return 'package.json\0';
    if (args[0] === 'show') return manifests.get(args.at(-1)!) ?? null;
    if (args[0] === 'for-each-ref') return read();
    if (args[0] === 'show-ref' && args.includes('--exclude-existing=refs/heads/')) {
      return absent ? absent(input!) : input!.trim().split('\n').filter(ref => !heads.has(ref.slice('refs/heads/'.length))).join('\n');
    }
    return null;
  };
  const tracker = new Tracker({ root, db: ':memory:', clock, git, readBase: async () => 'dev' });
  const drops: string[] = [];
  const queue = new MergeQueue(store, tracker, clock, () => true, git, undefined, (entry, reason) => drops.push(`${entry.item}: ${reason}`));
  t.after(async () => { queue.stop(); await tracker.stop(); store.close(); await rm(root, { recursive: true, force: true }); });
  const actor = { id: 'coordinator', name: 'coordinator', role: 'coordinator' };
  for (let i = 1; i <= 6; i++) {
    const branch = `t/${i}`;
    const item = await tracker.create(actor, { title: `Queued ${i}`, branch, size: 'S' });
    store.enqueueMerge({ item: item.id, branch, head: heads.get(branch)!, verdictBase: 'dev', enqueued: clock.now().toISOString(), by: actor });
  }
  return { root, actor, manifests, queue, tracker, heads, drops, listing, read(fn: typeof read) { read = fn; }, absent(fn: NonNullable<typeof absent>) { absent = fn; } };
}

test('malformed branch output cannot authorize drops even for parsed head changes', async t => {
  const f = await fixture(t), expected = f.queue.entries();
  f.heads.set('t/1', 'f'.repeat(40));
  for (const suffix of ['truncated', `${'a'.repeat(41)} refs/heads/other`, `${'b'.repeat(40)} refs/heads/t/1`]) {
    f.read(() => `${f.listing()}\n${suffix}`);
    assert.deepEqual(await f.queue.refresh(), expected);
    assert.deepEqual(f.drops, []);
  }
});

test('drop removes and reports only the matching pinned request', async t => {
  const { queue, drops } = await fixture(t), expected = queue.entries();
  const entry = expected[0]!;
  for (const stale of [
    { ...entry, item: 'T-99' },
    { ...entry, head: 'f'.repeat(40) },
    { ...entry, enqueued: '2026-10-15T12:00:00.000Z' },
  ]) {
    queue.drop(stale, 'stale batch refusal');
    assert.deepEqual(queue.entries(), expected);
    assert.deepEqual(drops, [], 'a stale refusal must not report removal of a newer request');
  }
  queue.drop({ ...entry }, 'matching refusal');
  assert.deepEqual(queue.entries(), expected.slice(1));
  assert.deepEqual(drops, ['T-1: matching refusal']);
  queue.drop(entry, 'already removed');
  assert.deepEqual(queue.entries(), expected.slice(1));
  assert.deepEqual(drops, ['T-1: matching refusal']);
});

test('uncertain refreshes retain all six entries without partial reconciliation', async t => {
  const f = await fixture(t), expected = f.queue.entries();
  f.heads.set('t/1', 'f'.repeat(40));
  f.heads.delete('t/2');
  for (const read of [() => '', () => null, () => `${f.heads.get('dev')} refs/heads/dev\n${f.heads.get('t/1')} refs/heads/t/1`]) {
    f.read(read);
    assert.deepEqual(await f.queue.refresh(), expected);
    assert.deepEqual(f.drops, []);
  }
  f.read(() => { throw new Error('git timed out'); });
  await assert.rejects(f.queue.refresh(), /git timed out/);
  assert.deepEqual(f.queue.entries(), expected);
  f.read(f.listing);
  for (const receipt of [null, '', 'refs/heads/unrequested']) {
    f.absent(() => receipt);
    assert.deepEqual(await f.queue.refresh(), expected);
    assert.deepEqual(f.drops, []);
  }
  f.absent(() => { throw new Error('absence read timed out'); });
  await assert.rejects(f.queue.refresh(), /absence read timed out/);
  assert.deepEqual(f.queue.entries(), expected);
});

test('authoritative reads still drop real deletions and changed heads with the original reason', async t => {
  const f = await fixture(t);
  f.heads.set('t/1', 'f'.repeat(40));
  f.heads.delete('t/2');
  const remaining = await f.queue.refresh();
  assert.deepEqual(remaining.map(entry => entry.item), ['T-3', 'T-4', 'T-5', 'T-6']);
  assert.deepEqual(f.drops, [`T-1: branch head changed or deleted; prepared head ${'1'.repeat(40)}, current head ${'f'.repeat(40)}`, `T-2: branch head changed or deleted; prepared head ${'2'.repeat(40)}, current head missing`]);
});

test('tracker tip notifications do not treat missing cached heads as deletion proof', async t => {
  const f = await fixture(t), expected = f.queue.entries();
  await f.tracker.refreshFreshness();
  f.read(() => null);
  await f.tracker.refreshFreshness();
  assert.deepEqual(f.queue.entries(), expected);
  assert.deepEqual(f.drops, []);
});

test('partial tracker notifications cannot bypass snapshot validation', async t => {
  const f = await fixture(t), expected = f.queue.entries();
  f.heads.set('t/1', 'f'.repeat(40));
  f.read(() => `${f.heads.get('dev')} refs/heads/dev\n${f.heads.get('t/1')} refs/heads/t/1`);
  await f.tracker.refreshFreshness();
  assert.deepEqual(await f.queue.refresh(), expected);
  assert.deepEqual(f.drops, []);
});

for (const change of ['scripts', 'dependencies'] as const) test(`queue candidate: ${change} change has the correct install notice`, async t => {
  const f = await fixture(t);
  const before = { dependencies: { library: '1' }, scripts: { test: 'old' } };
  const after = change === 'scripts' ? { ...before, scripts: { test: 'new' } } : { ...before, dependencies: { library: '2' } };
  f.manifests.set(`${f.heads.get('dev')}:package.json`, JSON.stringify(before));
  f.manifests.set(`${f.heads.get('t/1')}:package.json`, JSON.stringify(after));
  // Dev's independent dependency update must not be attributed to this candidate.
  f.heads.set('dev', 'c'.repeat(40));
  f.manifests.set(`${f.heads.get('dev')}:package.json`, JSON.stringify({ ...before, dependencies: { library: '3' } }));
  const view = { ...f.tracker.view('T-1'), verdictBase: 'dev' };
  const candidate = await f.queue.candidate(view, work => work());
  f.queue.cancel(view.id);
  f.queue.enqueue(view, candidate.head, candidate.base, f.actor, candidate.dependencies);
  assert.deepEqual(f.queue.entries().find(entry => entry.item === view.id)?.dependencies,
    change === 'scripts' ? undefined : { files: ['package.json'], command: 'npm install', cwd: f.root });
});
