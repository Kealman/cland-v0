// T2 component: real projectHub socket edges, in-process harnesses, fake time; no child harness or spoke.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { serveProject } from '../src/hub/daemon.ts';
import { layout } from '../src/project.ts';
import { hubResources } from './hub-resources.ts';
import { mkdir, writeFile } from 'node:fs/promises';
import { realClock } from '../src/hub/clock.ts';
import { createHub } from '../src/hub/server.ts';
import { Store } from '../src/hub/store.ts';
import { DatabaseSync } from 'node:sqlite';
import { fixtureEnvironment } from './fixture-environment.ts';
import { fixtureNativeGuard } from './fake-native-guard.ts';
import { ownDirectory, guardDirectoryRemoval, beforeDirectories, fenceFixtureCleanup } from './process-cleanup.ts';
import { caseDeadlines } from './case-deadlines.ts';
import { join } from 'node:path';
import { setImmediate as yieldIO } from 'node:timers/promises';
import { FakeClock } from './fake-clock.ts';
import { fixedRoles } from '../src/roles/config.ts';
import { fakeHarness, FAKE_FLAVOURS } from './fakes/harness.ts';
import { connectSocket, connectUi, dispatcherUi, inProcessSpoke, isolateVerification, projectHub, startHub, tempProject } from './harness.ts';
import type { HarnessProcessView, Message } from '../src/protocol.ts';

test('scratch removal stops its hub and joins lease index writes before removing the root', async t => {
  const run = caseDeadlines(t, { ownership: { beforeDirectories, guardDirectoryRemoval } });
  return run.run(async step => {
  let hub: Awaited<ReturnType<typeof startHub>> | undefined;
  const stopHub = async () => { await hub?.close(); };
  run.fixtures.after(stopHub);
  const root = await step(() => run.wait('root setup', async () => {
    const parent = await tempProject(run.fixtures, 'cland-harness-parent-');
    run.adoptRoot(parent);
    guardDirectoryRemoval(parent, stopHub);
    return tempProject(run.fixtures, 'cland-harness-subject-', parent);
  }));
  const remove = ownDirectory(undefined, root);
  await step(() => run.wait('hub setup', async () => { hub = await startHub({ control: { status: () => ({ root, pid: process.pid, port: 0, socket: '', version: 'test', startedAt: '', uptimeMs: 0 }), stop() {} } }); }));
  await step(() => run.wait('guarded removal', remove));
  assert.equal(existsSync(root), false);
  await step(() => run.wait('joined stop', () => hub!.close()));
  assert.throws(() => hub!.core.store.meta('executor-leases'), /closed|not open/i);
  });
});

test('a failed directory guard still joins every other writer and preserves its error', async t => {
  const run = caseDeadlines(t, { ownership: { beforeDirectories, guardDirectoryRemoval } });
  return run.run(async step => {
  const failure = new Error('controlled writer failure');
  let fail = true, joined = false;
  run.fixtures.after(() => { fail = false; });
  const root = await step(() => run.wait('root setup', async () => {
    const parent = await tempProject(run.fixtures, 'cland-harness-parent-');
    run.adoptRoot(parent);
    return tempProject(run.fixtures, 'cland-harness-subject-', parent);
  }));
  const remove = ownDirectory(undefined, root);
  guardDirectoryRemoval(root, () => { if (fail) throw failure; });
  guardDirectoryRemoval(root, async () => { await yieldIO(); joined = true; });
  await step(() => run.wait('refused removal', () => assert.rejects(remove(), error => error === failure)));
  assert.equal(joined, true);
  assert.equal(existsSync(root), true, 'unconfirmed writer retains its root');
  fail = false;
  await step(() => run.wait('recovered removal', remove));
  });
});

