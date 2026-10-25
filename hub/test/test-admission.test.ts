// T2: admission's real socket boundary with a complete fake clock; no hub process
// or elapsed-time wait is needed to delay the suite.slot answer beyond 3000 ms.
import './cover-quiet.ts';
import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { createServer, type Socket } from 'node:net';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { assertTestAdmission } from '../src/test-admission.ts';
import { FakeClock } from './fake-clock.ts';
import { AdmissionTimeout } from '../src/test-admission-outcome.ts';
import { projectHub, tempProject, inProcessSpoke } from './harness.ts';
import { sessionUi, sessionShell } from './session-credential-fixture.ts';
import type { TopicMessage, VerificationQueue } from '../src/protocol.ts';

test('a refused session receives one durable test-slot-available notice across disconnect and hub restart', async t => {
  const root = await tempProject(t), clock = new FakeClock();
  const holder = { pid: 123, started: 'fixture-start', token: 'cover', since: clock.now().toISOString(), integrated: 'cover-run' };
  let occupied = true;
  const options = { clock, durationContext: null,
    compatibility: { holder: async () => occupied ? { holder, since: holder.since } : null, occupied: async () => occupied },
  };
  let hub = await projectHub(t, root, {}, options);
  let ui = await sessionUi(t, hub.discovery, 'cli');
  await ui.request({ type: 'role.set', session: 'impl', role: 'implementer' });
  let spoke = await inProcessSpoke(t, { cwd: root, discover: true, name: 'impl', sessionId: 'slot-impl', role: 'implementer' });
  await spoke.waitForPresence(['impl']);
  const env = sessionShell(root, { CLAND_SESSION_NAME: 'impl', CLAND_SESSION_ID: 'slot-impl' });
  await assertTestAdmission(root, { ...env, CLAND_SUITE_LEASE: JSON.stringify(holder) });
  // The production admission client closes its short-lived CLI socket on refusal.
  for (let i = 0; i < 2; i++) await assert.rejects(assertTestAdmission(root, env), /cover-quiet.*test-slot-available.*no polling/);
  await spoke.close(); ui.close(); await hub.stop();
  hub = await projectHub(t, root, {}, options);
  ui = await sessionUi(t, hub.discovery, 'cli');
  spoke = await inProcessSpoke(t, { cwd: root, discover: true, name: 'impl', sessionId: 'slot-impl', role: 'implementer', assignRole: false });
  await spoke.waitForPresence(['impl']);
  const notices = async () => ((await ui.request({ type: 'topic.history', topic: 'agents' })).value as { messages: TopicMessage[] }).messages.filter(m => m.text.startsWith('test-slot-available:'));
  await clock.advance(1000); await hub.verificationSettled();
  assert.deepEqual(await notices(), [], 'no premature notice while the local cover owns the slot');
  assert.deepEqual(((await ui.request({ type: 'suite.queue' })).value as VerificationQueue).waiters, [], 'no suite reservation');
  await ui.request({ type: 'subscribe' });
  const delivered = ui.waitFor(frame => frame.type === 'message' && (frame.message as TopicMessage).text.startsWith('test-slot-available:'));
  const sessionEvent = spoke.waitForEvent(event => event.params.content.includes('test-slot-available:'));
  occupied = false;
  await clock.advance(1000); await hub.verificationSettled();
  const message = (await delivered).message as TopicMessage;
  assert.deepEqual(message.to, ['impl']);
  assert.equal(message.kind, 'report');
  assert.match(message.text, /cover-run/);
  assert.equal((await sessionEvent).params.meta?.msg_id, message.id, 'the refused session receives the exact report');
  assert.equal((await notices())[0]?.id, message.id, 'the wake-up is persisted before delivery');
  await clock.advance(3000); await hub.verificationSettled();
  assert.equal((await notices()).length, 1, 'repeated refusals and scheduler ticks produce one notice');
  await assertTestAdmission(root, env);
  // A later cover needs a fresh one-shot registration, not an eternal subscription.
  occupied = true;
  await assert.rejects(assertTestAdmission(root, env), /test-slot-available wake-up registered/);
  const again = spoke.waitForEvent(event => event.params.content.includes('test-slot-available:') && event.params.meta?.msg_id !== message.id);
  occupied = false;
  await clock.advance(1000); await hub.verificationSettled();
  const second = await again;
  assert.equal((await notices()).length, 2);
  assert.notEqual(second.params.meta?.msg_id, message.id);
});

