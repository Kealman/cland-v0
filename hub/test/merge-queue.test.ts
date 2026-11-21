import { fixtureCommand as cland } from './fixture-command.ts';
import { beforeEach } from 'node:test';
import { fixtureNativeGuard } from './fake-native-guard.ts';
import { stageCase } from './stage-case-fixture.ts';
import { ownedDatabases, ownedTracker } from './owned-tracker.ts';
const preflightCase = 'preflight findings and cancellation refuse before queue mutation while fresh requests enqueue';
const timingCase = 'enqueue requires durable exact-head Linux timing proof and allowances before mutation';
const timingConstructorCases = (['tracker', 'store'] as const).map(kind => ({ kind, name: `timing seed retains ${kind} database after constructor and close rejection` }));
const preflightCleanupCase = 'preflight guard stays installed when owned cleanup rejects';
const skippedPreflightCase = 'enqueue records skipped preflight when no verification check is configured';
const protectedReplyCases = ['native', 'retained', 'secondary cleanup', 'oversize', 'oversize secondary'].map(mode => ({ mode, name: `enqueue protects ${mode} rejection at the public reply boundary` }));
const preflightNativeGuard = (t: TestContext) => fixtureNativeGuard(t, { fenced: true });
const cleanupProjectionCases = [false, true].map(rejectConstructor => ({ rejectConstructor,
  name: `queue cleanup projection ${rejectConstructor ? 'joins constructor rejection with captured databases' : 'exposes retained cleanup separately from a blocked batch'}` }));
const ownedGuardAdmissions = new Set<string>();
const batchGitCase = 'the production batch Git adapter preserves whitespace in unknown paths';
beforeEach(async t => {
  if (!('assert' in t)) throw new Error('native guard requires a test context');
  // These exact cases retain the same complete guard through their stronger
  // whole-case positive-close fence; nesting guards would restore out of order.
  if (t.name === timingCase || timingConstructorCases.some(testCase => testCase.name === t.name) || t.name === skippedPreflightCase || t.name === preflightCleanupCase || protectedReplyCases.some(testCase => testCase.name === t.name) || t.name === batchGitCase || cleanupProjectionCases.some(testCase => testCase.name === t.name)) { ownedGuardAdmissions.add(t.name); return; }
  if (t.name === preflightCase) await preflightNativeGuard(t);
  else await fixtureNativeGuard(t);
});
// T2: durable merge queue admission through projectHub and its public merge/task frames.
import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { connectUi, inProcessSpoke, projectHub, tempProject, until, fakeEnqueuePreflight, type ProjectHubOptions } from './harness.ts';
import { manualTips } from './freshness-harness.ts';
import { FakeClock } from './fake-clock.ts';
import { dispatcherSpoke, value } from './validation-support.ts';
import { onCleanup } from './process-cleanup.ts';
import { LocalExecutor } from '../src/executor/local.ts';
import type { Lease, RunRef, RunStatus } from '../src/executor/executor.ts';
import type { VerificationQueue, MergeBatchStatus } from '../src/protocol.ts';
import { parseConfig } from '../src/init/config.ts';
import { Tracker, type ItemView } from '../src/tracker/tracker.ts';
import type { Git } from '../src/tracker/verdict-git.ts';
import { fixtureEnvironment } from './fixture-environment.ts';
import { batchRebuildReason } from '../src/hub/merge-batch-territory.ts';
import { verificationFixture } from './verification-fixture.ts';
import { writeLease, type DropletLease } from '../src/executor/droplet/lease.ts';
import { Store } from '../src/hub/store.ts';
import { caseDeadlines } from './case-deadlines.ts';
import { beforeDirectories, guardDirectoryRemoval, ownDirectory } from './process-cleanup.ts';
import { MergeError } from '../src/merge.ts';
import { TaskMerges } from '../src/hub/merge.ts';
import { DatabaseSync } from 'node:sqlite';
import { fakeNativeGuard } from './fake-native-guard.ts';
import { afterCleanup } from './process-cleanup.ts';
import { HubCore } from '../src/hub/core.ts';
import { completeJournalLines } from './journal-lines.ts';
import { PruneProcesses } from '../src/prune-processes.ts';
import cp from 'node:child_process';
import { drainFixtureCleanup } from './process-cleanup.ts';
import { pruneCase, fakePrune } from './prune-case.ts';
import { SuiteCommandFailure } from '../src/suite-command.ts';
import { EnqueueNativeIncomplete } from '../src/hub/enqueue-preflight.ts';
import { enqueuePreflight } from '../src/hub/enqueue-preflight-native.ts';
import { verificationCommands } from '../src/verification-commands.ts';

test(skippedPreflightCase, t => {
  assert.ok(ownedGuardAdmissions.delete(t.name));
  const scope = stageCase(t);
  let f: Awaited<ReturnType<typeof fixture>> | undefined;
  return scope.wait('whole missing-check admission case', () => scope.run(async step => {
    const open = ownedDatabases(scope, () => f?.stop());
    let removed = 0;
    f = await step(() => scope.wait('fixture setup without verification commands', () => fixture(scope.resources, {
      verification: '', openDatabase: open,
      enqueuePreflight: (root, entry, env) => enqueuePreflight(root, entry, env, {
        prepareMergeBatch: async (_root, _id, members, _env, _provider, base) => ({ base: base!, head: members[0]!.head, tree: 'fixture-tree', cwd: root, budgetLines: [] }),
        checkoutMergeBatch: async () => {}, committedTreeOrThrow: async () => 'fixture-tree', verificationCommands,
        suiteCommand: async () => assert.fail('a skipped check must never execute a command'),
        beginCandidateCommand: async () => assert.fail('a skipped check must never admit a native command owner'),
        forward: () => assert.fail('a skipped check has no command output'), removeMergeBatch: async () => { removed++; },
      }),
    })));
    const result = await step(() => scope.wait('durable skipped-preflight enqueue', () => value<{ item: string; queued: number; preflight?: string }>(f!.ui, { type: 'merge', item: f!.item.id })));
    assert.equal(result.queued, 1);
    assert.equal(result.preflight, 'preflight skipped: no verification check configured');
    assert.equal(removed, 1, 'the prepared candidate still closes before admission');
    const queue = await value<{ entries: Array<{ item: string }> }>(f.ui, { type: 'merge.queue' });
    assert.deepEqual(queue.entries.map(value => value.item), [f.item.id]);
  }));
});

for (const { mode, name } of protectedReplyCases) test(name, t => {
  assert.ok(ownedGuardAdmissions.delete(t.name));
  const scope = stageCase(t);
  let f: Awaited<ReturnType<typeof fixture>> | undefined;
  const retained = Promise.withResolvers<void>();
  scope.releaseOnClose(() => retained.resolve());
  return scope.wait('whole protected rejection case', () => scope.run(async step => {
    const open = ownedDatabases(scope, () => f?.stop());
    const primary = new Error(`Authorization: Bearer ${mode === 'oversize' ? 'synthetic-rejection-value'.repeat(60000) : 'synthetic-rejection-value'}\nsynthetic-source.ts:7: primary finding`);
    const secondary = new Error('token=' + 'synthetic-cleanup-value'.repeat(mode === 'oversize secondary' ? 60000 : 1) + '\nsecondary fixture failure');
    let removals = 0;
    f = await step(() => scope.wait('fixture setup', () => fixture(scope.resources, {
      openDatabase: open,
      enqueuePreflight: (...args) => ({ ...fakeEnqueuePreflight(...args), check: async () => {
        if (mode === 'retained') throw new EnqueueNativeIncomplete('/owned/retained-check', primary, retained.promise);
        throw new SuiteCommandFailure(primary, { state: 'closed', pid: 43001, birth: 'birth', captured: [], unverified: [], nativeClose: { code: 1, signal: null } });
      }, remove: async () => { removals++; if (mode === 'secondary cleanup' || mode === 'oversize secondary') throw secondary; } }),
    })));
    const reply = await step(() => scope.wait('protected public refusal', () => f!.ui.request({ type: 'merge', item: f!.item.id })));
    assert.equal(reply.ok, false);
    const text = reply.error ?? '';
    assert.ok(!text.includes('synthetic-rejection-value'), 'public native/retention error must redact its private primary');
    assert.ok(!text.includes('synthetic-cleanup-value'), 'public secondary cleanup error must be protected');
    assert.ok(Buffer.byteLength(text) <= 38 * 1024, 'public diagnostics have a fixed byte bound');
    if (mode.startsWith('oversize')) assert.match(text, /withheld/);
    if (mode !== 'oversize') assert.match(text, /synthetic-source\.ts:7/);
    if (mode === 'retained') assert.match(text, /checkout retained: \/owned\/retained-check/);
    assert.deepEqual((await value<{ entries: unknown[] }>(f.ui, { type: 'merge.queue' })).entries, []);
    assert.equal(removals, mode === 'retained' ? 0 : 1);
    retained.resolve();
  }));
});

async function checkoutClandFixture(cwd: string) {
  // Fake batch checkouts carry the runner that real cland candidates contain.
  await mkdir(cwd, { recursive: true });
  await verificationFixture(cwd);
}

test(preflightCleanupCase, t => {
  assert.ok(ownedGuardAdmissions.delete(t.name));
  const scope = stageCase(t);
  let allowClose = false;
  const control = { after() {} } as unknown as TestContext;
  scope.releaseOnClose(() => { allowClose = true; });
  scope.requireClose(() => drainFixtureCleanup(control));
  return scope.wait('whole rejected-cleanup case', () => scope.run(async step => {
    onCleanup(control, async () => { if (!allowClose) throw new Error('controlled writer close rejected'); });
    await step(() => scope.wait('native guard setup', () => preflightNativeGuard(control)));
    const guarded = cp.spawn;
    await assert.rejects(() => drainFixtureCleanup(control), /controlled writer close rejected/);
    assert.equal(cp.spawn, guarded, 'rejected close must retain the installed native guard');
    allowClose = true;
    await drainFixtureCleanup(control);
    assert.notEqual(cp.spawn, guarded, 'positive cleanup releases the nested guard');
  }));
});