test('hub stop guard rejects a live timer from hub startup and observes recovery', async t => {
  let timer: ReturnType<typeof setInterval> | undefined;
  const run = caseDeadlines(t, { ownership: { beforeDirectories, guardDirectoryRemoval }, releaseOnClose: () => clearInterval(timer) });
  return run.run(async step => {
  let hub: Awaited<ReturnType<typeof startHub>> | undefined;
  run.fixtures.after(async () => { clearInterval(timer); await hub?.close(); });
  await step(() => run.wait('timer hub setup', async () => { hub = await startHub({ clock: { ...realClock, setInterval: (callback, ms) => {
    timer ??= setInterval(() => {}, 60000);
    return realClock.setInterval(callback, ms);
  } } }); }));
    assert.ok(timer, 'startup created the positive-control leak');
    await step(() => run.wait('leak refusal', () => assert.rejects(hub!.close(), /leaked resources.*|Timeout/s)));
    clearInterval(timer);
    await step(() => run.wait('positive stop recovery', () => hub!.close()));
  });
});

test('resource observation survives failure and records new work before positive drain', async t => {
  const timers: Array<ReturnType<typeof setInterval>> = [];
  const run = caseDeadlines(t, { ownership: { beforeDirectories, guardDirectoryRemoval }, releaseOnClose: () => timers.forEach(clearInterval) });
  return run.run(async step => {
    const resources = hubResources();
    run.fixtures.after(() => { timers.forEach(clearInterval); resources.cancel(); });
    const first = resources.run(() => setInterval(() => {}, 60000));
    timers.push(first);
    await step(() => run.wait('first resource refusal', () => assert.rejects(resources.check(), /Timeout/)));
    clearInterval(first);
    const second = resources.run(() => setInterval(() => {}, 60000));
    timers.push(second);
    await step(() => run.wait('new resource refusal', () => assert.rejects(resources.check(), /Timeout/)));
    clearInterval(second);
    await step(() => run.wait('positive resource drain', () => resources.check()));
  });
});

test('failed hub close retains its guarded root until the owner positively recovers', async t => {
  const run = caseDeadlines(t, { ownership: { beforeDirectories, guardDirectoryRemoval } });
  return run.run(async step => {
    let hub: Awaited<ReturnType<typeof startHub>> | undefined;
    let refuse = true;
    const stopHub = async () => { await hub?.close(); };
    run.fixtures.after(async () => { refuse = false; await stopHub(); });
    const root = await step(() => run.wait('root setup', async () => {
      const parent = await tempProject(run.fixtures, 'cland-harness-parent-');
      run.adoptRoot(parent);
      guardDirectoryRemoval(parent, stopHub);
      return tempProject(run.fixtures, 'cland-harness-subject-', parent);
    }));
    const remove = ownDirectory(undefined, root);
    await step(() => run.wait('hub setup', async () => { hub = await startHub({ root }); }));
    const failure = new Error('controlled incomplete close');
    const close = hub!.core.store.close.bind(hub!.core.store);
    let attempts = 0, sibling = 0;
    t.mock.method(hub!.core.store, 'close', () => { attempts++; if (refuse) throw failure; close(); });
    guardDirectoryRemoval(root, async () => { await yieldIO(); sibling++; });
    await step(() => run.wait('first failed close', () => assert.rejects(hub!.close(), error => error === failure)));
    await step(() => run.wait('refused guarded removal', () => assert.rejects(remove(), error => error === failure)));
    assert.equal(existsSync(root), true, 'the actual guarded cleanup retained its root');
    assert.equal(attempts, 2, 'removal retried the failed owner');
    assert.equal(sibling, 1, 'the sibling guard was joined despite close rejection');
    refuse = false;
    await step(() => run.wait('recovered guarded removal', remove));
    assert.equal(attempts, 3);
    assert.equal(sibling, 2);
    assert.equal(existsSync(root), false);
    assert.throws(() => hub!.core.store.meta('executor-leases'), /closed|not open/i);
  });
});

