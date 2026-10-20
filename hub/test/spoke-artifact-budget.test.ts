// T2: the MCP artifact tool and real WebSocket edge against a slow fake hub, with virtual time.
import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { WebSocketServer, type WebSocket } from 'ws';
import { PROTOCOL_VERSION } from '../src/protocol.ts';
import { inProcessSpoke, until, type Session } from './harness.ts';
import { FakeClock } from './fake-clock.ts';

/** Bound each receipt independently, preserving setup/call errors as well as missing-receipt errors. */
async function receipt<T>(pending: Promise<T>, what: string): Promise<T> {
  let outcome: { value: T } | { error: unknown } | undefined;
  void pending.then(value => { outcome = { value }; }, error => { outcome = { error }; });
  await until(() => outcome !== undefined, { what });
  if ('error' in outcome!) throw outcome.error;
  return outcome!.value;
}

async function slowHub(t: TestContext) {
  const clock = new FakeClock();
  const server = new WebSocketServer({ port: 0, host: '127.0.0.1' });
  let spoke: Session | undefined;
  t.after(async () => {
    try {
      if (spoke) await receipt(spoke.close(), 'the MCP spoke closes');
    } finally {
      for (const ws of server.clients) ws.terminate();
      await receipt(new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())), 'the fake hub closes');
    }
  });
  await receipt(once(server, 'listening'), 'the fake hub starts listening');
  const creating = Promise.withResolvers<void>();
  const listing = Promise.withResolvers<void>();
  const consumed = Promise.withResolvers<void>();
  const barrierId = 'after-publication-result';
  const creates: Array<{ ws: WebSocket; id: string }> = [];
  const artifacts: Array<{ id: string; path: string; folder: boolean }> = [];
  server.on('connection', ws => ws.on('message', data => {
    const frame = JSON.parse(String(data)) as { type: string; id: string };
    if (frame.type === 'hello') {
      ws.send(JSON.stringify({ type: 'welcome', protocol: PROTOCOL_VERSION, name: 'publisher', presence: [] }));
    } else if (frame.type === 'artifact.create') {
      creates.push({ ws, id: frame.id });
      creating.resolve();
    } else if (frame.type === 'artifact.list') {
      listing.resolve(); // Deliberately hold this ordinary request too.
    } else if (frame.type === 'ack' && frame.id === barrierId) {
      consumed.resolve(); // Ordered WebSocket frames: the preceding result was consumed first.
    }
  }));
  spoke = await receipt(inProcessSpoke(t, {
    hub: { url: `ws://127.0.0.1:${(server.address() as { port: number }).port}` }, clock,
    keepaliveMs: 300_000, // Isolate the request budget from the independent keepalive deadline.
  }), 'the MCP spoke initializes');
  return { clock, spoke, creates, artifacts, creating: creating.promise, listing: listing.promise,
    publish() {
      const acknowledged = receipt(consumed.promise, 'the spoke acknowledges the frame after the publication result');
      const request = creates[0]!;
      const artifact = { id: 'A-1', path: '/artifacts/A-1-evidence', folder: true };
      artifacts.push(artifact);
      request.ws.send(JSON.stringify({ type: 'result', id: request.id, ok: true, value: { artifact } }));
      request.ws.send(JSON.stringify({ type: 'deliver', id: barrierId, message: {
        id: barrierId, from: 'hub', fromKind: 'hub', via: 'hub', to: ['publisher'],
        text: 'Publication result sent', ts: clock.now().toISOString(),
      } }));
      return acknowledged;
    },
  };
}

test('artifact.create returns one folder id after copying exceeds the ordinary 10 s deadline', async t => {
  const f = await slowHub(t);
  let settled = false;
  const call = f.spoke.call<{ ok: boolean; artifact: { id: string } }>('artifact.create', {
    kind: 'file', title: 'Census evidence', topic: 'agents', path: '/large-evidence-folder',
  }).then(value => { settled = true; return value; });
  await receipt(f.creating, 'the fake hub receives artifact.create');
  await f.clock.advance(119_999);
  assert.equal(settled, false, 'creation keeps waiting past the old deadline');
  await f.publish();
  const result = await receipt(call, 'the caller receives the folder artifact id');
  assert.equal(result.ok, true);
  assert.equal(result.artifact.id, 'A-1');
  assert.equal(f.creates.length, 1, 'the spoke never retries a pending publication');
  assert.deepEqual(f.artifacts.map(a => a.id), ['A-1']);
});

test('artifact.create has a bounded 120 s wait while artifact.list retains its 10 s deadline', async t => {
  const f = await slowHub(t);
  const creating = f.spoke.call<{ ok: boolean; error: string }>('artifact.create', {
    kind: 'note', title: 'Stuck copy', topic: 'agents', folder: true,
  });
  const listing = f.spoke.call<{ ok: boolean; error: string }>('artifact.list');
  await receipt(Promise.all([f.creating, f.listing]), 'the fake hub receives create and list');
  await f.clock.advance(10_000);
  assert.deepEqual(await receipt(listing, 'the caller receives the listing timeout'), { ok: false, error: 'the hub did not answer within 10 s' });
  let settled = false;
  void creating.then(() => { settled = true; });
  await f.clock.advance(109_999);
  assert.equal(settled, false);
  await f.clock.advance(1);
  assert.deepEqual(await receipt(creating, 'the caller receives the creation timeout'), { ok: false, error: 'the hub did not answer within 120 s' });
  await f.publish(); // Observe consumption of the late result before checking for duplicate publication.
  assert.equal(f.creates.length, 1);
  assert.deepEqual(f.artifacts.map(a => a.id), ['A-1']);
});