test(preflightCase, t => {
  const entered = Promise.withResolvers<void>(), release = Promise.withResolvers<void>();
  const scope = caseDeadlines(t, { ownership: { beforeDirectories, guardDirectoryRemoval }, releaseOnClose: () => { release.resolve(); } });
  return scope.wait('owned enqueue case', () => scope.run(async step => {
    let mode: 'red' | 'held' | 'green' = 'red', removals = 0;
    const f = await step(() => scope.wait('fixture setup', () => fixture(scope.fixtures, {
      enqueuePreflight: (...args) => ({ ...fakeEnqueuePreflight(...args),
        check: async () => {
          if (mode === 'held') { entered.resolve(); await release.promise; }
          return { command: 'candidate check', code: mode === 'red' ? 1 : 0, tail: 'src/parser.ts:7: planted finding' };
        },
        remove: async () => { removals++; },
      }),
    }, undefined, undefined, root => scope.adoptRoot(root))));
    const red = await step(() => scope.wait('finding refusal', () => f.ui.request({ type: 'merge', item: f.item.id })));
    assert.equal(red.ok, false);
    assert.match(red.error ?? '', /candidate check: exit 1[\s\S]*src\/parser.ts:7/);
    assert.deepEqual((await value<{ entries: unknown[] }>(f.ui, { type: 'merge.queue' })).entries, []);
    mode = 'held';
    const pending = step(() => scope.wait('cancelled merge receipt', () => f.ui.request({ type: 'merge', item: f.item.id })));
    await scope.wait('check entered', () => entered.promise);
    assert.deepEqual(await value(f.ui, { type: 'merge', item: f.item.id, cancel: true }), { item: f.item.id, cancelled: false });
    release.resolve();
    const cancelled = await pending;
    assert.equal(cancelled.ok, false);
    assert.match(cancelled.error ?? '', /cancelled during preflight/);
    assert.deepEqual((await value<{ entries: unknown[] }>(f.ui, { type: 'merge.queue' })).entries, []);
    mode = 'green';
    assert.deepEqual(await step(() => scope.wait('fresh request enqueue', () => value(f.ui, { type: 'merge', item: f.item.id }))), { item: f.item.id, queued: 1 });
    assert.equal((await value<{ entries: unknown[] }>(f.ui, { type: 'merge.queue' })).entries.length, 1);
    assert.equal(removals, 3);
  }));
});

const timingModes = ['missing', 'wrong OS', 'unknown OS', 'slow', 'allowed', 'existing', 'mixed literal', 'mixed unknown', 'ternary baseline', 'ternary allowance', 'ternary head baseline', 'ternary head allowance'] as const;
type TimingMode = typeof timingModes[number];
const ternaryTiming = { file: 'hub/test/claude-code-remote.test.ts', name: 'Claude TERM-resistant SessionEnd hook is captured and killed by native birth' };
const timingSample = (mode: TimingMode) => mode.startsWith('ternary') ? ternaryTiming : { file: 'hub/test/new.test.ts', name: 'slow case' };
type SeedDatabase = { owner: Pick<ReturnType<typeof stageCase>, 'requireClose'>; open(kind: 'tracker' | 'store', path: string): DatabaseSync };
async function timingFixture(scope: ReturnType<typeof stageCase>, mode: TimingMode, native: Partial<Pick<SeedDatabase, 'open'>> = {}, adopt?: (root: string) => void) {
  const head = 'b'.repeat(40);
  const receipt = { run: 'timing-proof', head, tree: head, platform: 'linux', command: 'true', step: 'test', samples: [{ ...timingSample(mode), seconds: 4, outcome: 'pass' as const }] };
  const databases: SeedDatabase = { owner: scope, open: native.open ?? ((_kind, path) => new DatabaseSync(path)) };
  return fixture(scope.fixtures, { seedDatabase: databases }, undefined, async tracker => {
    if (mode === 'missing') return;
    let store: Store | undefined, closed = false;
    const close = () => { if (store && !closed) { store.close(); closed = true; } };
    const open = ownedDatabases(scope, () => store ? Promise.resolve().then(close) : undefined);
    store = new Store(join(tracker.root, '.cland/hub.db'), path => open(path, path => databases.open('store', path)));
    try {
      store.setMeta('suite-job:timing-proof', JSON.stringify({ position: 0, job: {
        id: receipt.run, head, tree: head, executor: 'droplet', branch: 't/parser', cwd: tracker.root, topic: 'agents', to: [], actor: { name: 'fixture', sessionId: 'fixture', shell: true }, mode: 'auto',
        log: join(tracker.root, '.cland/run/suites/timing-proof/suite.log'), result: join(tracker.root, '.cland/run/suites/timing-proof/result.json'), gate: join(tracker.root, '.cland/run/suites/timing-proof/ready'),
        pid: null, started: null, outcome: { code: 0, cause: '' }, state: 'finished', reported: true, cleaned: true, error: null, artifact: null,
        ...(mode === 'unknown OS' ? {} : { platform: { os: mode === 'wrong OS' ? 'darwin' : 'linux', arch: 'fixture', release: 'fixture', node: 'fixture', nvim: 'none' } }),
        timingReceipts: [receipt], timingSummary: [{ ...receipt, samples: 1 }],
      } }));
    } finally { close(); }
  }, root => { scope.adoptRoot(root); adopt?.(root); });
}

test(timingCase, t => {
  assert.ok(ownedGuardAdmissions.delete(t.name));
  const scope = stageCase(t);
  return scope.run(async step => {
    const head = 'b'.repeat(40), base = 'a'.repeat(40);
    for (const mode of timingModes) {
      const { file, name } = timingSample(mode), key = `${file}::${name}`;
      const f = await step(() => scope.wait(`${mode} fixture`, () => timingFixture(scope, mode)));
      f.manifests.set(`${head}:hub/test/durations.json`, JSON.stringify({ version: 1, source: { artifacts: [], commit: base }, budget: { testSeconds: 5, fileSeconds: 60 }, tests: mode === 'ternary head baseline' ? { [key]: 6.35 } : {}, files: {}, allow: mode === 'allowed' || mode === 'ternary head allowance' ? { [key]: { seconds: 6, reason: 'measured' } } : {} }));
      if (mode === 'existing') f.manifests.set(`${base}:${file}`, "test('slow case', () => {});");
      if (mode === 'mixed literal') f.manifests.set(`${base}:${file}`, "test('slow case', () => {}); for (const label of ['a', 'b']) test(label + ' case', () => {});");
      if (mode === 'mixed unknown') f.manifests.set(`${base}:${file}`, "test('other case', () => {}); for (const label of ['a', 'b']) test(label + ' case', () => {});");
      if (mode.startsWith('ternary')) {
        f.manifests.set(`${base}:${file}`, "for (const asynchronous of [false, true]) test(asynchronous ? 'Claude hook born across root exit remains unacquired' : 'Claude TERM-resistant SessionEnd hook is captured and killed by native birth', () => {});");
        f.manifests.set(`${base}:hub/test/durations.json`, JSON.stringify({ version: 1, source: { artifacts: [], commit: base }, budget: { testSeconds: 5, fileSeconds: 60 }, tests: mode === 'ternary baseline' ? { [key]: 6.35 } : {}, files: {}, allow: mode === 'ternary allowance' ? { [key]: { seconds: 15.69, reason: 'measured', owner: 'E-880' } } : {} }));
      }
      const result = await step(() => scope.wait(`${mode} admission receipt`, () => f.ui.request({ type: 'merge', item: f.item.id })));
      const queue = await value<{ entries: unknown[] }>(f.ui, { type: 'merge.queue' });
      if (mode === 'missing' || mode === 'wrong OS' || mode === 'unknown OS' || mode === 'slow' || mode === 'mixed unknown' || mode === 'ternary head baseline' || mode === 'ternary head allowance') {
        assert.equal(result.ok, false);
        assert.match(result.error ?? '', mode === 'mixed unknown' || mode.startsWith('ternary head') ? /new timing identity unknown in base source/ : mode !== 'slow' ? /missing exact-head Linux timing receipt/ : /4 s or more require allowances/);
        if (mode === 'slow') { assert.match(result.error ?? '', /"seconds": 6/); assert.ok(result.error?.includes(key)); }
        assert.deepEqual(queue.entries, []);
      } else { assert.equal(result.ok, true, result.error); assert.equal(queue.entries.length, 1); }
    }
  });
});

for (const { kind, name } of timingConstructorCases) test(name, async t => {
  assert.ok(ownedGuardAdmissions.delete(t.name));
  const scope = stageCase(t);
  const captured = new Set<DatabaseSync>();
  const nativeClose = new Map<DatabaseSync, () => void>();
  const primary = new Error(`injected ${kind} constructor rejection`), secondary = new Error('injected database close rejection');
  const observerFailure = new Error('capture observer retains unclosed database');
  const onlyObserverFailure = (error: unknown): boolean => error === observerFailure
    || error instanceof AggregateError && error.errors.length > 0 && error.errors.every(onlyObserverFailure);
  let root = '', blocked = true, faulted = false, boundary: unknown;
  // Rescue only after the original control has settled, including its red round.
  // This cannot supply the body's positive-close assertions.
  t.after(async () => {
    blocked = false;
    try { await scope.close(); } catch (error) { if (!faulted || !onlyObserverFailure(error)) throw error; }
    for (const db of captured) if (db.isOpen) nativeClose.get(db)!();
    assert.ok([...captured].every(db => !db.isOpen));
    await scope.close();
    await scope.restore();
  });
  await scope.run(async step => {
    boundary = scope.nativeBoundary();
    await step(() => scope.wait('constructor rejection receipt', () => assert.rejects(() => timingFixture(scope, 'slow', { open: (opened, path) => {
      const db = new DatabaseSync(path);
      if (opened !== kind) return db;
      captured.add(db); nativeClose.set(db, db.close.bind(db));
      const exec = db.exec.bind(db); let calls = 0;
      scope.patch(db, 'exec', (sql: string) => { if (++calls === 2) { faulted = true; throw primary; } return exec(sql); });
      scope.patch(db, 'close', () => { if (blocked) throw secondary; nativeClose.get(db)!(); });
      return db;
    } }, acquired => {
      root = acquired;
      guardDirectoryRemoval(root, () => { if ([...captured].some(db => db.isOpen)) throw observerFailure; });
    }), error => error === primary)));
    assert.equal(faulted, true);
    assert.equal(captured.size, 1);
  });
  await assert.rejects(scope.close(), error => error === secondary);
  await assert.rejects(scope.restore(), /close unconfirmed/);
  assert.equal(scope.nativeBoundary(), boundary, 'the positively controlled launch guard remains installed');
  assert.ok([...captured].every(db => db.isOpen));
  const remove = ownDirectory(undefined, root);
  await assert.rejects(remove(), error => error instanceof AggregateError
    && error.errors.some(error => error instanceof Error && error.message === 'stage resource close unconfirmed; root retained')
    && error.errors.includes(observerFailure));
  assert.equal((await stat(root)).isDirectory(), true);
  blocked = false;
  await scope.close();
  assert.ok([...captured].every(db => !db.isOpen));
  await scope.restore();
  await remove();
  await assert.rejects(stat(root), { code: 'ENOENT' });
});

