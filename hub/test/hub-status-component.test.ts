// T2: inspect/start use the real socket edge; fake time models expensive full status collection.
// A small control-only hub isolates liveness from the daemon's unrelated project services.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { createHubBase } from '../src/hub/server.ts';
import { createSocketEdge } from '../src/hub/socket.ts';
import { inspect, runHub } from '../src/cli/hub.ts';
import { askHub } from '../src/cli/socket-client.ts';
import { layout } from '../src/project.ts';
import { FakeClock } from './fake-clock.ts';
import { tempProject } from './harness.ts';

async function fixture(t: test.TestContext, holdStatus?: () => void) {
  const root = await tempProject(t), l = layout(root), clock = new FakeClock();
  const base = { pid: process.pid, port: 0, socket: l.socket, version: 'test', root, startedAt: clock.now().toISOString(), uptimeMs: 0 };
  let statusCalls = 0;
  const control = {
    status: () => { statusCalls++; clock.block(4000); return base; }, stop: () => assert.fail('must not stop the hub'),
  };
  const hub = createHubBase({ secret: 'test', clock, control });
  t.after(() => hub.close());
  if (holdStatus) {
    const open = hub.dispatcher.open.bind(hub.dispatcher);
    t.mock.method(hub.dispatcher, 'open', (...args: Parameters<typeof open>) => {
      const conversation = open(...args);
      return { ...conversation, receive: (line: string) => {
        if (JSON.parse(line).type === 'hub.status') holdStatus();
        else conversation.receive(line);
      } };
    });
  }
  await mkdir(l.dir, { recursive: true });
  const edge = await createSocketEdge({ path: l.socket, dispatcher: hub.dispatcher });
  t.after(() => edge.close());
  const d = { ...base, secret: 'test' };
  await writeFile(l.discovery, JSON.stringify(d));
  statusCalls = 0;
  return { root, l, clock, d, base, control, statusCalls: () => statusCalls };
}

test('inspect and start recognise a serving hub without collecting slow status', async t => {
  const f = await fixture(t);
  assert.equal((await inspect(f.l)).kind, 'live');
  let out = '', err = '';
  assert.equal(await runHub(['start'], f.root, { out: s => { out += s; }, err: s => { err += s; } }), 0, err);
  assert.match(out, /hub already running/);
  assert.equal(f.statusCalls(), 0, 'liveness must not depend on full status');
  const before = f.clock.now().getTime();
  assert.equal((await askHub(f.d, 'hub.status') as { pid: number }).pid, process.pid);
  assert.equal(f.clock.now().getTime() - before, 4000, 'status collection exceeds the 3000 ms probe budget');
});

test('status preserves liveness when full status collection times out', async t => {
  let entered = Promise.withResolvers<void>();
  const f = await fixture(t, () => entered.resolve());
  t.mock.timers.enable({ apis: ['setTimeout'] });
  for (const json of [false, true]) {
    let out = '', err = '';
    entered = Promise.withResolvers<void>();
    const result = runHub(['status', ...(json ? ['--json'] : [])], f.root, { out: s => { out += s; }, err: s => { err += s; } });
    await entered.promise;
    t.mock.timers.tick(3000);
    assert.equal(await result, 0, err);
    assert.equal(err, '');
    if (json) assert.deepEqual(JSON.parse(out), { running: true, root: f.root, pid: process.pid, statusError: `the hub did not answer on ${f.l.socket} within 3000 ms` });
    else {
      assert.match(out, /hub running for/);
      assert.match(out, /full status unavailable: .*within 3000 ms/);
      assert.doesNotMatch(out, /does not answer/);
    }
  }
});

test('full status retains a large fragmented response', async t => {
  const f = await fixture(t);
  // Historical suite selections produced a 13 MB reply in the incident. The
  // transport must join fragments once, retaining Unicode and the final frame.
  const payload = 'status 🐈\n'.repeat(1_000_000);
  f.control.status = () => ({ ...f.base, keys: { layouts: [payload] } });
  const full = await askHub(f.d, 'hub.status') as { keys: { layouts: string[] } };
  assert.deepEqual(full.keys.layouts, [payload]);
});
