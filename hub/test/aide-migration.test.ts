// T2: startup migration through real frames, with an in-process hub and fake harnesses.
import { sessionUi as connectUi } from './session-credential-fixture.ts';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { syncBuiltinESMExports } from 'node:module';
import { join } from 'node:path';
import test, { mock, type TestContext } from 'node:test';
import { parseRoles } from '../src/roles/config.ts';
import { testWaitMs } from './until.ts';
import { FakeClock } from './fake-clock.ts';
import { inProcessSpoke, projectHub, projectHubStartupCleanupFailures, tempProject } from './harness.ts';
import { onCleanup, beforeDirectories, afterCleanup, ownDirectory, guardDirectoryRemoval } from './process-cleanup.ts';
import { caseDeadlines, drainFixtureWork } from './case-deadlines.ts';
import { fakeNativeGuard } from './fake-native-guard.ts';
import { setImmediate as yieldIO } from 'node:timers/promises';
import { Journal } from '../src/hub/journal.ts';
import { type Discovery } from './harness.ts';
import { guardedLeaseCase } from './executor-lease-fixture.ts';
import { drainFixtureCleanup, fenceFixtureCleanup } from './process-cleanup.ts';

type ControlStep = <T>(name: string, run: () => Promise<T>) => Promise<T>;

/** Own the full callback before guard installation or root acquisition. */
function migrationControl(t: TestContext, body: (root: string, fixtures: TestContext, step: ControlStep, releaseOnClose: (release: () => void) => void) => Promise<void>) {
  let release = () => {};
  const owner = caseDeadlines(t, {
    timeoutMs: testWaitMs(5000),
    ownership: { beforeDirectories, guardDirectoryRemoval },
    releaseOnClose: () => release(),
  });
  let guard: Awaited<ReturnType<typeof fakeNativeGuard>> | undefined;
  let restoreGuard: (() => void) | undefined;
  afterCleanup(t, async () => {
    // An expired observer is not permission to restore patches under live work.
    await drainFixtureWork();
    try { guard?.verify(); }
    finally { mock.restoreAll(); syncBuiltinESMExports(); restoreGuard?.(); }
  });
  return owner.run(async (admit, signal) => {
    const step: ControlStep = (name, run) => owner.wait(name, () => admit(async () => {
      signal.throwIfAborted();
      const value = await run();
      signal.throwIfAborted();
      return value;
    }));
    await step('native guard setup', async () => { guard = await fakeNativeGuard(restore => { restoreGuard = restore; }); });
    const root = await owner.wait('migration root setup', () => admit(async () => {
      const root = await tempProject(owner.fixtures);
      // Adoption belongs to the acquisition even if its observer has expired.
      owner.adoptRoot(root);
      return root;
    }));
    signal.throwIfAborted();
    await body(root, owner.fixtures, step, next => { release = next; });
  });
}

/** Synthetic context drainage is required before roots or global seams can be released. */
function startupControl(t: TestContext, body: (control: {
  root: string; context: TestContext; step: ControlStep;
  patch: ReturnType<typeof guardedLeaseCase>['patch'];
  start: (options: Parameters<typeof projectHub>[3]) => ReturnType<typeof projectHub>;
  close: () => Promise<void>; releaseSeams: () => void; remove: () => Promise<void>;
  cancel: () => Promise<void>; cancelled: Promise<void>; wait: ControlStep;
}) => Promise<void>) {
  let closed = false;
  let starting: ReturnType<typeof projectHub> | undefined;
  const cancelled = Promise.withResolvers<void>();
  const scope = guardedLeaseCase(t, () => cancelled.resolve(), { timeoutMs: testWaitMs(5000), canRestore: () => closed });
  const context = { after: () => {} } as unknown as TestContext;
  fenceFixtureCleanup(context);
  const close = async () => {
    await starting?.catch(() => {});
    await drainFixtureCleanup(context);
    closed = true;
  };
  // This hook owns the exact context before its first startup can begin.
  scope.fixtures.after(close);
  return scope.run(async admit => {
    const step: ControlStep = (name, run) => scope.wait(name, () => admit(run));
    const root = await step('startup control root', () => tempProject(scope.fixtures));
    guardDirectoryRemoval(root, () => { if (!closed) throw new Error('startup control closure unconfirmed; root retained'); });
    await body({ root, context, step, patch: scope.patch, close, releaseSeams: scope.releaseSeams,
      cancel: () => drainFixtureCleanup(t), cancelled: cancelled.promise, wait: scope.wait,
      remove: ownDirectory(undefined, root),
      start: options => starting = projectHub(context, root, {}, options),
    });
  });
}

