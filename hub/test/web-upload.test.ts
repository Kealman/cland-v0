// T2: sealed HTTP upload edge and frame readback.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, open, readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { request } from 'node:http';
import { uploadOwner } from './web-upload-owner.ts';
import { FakeClock } from './fake-clock.ts';
import { until } from './until.ts';
import { projectHub, tempProject } from './harness.ts';
import { askHubFrame } from '../src/cli/socket-client.ts';

test('upload authenticates cookie, Origin and Host and caps declared and streamed bodies without publishing', async t => {
  const root = await tempProject(t);
  await mkdir(join(root, '.cland'));
  await writeFile(join(root, '.cland/config.toml'), '[artifacts]\nmax_upload_mb = 1\n');
  const hub = await projectHub(t, root);
  const link = await askHubFrame(hub.discovery, { type: 'web.link' }, 2000, {});
  const url = (link as { url: string }).url;
  const origin = new URL(url).origin;
  const auth = await fetch(url, { redirect: 'manual' });
  const cookie = auth.headers.get('set-cookie')!.split(';')[0]!;
  const post = async (headers: Record<string, string>, body = Buffer.from('bad multipart')) => {
    let status: number | undefined, failure: Error | undefined;
    const req = request(`${origin}/upload`, { method: 'POST', headers: { 'content-type': 'multipart/form-data; boundary=test', ...headers }, agent: false }, res => {
      res.resume(); res.on('end', () => { status = res.statusCode!; });
    });
    req.on('error', error => { if (!['EPIPE', 'ECONNRESET'].includes((error as NodeJS.ErrnoException).code ?? '')) failure = error; });
    let at = 0;
    const write = () => {
      if (status !== undefined || req.destroyed) return;
      if (at >= body.length) { req.end(); return; }
      const chunk = body.subarray(at, at + 16384); at += chunk.length;
      req.write(chunk); setImmediate(write);
    };
    write();
    try {
      await until(() => status !== undefined || failure !== undefined, { what: 'upload HTTP response completed', timeoutMs: 3000 });
      if (failure) throw failure;
      assert.ok(status !== undefined);
      return status;
    } finally { req.destroy(); }
  };
  assert.equal(await post({ origin }), 401);
  assert.equal(await post({ cookie, origin: 'http://foreign.invalid' }), 403);
  assert.equal(await post({ cookie, origin, host: 'foreign.invalid' }), 403);
  assert.equal(await post({ cookie, origin, 'content-length': String(10 * 1024 * 1024 + 1) }), 413);
  assert.equal(await post({ cookie, origin, 'transfer-encoding': 'chunked' }, Buffer.concat([Buffer.from('--test\r\nContent-Disposition: form-data; name="files"; filename="x.txt"\r\n\r\nx\r\n--test--\r\n'), Buffer.alloc(10 * 1024 * 1024)])), 413);
  assert.equal((await fetch(`${origin}/upload`, { headers: { cookie, origin } })).status, 405);
  const history = await askHubFrame(hub.discovery, { type: 'topic.history', topic: 'general' }, 2000, {});
  assert.deepEqual((history as { messages: unknown[] }).messages, []);
  const artifacts = await askHubFrame(hub.discovery, { type: 'artifact.list' }, 2000, {});
  assert.deepEqual((artifacts as { artifacts: unknown[] }).artifacts, []);
  const overFile = new FormData();
  overFile.set('topic', 'general'); overFile.append('files', new Blob([Buffer.alloc(1024 * 1024 + 1)]), 'large.bin');
  assert.equal((await fetch(`${origin}/upload`, { method: 'POST', headers: { cookie, origin }, body: overFile })).status, 413);
  const body = new FormData();
  body.set('topic', 'general'); body.set('text', 'Two files'); body.set('kind', 'question');
  body.append('files', new Blob([Buffer.from('binary\x00\r\n--test-not-a-delimiter')]), 'one.bin');
  body.append('files', new Blob(['second']), 'two.txt');
  const accepted = await fetch(`${origin}/upload`, { method: 'POST', headers: { cookie, origin }, body });
  assert.equal(accepted.status, 200);
  const result = await accepted.json() as { ok: boolean; value: { message: { id: string; text: string }; artifacts: { title: string; path: string }[] } };
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(result.value.message.text, 'Two files');
  assert.deepEqual(result.value.artifacts.map(row => row.title), ['one.bin', 'two.txt']);
  assert.deepEqual(await readFile(result.value.artifacts[0]!.path), Buffer.from('binary\x00\r\n--test-not-a-delimiter'));
  const final = await askHubFrame(hub.discovery, { type: 'topic.history', topic: 'general' }, 2000, {}) as { messages: { id: string }[] };
  assert.deepEqual(final.messages.map(row => row.id), [result.value.message.id]);

});