async function delayedHub(t: TestContext) {
  const root = await mkdtemp(join(tmpdir(), 'cland-admission-'));
  const socketPath = join(root, 'hub.sock');
  const sockets = new Set<Socket>();
  let received!: (reply: (ok?: boolean, error?: string) => void) => void;
  const request = new Promise<(ok?: boolean, error?: string) => void>(resolve => { received = resolve; });
  const server = createServer(socket => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
    socket.on('error', () => {});
    socket.setEncoding('utf8');
    let buffer = '';
    socket.on('data', chunk => {
      buffer += chunk;
      let nl: number;
      while ((nl = buffer.indexOf('\n')) >= 0) {
        const frame = JSON.parse(buffer.slice(0, nl)); buffer = buffer.slice(nl + 1);
        if (frame.type === 'hello') socket.write(JSON.stringify({ type: 'welcome', protocol: 2 }) + '\n');
        else if (frame.type === 'suite.slot') received((ok = true, error) => socket.write(JSON.stringify({ type: 'result', id: frame.id, ok, error }) + '\n'));
      }
    });
  });
  t.after(async () => {
    for (const socket of sockets) socket.destroy();
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    await rm(root, { recursive: true, force: true });
  });
  await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(socketPath, resolve); });
  await mkdir(join(root, '.cland'));
  const discovery = join(root, '.cland', 'hub.json');
  await writeFile(discovery, JSON.stringify({ socket: socketPath, secret: 'fixture', port: 1, pid: process.pid, version: 'fixture' }));
  return { root, request, env: { CLAND_HUB_FILE: discovery } };
}

test('admission accepts a suite.slot answer delayed beyond 3000 ms', async t => {
  const hub = await delayedHub(t);
  const clock = new FakeClock();
  const outcome = assertTestAdmission(hub.root, hub.env, { clock, load: 0, parallelism: 1 }).then(() => 'admitted', error => error);
  const reply = await hub.request;
  await clock.advance(3001);
  reply();
  assert.equal(await outcome, 'admitted');
  assert.equal(clock.pending, 0, 'admission releases its deadline');
});

test('admission preserves the previous hub cover-quiet refusal without new reply fields', async t => {
  const hub = await delayedHub(t);
  const message = 'cover-quiet: integrated run old-cover holds the local test slot; wait for it to finish (only the human may set CLAND_TEST_IGNORE_COVER=1)';
  const outcome = assertTestAdmission(hub.root, hub.env).then(() => undefined, error => error);
  (await hub.request)(false, message);
  assert.equal((await outcome as Error).message, message);
});

test('silent admission ends as a typed infrastructure timeout with a load-scaled bound', async t => {
  for (const [load, deadline] of [[0, 15000], [2, 30000], [100, 60000]] as const) {
    const hub = await delayedHub(t);
    const clock = new FakeClock();
    let settled = false;
    const outcome = assertTestAdmission(hub.root, hub.env, { clock, load, parallelism: 1 }).then(() => undefined, error => error).finally(() => { settled = true; });
    await hub.request;
    await clock.advance(deadline - 1);
    assert.equal(settled, false, 'admission keeps waiting until its own deadline');
    await clock.advance(1);
    const error = await outcome;
    assert.ok(error instanceof AdmissionTimeout);
    assert.equal(error.code, 'CLAND_ADMISSION_TIMEOUT');
    assert.match(error.message, /^admission timed out after \d+ s: project hub busy; not a test result$/);
    assert.equal(error.timeoutMs, deadline);
    assert.equal(clock.pending, 0);
  }
});