for (const failure of ['cards', 'readiness', 'rejected close'] as const) test(`fixture cleanup owns the acquired hub after ${failure} rejection`, t => startupControl(t, async ({ root, context, step, patch, start, close: closeSubject, releaseSeams, remove }) => {
  const clock = new FakeClock();
  const original = new Error('planted card registration failure');
  const cleanupError = new Error('planted process log close failure');
  let rejectClose = failure === 'rejected close';
  const ok: typeof assert.ok = assert.ok;
  const write = Journal.prototype.write;
  const close = Journal.prototype.close;
  let processLog: Journal | undefined;
  let logClosed = false;
  patch(Journal.prototype, 'write', function(this: Journal, ...args: Parameters<typeof write>) {
    if (args[0].event === 'hub-startup-step') processLog = this;
    return write.apply(this, args);
  });
  patch(Journal.prototype, 'close', async function(this: Journal) {
    if (this === processLog && rejectClose) throw cleanupError;
    await close.call(this);
    if (this === processLog) logClosed = true;
  });
  let readinessError: unknown;
  if (failure === 'readiness') patch(assert, 'ok', (value: unknown, message?: string | Error) => {
    if (message === 'projectHub must bind both real edges') {
      try { ok(false, message); } catch (error) { readinessError = error; throw error; }
    }
    ok(value, message);
  });
  let discovery: Discovery | undefined;
  try {
    await step('original startup rejection', () => assert.rejects(start({
      clock,
      registerHubCards: () => {
        discovery = JSON.parse(readFileSync(join(root, '.cland/hub.json'), 'utf8')) as Discovery;
        if (failure !== 'readiness') throw original;
      },
    }), error => error === (failure === 'readiness' ? readinessError : original)));
    if (failure === 'rejected close') {
      assert.deepEqual(projectHubStartupCleanupFailures(context), [{ primary: original, cleanup: cleanupError }]);
      await step('rejected context close', () => assert.rejects(closeSubject(), error => error === cleanupError));
      await step('guarded removal retains open log', () => assert.rejects(remove(), error => error instanceof AggregateError && error.errors.includes(cleanupError)));
      assert.equal((await stat(root)).isDirectory(), true);
      assert.throws(releaseSeams, /closure unconfirmed/);
      assert.equal(logClosed, false);
      rejectClose = false;
      await step('repaired context close', closeSubject);
    }
    if (failure !== 'rejected close') assert.equal(logClosed, true, 'the process log closes before startup rejection propagates');
    await step('startup cleanup hooks', closeSubject);
    assert.equal(logClosed, true, 'the process log close completed');
    await step('discovery removal receipt', () => assert.rejects(stat(join(root, '.cland/hub.json')), { code: 'ENOENT' }));
    assert.ok(discovery, 'the acquired socket identity was captured before rejection');
    await step('socket removal receipt', () => assert.rejects(stat(discovery!.socket), { code: 'ENOENT' }));
    assert.equal(clock.pending, 0);
  } finally {
    rejectClose = false;
    await closeSubject();
  }
}));