for (const boundary of ['revoke', 'stop'] as const) test(`upload ${boundary} fences a held writer and joins rollback before returning`, async t => {
  const root = await tempProject(t);
  const released = Promise.withResolvers<void>();
  let writing = false, writerClosed = false;
  const uploadOpen: typeof import('node:fs/promises').open = async (...args) => {
    const handle = await open(...args), write = handle.writeFile.bind(handle), close = handle.close.bind(handle);
    handle.writeFile = async (...args) => { writing = true; await released.promise; return write(...args); };
    handle.close = async () => { await close(); writerClosed = true; };
    return handle;
  };
  const events: string[] = [];
  const hub = await projectHub(t, root, {}, { uploadOpen, log: entry => events.push(String(entry.event)) });
  const { url } = await askHubFrame(hub.discovery, { type: 'web.link' }, 2000, {}) as { url: string };
  const origin = new URL(url).origin;
  const auth = await fetch(url, { redirect: 'manual' });
  const cookie = auth.headers.get('set-cookie')!.split(';')[0]!;
  const sessions = await askHubFrame(hub.discovery, { type: 'web.sessions' }, 2000, {}) as { sessions: { id: string }[] };
  const owner = uploadOwner(t, () => hub.stop(), () => released.resolve());
  const body = new FormData(); body.set('topic', 'general'); body.append('files', new Blob(['held']), 'held.txt');
  const upload = owner.post(`${origin}/upload`, { method: 'POST', headers: { cookie, origin }, body });
  let finished = false;
  try {
    await until(() => writing, { what: 'upload entered native file writer' });
    const cancellation = owner.track(boundary === 'revoke'
      ? askHubFrame(hub.discovery, { type: 'web.revoke', session: sessions.sessions[0]!.id }, 5000, {})
      : hub.stop());
    const completed = owner.track(cancellation.then(() => { finished = true; }));
    if (boundary === 'revoke') await until(async () => {
      const state = await askHubFrame(hub.discovery, { type: 'web.sessions' }, 2000, {}) as { sessions: unknown[] };
      return state.sessions.length === 0;
    }, { what: 'session revocation persisted' });

    else await until(() => events.includes('web-upload-cancelled'), { what: 'web edge closed upload admission' });
    released.resolve();
    await owner.join(completed); await owner.join(upload);
    assert.equal(finished, true);
    assert.equal(writerClosed, true, 'cancellation joined native writer close');
    const readable = boundary === 'revoke' ? hub : await projectHub(t, root);
    {
      const artifacts = await askHubFrame(readable.discovery, { type: 'artifact.list' }, 2000, {}) as { artifacts: unknown[] };
      const history = await askHubFrame(readable.discovery, { type: 'topic.history', topic: 'general' }, 2000, {}) as { messages: unknown[] };
      assert.deepEqual(artifacts.artifacts, []); assert.deepEqual(history.messages, []);
    }
    assert.deepEqual(await readdir(join(root, '.cland/artifacts')), [], 'rollback leaves no prepared file');
  } finally { await owner.dispose(); }
});

