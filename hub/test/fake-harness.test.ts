// T2 component: real projectHub socket edges, in-process harnesses, fake time; no child harness or spoke.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { serveProject } from '../src/hub/daemon.ts';
import { layout } from '../src/project.ts';
import { hubResources } from './hub-resources.ts';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { FakeClock } from './fake-clock.ts';
import { fixedRoles } from '../src/roles/config.ts';
import { fakeHarness, FAKE_FLAVOURS } from './fakes/harness.ts';
import { connectSocket, connectUi, dispatcherUi, isolateVerification, projectHub, startHub, tempProject } from './harness.ts';
import type { HarnessProcessView, Message } from '../src/protocol.ts';

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
    assert.equal(request.approval, 'never');
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

test('adapter construction rolls back resources on factory failure or duplicate harness', async t => {
  const root = await tempProject(t);
  for (const failure of ['factory', 'duplicate', 'registered'] as const) {
    const clock = new FakeClock();
    const closed: string[] = [];
    const timerAdapter = (label: string) => (host: import('../src/adapters/contract.ts').AdapterHost) => {
      const fake = fakeHarness(label === 'second' ? 'opencode' : 'codex', { host, clock });
      const timer = clock.setInterval(() => {}, 1000);
      fake.close = () => {
        clock.clearInterval(timer);
        closed.push(label);
        if (label === 'first') throw new Error('cleanup fixture failure');
      };
      return fake;
    };
    const adapters = [timerAdapter('first'), failure === 'factory'
      ? () => { throw new Error('factory fixture failure'); }
      : timerAdapter(failure === 'duplicate' ? 'duplicate' : 'second')];
    if (failure === 'registered') {
      const hub = await startHub({ root, clock, adapters });
      await assert.rejects(hub.close(), /adapter cleanup failed/);
    } else {
      await assert.rejects(startHub({ root, clock, adapters }), /adapter construction and cleanup failed/);
    }
    assert.deepEqual(closed, failure === 'factory' ? ['first'] : failure === 'duplicate' ? ['first', 'duplicate'] : ['second', 'first'], 'one failed close cannot strand another constructed adapter');
    assert.equal(clock.pending, 0, 'factory and hub timers are all disposed');
  }
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