test('caller cancellation retains seams and root while rejected startup is still closing', async t => {
  let cancellation: Promise<void> | undefined;
  await assert.rejects(startupControl(t, async ({ root, step, patch, start, close, releaseSeams, remove, cancel, cancelled, wait }) => {
  const clock = new FakeClock();
  const entered = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  const original = new Error('planted startup failure during caller cleanup');
  const write = Journal.prototype.write;
  const nativeClose = Journal.prototype.close;
  let processLog: Journal | undefined;
  let logClosed = false;
  patch(Journal.prototype, 'write', function(this: Journal, ...args: Parameters<typeof write>) {
    if (args[0].event === 'hub-startup-step') processLog = this;
    return write.apply(this, args);
  });
  patch(Journal.prototype, 'close', async function(this: Journal) {
    if (this === processLog) { entered.resolve(); await release.promise; }
    await nativeClose.call(this);
    if (this === processLog) logClosed = true;
  });
  const starting = assert.rejects(start({ clock, startupCleanup: { clock, timeoutMs: 1 }, registerHubCards: () => { throw original; } }), error => error === original);
  void starting.catch(() => {});
  try {
    await step('startup log close entry', () => entered.promise);
    cancellation = cancel();
    void cancellation.catch(() => {});
    await wait('whole-case admission closed receipt', () => cancelled);
    const removal = assert.rejects(remove(), error => error instanceof AggregateError);
    void removal.catch(() => {});
    await wait('armed removal observation', () => yieldIO());
    await wait('cleanup observation expiry', () => clock.advance(1));
    await wait('guarded removal refusal during cancellation', () => removal);
    assert.equal((await stat(root)).isDirectory(), true);
    assert.equal(logClosed, false);
    assert.throws(releaseSeams, /closure unconfirmed/);
    release.resolve();
    await wait('original rejected startup joined', () => starting);
    await wait('caller cleanup completion', close);
    assert.equal(logClosed, true);
    await wait('root removal after confirmed closure', remove);
    await wait('removed root receipt', () => assert.rejects(stat(root), { code: 'ENOENT' }));
  } finally { release.resolve(); await starting; await close(); }
  }), /fixture work admission closed/);
  await cancellation;
});

for (const expired of [false, true]) test(expired
  ? 'fixture root stays retained when startup cleanup observation expires'
  : 'fixture cleanup joins startup still loading the roles file', t => migrationControl(t, async (root, fixtures, step, releaseOnClose) => {
  const subject = join(root, 'subject');
  const path = join(subject, '.cland/roles.toml');
  const entered = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  const hooks: Array<() => Promise<void>> = [];
  const context = { after: (hook: () => Promise<void>) => hooks.push(hook) } as unknown as TestContext;
  let cursor = 0;
  const drain = async () => { while (cursor < hooks.length) await hooks[cursor++]!(); };
  let starting: ReturnType<typeof projectHub> | undefined;
  let fallbackStop: Promise<void> | undefined;
  releaseOnClose(() => {
    release.resolve();
    // Release retained observations before the whole-case join, including red controls.
    fallbackStop = starting?.then(hub => hub.dispose(), () => {});
    void fallbackStop?.catch(() => {});
  });
  let closing: Promise<void> | undefined;
  let expectedIncomplete = false;
  onCleanup(fixtures, async () => {
    release.resolve();
    await fallbackStop;
    await (await starting?.catch(() => undefined))?.dispose();
    try { await closing; } catch (error) { if (!expectedIncomplete) throw error; }
    await drain();
  });
  await step('roles directory setup', () => mkdir(join(subject, '.cland'), { recursive: true }));
  await step('roles file setup', () => writeFile(path, '[aide.permissions]\ntools = ["who"]\n'));
  const removeSubject = ownDirectory(undefined, subject);
  onCleanup(fixtures, removeSubject);
  const clock = new FakeClock();
  const read = fs.readFile;
  mock.method(fs, 'readFile', async (...args: Parameters<typeof fs.readFile>) => {
    if (args[0] === path) { entered.resolve(); await release.promise; }
    return read(...args);
  });
  syncBuiltinESMExports();
  const setup = step('held hub setup', () => starting = projectHub(context, subject, {}, {
    clock, ...(expired ? { startupCleanup: { clock, timeoutMs: 1 } } : {}),
  }));
  void setup.catch(() => {});
  await step('held roles receipt', () => entered.promise);
  let closed = false;
  closing = drain().finally(() => { closed = true; });
  void closing.catch(() => {});
  await step('cleanup fence observation', () => yieldIO());
  assert.equal(closed, false, 'cleanup retains the pending startup');
  if (expired) {
    const refused = assert.rejects(removeSubject(), /startup join incomplete/);
    void refused.catch(() => {});
    await step('cleanup observation expiry', () => clock.advance(1));
    await step('guarded removal refusal', () => refused);
    await step('retained subject receipt', () => stat(subject));
  }
  release.resolve();
  const hub = await setup;
  await step('independent late stop receipt', () => hub.stopped);
  if (expired) {
    await step('incomplete cleanup receipt', () => assert.rejects(closing!, /startup join incomplete/));
    expectedIncomplete = true;
  } else await step('cleanup completion', () => closing!);
  await step('removed discovery receipt', () => assert.rejects(stat(join(subject, '.cland/hub.json')), { code: 'ENOENT' }));
  assert.equal(clock.pending, 0, 'all owned scheduling stopped');
  await step('subject removal after stop', removeSubject);
  await step('removed subject receipt', () => assert.rejects(stat(subject), { code: 'ENOENT' }));
}));