async function fixture(t: TestContext, options: ProjectHubOptions & { verification?: string; seedDatabase?: SeedDatabase } = {}, files = ['hub/src/parser.ts'], seed?: (tracker: Tracker) => Promise<void>, adoptRoot?: (root: string) => void, captureDispose?: (dispose: () => Promise<void>) => void) {
  const { verification = 'test="true"', seedDatabase, ...hubOptions } = options;
  const root = await tempProject(t);
  adoptRoot?.(root);
  await mkdir(join(root, '.cland'), { recursive: true });
  const repository = parseConfig(await readFile(new URL('../../.cland/config.toml', import.meta.url), 'utf8'), 'repository', {});
  await writeFile(join(root, '.cland/config.toml'), `[merge]\nqueue = ${repository.merge.queue}\n[verification]\n${verification}\n`);
  const clock = new FakeClock();
  const tips = manualTips();
  const heads = new Map([['dev', 'a'.repeat(40)], ['t/parser', 'b'.repeat(40)]]);
  const surfaces = new Map<string, string[]>();
  const manifests = new Map<string, string>();
  const history = { read: undefined as (() => string | null) | undefined };
  const git: Git = async (args, input) => {
    if (args[0] === 'for-each-ref') return [...heads].map(([branch, head]) => `${head} refs/heads/${branch}`).join('\n');
    if (args[0] === 'show-ref' && args.includes('--exclude-existing=refs/heads/')) return input!.trim().split('\n').filter(ref => !heads.has(ref.slice('refs/heads/'.length))).join('\n');
    if (args[0] === 'rev-parse') {
      const ref = args.at(-1)!.replace(/^refs\/heads\//, '').replace(/\^\{commit\}$/, '');
      return heads.get(ref) ?? ([...heads.values()].includes(ref) ? ref : null);
    }
    if (args[0] === 'merge-base') return 'a'.repeat(40);
    if (args[0] === 'diff') return args.includes('--name-only') ? files.join('\0') + '\0' : 'parser patch';
    if (args[0] === 'show') return manifests.get(args.at(-1)!) ?? null;
    if (args[0] === 'ls-tree') {
      const ref = args[args.indexOf('--') - 1]!;
      return args.slice(args.indexOf('--') + 1).filter(file => manifests.has(`${ref}:${file}`)).join('\0');
    }
    if (args[0] === 'patch-id') return 'stable-patch';
    if (args[0] === 'log') return args.includes('--raw') && history.read ? history.read() : [...surfaces].map(([item, paths]) => `${'c'.repeat(40)}\0${item}\0\0${paths.map(path => `\n:100644 100644 ${'a'.repeat(40)} ${'b'.repeat(40)} M\0${path}\0`).join('')}`).join('\0');
    return null;
  };
  if (seed) {
    // Seed durable landed history through the tracker before the serving hub opens it.
    const trackerOptions = { root, db: join(root, '.cland/hub.db'), clock, git, stageTree: async () => 'fixture-stage-tree', readBase: async () => 'dev', env: fixtureEnvironment(root, process.env) };
    const tracker = seedDatabase
      ? ownedTracker(seedDatabase.owner, { ...trackerOptions, openDatabase: path => seedDatabase.open('tracker', path) })
      : new Tracker(trackerOptions);
    try { await seed(tracker); } finally { await tracker.stop(); }
  }
  const { discovery, dispatcher, stop, fakes, dispose } = await projectHub(t, root, {}, { clock, stageTree: async () => 'fixture-stage-tree', scheduleTips: tips.scheduleTips, readBase: async () => 'dev', git, ...hubOptions });
  captureDispose?.(dispose);
  await tips.refresh();
  const ui = await connectUi(t, discovery);
  const rev = await inProcessSpoke(t, { discover: true, cwd: root, name: 'rev', sessionId: 'review-id', role: 'reviewer' });
  const { item } = await value<{ item: ItemView }>(ui, { type: 'task.create', title: 'Parser', size: 'M', branch: 't/parser' });
  assert.equal((await rev.call<{ ok: boolean }>('task.comment', { id: item.id, verdict: 'review', scope: 'full', result: 'clear', run: 'review-1' })).ok, true);
  await until(async () => { await clock.advance(100); return (await value<{ item: ItemView }>(ui, { type: 'task.view', item: item.id })).item.status === 'ready'; }, { what: 'reviewed task ready', timeoutMs: 1500 });
  return { root, ui, dispatcher, item, clock, heads, surfaces, manifests, history, rev, tips, stop, fakes, enqueuedAt: clock.now().toISOString() };
}

for (const { rejectConstructor, name } of cleanupProjectionCases) test(name, t => {
  assert.ok(ownedGuardAdmissions.delete(name), 'file hook must delegate this exact case to its owned native guard');
  const scope = caseDeadlines(t, { ownership: { beforeDirectories, guardDirectoryRemoval } });
  const databases = new Set<DatabaseSync>();
  let guard: Awaited<ReturnType<typeof fakeNativeGuard>> | undefined, restore: (() => void) | undefined;
  let bodyClosed = false, ownerReturned = false, ownerClosed = false, restored = false, refuseClose = true;
  let registered = 0, completed = 0, root = '';
  let seededNotice = false;
  let closeReturnedOwner: (() => Promise<void>) | undefined;
  const captured = new Proxy(scope.fixtures, { get(target, key) {
    if (key === 'after') return (close: () => unknown) => {
      registered++;
      scope.fixtures.after(async () => { await close(); completed++; });
    };
    const value = Reflect.get(target, key, target);
    return typeof value === 'function' ? value.bind(target) : value;
  } });
  const finalize = () => {
    assert.ok(bodyClosed, 'original setup/body must join before guard restoration');
    assert.ok(!ownerReturned || ownerClosed, 'returned hub resource closure incomplete; retain databases and native guard');
    assert.equal(completed, registered, 'registered cleanup must complete positively before fallback');
    // Only a rejected constructor with no returned owner permits fallback closure.
    if (!ownerReturned) for (const db of databases) if (db.isOpen) db.close();
    assert.ok([...databases].every(db => !db.isOpen), 'all constructor-captured databases closed');
    try { guard?.verify(); } finally { restore?.(); restored = true; }
  };
  afterCleanup(t, finalize);
  if (!rejectConstructor) captured.after(async () => {
    assert.ok(closeReturnedOwner);
    // Registered cleanup observes a rejected owner before its later positive retry.
    await assert.rejects(closeReturnedOwner!, /owner close rejection/);
    assert.throws(finalize, /returned hub resource closure incomplete/);
    assert.ok([...databases].some(db => db.isOpen), 'rejected closure retains live owner databases');
    assert.equal(restored, false, 'guard remains active across rejected closure');
    assert.equal((await stat(root)).isDirectory(), true);
    refuseClose = false;
  });
  return scope.run(async step => {
  try {
  guard = await step(() => scope.wait('native guard setup', () => fakeNativeGuard(fn => { restore = fn; })));
  const acquiring = () => fixture(captured, { lockIdentity: { hostname: 'fixture-host', bootId: 'fixture-boot', pidNamespace: null }, openDatabase: path => {
    const db = new DatabaseSync(path); databases.add(db); // Capture before any wrapper constructor can reject.
    if (rejectConstructor) throw new Error('injected constructor rejection after capture');
    db.exec('create table if not exists meta (key text primary key, value text not null)');
    db.prepare('insert into meta(key,value) values (?,?) on conflict(key) do nothing').run('merge-batch-cleanups', JSON.stringify([{ batch: { id: 'landed', members: [{ item: 'T-8000', branch: '', head: 'a'.repeat(40), verdictBase: '', enqueued: '', by: { id: 'review-id', name: 'old-review-name', role: 'reviewer' } }] }, candidate: { cwd: '/scratch/landed-candidate' }, error: 'ps unavailable', attempts: 2, retryAt: '2099-01-01T00:00:00.000Z' }]));
    if (!seededNotice) {
      db.prepare('insert into meta(key,value) values (?,?)').run('merge-cleanup-notice:recorded', JSON.stringify({ batch: { id: 'recorded-overflow', members: [{ item: 'T-8000', branch: '', head: 'a'.repeat(40), verdictBase: '', enqueued: '', by: { id: 'review-id', name: 'old-review-name', role: 'reviewer' } }] }, text: 'UNRESOLVED cleanup overflow: recorded owned candidate', phase: 'cleanup:overflow:recorded:T-8000' }));
      seededNotice = true;
    }
    return db;
  } }, undefined, undefined, acquiredRoot => { root = acquiredRoot; scope.adoptRoot(root); }, dispose => {
    ownerReturned = true;
    closeReturnedOwner = async () => {
      if (refuseClose) throw new Error('injected owner close rejection');
      await dispose(); ownerClosed = true;
    };
    captured.after(closeReturnedOwner);
  });
  if (rejectConstructor) {
    await step(() => scope.wait('projection constructor rejection', () => assert.rejects(acquiring(), /injected constructor rejection after capture/)));
    assert.ok(databases.size > 0, 'positive constructor acquisition receipt');
    return;
  }
  const { ui, clock } = await step(() => scope.wait('projection fixture setup', acquiring));
  const expected = [{ candidate: { cwd: '/scratch/landed-candidate' }, error: 'ps unavailable', retryAt: '2099-01-01T00:00:00.000Z' }];
  const queue = await step(() => scope.wait('public merge queue', () => value<{ batch: unknown; cleanups: unknown[] }>(ui, { type: 'merge.queue' })));
  assert.equal(queue.batch, null);
  assert.deepEqual(queue.cleanups, expected);
  const status = await step(() => scope.wait('public hub status', () => value<{ verification: { cleanups: unknown[] } }>(ui, { type: 'hub.status' })));
  assert.deepEqual(status.verification.cleanups, expected);
  await step(() => scope.wait('old requester name reused', () => inProcessSpoke(captured, { discover: true, cwd: root, name: 'old-review-name', sessionId: 'replacement-id' })));
  let delivered: { id: string; text: string; to: string[] } | undefined;
  let ordinary: { id: string; text: string; to: string[] } | undefined;
  const receiving = scope.wait('captured cleanup requester publication', () => until(async () => {
    const history = await value<{ messages: { id: string; text: string; to: string[] }[] }>(ui, { type: 'topic.history', topic: 'agents', limit: 100 });
    delivered = history.messages.find(message => message.text === 'UNRESOLVED cleanup overflow: recorded owned candidate' && message.to.includes('rev'));
    ordinary = history.messages.find(message => message.text.startsWith('batch landed cleanup follow-up:') && message.to.includes('rev'));
    return !!delivered && !!ordinary;
  }, { what: 'overflow notice for captured requester under current name', timeoutMs: 1500 }).catch(async error => {
    const db = [...databases].find(db => db.isOpen);
    const diagnostic = db?.prepare("select key,value from meta where key in ('merge-batch-publication-error','merge-cleanup-notice-cursor','merge-cleanup-notice:recorded')").all();
    const history = await value<{ messages: { text: string; to: string[] }[] }>(ui, { type: 'topic.history', topic: 'agents', limit: 10 });
    throw new Error(`${String(error)}; retained diagnostic ${JSON.stringify(diagnostic)}; notices ${JSON.stringify(history.messages.map(message => ({ text: message.text, to: message.to })))}`);
  }));
  void receiving.catch(() => {});
  await step(() => clock.advance(1000));
  await step(() => receiving);
  assert.ok(delivered?.id);
  assert.ok(delivered!.to.includes('rev'));
  assert.ok(!delivered!.to.includes('old-review-name'));
  assert.ok(ordinary?.id);
  assert.ok(!ordinary!.to.includes('old-review-name'));
  } finally { bodyClosed = true; }
  });
});

function demoLease(clock: FakeClock, epic: string): DropletLease {
  return {
    kind: 'droplet', provider: 'digitalocean', lease: 'demo-fixture', name: 'demo-fixture', tags: ['cland'],
    run: 'demo-fixture', created: clock.now().toISOString(), deadline: new Date(clock.now().getTime() + 60_000).toISOString(),
    state: 'active', resource: 1, keyId: null, keyName: 'fixture', size: 'fixture', region: 'fixture', priceHourly: 0,
    demo: { epic, commit: 'a'.repeat(40), ready: true },
  };
}

test('enqueue warns about exact landed files of an epic with an active demo without blocking', async t => {
  const { root, ui, item, clock, surfaces } = await fixture(t, {}, ['hub/src/parser.ts', 'hub/src/other.ts']);
  await inProcessSpoke(t, { discover: true, cwd: root, name: 'coord', sessionId: 'coord-id', role: 'coordinator' });
  const impl = await inProcessSpoke(t, { discover: true, cwd: root, name: 'impl', sessionId: 'impl-id', role: 'implementer' });
  await value(ui, { type: 'task.edit', item: item.id, assignee: 'impl' });
  const claim = await impl.call<{ ok: boolean; error?: string }>('task.claim', { id: item.id });
  assert.equal(claim.ok, true, claim.error);
  const epic = (await value<{ item: ItemView }>(ui, { type: 'task.create', title: 'Demo epic', kind: 'epic' })).item;
  const child = (await value<{ item: ItemView }>(ui, { type: 'task.create', title: 'Demo surface', size: 'S', parent: epic.id })).item;
  surfaces.set(child.id, ['hub/src/parser.ts', 'hub/src/demo-only.ts']);
  const { topic } = await value<{ topic: { id: string } }>(ui, { type: 'topic.create', title: 'Candidate', item: item.id });
  await writeLease(root, demoLease(clock, epic.id));
  assert.deepEqual(await value(ui, { type: 'merge', item: item.id }), { item: item.id, queued: 1 });
  const history = await value<{ messages: Array<{ text: string; to: string[] }> }>(ui, { type: 'topic.history', topic: topic.id, limit: 100 });
  const warning = history.messages.find(message => message.text.startsWith('merge-demo-warning'));
  assert.equal(warning?.text, `merge-demo-warning ${item.id}: ${epic.id} demo running; overlapping files: hub/src/parser.ts. Landing may make the demo stale.`);
  assert.ok(warning.to.includes('coord'));
  assert.ok(warning.to.includes('impl'));
  assert.equal((await value<{ entries: unknown[] }>(ui, { type: 'merge.queue' })).entries.length, 1);
});

for (const mode of ['due', 'stage-only', 'building', 'recorded', 'recorded-active', 'expired', 'released', 'closed', 'unlanded', 'unrelated'] as const) test(`enqueue demo warning: ${mode}`, async t => {
  let epic!: ItemView, child!: ItemView;
  const human = { id: 'human', name: 'human', role: null, human: true };
  const { root, ui, item, clock, surfaces } = await fixture(t, {}, ['hub/src/parser.ts'], async tracker => {
    epic = await tracker.create(human, { title: 'Pending demo', kind: 'epic' });
    child = await tracker.create(human, { title: 'Landed surface', size: 'S', parent: epic.id });
    await tracker.close(human, child.id);
    if (mode !== 'unlanded') tracker.recordMerge(child.id, { commit: 'c'.repeat(40), base: 'dev', branch: 't/demo', tip: 'd'.repeat(40) });
    if (mode === 'building') await tracker.create(human, { title: 'Still building', size: 'S', parent: epic.id });
    if (mode === 'stage-only') {
      await tracker.setPlan(human, epic.id, JSON.stringify({ stages: [{ name: 'Done stage', qa: { scope: 'affected', when: 'after-stage' }, lanes: [[child.id]] }] }));
      await tracker.comment({ id: 'qa', name: 'qa', role: 'qa' }, epic.id, 'Stage complete', { verdict: 'qa', result: 'clear', run: 'stage-recorded', stage: 'Done stage', commit: 'a'.repeat(40) });
    }
    if (['recorded', 'recorded-active', 'expired', 'released'].includes(mode)) await tracker.comment({ id: 'qa', name: 'qa', role: 'qa' }, epic.id, 'Demo complete', { verdict: 'qa', result: 'clear', run: 'demo-recorded', commit: 'a'.repeat(40) });
    if (mode === 'closed') await tracker.close(human, epic.id, 'Closed demo', undefined, undefined, 'fixture closure');
  });
  surfaces.set(child.id, [mode === 'unrelated' ? 'hub/src/demo-only.ts' : 'hub/src/parser.ts']);
  if (['recorded-active', 'expired', 'released'].includes(mode)) {
    // A new demo starts after the already-recorded verdict, avoiding its automatic lease cleanup.
    await clock.advance(1);
    await writeLease(root, { ...demoLease(clock, epic.id), ...(mode === 'expired' ? { deadline: clock.now().toISOString() } : {}), state: mode === 'released' ? 'released' : 'active' });
  }
  const { topic } = await value<{ topic: { id: string } }>(ui, { type: 'topic.create', title: 'Candidate', item: item.id });
  assert.deepEqual(await value(ui, { type: 'merge', item: item.id }), { item: item.id, queued: 1 });
  const history = await value<{ messages: Array<{ text: string }> }>(ui, { type: 'topic.history', topic: topic.id, limit: 100 });
  assert.deepEqual(history.messages.filter(message => message.text.startsWith('merge-demo-warning')).map(message => message.text), ['due', 'stage-only', 'recorded-active'].includes(mode) ? [
    `merge-demo-warning ${item.id}: ${epic.id} demo ${mode === 'recorded-active' ? 'running' : 'due'}; overlapping files: hub/src/parser.ts. Landing may make the demo stale.`,
  ] : []);
});

for (const fault of ['lease', 'history-unavailable', 'history-malformed', 'history-throw'] as const) test(`enqueue survives unavailable demo diagnostics: ${fault}`, async t => {
  let epic!: ItemView;
  const human = { id: 'human', name: 'human', role: null, human: true };
  const { root, ui, item, history } = await fixture(t, {}, ['hub/src/parser.ts'], async tracker => {
    epic = await tracker.create(human, { title: 'Demo due', kind: 'epic' });
    const child = await tracker.create(human, { title: 'Landed task', size: 'S', parent: epic.id });
    await tracker.close(human, child.id);
    tracker.recordMerge(child.id, { commit: 'c'.repeat(40), base: 'dev', branch: 't/demo', tip: 'd'.repeat(40) });
  });
  if (fault === 'lease') {
    const damaged = join(root, '.cland/run/executor/leases/damaged');
    await mkdir(damaged, { recursive: true });
    await writeFile(join(damaged, 'lease.json'), '{}');
    // Corrupt an indexed live record: cold directories are no longer enumerated.
    const indexPath = join(root, '.cland/run/executor/lease-index.json');
    const index = JSON.parse(await readFile(indexPath, 'utf8').catch(() => '{"version":1,"leases":[]}'));
    await writeFile(indexPath, JSON.stringify({ ...index, leases: [...index.leases, 'damaged'] }));
  } else history.read = () => {
    if (fault === 'history-throw') throw new Error('fixture Git read failed');
    return fault === 'history-unavailable' ? null : 'malformed history';
  };
  const { topic } = await value<{ topic: { id: string } }>(ui, { type: 'topic.create', title: 'Candidate', item: item.id });
  assert.deepEqual(await value(ui, { type: 'merge', item: item.id }), { item: item.id, queued: 1 });
  assert.equal((await value<{ entries: unknown[] }>(ui, { type: 'merge.queue' })).entries.length, 1);
  const messages = (await value<{ messages: Array<{ text: string }> }>(ui, { type: 'topic.history', topic: topic.id, limit: 100 })).messages;
  assert.ok(messages.some(message => message.text === `merge-demo-warning-unavailable ${item.id}: ${fault === 'lease' ? 'demo leases unavailable' : `${epic.id} landed files unavailable`}. Enqueue succeeded.`));
});

test('startup clears a persisted all-landed blocked batch through the public queue frame', async t => {
  const cleaned: string[] = [];
  const { ui } = await fixture(t, { batchRepository: {
    git: async () => assert.fail('terminal recovery must not prepare Git'),
    facts: async () => assert.fail('terminal recovery must not inspect budgets'),
    identity: async () => assert.fail('terminal recovery must not inspect trees'),
    checkout: async () => assert.fail('terminal recovery must not check out'),
    remove: async candidate => { cleaned.push(candidate.cwd); },
  } }, undefined, async tracker => {
    const actor = { id: 'human', name: 'human', role: null, human: true };
    const item = await tracker.create(actor, { title: 'Already landed', size: 'S', branch: 't/landed' });
    tracker.recordMerge(item.id, { commit: 'c'.repeat(40), base: 'dev', branch: 't/landed', tip: 'd'.repeat(40) });
    await tracker.close(actor, item.id);
    const store = new Store(join(tracker.root, '.cland/hub.db'));
    try {
      store.setMeta('merge-batch', JSON.stringify({ id: 'old-blocked',
        members: [{ item: item.id, branch: 't/landed', head: 'd'.repeat(40), verdictBase: 'dev', enqueued: '2026-10-16T12:00:00Z', by: actor }],
        failed: 'merged, follow-up failed: stop sessions: ps failed or timed out',
        candidate: { base: 'base', head: 'head', tree: 'tree', cwd: join(tracker.root, 'old-candidate'), budgetLines: [] },
      }));
    } finally { store.close(); }
  });
  await until(() => cleaned.length === 1, { what: 'persisted terminal candidate cleanup receipt', timeoutMs: 1500 });
  assert.match(cleaned[0]!, /old-candidate$/);
  assert.equal((await value<{ batch: MergeBatchStatus | null }>(ui, { type: 'merge.queue' })).batch, null);
});

test('hub serves queue and status frames after its batch blocked notice throws', async t => {
  const logs: Record<string, unknown>[] = [];
  const { ui, item, clock } = await fixture(t, {
    log: entry => { logs.push(entry); },
    batchRepository: {
      git: async () => { throw new Error('candidate preparation failed'); },
      facts: async () => assert.fail('failed preparation cannot read facts'),
      identity: async () => assert.fail('failed preparation cannot identify a tree'),
      checkout: async () => assert.fail('failed preparation cannot check out'),
      remove: async () => {},
    },
  });
  const noticeTo = HubCore.prototype.noticeTo;
  t.mock.method(HubCore.prototype, 'noticeTo', function (this: HubCore, ...args: Parameters<typeof noticeTo>) {
    if (args[1].detail?.event === 'merge-batch-result') throw new Error('report boundary failed');
    return noticeTo.apply(this, args);
  });
  await value(ui, { type: 'merge', item: item.id });
  await clock.advance(601_000);
  await until(() => logs.some(entry => entry.event === 'merge-batch-report-failed'), { what: 'batch report failure logged', timeoutMs: 1500 });
  const queue = await value<{ entries: Array<{ item: string }>; batch: MergeBatchStatus }>(ui, { type: 'merge.queue' });
  assert.deepEqual(queue.entries.map(entry => entry.item), [item.id]);
  assert.equal(queue.batch.failed, 'candidate preparation failed');
  assert.ok(logs.some(entry => entry.event === 'merge-batch-report-failed' && entry.error === 'report boundary failed'));
  const status = await value<{ mergeQueue: unknown[] }>(ui, { type: 'hub.status', history: true });
  assert.equal(status.mergeQueue.length, 1);
});

test('merge queue carries the root install requirement for dependency changes', async t => {
  const { root, ui, item } = await fixture(t, {}, ['package.json', 'hub/package.json', 'package-lock.json']);
  await value(ui, { type: 'merge', item: item.id });
  const queue = await value<{ entries: Array<{ dependencies?: unknown }> }>(ui, { type: 'merge.queue' });
  assert.deepEqual(queue.entries[0]?.dependencies, { files: ['hub/package.json', 'package-lock.json', 'package.json'], command: 'npm install', cwd: root });
  const shown = await cland(root, 'merge', 'queue');
  assert.equal(shown.code, 0, shown.stderr);
  assert.match(shown.stdout, /hub\/package.json, package-lock.json, package.json changed; run npm install in root/);
  assert.ok(shown.stdout.includes(root));
});

test('startup preserves the durable queue when branch enumeration omits a live ref', async t => {
  const { root, ui, item, clock, heads, stop } = await fixture(t);
  await value(ui, { type: 'merge', item: item.id });
  const expected = (await value<{ entries: unknown[] }>(ui, { type: 'merge.queue' })).entries;
  await stop();
  const tips = manualTips();
  const reopened = await projectHub(t, root, {}, { clock, scheduleTips: tips.scheduleTips, readBase: async () => 'dev', git: async (args, input) => {
    // A successful but partial listing is indistinguishable from deletion on its own.
    if (args[0] === 'for-each-ref') return `${heads.get('dev')} refs/heads/dev`;
    if (args[0] === 'show-ref' && args.includes('--exclude-existing=refs/heads/')) {
      return input!.trim().split('\n').filter(ref => !heads.has(ref.replace(/^refs\/heads\//, ''))).join('\n');
    }
    if (args[0] === 'rev-parse') return heads.get(args.at(-1)!.replace(/^refs\/heads\//, '').replace(/\^\{commit\}$/, '')) ?? null;
    return null;
  } });
  const reconnected = await connectUi(t, reopened.discovery);
  assert.deepEqual((await value<{ mergeQueue: unknown[] }>(reconnected, { type: 'hub.status', history: true })).mergeQueue, expected);
  assert.deepEqual((await value<{ entries: unknown[] }>(reconnected, { type: 'merge.queue' })).entries, expected);
});

test('reviewed code is queued without landing and visible through task view and queue', async t => {
  const { ui, item, enqueuedAt } = await fixture(t);
  const result = await value<{ item: string; queued: number }>(ui, { type: 'merge', item: item.id });
  assert.deepEqual(result, { item: item.id, queued: 1 });
  const viewed = (await value<{ item: ItemView & { mergeQueue: { position: number; enqueued: string } } }>(ui, { type: 'task.view', item: item.id })).item;
  assert.equal(viewed.status, 'ready');
  assert.equal(viewed.state, 'open');
  assert.deepEqual(viewed.mergeQueue, { position: 1, enqueued: enqueuedAt });
  const queue = await value<{ entries: Array<{ item: string; head: string }> }>(ui, { type: 'merge.queue' });
  assert.equal(queue.entries[0]?.item, item.id);
  assert.equal(queue.entries[0]?.head, 'b'.repeat(40));
});

test('cancel drops the queued entry with a notice to requester and lead', async t => {
  const { root, ui, item } = await fixture(t);
  const coordinator = await inProcessSpoke(t, { discover: true, cwd: root, name: 'coord', sessionId: 'coord-id', role: 'coordinator' });
  const impl = await inProcessSpoke(t, { discover: true, cwd: root, name: 'impl', sessionId: 'impl-id', role: 'implementer' });
  const { topic } = await value<{ topic: { id: string } }>(ui, { type: 'topic.create', title: 'Parser queue', item: item.id });
  await value(ui, { type: 'task.edit', item: item.id, assignee: 'impl' });
  assert.equal((await impl.call<{ ok: boolean }>('task.claim', { id: item.id })).ok, true);
  const queued = await coordinator.call<{ ok: boolean; queued: number }>('merge', { item: item.id });
  assert.equal(queued.queued, 1);
  assert.equal((await coordinator.call<{ entries: unknown[] }>('merge.queue')).entries.length, 1);
  assert.equal((await value<{ entries: unknown[] }>(ui, { type: 'merge.queue' })).entries.length, 1);
  const refused = await impl.call<{ ok: boolean; code: string }>('merge', { item: item.id, cancel: true });
  assert.equal(refused.code, 'forbidden');
  assert.equal((await value<{ entries: unknown[] }>(ui, { type: 'merge.queue' })).entries.length, 1);
  const cancelled = await coordinator.call<{ ok: boolean; cancelled: boolean }>('merge', { item: item.id, cancel: true });
  assert.equal(cancelled.cancelled, true);
  assert.deepEqual((await value<{ entries: unknown[] }>(ui, { type: 'merge.queue' })).entries, []);
  const history = await value<{ messages: Array<{ text: string; to: string[] }> }>(ui, { type: 'topic.history', topic: topic.id, limit: 100 });
  assert.ok(history.messages.some(message => /merge-queue-dropped.*cancelled/.test(message.text) && message.to.includes('coord') && message.to.includes('impl')));
});

test('changed heads, not-clear verdicts and closed items drop pinned requests', async t => {
  const { ui, item, rev, heads, clock, tips } = await fixture(t);
  for (const change of ['head', 'verdict', 'closed'] as const) {
    if (change !== 'head') {
      assert.equal((await rev.call<{ ok: boolean }>('task.comment', { id: item.id, verdict: 'review', scope: 'full', result: 'clear', run: `clear-${change}` })).ok, true);
      await until(async () => { await clock.advance(100); return (await value<{ item: ItemView }>(ui, { type: 'task.view', item: item.id })).item.status === 'ready'; }, { what: 'new reviewed head ready', timeoutMs: 1500 });
    }
    await value(ui, { type: 'merge', item: item.id });
    if (change === 'head') {
      heads.set('t/parser', 'c'.repeat(40));
      await tips.refresh();
    }
    if (change === 'verdict') assert.equal((await rev.call<{ ok: boolean }>('task.comment', { id: item.id, verdict: 'review', scope: 'full', result: 'not clear', run: 'rejected' })).ok, true);
    if (change === 'closed') await value(ui, { type: 'task.close', item: item.id });
    const history = await value<{ messages: Array<{ text: string }> }>(ui, { type: 'topic.history', topic: 'agents', limit: 100 });
    assert.ok(history.messages.some(message => message.text.includes('merge-queue-dropped') && message.text.includes(change === 'verdict' ? 'not clear' : change)), change);
    if (change === 'head') assert.ok(history.messages.some(message => message.text === `merge-queue-dropped ${item.id}: branch head changed or deleted; prepared head ${'b'.repeat(40)}, current head ${'c'.repeat(40)}`));
    assert.deepEqual((await value<{ entries: unknown[] }>(ui, { type: 'merge.queue' })).entries, [], change);
  }
});

test('a confirmed deleted branch drops its request with the original reason', async t => {
  const { ui, item, heads, tips } = await fixture(t);
  await value(ui, { type: 'merge', item: item.id });
  heads.delete('t/parser');
  await tips.refresh();
  assert.deepEqual((await value<{ entries: unknown[] }>(ui, { type: 'merge.queue' })).entries, []);
  const history = await value<{ messages: Array<{ text: string }> }>(ui, { type: 'topic.history', topic: 'agents', limit: 100 });
  assert.ok(history.messages.some(message => message.text === `merge-queue-dropped ${item.id}: branch head changed or deleted; prepared head ${'b'.repeat(40)}, current head missing`));
});

test('merge CLI renders queue replies, ordered entries and task positions', async t => {
  const { root, item, enqueuedAt } = await fixture(t);
  const merged = await cland(root, 'merge', item.id);
  assert.equal(merged.code, 0, merged.stderr);
  assert.equal(merged.stdout, `${item.id}: queued 1\n`);
  const queue = await cland(root, 'merge', 'queue', '--json');
  assert.equal(queue.code, 0, queue.stderr);
  assert.equal(JSON.parse(queue.stdout).entries[0].item, item.id);
  const viewed = await cland(root, 'task', 'view', item.id);
  assert.ok(viewed.stdout.includes(`merge queue 1 since ${enqueuedAt}`));
  const status = await cland(root, 'hub', 'status', '--json');
  assert.equal(status.code, 0, status.stderr);
  assert.equal(JSON.parse(status.stdout).mergeQueue[0].item, item.id);
  const cancelled = await cland(root, 'merge', item.id, '--cancel');
  assert.equal(cancelled.code, 0, cancelled.stderr);
  assert.equal(cancelled.stdout, `${item.id}: cancelled\n`);
});

test('queued cancellation replies forbidden when its caller loses merge authority', async t => {
  const entered = Promise.withResolvers<void>();
  const released = Promise.withResolvers<void>();
  onCleanup(t, () => released.resolve());
  let hold = false;
  const { root, ui, dispatcher, item } = await fixture(t, { territoryLock: async (_root, operation) => {
    if (hold) { entered.resolve(); await released.promise; }
    return operation();
  } });
  await value(ui, { type: 'merge', item: item.id });
  await value(ui, { type: 'role.set', session: 'coord', role: 'coordinator' });
  const coordinator = await dispatcherSpoke(t, dispatcher, root, 'coord', 'queued-coord-id');
  hold = true;
  const merging = value<{ queued: number }>(ui, { type: 'merge', item: item.id });
  await entered.promise;
  // Direct frame dispatch admits cancellation synchronously behind the held merge.
  const cancelling = coordinator.call<{ ok: boolean; code: string; permission: string }>('merge', { item: item.id, cancel: true });
  await value(ui, { type: 'role.set', session: 'coord', role: 'implementer' });
  assert.equal((await value<{ entries: unknown[] }>(ui, { type: 'merge.queue' })).entries.length, 1, 'the queued cancellation has not changed the FIFO');
  released.resolve();
  assert.equal((await merging).queued, 1, 'the held merge completes before observing its queued successor');
  const result = await cancelling;
  assert.deepEqual([result.ok, result.code, result.permission], [false, 'forbidden', 'merge']);
  assert.equal((await value<{ entries: unknown[] }>(ui, { type: 'merge.queue' })).entries.length, 1, 'revoked authority cannot cancel');
});

test('queued merged-tree budget refusal moves no ref or checkout', async t => {
  const reads: string[][] = [];
  const manifest = { version: 1 as const, source: { artifacts: [], commit: 'base' }, budget: { mode: 'enforce' as const, testSeconds: 5, fileSeconds: 60 }, files: { component: { seconds: 600, tests: 1 } }, tests: { 'component::rule': 600 }, allow: {} };
  const { ui, item, clock } = await fixture(t, { batchRepository: {
    git: async args => {
      reads.push(args);
      if (args[0] === 'rev-parse') return args.at(-1) === 'refs/heads/dev' ? 'a'.repeat(40) : 'b'.repeat(40);
      if (args[0] === 'merge-tree') return 'c'.repeat(40) + '\0';
      throw new Error(`unexpected mutation: ${args[0]}`);
    },
    facts: async (tree, head, base) => {
      assert.deepEqual([tree, head, base], ['c'.repeat(40), 'b'.repeat(40), 'a'.repeat(40)], 'admit the merged tree against the captured base');
      return { context: { manifest, tiers: { component: 'T2' } }, workers: 1 };
    },
    identity: async () => { throw new Error('a refused tree cannot reach checkout preparation'); },
    checkout: async () => { throw new Error('a refused tree cannot be checked out'); },
    remove: async () => {},
  } });
  await value(ui, { type: 'merge', item: item.id });
  await clock.advance(601_000);
  await until(async () => (await value<{ entries: unknown[] }>(ui, { type: 'merge.queue' })).entries.length === 0, { what: 'budget refusal drops queued candidate' });
  const history = await value<{ messages: Array<{ text: string }> }>(ui, { type: 'topic.history', topic: 'agents', limit: 100 });
  assert.ok(history.messages.some(message => /merge-queue-dropped.*merge-budget.*T2 projected wall 600 s > 480 s/s.test(message.text)));
  assert.equal((await value<{ suites: unknown[] }>(ui, { type: 'hub.status', history: true })).suites.length, 0);
  assert.ok(reads.every(args => ['rev-parse', 'merge-tree'].includes(args[0]!)), 'no checkout, commit or ref mutation');
});


test('a red singleton posts its bisection refusal to the member lead after appearing in both queues', async t => {
  const started = Promise.withResolvers<RunRef>();
  let receipt: RunStatus = { state: 'running' };
  const lease = (run: RunRef, deadline: string): Lease => ({ kind: 'local', run: run.id, created: '2026-10-16T12:00:00Z', deadline, resource: null });
  t.mock.method(LocalExecutor.prototype, 'reconcile', async () => {});
  t.mock.method(LocalExecutor.prototype, 'holder', async () => null);
  t.mock.method(LocalExecutor.prototype, 'occupied', async () => false);
  t.mock.method(LocalExecutor.prototype, 'acquire', async (run: RunRef, deadline: string) => lease(run, deadline));
  t.mock.method(LocalExecutor.prototype, 'deliver', async () => {});
  t.mock.method(LocalExecutor.prototype, 'start', async (_lease: Lease, run: RunRef) => { await writeFile(run.log, 'suite test failures [{"file":"hub/test/parser.test.ts","name":"rejects stale input"}]\n# tests 1\n# fail 1\n'); started.resolve(run); });
  t.mock.method(LocalExecutor.prototype, 'status', async () => receipt);
  t.mock.method(LocalExecutor.prototype, 'release', async () => ({ lifetimeMs: null, costUsd: null }));
  t.mock.method(LocalExecutor.prototype, 'cancel', async () => {});
  const candidateHead = 'f'.repeat(40), tree = 'e'.repeat(40);
  const { root, ui, item, clock } = await fixture(t, { durationContext: null, candidate: {
    head: async () => candidateHead, tree: async () => tree,
    inspect: async () => ({ head: candidateHead, tree, branch: '', selection: { mode: 'full', files: [], reason: 'batch' }, tierPlan: [], budgetBase: undefined }),
  }, batchRepository: {
    git: async args => args[0] === 'rev-parse' ? args.at(-1) === 'refs/heads/dev' ? 'a'.repeat(40) : 'b'.repeat(40) : args[0] === 'merge-tree' ? tree + '\0' : candidateHead,
    facts: async () => ({ context: null, workers: 1 }), identity: async () => tree,
    checkout: async candidate => checkoutClandFixture(candidate.cwd), remove: async () => {},
  } });
  const coord = await inProcessSpoke(t, { discover: true, cwd: root, name: 'coord', sessionId: 'batch-requester', role: 'coordinator' });
  const topic = (await value<{ topic: { id: string } }>(ui, { type: 'topic.create', title: 'Batch report', item: item.id })).topic.id;
  assert.equal((await coord.call<{ queued: number }>('merge', { item: item.id })).queued, 1);
  await clock.advance(601_000);
  const run = await started.promise;
  const merging = await value<{ batch: MergeBatchStatus }>(ui, { type: 'merge.queue' });
  const verifying = await value<VerificationQueue>(ui, { type: 'suite.queue' });
  assert.deepEqual(merging.batch.members.map(member => member.item), [item.id]);
  assert.equal(verifying.batch?.id, merging.batch.id);
  assert.equal(verifying.holder?.occasion, 'batch');
  receipt = { state: 'done', code: 1, finished: clock.now().toISOString() };
  await clock.advance(1000);
  await until(async () => { await clock.advance(1000); const status = await value<{ suites: Array<{ error: string | null }> }>(ui, { type: 'hub.status', history: true }); if (status.suites[0]?.error) throw new Error(status.suites[0].error); return (await value<{ batch: MergeBatchStatus | null }>(ui, { type: 'merge.queue' })).batch === null; }, { what: 'red singleton refused', timeoutMs: 1500 });
  const history = await value<{ messages: Array<{ text: string; to: string[] }> }>(ui, { type: 'topic.history', topic, limit: 100 });
  assert.ok(history.messages.some(message => message.text.startsWith(`suite result ${run.id}`) && message.to.includes('coord')));
  assert.ok(history.messages.some(message => message.text.includes(`tree ${tree}`) && message.text.includes(item.id) && /tiers T1, T3; wall \d+ ms; exit 1/.test(message.text)));
  assert.ok(history.messages.some(message => /merge-queue-dropped.*merge-bisected.*hub\/test\/parser.test.ts::rejects stale input/s.test(message.text) && message.to.includes('coord')));
});

test('a cancelled live batch member re-enqueued at the same head keeps its admitted run', async t => {
  // T2: public merge frames through projectHub; only the executor and Git edges are fake.
  const setup = caseDeadlines(t, { ownership: { beforeDirectories, guardDirectoryRemoval } });
  return setup.run(async step => {
  const merge = TaskMerges.prototype.merge;
  t.mock.method(TaskMerges.prototype, 'merge', async function (this: TaskMerges, ...args: Parameters<TaskMerges['merge']>) {
    if (!args[5]) return merge.apply(this, args);
    const [id, actor] = args;
    const commit = 'c'.repeat(40);
    this.tracker.recordMerge(id, { commit, base: 'dev', branch: 't/parser', tip: 'b'.repeat(40) });
    await this.tracker.close(actor, id);
    return { item: id, commit, base: 'dev', cleanup: 'fixture' };
  });
  const started = Promise.withResolvers<RunRef>();
  let receipt: RunStatus = { state: 'running' };
  t.mock.method(LocalExecutor.prototype, 'reconcile', async () => {});
  t.mock.method(LocalExecutor.prototype, 'holder', async () => null);
  t.mock.method(LocalExecutor.prototype, 'occupied', async () => false);
  t.mock.method(LocalExecutor.prototype, 'acquire', async (run: RunRef, deadline: string): Promise<Lease> => ({ kind: 'local', run: run.id, created: '2026-10-16T12:00:00Z', deadline, resource: null }));
  t.mock.method(LocalExecutor.prototype, 'deliver', async () => {});
  t.mock.method(LocalExecutor.prototype, 'start', async (_lease: Lease, run: RunRef) => {
    await writeFile(run.log, '# tests 1\n# pass 1\n'); started.resolve(run);
  });
  t.mock.method(LocalExecutor.prototype, 'status', async () => receipt);
  t.mock.method(LocalExecutor.prototype, 'release', async () => ({ lifetimeMs: null, costUsd: null }));
  t.mock.method(LocalExecutor.prototype, 'cancel', async () => {});
  const head = 'f'.repeat(40), tree = 'e'.repeat(40);
  const { root, ui, item, clock } = await step(() => fixture(setup.fixtures, { durationContext: null, candidate: {
    head: async () => head, tree: async () => tree,
    inspect: async () => ({ head, tree, branch: '', selection: { mode: 'full', files: [], reason: 'batch' }, tierPlan: [], budgetBase: undefined }),
  }, batchRepository: {
    git: async args => args[0] === 'rev-parse' ? args.at(-1) === 'refs/heads/dev' ? 'a'.repeat(40) : 'b'.repeat(40) : args[0] === 'merge-tree' ? tree + '\0' : head,
    facts: async () => ({ context: null, workers: 1 }), identity: async () => tree,
    checkout: async candidate => checkoutClandFixture(candidate.cwd), remove: async () => {},
  } }));
  setup.adoptRoot(root);
  await step(() => value(ui, { type: 'merge', item: item.id }));
  await step(() => clock.advance(601_000));
  const run = await step(() => setup.wait('admitted worker start', () => started.promise));
  const original = await step(() => value<{ entries: unknown[]; batch: MergeBatchStatus }>(ui, { type: 'merge.queue' }));
  assert.equal((await step(() => value<{ cancelled: boolean }>(ui, { type: 'merge', item: item.id, cancel: true }))).cancelled, true);
  assert.equal((await step(() => value<{ queued: number }>(ui, { type: 'merge', item: item.id }))).queued, 1);
  const replacement = await step(() => value<{ entries: unknown[]; batch: MergeBatchStatus }>(ui, { type: 'merge.queue' }));
  assert.deepEqual(replacement.entries, original.entries, 'the same head rejoins its admitted request');
  assert.equal(replacement.batch.id, original.batch.id, 'the live worker keeps its pinned batch');
  assert.equal((await step(() => value<{ suites: unknown[] }>(ui, { type: 'hub.status', history: true }))).suites.length, 1);
  receipt = { state: 'done', code: 0, finished: clock.now().toISOString() };
  await step(() => until(async () => {
    await clock.advance(1000);
    const suites = (await value<{ suites: Array<{ id: string; reported: boolean }> }>(ui, { type: 'hub.status', history: true })).suites;
    return suites.some(job => job.id === run.id && job.reported);
  }, { what: 'live batch worker completion receipt', timeoutMs: 1500 }));
  await step(() => until(async () => {
    await clock.advance(1000);
    return (await value<{ batch: MergeBatchStatus | null }>(ui, { type: 'merge.queue' })).batch === null;
  }, { what: 'cancelled batch resolves', timeoutMs: 1500 }));
  assert.deepEqual((await step(() => value<{ entries: unknown[] }>(ui, { type: 'merge.queue' }))).entries, []);
  assert.equal((await step(() => value<{ item: ItemView }>(ui, { type: 'task.view', item: item.id }))).item.state, 'closed');
  });
});

test('a code movement rebuild notice survives the original green result notice', async t => {
  const started = Promise.withResolvers<RunRef>();
  let receipt: RunStatus = { state: 'running' };
  t.mock.method(LocalExecutor.prototype, 'reconcile', async () => {});
  t.mock.method(LocalExecutor.prototype, 'holder', async () => null);
  t.mock.method(LocalExecutor.prototype, 'occupied', async () => false);
  t.mock.method(LocalExecutor.prototype, 'acquire', async (run: RunRef, deadline: string): Promise<Lease> => ({ kind: 'local', run: run.id, created: '2026-10-16T12:00:00Z', deadline, resource: null }));
  t.mock.method(LocalExecutor.prototype, 'deliver', async () => {});
  t.mock.method(LocalExecutor.prototype, 'start', async (_lease: Lease, run: RunRef) => {
    await writeFile(run.log, '# tests 1\n# pass 1\n'); started.resolve(run);
  });
  t.mock.method(LocalExecutor.prototype, 'status', async () => receipt);
  t.mock.method(LocalExecutor.prototype, 'release', async () => ({ lifetimeMs: null, costUsd: null }));
  t.mock.method(LocalExecutor.prototype, 'cancel', async () => {});
  let moved = false;
  let checkedHead = '', checkedTree = '';
  const { ui, item, clock } = await fixture(t, { durationContext: null, candidate: {
    head: async () => checkedHead, tree: async () => checkedTree,
    inspect: async () => ({ head: checkedHead, tree: checkedTree, branch: '', selection: { mode: 'full', files: [], reason: 'batch' }, tierPlan: [], budgetBase: undefined }),
  }, batchRepository: {
    git: async args => {
      if (args[0] === 'rev-parse') return args.at(-1) === 'refs/heads/dev' ? moved ? 'new-dev' : 'a'.repeat(40) : 'b'.repeat(40);
      if (args[0] === 'merge-tree') return (moved ? 'new-tree' : 'old-tree') + '\0';
      if (args[0] === 'commit-tree') return moved ? 'new-head' : 'old-head';
      if (args[0] === 'diff') return 'hub/src/parser.ts\0';
      if (args[0] === '--literal-pathspecs') return 'forcing-code-commit';
      throw new Error(`unexpected Git operation ${args}`);
    },
    facts: async () => ({ context: null, workers: 1 }), identity: async () => moved ? 'new-tree' : 'old-tree',
    checkout: async candidate => { await checkoutClandFixture(candidate.cwd); checkedHead = candidate.head; checkedTree = candidate.tree; }, remove: async () => {},
  } });
  await value(ui, { type: 'merge', item: item.id });
  await clock.advance(601_000);
  await started.promise;
  moved = true;
  receipt = { state: 'done', code: 0, finished: clock.now().toISOString() };
  await until(async () => {
    await clock.advance(1000);
    return (await value<{ suites: unknown[] }>(ui, { type: 'hub.status', history: true })).suites.length === 2;
  }, { what: 'changed code candidate admitted for a new batch' });
  const history = await value<{ messages: Array<{ id: string; text: string }> }>(ui, { type: 'topic.history', topic: 'agents', limit: 100 });
  const green = history.messages.find(message => /batch .*tiers T1, T3;.*exit 0/.test(message.text));
  const rebuild = history.messages.find(message => /rebuild: commit forcing-code-commit changed batch test inputs: hub\/src\/parser.ts/.test(message.text));
  assert.ok(green, 'original green result is retained');
  assert.ok(rebuild, 'forcing commit is visible in the queue notice');
  assert.notEqual(green.id, rebuild.id, 'the suite notice cannot deduplicate the rebuild notice');
});

test(batchGitCase, t => pruneCase(t, async (scope, step) => {
  assert.ok(ownedGuardAdmissions.delete(t.name), 'file hook delegates this exact case to its whole-callback native guard');
  const root = await step('disposable batch cwd', async () => {
    const root = await tempProject(scope.fixtures); scope.adoptRoot(root); return root;
  });
  const env = fixtureEnvironment(root, process.env);
  let path = '';
  let calls = 0;
  const git = PruneProcesses.prototype.git;
  scope.patch(PruneProcesses.prototype, 'git', async function (...call: Parameters<typeof git>) {
    const [cwd, args] = call;
    assert.equal(cwd, root);
    const f = fakePrune(scope);
    const running = scope.wait('owned fake Git result', () => Reflect.apply(git, f.owner, call));
    await step('owned fake Git gate', () => f.started);
    calls++;
    let output: string;
    if (args[0] === 'diff') {
      assert.deepEqual(args, ['diff', '--name-only', '-z', '--no-renames', 'tested-head', 'current-head', '--']);
      output = path + '\0';
    }
    else {
      assert.deepEqual(args, ['--literal-pathspecs', 'log', '-1', '--format=%H', 'current', '^tested', '--', path]);
      output = 'forcing-commit\n';
    }
    f.child.stdout.emit('data', output);
    f.close();
    const result = await running;
    await step('owned fake Git settlement', () => f.owner.settled);
    return result;
  });
  const candidate = (base: string) => ({ base, head: `${base}-head`, tree: `${base}-tree`, cwd: root, budgetLines: [] });
  for (const unknown of [' docs/input.ts', ' README.md', '\tdocs/input.ts', '\nREADME.md', 'README.md ']) {
    path = unknown;
    assert.equal(await batchRebuildReason(root, candidate('tested'), candidate('current'), env), `commit forcing-commit changed batch test inputs: ${unknown}`);
  }
  path = 'docs/input.md';
  assert.equal(await batchRebuildReason(root, candidate('tested'), candidate('current'), env), null);
  assert.equal(calls, 11, 'all unknown paths reach native-result handling and the safe path omits log');
}));

test('scripts-only manifest changes omit the install warning from queue frames and CLI output', async t => {
  const f = await fixture(t, {}, ['package.json']);
  f.manifests.set(`${f.heads.get('dev')}:package.json`, JSON.stringify({ scripts: { test: 'old' } }));
  f.manifests.set(`${f.heads.get('t/parser')}:package.json`, JSON.stringify({ scripts: { test: 'new' } }));
  await value(f.ui, { type: 'merge', item: f.item.id });
  const queue = await value<{ entries: Array<{ item: string; dependencies?: unknown }> }>(f.ui, { type: 'merge.queue' });
  assert.equal(queue.entries[0]?.item, f.item.id);
  assert.equal(queue.entries[0]?.dependencies, undefined);
  const shown = await cland(f.root, 'merge', 'queue');
  assert.equal(shown.code, 0, shown.stderr);
  assert.ok(shown.stdout.includes(f.item.id));
  assert.doesNotMatch(shown.stdout, /npm install|dependencies out of date/);
});

for (const mode of ['ordinary', 'rename', 'shared', 'unavailable', 'refused-retry', 'human'] as const) test(`queue landing delivers exactly one report: ${mode}`, async t => {
  const setup = caseDeadlines(t);
  const release = Promise.withResolvers<void>();
  let entered = false;
  beforeDirectories(setup.fixtures, async () => { release.resolve(); });
  let available = mode !== 'unavailable';
  const notice = HubCore.prototype.noticeToSessions;
  t.mock.method(HubCore.prototype, 'noticeToSessions', function (this: HubCore, ...args: Parameters<HubCore['noticeToSessions']>) {
    return available ? notice.apply(this, args) : null;
  });
  let refused = false;
  const commit = 'c'.repeat(40);
  const merge = TaskMerges.prototype.merge;
  t.mock.method(TaskMerges.prototype, 'merge', async function (this: TaskMerges, ...args: Parameters<TaskMerges['merge']>) {
    if (!args[5]) return merge.apply(this, args);
    const [id, actor] = args;
    if (mode === 'refused-retry' && !refused) { refused = true; throw new MergeError('merge-changed', 'fixture gate refused before landing'); }
    entered = true;
    if (mode === 'rename') await release.promise;
    this.tracker.recordMerge(id, { commit, base: 'dev', branch: 't/parser', tip: 'b'.repeat(40) });
    await this.tracker.close(actor, id);
    return { item: id, commit, base: 'dev', cleanup: 'fixture' };
  });
  let receipt: RunStatus = { state: 'running' };
  const lease = (run: RunRef, deadline: string): Lease => ({ kind: 'local', run: run.id, created: '2026-10-16T12:00:00Z', deadline, resource: null });
  t.mock.method(LocalExecutor.prototype, 'reconcile', async () => {});
  t.mock.method(LocalExecutor.prototype, 'holder', async () => null);
  t.mock.method(LocalExecutor.prototype, 'occupied', async () => false);
  t.mock.method(LocalExecutor.prototype, 'acquire', async (run: RunRef, deadline: string) => lease(run, deadline));
  t.mock.method(LocalExecutor.prototype, 'deliver', async () => {});
  t.mock.method(LocalExecutor.prototype, 'start', async (_lease: Lease, run: RunRef) => { await writeFile(run.log, '# tests 1\n# fail 0\n'); });
  t.mock.method(LocalExecutor.prototype, 'status', async () => receipt);
  t.mock.method(LocalExecutor.prototype, 'release', async () => ({ lifetimeMs: null, costUsd: null }));
  t.mock.method(LocalExecutor.prototype, 'cancel', async () => {});
  const candidateHead = 'f'.repeat(40), tree = 'e'.repeat(40);
  const { root, ui, item, clock, fakes } = await setup.wait('landing hub/UI readiness', () => fixture(setup.fixtures, { durationContext: null, candidate: {
    head: async () => candidateHead, tree: async () => tree,
    inspect: async () => ({ head: candidateHead, tree, branch: '', selection: { mode: 'full', files: [], reason: 'batch' }, tierPlan: [], budgetBase: undefined }),
  }, batchRepository: {
    git: async args => args[0] === 'rev-parse' ? args.at(-1) === 'refs/heads/dev' ? 'a'.repeat(40) : 'b'.repeat(40) : args[0] === 'merge-tree' ? tree + '\0' : candidateHead,
    facts: async () => ({ context: null, workers: 1 }), identity: async () => tree,
    checkout: async candidate => checkoutClandFixture(candidate.cwd), remove: async () => {},
  } }));

  const launched = mode === 'ordinary' ? await value<{ process: { sessionId: string } }>(ui, { type: 'session.launch', name: 'coord', harness: 'claude-code', role: 'coordinator' }) : null;
  const coord = await setup.wait('landing spoke readiness', () => inProcessSpoke(setup.fixtures, { discover: true, cwd: root, name: 'coord', sessionId: launched?.process.sessionId ?? 'landing-requester', role: 'coordinator' }));
  const impl = mode === 'shared' ? coord : await setup.wait('landing spoke readiness', () => inProcessSpoke(setup.fixtures, { discover: true, cwd: root, name: 'impl', sessionId: 'landing-claimant', role: 'implementer' }));
  await value(ui, { type: 'task.edit', item: item.id, assignee: mode === 'shared' ? 'coord' : 'impl' });
  const claimed = await impl.call<{ ok: boolean; error?: string }>('task.claim', { id: item.id });
  assert.equal(claimed.ok, true, claimed.error);
  const topic = (await value<{ topic: { id: string } }>(ui, { type: 'topic.create', title: 'Landing', item: item.id })).topic.id;
  const claude = fakes['claude-code']!;
  if (mode === 'ordinary') {
    await until(() => claude.injections.some(injection => injection.message.kind === 'role' && injection.outcome === 'accept'), { what: 'Coordinator role input accepted', timeoutMs: 1500 });
    claude.idle('coord');
    const progress = await impl.call<{ ok: boolean; outcomes: Array<{ outcome: string }> }>('send', { to: ['coordinator'], topic, kind: 'progress', text: 'Routine implementation progress' });
    assert.equal(progress.ok, true);
    assert.equal(progress.outcomes[0]?.outcome, 'queued');
    await coord.call('who');
    assert.equal(coord.events.some(event => event.params.content.includes('Routine implementation progress')), false);
    assert.equal(claude.injections.some(injection => injection.message.text === 'Routine implementation progress'), false);
    const ready = await impl.call<{ ok: boolean }>('send', { to: ['coordinator'], topic, kind: 'report', text: 'Ready for queue admission' });
    assert.equal(ready.ok, true);
    await until(() => coord.events.some(event => event.params.content.includes('Ready for queue admission')), { what: 'ready report channel delivery recorded', timeoutMs: 1500 });
    const delivered = coord.events.find(event => event.params.content.includes('Ready for queue admission'))!;
    assert.match(delivered.params.content, /Routine implementation progress[\s\S]*Ready for queue admission/);
    await until(() => claude.injections.some(injection => injection.message.text === 'Ready for queue admission'), { what: 'ready report injected into idle Claude', timeoutMs: 1500 });
    await until(async () => {
      const { messages } = await value<{ messages: Array<{ text: string; stage: string }> }>(ui, { type: 'topic.history', topic });
      return ['Routine implementation progress', 'Ready for queue admission'].every(text => messages.some(message => message.text === text && message.stage === 'injected'));
    }, { what: 'ready report and progress injection persisted', timeoutMs: 1500 });
    claude.idle('coord');
  }
  assert.equal((mode === 'human' ? await value<{ queued: number }>(ui, { type: 'merge', item: item.id }) : await coord.call<{ queued: number }>('merge', { item: item.id })).queued, 1);
  await clock.advance(601_000);
  let batch = (await value<{ batch: MergeBatchStatus }>(ui, { type: 'merge.queue' })).batch.id;
  receipt = { state: 'done', code: 0, finished: clock.now().toISOString() };
  if (mode === 'refused-retry') {
    await until(async () => { await clock.advance(1000); return (await value<{ batch: MergeBatchStatus | null }>(ui, { type: 'merge.queue' })).batch === null; }, { what: 'positive pre-landing refusal', timeoutMs: 3000 });
    assert.equal((await coord.call<{ queued: number }>('merge', { item: item.id })).queued, 1);
    receipt = { state: 'running' };
    await clock.advance(601_000);
    batch = (await value<{ batch: MergeBatchStatus }>(ui, { type: 'merge.queue' })).batch.id;
    receipt = { state: 'done', code: 0, finished: clock.now().toISOString() };
  }
  let stranger: Awaited<ReturnType<typeof inProcessSpoke>> | undefined;
  if (mode === 'rename') {
    await until(async () => { await clock.advance(1000); return entered; }, { what: 'held landing entered', timeoutMs: 3000 });
    assert.deepEqual(await coord.call('rename', { name: 'renamed-coord' }), { ok: true, name: 'renamed-coord' });
    stranger = await setup.wait('reused name spoke readiness', () => inProcessSpoke(setup.fixtures, { discover: true, cwd: root, name: 'coord', sessionId: 'unrelated' }));
    release.resolve();
  }
  await until(async () => { await clock.advance(1000); return (await value<{ item: ItemView }>(ui, { type: 'task.view', item: item.id })).item.state === 'closed'; }, { what: 'durable queued landing', timeoutMs: 3000 });
  await until(async () => { await clock.advance(1000); return (await value<{ batch: MergeBatchStatus | null }>(ui, { type: 'merge.queue' })).batch === null; }, { what: 'batch cleanup completion', timeoutMs: 3000 });
  if (mode === 'unavailable') {
    assert.equal((await value<{ messages: Array<{ text: string }> }>(ui, { type: 'topic.history', topic, limit: 100 })).messages.filter(message => message.text.startsWith('merge-queue-landed')).length, 0);
    available = true;
    await clock.advance(1000);
  }
  const messages = (await value<{ messages: Array<{ id: string; kind: string; text: string; to: string[]; detail?: { batch: string } }> }>(ui, { type: 'topic.history', topic, limit: 100 })).messages;
  const reports = messages.filter(message => message.text.startsWith(`merge-queue-landed ${item.id}:`));
  assert.equal(reports.length, 1, 'one landing report per completed queue admission');
  const report = reports[0]!;
  if (mode === 'ordinary') {
    await until(() => claude.injections.some(injection => injection.message.id === report.id), { what: 'landing injected into idle Claude', timeoutMs: 1500 });
    assert.equal(claude.injections.filter(injection => injection.message.id === report.id).length, 1);
    await until(async () => {
      await value(ui, { type: 'hub.status', flushLogs: true });
      const records = completeJournalLines(await readFile(join(root, '.cland/journal.jsonl'), 'utf8')).filter(Boolean).map(line => JSON.parse(line));
      return records.some(record => record.event === 'injected' && record.id === report.id && record.session === 'coord');
    }, { what: 'landing injection persisted', timeoutMs: 1500 });
  }
  assert.equal(report.kind, 'report');
  assert.deepEqual([...report.to].sort(), mode === 'human' ? ['impl'] : mode === 'shared' ? ['coord'] : mode === 'rename' ? ['impl', 'renamed-coord'] : ['coord', 'impl']);
  assert.equal(report.text, `merge-queue-landed ${item.id}: merged ${commit} onto dev; batch ${batch}`);
  for (const recipient of new Set(mode === 'human' ? [impl] : [coord, impl])) {
    await until(() => recipient.events.some(event => JSON.stringify(event).includes(report.id)), { what: 'landing delivered to spoke', timeoutMs: 1500 });
    assert.equal(recipient.events.filter(event => JSON.stringify(event).includes(report.id)).length, 1);
  }
  assert.equal(stranger?.events.some(event => JSON.stringify(event).includes(report.id)) ?? false, false);
});

test('startup recovers a captured landing obligation after close removed its queue and claim', async t => {
  const setup = caseDeadlines(t);
  let landed = '';
  const { root, ui, clock } = await setup.wait('recovery hub readiness', () => fixture(setup.fixtures, {}, undefined, async tracker => {
    const actor = { id: 'recovered-requester', name: 'old-name', role: 'coordinator' };
    const item = await tracker.create(actor, { title: 'Interrupted landing', size: 'S', branch: 't/recovered' });
    landed = item.id;
    const store = new Store(join(tracker.root, '.cland/hub.db'));
    try {
      // Crash image: obligation persisted before merge; close/receipt persisted,
      // but no notice was admitted before the old process disappeared.
      store.rememberSession('recovered', new FakeClock().now().getTime());
      store.rememberSessionId('recovered', actor.id);
      store.setMeta('merge-landing-reports', JSON.stringify([{ item: item.id, branch: 't/recovered', head: 'b'.repeat(40), batch: 'interrupted-batch', topic: 'agents', recipients: [actor.id, actor.id, 'late-recipient'] }]));
    } finally { store.close(); }
    tracker.recordMerge(item.id, { commit: 'c'.repeat(40), base: 'dev', branch: 't/recovered', tip: 'b'.repeat(40) });
    await tracker.close(actor, item.id);
  }));
  const coord = await setup.wait('recovered recipient readiness', () => inProcessSpoke(setup.fixtures, { discover: true, cwd: root, name: 'recovered', sessionId: 'recovered-requester', role: 'coordinator' }));
  await clock.advance(2000);
  const messages = (await value<{ messages: Array<{ id: string; text: string; to: string[] }> }>(ui, { type: 'topic.history', topic: 'agents', limit: 100 })).messages;
  const reports = messages.filter(message => message.text.startsWith(`merge-queue-landed ${landed}:`));
  assert.equal(reports.length, 1);
  assert.deepEqual(reports[0]!.to, ['recovered']);
  assert.equal(reports[0]!.text, `merge-queue-landed ${landed}: merged ${'c'.repeat(40)} onto dev; batch interrupted-batch`);
  await until(() => coord.events.some(event => JSON.stringify(event).includes(reports[0]!.id)), { what: 'recovered landing delivered', timeoutMs: 1500 });
  assert.equal(coord.events.filter(event => JSON.stringify(event).includes(reports[0]!.id)).length, 1);
  const late = await setup.wait('late recipient readiness', () => inProcessSpoke(setup.fixtures, { discover: true, cwd: root, name: 'late', sessionId: 'late-recipient' }));
  await clock.advance(2000);
  await until(() => late.events.some(event => JSON.stringify(event).includes(reports[0]!.id)), { what: 'late landing delivered', timeoutMs: 1500 });
  assert.equal(coord.events.filter(event => JSON.stringify(event).includes(reports[0]!.id)).length, 1, 'resolving another recipient never redelivers to requester');
  assert.equal(late.events.filter(event => JSON.stringify(event).includes(reports[0]!.id)).length, 1);
  const final = (await value<{ messages: Array<{ id: string; to: string[] }> }>(ui, { type: 'topic.history', topic: 'agents', limit: 100 })).messages.filter(message => message.id === reports[0]!.id);
  assert.equal(final.length, 1);
  assert.deepEqual(final[0]!.to.sort(), ['late', 'recovered']);
});