test('projectHub drives fake harness lifecycle and delivery outcomes across flavours', async t => {
  const roles = ['implementer', 'reviewer', 'qa'];
  const root = await tempProject(t);
  await mkdir(join(root, '.cland'), { recursive: true });
  await writeFile(join(root, '.cland/roles.toml'), FAKE_FLAVOURS.map((flavour, i) => `[${roles[i]}]\nclause = "Work carefully ${i}."\n[${roles[i]}.launch]\nharness = "${flavour}"\napproval = "never"\n`).join('\n'));
  const clock = new FakeClock();
  const { discovery, fakes } = await projectHub(t, root, {}, { clock, harnesses: 'fake' });
  const ui = await connectUi(t, discovery);
  assert.equal((await ui.request({ type: 'subscribe' })).ok, true);
  const list = async (name: string) => {
    const reply = await ui.request({ type: 'session.list' });
    assert.equal(reply.ok, true, reply.error);
    return (reply.value as { processes: HarnessProcessView[] }).processes.find(p => p.name === name)!;
  };
  for (const [i, flavour] of FAKE_FLAVOURS.entries()) {
    const fake = fakes[flavour]!;
    const name = `worker${i}`;
    const launched = await ui.request({ type: 'session.launch', name, role: roles[i], brief: 'One-time brief' });
    assert.equal(launched.ok, true, launched.error);
    const request = fake.spawns[0]!;
    assert.equal(request.cwd, root);
    assert.equal(request.approval, flavour === 'opencode' ? undefined : 'never', `${flavour}: only OpenCode keeps its own approval policy`);
    assert.match(request.clause!, new RegExp(`Work carefully ${i}`));
    assert.match(request.brief!.text, /One-time brief/);
    const process = await list(name);
    assert.equal(process.harness, flavour, 'roles.toml resolves the production harness name');
    assert.equal(process.pid, null, 'the fake owns no child');
    assert.equal(process.startedAt, clock.now().toISOString());
    const peer = await connectSocket(discovery.socket);
    t.after(() => peer.close());
    peer.send({ type: 'hello', protocol: 2, secret: discovery.secret, name, sessionId: process.sessionId, cwd: root, launchToken: request.launchToken });
    assert.equal((await peer.next()).type, 'welcome');
    let first;
    do {
      first = await peer.next();
      assert.ok(first.type === 'role' || first.type === 'deliver');
      peer.send({ type: 'ack', id: first.id });
    } while (first.id !== request.brief!.id);
    await ui.waitFor(f => f.type === 'delivery' && f.message === request.brief!.id && f.stage === 'injected');
    fake.idle(name);
    assert.equal((await list(name)).state, 'idle');
    fake.turn(name, { afterMs: 100, model: 'test-model', usage: { total: { totalTokens: 15, inputTokens: 12, outputTokens: 3, reasoningTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 } } });
    assert.equal((await list(name)).state, 'busy');
    await clock.advance(99);
    assert.equal((await list(name)).state, 'busy');
    await clock.advance(1);
    assert.equal((await list(name)).state, 'idle');
    assert.equal((await list(name)).model, 'test-model');
    assert.deepEqual((await list(name)).usage?.total, { totalTokens: 15, inputTokens: 12, outputTokens: 3, reasoningTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 });

    for (const [outcome, stage] of [['accept', 'injected'], ['reject', 'delivered'], ['uncertain', 'uncertain'], ['hold', 'delivered']] as const) {
      fake.scriptInject(name, outcome);
      const sent = await ui.request({ type: 'topic.send', topic: 'general', to: [name], text: outcome });
      assert.equal(sent.ok, true, sent.error);
      const message = (sent.value as { message: Message }).message;
      let delivery;
      do { delivery = await peer.next(); } while (delivery.type !== 'deliver' || delivery.id !== message.id);
      peer.send({ type: 'ack', id: delivery.id });
      if (outcome === 'uncertain') await ui.waitFor(f => f.type === 'event' && String((f.row as { text: string }).text).includes(`retry ${name} ${message.id}`));
      else await ui.waitFor(f => f.type === 'delivery' && f.message === message.id && f.stage === stage);
      // A correlated request runs after the ack/inject microtasks, including a rejection.
      const history = await ui.request({ type: 'topic.history', topic: 'general' });
      assert.equal((history.value as { messages: Array<Message & { stage: string }> }).messages.find(m => m.id === message.id)?.stage, outcome === 'uncertain' ? 'delivered' : stage);
      assert.equal(fake.injections.at(-1)?.outcome, outcome);
      if (outcome === 'uncertain') {
        const attempts = () => fake.injections.filter(input => input.message.id === message.id).length;
        const before = attempts();
        fake.busy(name);
        fake.idle(name);
        await ui.request({ type: 'session.list' });
        assert.equal(attempts(), before, 'uncertain inputs never replay on idle');
        assert.equal((await ui.request({ type: 'session.retry', session: name, message: message.id })).ok, true, 'only an uncertain receipt permits explicit retry');
        await ui.waitFor(f => f.type === 'delivery' && f.message === message.id && f.stage === 'injected');
        assert.equal((await ui.request({ type: 'session.retry', session: name, message: message.id })).ok, false);
      }
      if (outcome === 'hold') {
        fake.settle(name, message.id);
        await ui.waitFor(f => f.type === 'delivery' && f.message === message.id && f.stage === 'injected');
      }
    }
    fake.scriptResume(name, 'found');
    assert.equal((await ui.request({ type: 'session.resume', session: name })).ok, true);
    assert.equal(fake.resumes.length, 1);
    const stopped = await ui.request({ type: 'session.stop', session: name });
    assert.equal(stopped.ok, true, stopped.error);
    assert.equal((await list(name)).status, 'stopped');
    assert.equal(fake.stops.length, 1);
    fake.scriptResume(name, 'found');
    assert.equal((await ui.request({ type: 'session.resume', session: name })).ok, true);
    assert.equal((await list(name)).status, 'running');
    if (flavour === 'codex') fake.crash(name);
    else fake.exit(name, 0);
    assert.equal((await list(name)).status, 'exited');
    assert.equal((await list(name)).state, 'unknown');
    fake.scriptResume(name, 'gone');
    const gone = await ui.request({ type: 'session.resume', session: name });
    assert.equal(gone.ok, true, gone.error);
    assert.equal((gone.value as { found: boolean }).found, false);
    peer.close();
  }
});