test('HTTP file handoff retains one owned allocation through the native writer', async t => {
  const root = await tempProject(t);
  let storage: Buffer | undefined, written: Buffer | undefined;
  const uploadOpen: typeof import('node:fs/promises').open = async (...args) => {
    const handle = await open(...args), write = handle.writeFile.bind(handle);
    handle.writeFile = async (...args) => { assert.ok(Buffer.isBuffer(args[0])); written = args[0]; return write(...args); };
    return handle;
  };
  const hub = await projectHub(t, root, {}, { uploadOpen, uploadAllocate: size => storage = Buffer.allocUnsafeSlow(size) });
  const { url } = await askHubFrame(hub.discovery, { type: 'web.link' }, 2000, {}) as { url: string };
  const origin = new URL(url).origin;
  const auth = await fetch(url, { redirect: 'manual' });
  const cookie = auth.headers.get('set-cookie')!.split(';')[0]!;
  const body = new FormData(); body.set('topic', 'general'); body.append('files', new Blob([Buffer.alloc(16384, 42)]), 'owned.bin');
  const response = await fetch(`${origin}/upload`, { method: 'POST', headers: { cookie, origin }, body });
  assert.equal((await response.json() as { ok: boolean }).ok, true);
  assert.ok(storage && written);
  assert.equal(written.buffer === storage.buffer, true, 'writer receives a view of the single bounded wire allocation');
  assert.deepEqual(written, Buffer.alloc(16384, 42));
});

for (const failure of ['omitted', 'aborted'] as const) test(`upload owner drains HTTP and writers after ${failure} setup receipt`, async t => {
  const root = await tempProject(t), released = Promise.withResolvers<void>();
  const clock = new FakeClock(), setupAbort = new AbortController();
  let acquired = false, writerClosed = false;
  const uploadOpen: typeof open = async (...args) => {
    const handle = await open(...args), close = handle.close.bind(handle);
    handle.close = async () => { await close(); writerClosed = true; };
    acquired = true; await released.promise; return handle;
  };
  const hub = await projectHub(t, root, {}, { uploadOpen });
  const owner = uploadOwner(t, () => hub.stop(), () => released.resolve());
  const { url } = await askHubFrame(hub.discovery, { type: 'web.link' }, 2000, {}) as { url: string };
  const origin = new URL(url).origin;
  const auth = await fetch(url, { redirect: 'manual', signal: owner.signal });
  const cookie = auth.headers.get('set-cookie')!.split(';')[0]!;
  // Observe setup before POST; deliberately withhold its receipt while real I/O is owned.
  const starting = owner.setup(new Promise<void>(() => {}), { clock, signal: setupAbort.signal });
  const rejected = assert.rejects(starting, failure === 'omitted' ? /upload setup receipt deadline/ : /setup cancelled/);
  const body = new FormData(); body.set('topic', 'general'); body.append('files', new Blob(['held setup']), 'setup.txt');
  const upload = owner.post(`${origin}/upload`, { method: 'POST', headers: { cookie, origin }, body });
  try {
    await until(() => acquired, { what: 'HTTP upload acquired held native handle' });
    if (failure === 'omitted') await clock.advance(1000);
    else setupAbort.abort(new Error('upload setup cancelled'));
    await rejected;
    await owner.dispose();
    const result = await owner.join(upload);
    assert.equal(result.outcome, 'closed');
    assert.equal(owner.signal.aborted, true);
    assert.equal(writerClosed, true);
    assert.equal(owner.pending(), 0);
    assert.equal(clock.pending, 0);
    assert.deepEqual(await readdir(join(root, '.cland/artifacts')), []);
    const restarted = await projectHub(t, root);
    const artifacts = await askHubFrame(restarted.discovery, { type: 'artifact.list' }, 2000, {}) as { artifacts: unknown[] };
    const history = await askHubFrame(restarted.discovery, { type: 'topic.history', topic: 'general' }, 2000, {}) as { messages: unknown[] };
    assert.deepEqual(artifacts.artifacts, []); assert.deepEqual(history.messages, []);
  } finally { await owner.dispose(); }
});
