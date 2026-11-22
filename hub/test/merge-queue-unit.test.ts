// T1: durable queue reconciliation with real tracker/store, FakeClock and injected Git facts.
import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, stat } from 'node:fs/promises';
import { statSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MergeQueue } from '../src/hub/merge-queue.ts';
import { Store } from '../src/hub/store.ts';
import { Tracker } from '../src/tracker/tracker.ts';
import type { Git } from '../src/tracker/verdict-git.ts';
import { FakeClock } from './fake-clock.ts';
import { stageCase } from './stage-case-fixture.ts';
import { ownedDatabases, ownedTracker } from './owned-tracker.ts';
import { tempProject } from './harness.ts';

type FixtureControl = { openStore?: ConstructorParameters<typeof Store>[1]; root?: (root: string) => void; rootCleanup?: (cleanup: () => Promise<void>) => void; owner?: (owner: ReturnType<typeof stageCase>) => void };
async function fixture(t: TestContext, owner?: ReturnType<typeof stageCase>, control: FixtureControl = {}) {
  // This context is used only by tempProject. Forward its real registered
  // cleanup unchanged, and expose that same hook for independent guard proof.
  const directoryContext = owner && control.rootCleanup ? new Proxy(owner.fixtures, { get(target, key) {
    if (key === 'after') return (hook: () => unknown) => {
      target.after(hook);
      control.rootCleanup?.(async () => { await hook(); });
    };
    const value = Reflect.get(target, key, target);
    return typeof value === 'function' ? value.bind(target) : value;
  } }) : owner?.fixtures;
  const root = directoryContext ? await tempProject(directoryContext) : await mkdtemp(join(tmpdir(), 'merge-queue-unit-'));
  owner?.adoptRoot(root);
  control.root?.(root);
  let store: Store | undefined, queue: MergeQueue | undefined;
  owner?.requireClose(async () => { queue?.stop(); });
  const openStore = owner ? ownedDatabases(owner, () => {
    const acquired = store;
    return acquired ? Promise.resolve().then(() => acquired.close()) : undefined;
  }) : undefined;
  store = new Store(':memory:', openStore ? path => openStore(path, control.openStore) : control.openStore);
  const clock = new FakeClock();
  const heads = new Map<string, string>([['dev', 'a'.repeat(40)], ...Array.from({ length: 6 }, (_, i) => [`t/${i + 1}`, String(i + 1).repeat(40)] as const)]);
  const listing = () => [...heads].map(([branch, head]) => `${head} refs/heads/${branch}`).join('\n');
  let read: () => string | null = listing;
  let absent: ((input: string) => string | null) | undefined;
  const manifests = new Map<string, string>();
  let emptyDiff = false;
  const ancestor = heads.get('dev')!;
  const git: Git = async (args, input) => {
    if (args[0] === 'rev-parse') return heads.get(args.at(-1)!.replace(/^refs\/heads\//, '').replace(/\^\{commit\}$/, '')) ?? null;
    if (args[0] === 'merge-base') return ancestor;
    if (args[0] === 'diff') return emptyDiff ? '' : 'package.json\0';
    if (args[0] === 'show') return manifests.get(args.at(-1)!) ?? null;
    if (args[0] === 'for-each-ref') return read();
    if (args[0] === 'show-ref' && args.includes('--exclude-existing=refs/heads/')) {
      return absent ? absent(input!) : input!.trim().split('\n').filter(ref => !heads.has(ref.slice('refs/heads/'.length))).join('\n');
    }
    return null;
  };
  const options = { root, db: ':memory:', clock, git, readBase: async () => 'dev' };
  const tracker = owner ? ownedTracker(owner, options) : new Tracker(options);
  const drops: string[] = [];
  queue = new MergeQueue(store, tracker, clock, () => true, git, undefined, (entry, reason) => drops.push(`${entry.item}: ${reason}`));
  const acquiredStore = store, acquiredQueue = queue;
  if (!owner) t.after(async () => { acquiredQueue.stop(); await tracker.stop(); acquiredStore.close(); await rm(root, { recursive: true, force: true }); });
  const actor = { id: 'coordinator', name: 'coordinator', role: 'coordinator' };
  for (let i = 1; i <= 6; i++) {
    const branch = `t/${i}`;
    const item = await tracker.create(actor, { title: `Queued ${i}`, branch, size: 'S' });
    store.enqueueMerge({ item: item.id, branch, head: heads.get(branch)!, verdictBase: 'dev', enqueued: clock.now().toISOString(), by: actor });
  }
  return { root, actor, manifests, queue, tracker, heads, drops, listing, emptyDiff() { emptyDiff = true; }, read(fn: typeof read) { read = fn; }, absent(fn: NonNullable<typeof absent>) { absent = fn; } };
}

type UnitObservation = <T>(name: string, start: () => Promise<T>) => Promise<T>;
function candidateCase(t: TestContext, body: (f: Awaited<ReturnType<typeof fixture>>, observe: UnitObservation) => Promise<void>, control: FixtureControl = {}) {
  const scope = stageCase(t);
  control.owner?.(scope);
  return scope.wait('whole candidate admission callback', () => scope.run(async step => {
    const observe: UnitObservation = (name, start) => step(() => scope.wait(name, start));
    const f = await observe('candidate tracker, store and queue setup', () => fixture(scope.resources, scope, control));
    await body(f, observe);
  }));
}

for (const rejectedClose of [false, true]) test(`Store constructor failure preserves primary with ${rejectedClose ? 'rejected then repaired' : 'confirmed'} native closure`, t => {
  const supervisor = stageCase(t);
  let nested: ReturnType<typeof stageCase> | undefined, connection: DatabaseSync | undefined;
  let root = '', refuse = rejectedClose, closeCalls = 0, selected: unknown;
  let rootCleanup: (() => Promise<void>) | undefined, rootCleanupRegistrations = 0, removalAttempts = 0;
  const primary = new Error('controlled Store schema failure');
  const closeFailure = new Error('controlled Store native close rejection');
  const containsCloseFailure = (error: unknown): boolean => error === closeFailure || error instanceof AggregateError && error.errors.some(containsCloseFailure);
  supervisor.releaseOnClose(() => { refuse = false; });
  supervisor.requireClose(async () => {
    refuse = false;
    // Emergency drainage still permits the deliberately red fallback control.
    if (connection?.isOpen) DatabaseSync.prototype.close.call(connection);
    await nested?.close(); await nested?.restore();
  });
  return supervisor.wait('whole Store constructor control', () => supervisor.run(async step => {
    const observe: UnitObservation = (name, start) => step(() => supervisor.wait(name, start));
    const outerBoundary = supervisor.nativeBoundary();
    const hooks: Array<() => unknown> = [];
    const context = { name: t.name, after: (hook: () => unknown) => hooks.push(hook) } as unknown as TestContext;
    const dispose = async () => {
      const errors: unknown[] = [];
      for (const hook of hooks) try { await hook(); } catch (error) { errors.push(error); }
      if (errors.length) throw new AggregateError(errors, 'controlled candidate cleanup rejected');
    };
    const starting = candidateCase(context, async () => { assert.fail('failed Store setup cannot admit the candidate consumer'); }, {
      owner: owner => { nested = owner; }, root: value => { root = value; },
      rootCleanup: cleanup => { rootCleanupRegistrations++; rootCleanup = async () => { removalAttempts++; await cleanup(); }; },
      openStore: path => {
        assert.equal(rootCleanupRegistrations, 1, 'real root cleanup is captured before native open');
        const db = connection = new DatabaseSync(path), close = db.close.bind(db), execute = db.exec.bind(db);
        db.exec = sql => { if (sql.includes('create table')) throw primary; execute(sql); };
        db.close = () => {
          closeCalls++;
          if (refuse) throw closeFailure;
          assert.equal(statSync(root).isDirectory(), true, 'native close precedes guarded root removal');
          close();
        };
        return db;
      },
    });
    await observe('original Store constructor failure', () => assert.rejects(starting, error => { selected = error; return error === primary; }));
    assert.ok(connection, 'captured native open before Store assignment');
    assert.equal(connection.isOpen, true);
    assert.equal(rootCleanupRegistrations, 1, 'capture the actual root cleanup registration before native acquisition');
    assert.ok(rootCleanup);
    if (rejectedClose) {
      await observe('rejected native close receipt', () => assert.rejects(dispose(), containsCloseFailure));
      assert.equal(closeCalls, 1, 'fallback attempted the captured native closer');
      assert.equal(connection.isOpen, true, 'rejected close retains the exact handle');
      const heldBoundary = nested!.nativeBoundary();
      await observe('independent registered directory removal attempt', () => assert.rejects(rootCleanup!(), /stage resource close unconfirmed; root retained/));
      assert.equal(removalAttempts, 1, 'the independent registered cleanup attempt completed with guard refusal');
      assert.equal(closeCalls, 1, 'directory guard refuses without retrying the rejected native close');
      assert.equal(connection.isOpen, true, 'independent removal attempt retains the captured handle');
      assert.equal((await observe('guarded root retention', () => stat(root))).isDirectory(), true);
      assert.equal(nested!.nativeBoundary(), heldBoundary, 'independent removal refusal preserves the installed boundary');
      assert.notEqual(nested!.nativeBoundary(), outerBoundary, 'native guard independently retained');
      await observe('premature restoration refusal', () => assert.rejects(nested!.restore(), /resource close unconfirmed/));
      refuse = false;
      await observe('positive repaired close', () => nested!.close());
      await observe('positive repaired restoration', () => nested!.restore());
    } else await observe('captured connection fallback closure', dispose);
    assert.equal(selected, primary, 'cleanup never replaces the original selected failure');
    assert.equal(closeCalls, rejectedClose ? 2 : 1);
    assert.equal(connection.isOpen, false, 'positive native connection close receipt');
    await observe('guarded root removal', () => assert.rejects(stat(root), { code: 'ENOENT' }));
    assert.equal(nested!.nativeBoundary(), outerBoundary, 'guard restored only after positive closure');
    if (rejectedClose) await observe('earlier registered cleanup rejection remains reported', () => assert.rejects(dispose(), containsCloseFailure));
    else await observe('registered cleanup completes', dispose);
  }));
});

test('an empty-diff evidence task can enqueue without a task receipt', t => candidateCase(t, async (f, observe) => {
  f.emptyDiff();
  f.tracker.useVerify(() => null, () => [], () => true);
  await observe('fresh task tips', () => f.tracker.refreshFreshness(work => work()));
  await observe('explicit ready edit', () => f.tracker.edit({ ...f.actor, human: true }, 'T-1', { status: 'ready' }));
  const view = { ...f.tracker.view('T-1'), verdictBase: 'dev' };
  const candidate = await observe('empty-diff candidate admission', () => f.queue.candidate(view, work => work()));
  f.queue.cancel(view.id);
  f.queue.enqueue(view, candidate.head, candidate.base, f.actor);
  assert.equal(f.queue.entries().find(entry => entry.item === view.id)?.head, f.heads.get('t/1'));
}));

test('candidate admission cannot borrow readiness from an older cached head', t => candidateCase(t, async (f, observe) => {
  await observe('fresh task tips', () => f.tracker.refreshFreshness(work => work()));
  await observe('explicit ready edit', () => f.tracker.edit({ ...f.actor, human: true }, 'T-1', { status: 'ready' }));
  const view = { ...f.tracker.view('T-1'), verdictBase: 'dev' };
  f.heads.set('t/1', 'f'.repeat(40));
  await observe('moved-head candidate refusal', () => assert.rejects(f.queue.candidate(view, work => work()), /merge-changed.*resolved head/));
}));

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
  await f.tracker.edit({ ...f.actor, human: true }, view.id, { status: 'ready' });
  await f.tracker.refreshFreshness(work => work());
  const candidate = await f.queue.candidate(view, work => work());
  f.queue.cancel(view.id);
  f.queue.enqueue(view, candidate.head, candidate.base, f.actor, candidate.dependencies);
  assert.deepEqual(f.queue.entries().find(entry => entry.item === view.id)?.dependencies,
    change === 'scripts' ? undefined : { files: ['package.json'], command: 'npm install', cwd: f.root });
});