test('createHub installs adapter replacements and owns their clock cleanup', async t => {
  const root = await tempProject(t);
  const clock = new FakeClock();
  let fake!: ReturnType<typeof fakeHarness>;
  const hub = await startHub({ root, clock, roles: fixedRoles(), adapters: [(host, clock) => (fake = fakeHarness('codex', { host, clock }))] });
  let closed = false;
  t.after(() => closed ? undefined : hub.close());
  const ui = await dispatcherUi(t, hub.dispatcher, root);
  const launched = await ui.request({ type: 'session.launch', name: 'impl', role: 'implementer', harness: 'codex' });
  assert.equal(launched.ok, true, launched.error);
  assert.match(fake.spawns[0]!.clause!, /you hold the role Implementer/);
  fake.turn('impl', { afterMs: 500 });
  assert.ok(clock.pending > 0);
  ui.close();
  await hub.close();
  closed = true;
  assert.equal(clock.pending, 0);
});

test('hub close retries only failed adapters after preserving the original failure', async t => {
  const run = caseDeadlines(t, { ownership: { beforeDirectories, guardDirectoryRemoval } });
  return run.run(async step => {
  await step(() => run.wait('native guard setup', () => fixtureNativeGuard(t, { fenced: true })));
  let hub: Awaited<ReturnType<typeof createHub>> | undefined;
  let resources: ReturnType<typeof hubResources> | undefined;
  let completed = false, refuseAdapter = true;
  const dispose = async () => {
    if (hub && !completed) { await hub.close(); completed = true; }
    await resources?.check();
  };
  run.fixtures.after(async () => { refuseAdapter = false; await dispose(); });
  const nativeCloses = new Map<DatabaseSync, number>();
  const nativeClose = DatabaseSync.prototype.close;
  fenceFixtureCleanup(t).release(() => { DatabaseSync.prototype.close = nativeClose; });
  DatabaseSync.prototype.close = function (this: DatabaseSync) {
    nativeCloses.set(this, (nativeCloses.get(this) ?? 0) + 1);
    return nativeClose.call(this);
  };
  let parent!: string;
  const root = await step(() => run.wait('root setup', async () => {
    const scopeRoot = await tempProject(run.fixtures, 'cland-close-scope-');
    run.adoptRoot(scopeRoot);
    guardDirectoryRemoval(scopeRoot, dispose);
    parent = await tempProject(run.fixtures, 'cland-close-parent-', scopeRoot);
    guardDirectoryRemoval(parent, dispose);
    const root = await tempProject(run.fixtures, 'cland-close-subject-', parent);
    guardDirectoryRemoval(root, dispose);
    return root;
  }));
  const clock = new FakeClock();
  const failure = new Error('controlled adapter disposal failure');
  const attempts = [0, 0, 0];
  const remove = ownDirectory(undefined, parent);
  await step(() => run.wait('direct hub setup', async () => { resources = hubResources(); hub = await resources.run(() => createHub({ port: 0, host: '127.0.0.1', secret: 'test', root, clock,
    env: fixtureEnvironment(root, process.env),
    adapters: ['claude-code', 'opencode', 'codex'].map((harness, index) => (host, clock) => {
      const fake = fakeHarness(harness as 'claude-code' | 'opencode' | 'codex', { host, clock });
      const close = fake.close.bind(fake);
      fake.close = () => {
        attempts[index]!++;
        if (index === 2 && refuseAdapter) throw failure;
        return close();
      };
      return fake;
    }),
  })); }));
  const original = (error: unknown): boolean => error === failure || error instanceof AggregateError && error.errors.length > 0 && error.errors.every(original);
  await step(() => run.wait('original failed close', () => assert.rejects(hub!.close(), original)));
  assert.deepEqual([...nativeCloses.values()], [1, 1], 'both native databases closed despite the adapter failure');
  const closeSeam = DatabaseSync.prototype.close;
  await step(() => run.wait('refused parent removal', () => assert.rejects(remove(), original)));
  assert.equal(existsSync(parent), true, 'failed disposal retains the enclosing parent');
  assert.equal(existsSync(root), true, 'failed disposal retains the guarded root');
  assert.equal(DatabaseSync.prototype.close, closeSeam, 'failed disposal retains the native close seam');
  assert.deepEqual(attempts, [1, 1, 2], 'guarded removal retries only the failed adapter');
  refuseAdapter = false;
  await step(() => run.wait('repaired parent removal', remove));
  assert.equal(existsSync(parent), false, 'positive disposal permits enclosing parent removal');
  assert.equal(existsSync(root), false, 'positive disposal permits guarded removal');
  assert.deepEqual(attempts, [1, 1, 3]);
  await step(() => run.wait('completed close no-op', () => hub!.close()));
  assert.deepEqual(attempts, [1, 1, 3]);
  assert.equal(clock.pending, 0);
  assert.deepEqual([...nativeCloses.values()], [1, 1], 'retry never repeats a successful native close');
  });
});