test('ready fixture cleanup closes clients then hub before removing its root', t => migrationControl(t, async (root, fixtures, step) => {
  const clock = new FakeClock();
  const hub = await step('ready hub setup', () => projectHub(fixtures, root, {}, { clock }));
  await step('ready client setup', () => connectUi(fixtures, hub.discovery));
  const order: string[] = [];
  onCleanup(fixtures, () => { order.push('clients'); });
  beforeDirectories(fixtures, async () => {
    await hub.stopped;
    await stat(root);
    await assert.rejects(stat(join(root, '.cland/hub.json')), { code: 'ENOENT' });
    order.push('hub');
  });
  afterCleanup(fixtures, async () => {
    await assert.rejects(stat(root), { code: 'ENOENT' });
    assert.equal(clock.pending, 0);
    order.push('directory');
    assert.deepEqual(order, ['clients', 'hub', 'directory']);
  });
}));

const oldRestriction = '- You cannot ask the human, resolve a topic\'s wait, launch, stop or resume sessions, merge, hand over a role, release, sync or `cland push`: the Coordinator owns those operations.';
const oldTools = ['rule.add', 'rule.edit', 'rule.retire', 'rule.list', 'task.plan', 'task.create', 'task.edit', 'task.close', 'task.link', 'task.comment', 'task.claim', 'task.criterion', 'task.view', 'task.list', 'artifact.create', 'artifact.keep', 'artifact.move', 'artifact.archive', 'artifact.promote', 'send', 'topic.create', 'history', 'who', 'status'];
const addedTools = ['session.launch', 'session.stop', 'session.resume', 'task.import', 'push'];
const mark = '# cland: aide-tools-0.1.4 migrated';
const before = `# human settings\n[aide]\nclause = '''\nMy introduction.\n${oldRestriction}\nMy closing line.\n'''\n[aide.launch]\nharness = "claude-code"\nmodel = "my-model" # keep\n[aide.permissions] # grants\ntools = ${JSON.stringify(oldTools)} # keep tools comment\n[qa.launch]\nharness = "codex"\n`;