test('hub close preserves the adapter outcome alongside retryable native close failures', async t => {
  const run = caseDeadlines(t, { ownership: { beforeDirectories, guardDirectoryRemoval } });
  return run.run(async step => {
  await step(() => run.wait('native guard setup', () => fixtureNativeGuard(t, { fenced: true })));
  let hub: Awaited<ReturnType<typeof createHub>> | undefined;
  let resources: ReturnType<typeof hubResources> | undefined;
  let completed = false;
  const dispose = async () => {
    if (hub && !completed) { await hub.close(); completed = true; }
    await resources?.check();
  };
  run.fixtures.after(dispose);
  const root = await step(() => run.wait('root setup', async () => {
    const parent = await tempProject(run.fixtures, 'cland-close-parent-');
    run.adoptRoot(parent);
    guardDirectoryRemoval(parent, dispose);
    const root = await tempProject(run.fixtures, 'cland-close-subject-', parent);
    guardDirectoryRemoval(root, dispose);
    return root;
  }));
  const clock = new FakeClock();
  const adapterFailure = new Error('controlled asynchronous adapter failure');
  const nativeFailures: Error[] = [];
  const attempts = new Map<DatabaseSync, number>();
  const nativeClose = DatabaseSync.prototype.close;
  fenceFixtureCleanup(t).release(() => { DatabaseSync.prototype.close = nativeClose; });
  DatabaseSync.prototype.close = function (this: DatabaseSync) {
    const count = (attempts.get(this) ?? 0) + 1;
    attempts.set(this, count);
    if (count === 1) {
      const error = new Error('controlled native database close failure');
      nativeFailures.push(error);
      throw error;
    }
    return nativeClose.call(this);
  };
  let adapterAttempts = 0;
  await step(() => run.wait('direct hub setup', async () => { resources = hubResources(); hub = await resources.run(() => createHub({ port: 0, host: '127.0.0.1', secret: 'test', root, clock,
    env: fixtureEnvironment(root, process.env),
    adapters: ['claude-code', 'opencode', 'codex'].map(harness => (host, clock) => {
      const fake = fakeHarness(harness as 'claude-code' | 'opencode' | 'codex', { host, clock });
      if (harness === 'codex') {
        const close = fake.close.bind(fake);
        fake.close = async () => { if (++adapterAttempts === 1) throw adapterFailure; await close(); };
      }
      return fake;
    }),
  })); }));
  const flatten = (error: unknown): unknown[] => error instanceof AggregateError ? error.errors.flatMap(flatten) : [error];
  await step(() => run.wait('concurrent failed close receipts', async () => {
  const firstClose = hub!.close();
  assert.equal(hub!.close(), firstClose, 'concurrent callers join the owned close');
  await assert.rejects(firstClose, error => {
    assert.deepEqual(flatten(error), [adapterFailure, ...nativeFailures]);
    assert.equal(nativeFailures.length, 2);
    return true;
  });
  }));
  await step(() => run.wait('repaired close receipts', dispose));
  await step(() => run.wait('completed close no-op', () => hub!.close()));
  assert.deepEqual([...attempts.values()], [2, 2], 'only failed native closes are retried');
  assert.equal(adapterAttempts, 2);
  assert.equal(clock.pending, 0);
  });
});