test('startup migrates the shipped Aide restriction with one Agents notice', { timeout: testWaitMs() }, async t => {
  const root = await tempProject(t);
  const path = join(root, '.cland/roles.toml');
  await mkdir(join(root, '.cland'), { recursive: true });
  await writeFile(path, before);
  const { discovery } = await projectHub(t, root, {}, { clock: new FakeClock() });
  const after = await readFile(path, 'utf8');
  const roles = parseRoles(after);
  assert.deepEqual(roles.get('aide')!.permissions.tools, [...oldTools, ...addedTools]);
  assert.ok(after.includes(`[aide.permissions] # grants\n${mark}\n`), after);
  const clause = roles.get('aide')!.clause;
  assert.ok(!clause.includes(oldRestriction));
  assert.match(clause, /On the human's word, launch, stop and resume/);
  assert.match(clause, /During a build the Coordinator keeps the crew's staffing/);
  assert.match(clause, /cland task import-github/);
  assert.match(clause, /cland push/);
  assert.ok(clause.startsWith('My introduction.\n'));
  assert.ok(clause.endsWith('\nMy closing line.'));
  assert.ok(after.endsWith('# keep tools comment\n[qa.launch]\nharness = "codex"\n'));
  assert.ok(after.includes('model = "my-model" # keep\n'));
  const ui = await connectUi(t, discovery);
  const history = await ui.request({ type: 'topic.history', topic: 'agents' });
  assert.equal(history.ok, true, history.error);
  const notices = (history.value as { messages: Array<{ kind: string; text: string }> }).messages.filter(m => m.kind === 'aide-tools-migration');
  assert.equal(notices.length, 1, JSON.stringify(history.value));
  for (const tool of addedTools) assert.ok(notices[0]!.text.includes(tool));
  assert.match(notices[0]!.text, /next launch/);
});

test('later starts leave the marked file untouched after a human removes a grant', { timeout: testWaitMs() }, async t => {
  const root = await tempProject(t);
  const path = join(root, '.cland/roles.toml');
  await mkdir(join(root, '.cland'), { recursive: true });
  await writeFile(path, before);
  const first = await projectHub(t, root, {}, { clock: new FakeClock() });
  const migrated = await readFile(path, 'utf8');
  assert.ok(migrated.includes(mark));
  await first.stop();
  for (const text of [migrated, migrated.replace(',"session.launch"', '')]) {
    await writeFile(path, text);
    const stamp = await stat(path);
    const next = await projectHub(t, root, {}, { clock: new FakeClock() });
    assert.equal(await readFile(path, 'utf8'), text);
    const after = await stat(path);
    assert.deepEqual([after.ino, after.mtime.toISOString()], [stamp.ino, stamp.mtime.toISOString()]);
    const ui = await connectUi(t, next.discovery);
    const history = await ui.request({ type: 'topic.history', topic: 'agents' });
    assert.equal((history.value as { messages: Array<{ kind: string }> }).messages.filter(m => m.kind === 'aide-tools-migration').length, 1);
    ui.close();
    await next.stop();
  }
});

test('startup leaves inherited, complete and invalid permissions files unchanged', { timeout: testWaitMs() }, async t => {
  const root = await tempProject(t);
  const path = join(root, '.cland/roles.toml');
  await mkdir(join(root, '.cland'), { recursive: true });
  for (const text of [
    '[aide.launch]\nharness = "codex"\n[aide.permissions]\n# inherited tools\n',
    '[aide.launch]\nharness = "codex"\n[aide.permissions]\ntools = ["session.launch", "session.stop", "session.resume", "task.import", "push"]\n',
    '[aide.permissions]\ntools = ["send",\n',
  ]) {
    await writeFile(path, text);
    const stamp = await stat(path);
    const hub = await projectHub(t, root, {}, { clock: new FakeClock() });
    assert.equal(await readFile(path, 'utf8'), text);
    const after = await stat(path);
    assert.deepEqual([after.ino, after.mtime.toISOString()], [stamp.ino, stamp.mtime.toISOString()]);
    const ui = await connectUi(t, hub.discovery);
    const history = await ui.request({ type: 'topic.history', topic: 'agents' });
    const notices = (history.value as { messages: Array<{ kind: string; text: string }> }).messages.filter(m => m.kind === 'aide-tools-migration');
    if (text.endsWith(',\n')) {
      assert.equal(notices.length, 1);
      assert.match(notices[0]!.text, /waits for a valid file/);
    } else assert.equal(notices.length, 0);
    ui.close();
    await hub.stop();
  }
});

test('the migrated Aide can launch a session through its shell frame', { timeout: testWaitMs() }, async t => {
  const root = await tempProject(t);
  const path = join(root, '.cland/roles.toml');
  await mkdir(join(root, '.cland'), { recursive: true });
  await writeFile(path, before);
  const { discovery, fakes } = await projectHub(t, root, {}, { clock: new FakeClock() });
  const ui = await connectUi(t, discovery);
  const launched = await ui.request({ type: 'session.launch', name: 'aide-1', role: 'aide', harness: 'claude-code' });
  assert.equal(launched.ok, true, launched.error);
  const { process } = launched.value as { process: { sessionId: string } };
  const aide = await inProcessSpoke(t, { cwd: root, discover: true, name: 'aide-1', sessionId: process.sessionId, assignRole: false });
  await aide.waitForPresence(['aide-1']);
  const cli = await connectUi(t, discovery, 'cli');
  const result = await cli.request({ type: 'session.launch', as: { name: 'aide-1', sessionId: process.sessionId, shell: true }, name: 'worker', role: 'implementer', harness: 'claude-code' });
  assert.equal(result.ok, true, result.error);
  assert.equal(fakes['claude-code']!.spawns.at(-1)?.name, 'worker');
  assert.equal(fakes['claude-code']!.spawns.at(-1)?.role, 'implementer');
});

test('startup names a customized Aide clause for human review', { timeout: testWaitMs() }, async t => {
  const root = await tempProject(t);
  const path = join(root, '.cland/roles.toml');
  const custom = before.replace(oldRestriction, 'My custom staffing policy.');
  await mkdir(join(root, '.cland'), { recursive: true });
  await writeFile(path, custom);
  const { discovery } = await projectHub(t, root, {}, { clock: new FakeClock() });
  assert.equal(parseRoles(await readFile(path, 'utf8')).get('aide')!.clause, 'My introduction.\nMy custom staffing policy.\nMy closing line.');
  const ui = await connectUi(t, discovery);
  const history = await ui.request({ type: 'topic.history', topic: 'agents' });
  const notices = (history.value as { messages: Array<{ kind: string; text: string }> }).messages.filter(m => m.kind === 'aide-tools-migration');
  assert.equal(notices.length, 1);
  assert.match(notices[0]!.text, /custom Aide clause was kept; review it/);
});

test('a denied migration publication cannot start a hub with default role policy', { timeout: testWaitMs() }, async t => {
  const root = await tempProject(t);
  const path = join(root, '.cland/roles.toml');
  const restricted = '[aide.launch]\nharness = "codex"\nmodel = "human-model"\n[aide.permissions]\ntools = ["who"]\n';
  await mkdir(join(root, '.cland'), { recursive: true });
  await writeFile(path, restricted);
  const rename = fs.rename;
  // System-boundary fault: the real atomic writer reaches a denied rename.
  let denied = false;
  t.mock.method(fs, 'rename', async (...args: Parameters<typeof fs.rename>) => {
    if (args[1] === path) { denied = true; throw Object.assign(new Error('migration publish denied'), { code: 'EACCES' }); }
    return rename(...args);
  });
  syncBuiltinESMExports();
  try {
    const events: Array<Record<string, unknown>> = [];
    await assert.rejects(projectHub(t, root, {}, { clock: new FakeClock(), log: entry => events.push(entry) }), /migration.*publish.*denied/);
    assert.equal(denied, true);
    assert.equal(await readFile(path, 'utf8'), restricted);
    await assert.rejects(stat(join(root, '.cland/hub.json')), { code: 'ENOENT' }, 'no hub can serve fallback grants');
    assert.equal(events.some(entry => entry.event === 'aide-tools-migration-failed'), true);
    assert.equal(events.some(entry => entry.event === 'roles-unreadable'), false, 'valid source is not reported as invalid');
  } finally { t.mock.restoreAll(); syncBuiltinESMExports(); }
});

test('a concurrent roles edit stops startup without replacing the human policy', { timeout: testWaitMs() }, async t => {
  const root = await tempProject(t);
  const path = join(root, '.cland/roles.toml');
  const restricted = '[aide.launch]\nharness = "codex"\nmodel = "human-model"\n[aide.permissions]\ntools = ["who"]\n';
  const edited = restricted.replace('human-model', 'new-human-model').replace('["who"]', '["history"]');
  await mkdir(join(root, '.cland'), { recursive: true });
  await writeFile(path, restricted);
  const read = fs.readFile;
  let reads = 0;
  // System-boundary race: a valid edit arrives at the atomic writer's read-back.
  t.mock.method(fs, 'readFile', async (...args: Parameters<typeof fs.readFile>) => {
    if (args[0] === path && ++reads === 2) await writeFile(path, edited);
    return read(...args);
  });
  syncBuiltinESMExports();
  try {
    const events: Array<Record<string, unknown>> = [];
    await assert.rejects(projectHub(t, root, {}, { clock: new FakeClock(), log: entry => events.push(entry) }), /hub startup stopped.*roles.toml changed while setting it/);
    assert.ok(reads >= 2, 'the writer observed the concurrent edit');
    assert.equal(await readFile(path, 'utf8'), edited);
    await assert.rejects(stat(join(root, '.cland/hub.json')), { code: 'ENOENT' }, 'no hub can serve fallback grants');
    assert.equal(events.some(entry => entry.event === 'aide-tools-migration-failed'), true);
    assert.equal(events.some(entry => entry.event === 'roles-unreadable'), false);
  } finally { t.mock.restoreAll(); syncBuiltinESMExports(); }
});