test('hub close drops a pending injection retry before closing its process table', async t => {
  const root = await tempProject(t);
  const logs: unknown[] = [];
  const { discovery, fakes, stop } = await projectHub(t, root, {}, { clock: new FakeClock(), log: entry => logs.push(entry) });
  const fake = fakes['claude-code']!;
  // The fake bridge provides the connection receipt; Sessions owns the retry it triggers.
  Object.assign(fake, { bridge: () => () => true });
  const ui = await connectUi(t, discovery);
  assert.equal((await ui.request({ type: 'subscribe' })).ok, true);
  const launched = await ui.request({ type: 'session.launch', name: 'worker', role: 'implementer', harness: 'claude-code', brief: 'Start work' });
  assert.equal(launched.ok, true, launched.error);
  const process = (launched.value as { process: HarnessProcessView }).process;
  const peer = await connectSocket(discovery.socket);
  t.after(() => peer.close());
  peer.send({ type: 'hello', protocol: 2, secret: discovery.secret, name: 'worker', sessionId: process.sessionId, cwd: root, launchToken: fake.spawns[0]!.launchToken });
  const welcome = await peer.next();
  assert.equal(welcome.type, 'welcome', String(welcome.message));
  let first;
  do {
    first = await peer.next();
    assert.ok(first.type === 'role' || first.type === 'deliver');
    peer.send({ type: 'ack', id: first.id });
  } while (first.id !== fake.spawns[0]!.brief!.id);
  await ui.waitFor(f => f.type === 'delivery' && f.message === first.id && f.stage === 'injected');
  fake.scriptInject('worker', 'hold');
  const sent = await ui.request({ type: 'topic.send', topic: 'general', to: ['worker'], text: 'Pending at shutdown' });
  assert.equal(sent.ok, true, sent.error);
  const message = (sent.value as { message: Message }).message;
  const delivery = await peer.next();
  assert.equal(delivery.id, message.id);
  peer.send({ type: 'ack', id: message.id });
  await ui.waitFor(f => f.type === 'delivery' && f.message === message.id && f.stage === 'delivered');
  assert.equal((await ui.request({ type: 'session.bridge', session: 'worker' })).ok, true);
  const attempts = () => fake.injections.filter(input => input.message.id === message.id).length;
  assert.equal(attempts(), 1, 'retry stays pending while injection is held');
  // close rejects the held adapter promise; its retry continuation must not access closed resources.
  await stop();
  assert.equal(attempts(), 1, 'shutdown never retries a cancelled injection');
  assert.ok(!JSON.stringify(logs).includes('database is not open'));
});

test('hub close discards injection outcomes arriving after storage closes', async t => {
  const root = await tempProject(t);
  const logs: unknown[] = [];
  const { discovery, fakes, stop } = await projectHub(t, root, {}, { clock: new FakeClock(), log: entry => logs.push(entry) });
  const fake = fakes['claude-code']!;
  const close = fake.close.bind(fake);
  // Model an adapter whose outstanding transport callbacks settle after close returns.
  fake.close = () => {};
  t.after(close);
  const ui = await connectUi(t, discovery);
  assert.equal((await ui.request({ type: 'subscribe' })).ok, true);
  const pending: Array<{ name: string; id: string; outcome: 'accept' | 'reject' | 'uncertain' }> = [];
  for (const outcome of ['accept', 'reject', 'uncertain'] as const) {
    const name = `worker-${outcome}`;
    const launched = await ui.request({ type: 'session.launch', name, role: 'implementer', harness: 'claude-code', brief: outcome });
    assert.equal(launched.ok, true, launched.error);
    const process = (launched.value as { process: HarnessProcessView }).process;
    const request = fake.spawns.at(-1)!;
    fake.scriptInject(name, 'hold');
    await inProcessSpoke(t, { cwd: root, discover: true, name, sessionId: process.sessionId, launchToken: request.launchToken! });
    await ui.waitFor(f => f.type === 'delivery' && f.message === request.brief!.id && f.stage === 'delivered');
    pending.push({ name, id: request.brief!.id, outcome });
  }
  assert.equal(fake.injections.length, pending.length, 'all outcomes are held before shutdown');
  await stop();
  for (const { name, id, outcome } of pending) fake.settle(name, id, outcome);
  // Let the settled promise chains and Node's unhandled-rejection check run in this test.
  await yieldIO();
  assert.ok(!JSON.stringify(logs).includes('database is not open'));
  assert.equal(fake.injections.length, pending.length, 'late outcomes never start another injection');
});

test('adapter construction rolls back resources on factory failure or duplicate harness', async t => {
  const run = caseDeadlines(t, { ownership: { beforeDirectories, guardDirectoryRemoval } });
  return run.run(async step => {
  const root = await step(() => run.wait('root setup', async () => { const root = await tempProject(t); run.adoptRoot(root); return root; }));
  for (const failure of ['factory', 'duplicate', 'registered'] as const) {
    const clock = new FakeClock();
    const closed: string[] = [];
    const closeFailure = new Error('cleanup fixture failure');
    const timerAdapter = (label: string) => (host: import('../src/adapters/contract.ts').AdapterHost) => {
      const fake = fakeHarness(label === 'second' ? 'opencode' : 'codex', { host, clock });
      const timer = clock.setInterval(() => {}, 1000);
      fake.close = () => {
        clock.clearInterval(timer);
        closed.push(label);
        if (label === 'first') throw closeFailure;
      };
      return fake;
    };
    const adapters = [timerAdapter('first'), failure === 'factory'
      ? () => { throw new Error('factory fixture failure'); }
      : timerAdapter(failure === 'duplicate' ? 'duplicate' : 'second')];
    if (failure === 'registered') {
      // This negative production seam has a known post-disposal diagnostic,
      // not a retryable fixture stop. Own its native completion separately.
      const resources = hubResources();
      const store = new Store();
      const nativeClose = store.close.bind(store);
      let storeClosed = false;
      store.close = () => { nativeClose(); storeClosed = true; };
      let hub: Awaited<ReturnType<typeof createHub>> | undefined;
      let disposal: Promise<void> | undefined;
      const expected = (error: unknown): boolean => error === closeFailure || (error instanceof AggregateError && error.errors.length > 0 && error.errors.every(expected));
      const dispose = () => disposal ??= (async () => {
        if (hub) {
          await assert.rejects(hub.close(), error => expected(error));
          assert.equal(storeClosed, true, 'base storage native close completed despite the adapter diagnostic');
          assert.deepEqual(closed, ['second', 'first'], 'both fixture adapter disposal receipts arrived');
        } else if (!storeClosed) store.close();
        await resources.check();
      })();
      run.fixtures.after(dispose);
      guardDirectoryRemoval(root, dispose);
      await step(() => run.wait('direct hub setup', async () => { hub = await resources.run(() => createHub({ port: 0, host: '127.0.0.1', secret: 'test', root, clock, adapters, store })); }));
      await step(() => run.wait('direct failed-close receipts', dispose));
    } else {
      await step(() => run.wait('failed construction cleanup', () => assert.rejects(startHub({ root, clock, adapters }), /adapter construction and cleanup failed/)));
    }
    assert.deepEqual(closed, failure === 'factory' ? ['first'] : failure === 'duplicate' ? ['first', 'duplicate'] : ['second', 'first'], 'one failed close cannot strand another constructed adapter');
    assert.equal(clock.pending, 0, 'factory and hub timers are all disposed');
  }
  });
});

test('serveProject releases its listeners and lock after adapter startup or cleanup failure', async t => {
  const root = await tempProject(t);
  await isolateVerification(root);
  for (const mode of ['factory', 'close'] as const) {
    const clock = new FakeClock();
    const resources = hubResources();
    const failure = new Error(`${mode} fixture failure`);
    const containsFailure = (error: unknown): boolean => error === failure || (error instanceof AggregateError && error.errors.some(containsFailure)) || (error instanceof Error && containsFailure(error.cause));
    // Match projectHub's isolation even though this failure test serves the project directly.
    const env: NodeJS.ProcessEnv = {};
    for (const [key, value] of Object.entries(process.env)) if (!key.startsWith('CLAND_')) env[key] = value;
    Object.assign(env, { DIGITALOCEAN_TOKEN: '', CLAND_EXECUTOR_STATE: join(root, '.cland/executor-state'), CLAND_TEST_SKIP_ORPHAN_SWEEP: '1' });
    const options = {
      clock, log: () => {}, env,
      git: async () => null,
      readBase: async () => null,
      processes: { alive: (pid: number) => pid === process.pid, started: () => null },
    };
    try {
      const adapter = (host: import('../src/adapters/contract.ts').AdapterHost) => {
        const fake = fakeHarness('codex', { host, clock });
        const timer = clock.setInterval(() => {}, 1000);
        fake.close = () => { clock.clearInterval(timer); if (mode === 'close') throw failure; };
        return fake;
      };
      if (mode === 'factory') {
        await assert.rejects(resources.run(() => serveProject(root, { ...options, adapters: [adapter, () => { throw failure; }] })), error => error === failure);
      } else {
        const daemon = await resources.run(() => serveProject(root, { ...options, adapters: [adapter] }));
        await assert.rejects(daemon.stop(), containsFailure);
        await daemon.stopped;
      }
      const paths = layout(root);
      assert.equal(existsSync(paths.discovery), false);
      assert.equal(existsSync(paths.socket), false);
      assert.equal(existsSync(paths.lock), false);
      assert.equal(clock.pending, 0);
      // Reopening the same project proves the failed owner released its durable resources.
      const successor = await resources.run(() => serveProject(root, { ...options, adapters: FAKE_FLAVOURS.map(flavour => host => fakeHarness(flavour, { host, clock })) }));
      await successor.stop();
      assert.equal(clock.pending, 0);
    } finally {
      await resources.check();
    }
  }
});
