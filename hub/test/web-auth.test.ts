import { createServer } from 'node:net';
import { parseConfig } from '../src/init/config.ts';
import { phoneOrigin } from '../src/web-address.ts';
import { decodeTerminalQr } from './qr-decode.ts';
// T2: the executable CLI and HTTP authentication against an in-process project hub.
import { before, test, type TestContext } from 'node:test';
import { once } from 'node:events';
import { createHash } from 'node:crypto';
import { WebSocket } from 'ws';
import { askHubFrame } from '../src/cli/socket-client.ts';
import assert from 'node:assert/strict';
import { request, type IncomingHttpHeaders } from 'node:http';
import { chmod, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { frameClient, clandWithEnv, projectHub, tempProject } from './harness.ts';
import { FakeClock } from './fake-clock.ts';
import { fileURLToPath } from 'node:url';
import { ensureWebBuild } from './web-build.ts';

// Suites build outside workers; standalone runs need the same prerequisite.
before(() => ensureWebBuild(fileURLToPath(new URL('../../', import.meta.url))));

function get(url: string, headers: Record<string, string> = {}): Promise<{ status: number; headers: IncomingHttpHeaders; body: string; bytes: Buffer }> {
  return new Promise((resolve, reject) => {
    const req = request(url, { agent: false, headers }, res => {
      const chunks: Buffer[] = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => { const bytes = Buffer.concat(chunks); resolve({ status: res.statusCode!, headers: res.headers, body: bytes.toString(), bytes }); });
      res.on('error', reject);
    });
    req.setTimeout(2000, () => req.destroy(new Error('web request timed out')));
    req.on('upgrade', (_res, socket) => { socket.destroy(); reject(new Error('unexpected upgrade')); });
    req.on('error', reject);
    req.end();
  });
}

test('the project manifest and linked PNG icons share the built panel theme', async t => {
  const root = await tempProject(t);
  await mkdir(join(root, '.cland'));
  await writeFile(join(root, '.cland/config.toml'), '[project]\nname = "Crew & Café"\n');
  const hub = await projectHub(t, root, {}, { clock: new FakeClock() });
  const { url } = await askHubFrame(hub.discovery, { type: 'web.link' }, 3000, {}) as { url: string };
  const origin = new URL(url).origin;
  const response = await get(`${origin}/manifest.webmanifest`);
  assert.equal(response.status, 200);
  assert.equal(response.headers['content-type'], 'application/manifest+json');
  const manifest = JSON.parse(response.body);
  assert.equal(manifest.name, 'Crew & Café');
  assert.equal(manifest.short_name, 'Crew & Café');
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.id, '/');
  assert.equal(manifest.scope, '/');
  assert.equal(manifest.start_url, '/?area=inbox');
  const tokens = await readFile(new URL('../../web/src/tokens.css', import.meta.url), 'utf8');
  const panel = tokens.match(/--panel:\s*([^;]+);/)![1]!;
  assert.equal(manifest.theme_color, panel);
  assert.equal(manifest.background_color, panel);
  const html = (await get(`${origin}/`)).body;
  assert.match(html, /<link[^>]+rel="manifest"[^>]+href="\/manifest.webmanifest"/);
  assert.match(html, /<meta[^>]+name="theme-color"[^>]+content="([^"]+)"/);
  assert.equal(html.match(/name="theme-color"[^>]+content="([^"]+)"/)![1], panel);
  const apple = html.match(/<link[^>]+rel="apple-touch-icon"[^>]+href="([^"]+)"/)![1]!;
  assert.deepEqual(manifest.icons.map((icon: { sizes: string; purpose: string }) => [icon.sizes, icon.purpose]), [
    ['192x192', 'any'], ['512x512', 'any'], ['512x512', 'maskable'],
  ]);
  for (const icon of [...manifest.icons, { src: apple, sizes: '180x180', type: 'image/png' }]) {
    const png = await get(`${origin}${icon.src}`);
    assert.equal(png.status, 200, icon.src);
    assert.equal(png.headers['content-type'], 'image/png');
    assert.equal(icon.type, 'image/png');
    assert.deepEqual(png.bytes.subarray(0, 8), Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    assert.equal(`${png.bytes.readUInt32BE(16)}x${png.bytes.readUInt32BE(20)}`, icon.sizes);
  }
  const worker = await get(`${origin}/sw.js`);
  assert.equal(worker.status, 200);
  assert.equal(worker.headers['content-type'], 'text/javascript; charset=utf-8');
  assert.equal(worker.headers['service-worker-allowed'], '/');
  assert.match(worker.body, /notificationclick/);
  const cached = await get(`${origin}/manifest.webmanifest`, { 'If-None-Match': response.headers.etag! });
  assert.equal(cached.status, 304);
});

// A regression in --no-open must still never open the human's browser/keychain.
async function openers(root: string): Promise<Record<string, string>> {
  const bin = join(root, 'openers');
  await mkdir(bin);
  for (const name of ['open', 'xdg-open']) {
    const path = join(bin, name);
    await writeFile(path, `#!/bin/sh\nprintf '%s\\n' "$1" > "$WEB_OPEN_RECEIPT"\n`);
    await chmod(path, 0o700);
  }
  return { PATH: `${bin}:${process.env.PATH ?? ''}`, WEB_OPEN_RECEIPT: join(root, 'opened') };
}

test('cland web --no-open prints a single-use link; auth sets the cookie and redirects', async t => {
  const root = await tempProject(t);
  await projectHub(t, root, {}, { clock: new FakeClock() });
  const result = await clandWithEnv(root, await openers(root), 'web', '--no-open');
  await assert.rejects(readFile(join(root, 'opened')), { code: 'ENOENT' });
  assert.equal(result.code, 0, result.stderr);
  const url = result.stdout.trim();
  assert.match(url, /^http:\/\/127\.0\.0\.1:\d+\/auth\?token=[a-f0-9]{64}$/);
  const response = await get(url);
  assert.equal(response.status, 302);
  assert.equal(response.headers.location, '/');
  assert.ok(response.headers['set-cookie']![0]!.startsWith(`cland_${createHash('sha256').update(root).digest('hex').slice(0, 12)}=`));
  assert.match(response.headers['set-cookie']![0]!, /^cland_[a-f0-9]{12}=[a-f0-9]{64}; Path=\/; HttpOnly; SameSite=Strict; Max-Age=2592000$/);
  assert.equal(response.headers['cache-control'], 'no-store');
  assert.equal((await get(url)).status, 401);
  assert.equal((await get(url.replace(/token=.*/, 'token=unknown'))).status, 401);
});

async function signIn(t: TestContext, log: (entry: Record<string, unknown>) => void = () => {}) {
  const root = await tempProject(t);
  const clock = new FakeClock();
  const hub = await projectHub(t, root, {}, { clock, log });
  const { url } = await askHubFrame(hub.discovery, { type: 'web.link' }, 3000, {}) as { url: string };
  const response = await get(url);
  return { root, hub, clock, url, origin: new URL(url).origin, cookie: response.headers['set-cookie']![0]!.split(';')[0]! };
}

async function browser(t: TestContext, origin: string, cookie: string, autoPong = true) {
  const ws = new WebSocket(`${origin.replace('http:', 'ws:')}/ws`, { origin, autoPong, headers: { Cookie: cookie } });
  t.after(() => ws.terminate());
  const seen: string[] = [];
  ws.on('message', data => seen.push(data.toString()));
  const client = frameClient(line => ws.send(line.trim()), fn => ws.on('message', data => fn(`${data.toString()}\n`)), () => ws.terminate());
  await once(ws, 'open', { signal: AbortSignal.timeout(2000) });
  return { ws, seen, client };
}

test('web.link is callable by a local test client and auth expires at five minutes', async t => {
  const root = await tempProject(t);
  const clock = new FakeClock();
  const hub = await projectHub(t, root, {}, { clock });
  const { url } = await askHubFrame(hub.discovery, { type: 'web.link' }, 3000, {}) as { url: string };
  await clock.advance(300_000);
  assert.equal((await get(url)).status, 401);
});

for (const bad of ['cookie', 'Host', 'Origin', 'null Origin', 'missing Origin']) {
  test(`/ws refuses an upgrade before frames with ${bad}`, async t => {
    const { origin, cookie } = await signIn(t);
    const headers: Record<string, string> = {
      Host: new URL(origin).host, Origin: origin, Cookie: cookie,
      Connection: 'Upgrade', Upgrade: 'websocket',
      'Sec-WebSocket-Version': '13', 'Sec-WebSocket-Key': 'dGhlIHNhbXBsZSBub25jZQ==',
    };
    if (bad === 'cookie') delete headers.Cookie;
    if (bad === 'Host') headers.Host = 'foreign.example';
    if (bad === 'Origin') headers.Origin = 'https://foreign.example';
    if (bad === 'null Origin') headers.Origin = 'null';
    if (bad === 'missing Origin') delete headers.Origin;
    const response = await get(`${origin}/ws`, headers);
    assert.equal(response.status, bad === 'cookie' ? 401 : 403);
  });
}

test('/ws welcomes a secret-free client as human and answers hub.status', async t => {
  const { origin, cookie } = await signIn(t);
  const { client } = await browser(t, origin, cookie);
  const welcome = client.waitFor(frame => frame.type === 'welcome');
  client.send({ type: 'hello', protocol: 2, client: 'pretend-session' });
  assert.equal((await welcome).name, 'human');
  const result = await client.request({ type: 'hub.status' });
  assert.equal(result.ok, true);
  assert.ok((result.value as { root: string }).root);
});

test('/ws refuses a spoke hello and closes its socket', async t => {
  const { origin, cookie } = await signIn(t);
  const { ws, client } = await browser(t, origin, cookie);
  const error = client.waitFor(frame => frame.type === 'error');
  const closed = once(ws, 'close', { signal: AbortSignal.timeout(2000) });
  client.send({ type: 'hello', protocol: 2, sessionId: 'session', name: 'intruder', cwd: '/' });
  assert.equal((await error).code, 'bad-hello');
  assert.equal((await closed)[0], 4000);
});

test("web.link refuses a session's shell even with an unknown identity", async t => {
  const root = await tempProject(t);
  const hub = await projectHub(t, root, {}, { clock: new FakeClock() });
  await assert.rejects(askHubFrame(hub.discovery, { type: 'web.link' }, 3000, { CLAND_SESSION_ID: 'unknown', CLAND_SESSION_NAME: 'session' }), /session "session" credential/);
  const result = await clandWithEnv(root, { ...await openers(root), CLAND_SESSION_ID: 'unknown', CLAND_SESSION_NAME: 'session' }, 'web', '--no-open');
  assert.equal(result.code, 1);
  assert.equal(result.stdout, '');
  assert.match(result.stderr, /only the human|session "session" credential/);
});

test('cland web opens the printed link using a scratch platform opener', async t => {
  const root = await tempProject(t);
  await projectHub(t, root, {}, { clock: new FakeClock() });
  const result = await clandWithEnv(root, await openers(root), 'web');
  assert.equal(result.code, 0, result.stderr);
  assert.equal(await readFile(join(root, 'opened'), 'utf8'), result.stdout);
});

test("the served bundle, auth responses and every browser frame contain no hub secret", async t => {
  const { hub, origin, cookie, url } = await signIn(t);
  const secret = hub.discovery.secret;
  const scan = (value: unknown) => assert.ok(!JSON.stringify(value).includes(secret), 'hub secret crossed the web edge');
  // The shared prerequisite builds the installed bundle before tests. Scan all files
  // over HTTP, including assets and build metadata, rather than only index.html.
  const files = await readdir(new URL('../../web/dist/', import.meta.url), { recursive: true, withFileTypes: true });
  assert.ok(files.length > 0);
  const base = new URL('../../web/dist/', import.meta.url).pathname;
  for (const file of files.filter(file => file.isFile())) {
    const path = join(file.parentPath, file.name).slice(base.length);
    const response = await get(`${origin}/${path}`);
    assert.equal(response.status, 200, path);
    scan(response);
  }
  scan(await get(url)); // spent
  scan(await get(`${origin}/auth?token=unknown`));
  const { url: fresh } = await askHubFrame(hub.discovery, { type: 'web.link' }, 3000, {}) as { url: string };
  scan(await get(fresh)); // success
  const { client, seen } = await browser(t, origin, cookie);
  const welcome = client.waitFor(frame => frame.type === 'welcome');
  client.send({ type: 'hello', protocol: 2, client: 'web' });
  await welcome;
  assert.equal((await client.request({ type: 'hub.status' })).ok, true);
  assert.equal((await client.request({ type: 'topic.list' })).ok, true);
  assert.equal((await client.request({ type: 'web.link' })).ok, false);
  for (const raw of seen) scan(raw);
  assert.ok(seen.length >= 4);
  const refused = await browser(t, origin, cookie);
  const error = refused.client.waitFor(frame => frame.type === 'error');
  const closed = once(refused.ws, 'close', { signal: AbortSignal.timeout(2000) });
  refused.client.send({ type: 'hello', protocol: 2, sessionId: 'spoke', cwd: '/' });
  await error;
  await closed;
  for (const raw of refused.seen) scan(raw);
});

test('server pings reap a browser that does not return a pong', async t => {
  const { origin, cookie, clock } = await signIn(t);
  const { ws, client } = await browser(t, origin, cookie, false);
  const welcome = client.waitFor(frame => frame.type === 'welcome');
  client.send({ type: 'hello', protocol: 2, client: 'web' });
  await welcome;
  let pings = 0;
  ws.on('ping', () => { pings++; });
  const ping = once(ws, 'ping', { signal: AbortSignal.timeout(2000) });
  await clock.advance(29_999);
  assert.equal(pings, 0);
  assert.equal(ws.readyState, WebSocket.OPEN);
  await clock.advance(1);
  await ping;
  assert.equal(pings, 1);
  const closed = once(ws, 'close', { signal: AbortSignal.timeout(2000) });
  await clock.advance(29_999);
  assert.equal(ws.readyState, WebSocket.OPEN);
  await clock.advance(1);
  assert.equal((await closed)[0], 1006);
});

test('web traffic refreshes the silence deadline even without automatic pongs', async t => {
  const { origin, cookie, clock } = await signIn(t);
  const { ws, client } = await browser(t, origin, cookie, false);
  const welcome = client.waitFor(frame => frame.type === 'welcome');
  client.send({ type: 'hello', protocol: 2, client: 'web' });
  await welcome;
  const firstPing = once(ws, 'ping', { signal: AbortSignal.timeout(2000) });
  await clock.advance(30_000);
  await firstPing;
  assert.equal((await client.request({ type: 'hub.status' })).ok, true);
  const secondPing = once(ws, 'ping', { signal: AbortSignal.timeout(2000) });
  await clock.advance(30_000);
  await secondPing;
  assert.equal(ws.readyState, WebSocket.OPEN);
  const closed = once(ws, 'close', { signal: AbortSignal.timeout(2000) });
  await clock.advance(30_000);
  assert.equal((await closed)[0], 1006);
});

test('binary web frames are reserved for streams and close with their dedicated code', async t => {
  const { origin, cookie } = await signIn(t);
  const { ws, client } = await browser(t, origin, cookie);
  const welcome = client.waitFor(frame => frame.type === 'welcome');
  client.send({ type: 'hello', protocol: 2, client: 'web' });
  await welcome;
  const closed = once(ws, 'close', { signal: AbortSignal.timeout(2000) });
  // Valid JSON bytes must still be refused when carried by a binary opcode.
  ws.send(Buffer.from('{"type":"hub.status","id":"binary"}'));
  const [code, reason] = await closed;
  assert.equal(code, 4003);
  assert.match(String(reason), /binary.*reserved/i);
});

test('JSON web frames accept exactly 1 MiB and refuse the next byte, including multibyte text', async t => {
  const { origin, cookie } = await signIn(t);
  const { ws, client } = await browser(t, origin, cookie);
  const welcome = client.waitFor(frame => frame.type === 'welcome');
  client.send({ type: 'hello', protocol: 2, client: 'web' });
  await welcome;
  const envelope = JSON.stringify({ type: 'hub.status', id: 'limit', padding: '' });
  const payload = envelope.replace('"padding":""', `"padding":"é${'x'.repeat(1024 * 1024 - Buffer.byteLength(envelope) - 2)}"`);
  assert.equal(Buffer.byteLength(payload), 1024 * 1024);
  const accepted = client.waitFor(frame => frame.type === 'result' && frame.id === 'limit');
  ws.send(payload);
  assert.equal((await accepted).ok, true);
  const closed = once(ws, 'close', { signal: AbortSignal.timeout(2000) });
  ws.send(`${payload} `);
  assert.equal((await closed)[0], 1009);
});

test('even an empty binary web frame is reserved', async t => {
  const { origin, cookie } = await signIn(t);
  const { ws } = await browser(t, origin, cookie);
  const closed = once(ws, 'close', { signal: AbortSignal.timeout(2000) });
  ws.send(Buffer.alloc(0));
  assert.equal((await closed)[0], 4003);
});

test('web welcome reports negotiated features and the current served bundle stamp', async t => {
  const root = await tempProject(t);
  await mkdir(join(root, 'bundle'));
  await mkdir(join(root, '.cland'));
  await writeFile(join(root, '.cland/config.toml'), '[web]\ndist = "bundle"\n');
  const stamp = join(root, 'bundle/build-stamp.json');
  await writeFile(stamp, JSON.stringify({ version: 1, sources: 'a'.repeat(64), builtAt: 1 }));
  const hub = await projectHub(t, root, {}, { clock: new FakeClock() });
  const { url } = await askHubFrame(hub.discovery, { type: 'web.link' }, 3000, {}) as { url: string };
  const response = await get(url);
  const cookie = response.headers['set-cookie']![0]!.split(';')[0]!;
  for (const digest of ['a'.repeat(64), 'b'.repeat(64)]) {
    await writeFile(stamp, JSON.stringify({ version: 1, sources: digest, builtAt: 1 }));
    const { client } = await browser(t, new URL(url).origin, cookie);
    const welcomed = client.waitFor(frame => frame.type === 'welcome');
    client.send({ type: 'hello', protocol: 2, client: 'web', features: ['slim-frames', 'future-feature'] });
    const frame = await welcomed;
    assert.deepEqual(frame.features, ['slim-frames']);
    assert.equal(frame.buildStamp, digest);
  }
});

test('a protocol-refused web hello tells the page to restart the hub', async t => {
  const { origin, cookie } = await signIn(t);
  const { ws, client } = await browser(t, origin, cookie);
  const refused = client.waitFor(frame => frame.type === 'error');
  const closed = once(ws, 'close', { signal: AbortSignal.timeout(2000) });
  client.send({ type: 'hello', protocol: 999, client: 'web' });
  const frame = await refused;
  assert.equal(frame.code, 'version');
  assert.equal(frame.action, 'restart-hub');
  assert.match(String(frame.message), /restart the hub/i);
  assert.equal((await closed)[0], 4000);
});

test('a web client reads the terminal capability of every adapter', async t => {
  const { origin, cookie } = await signIn(t);
  const { client } = await browser(t, origin, cookie);
  const welcome = client.waitFor(frame => frame.type === 'welcome');
  client.send({ type: 'hello', protocol: 2, client: 'web' });
  await welcome;
  const status = await client.request({ type: 'session.list' });
  assert.equal(status.ok, true);
  const capabilities = (status.value as { adapters: Record<string, { terminal: string }> }).adapters;
  assert.deepEqual(Object.keys(capabilities).sort(), ['claude-code', 'codex', 'opencode']);
  for (const capability of Object.values(capabilities)) assert.equal(capability.terminal, 'none');
});

// C1: restart the served hub on the same project, with no real hub process needed.
test('a persisted cookie opens /ws after two hub starts on one project', async t => {
  const { root, hub: first, origin, cookie } = await signIn(t);
  const before = await browser(t, origin, cookie);
  const welcome = before.client.waitFor(frame => frame.type === 'welcome');
  before.client.send({ type: 'hello', protocol: 2, client: 'web' });
  await welcome;
  const closed = once(before.ws, 'close', { signal: AbortSignal.timeout(2000) });
  await first.stop();
  await closed;
  const second = await projectHub(t, root, {}, { clock: new FakeClock() });
  const after = await browser(t, origin, cookie);
  const welcomed = after.client.waitFor(frame => frame.type === 'welcome');
  after.client.send({ type: 'hello', protocol: 2, client: 'web' });
  assert.equal((await welcomed).name, 'human');
  assert.equal((await after.client.request({ type: 'hub.status' })).ok, true);
  const listing = await askHubFrame(second.discovery, { type: 'web.sessions' }, 3000, {}) as { sessions: Array<{ sockets: number }> };
  assert.equal(listing.sessions.length, 1);
  assert.equal(listing.sessions[0]!.sockets, 1);
});

test('cland web lists timestamps and socket counts and revokes only the chosen session within the call', async t => {
  const serverCloses: string[] = [];
  const { root, hub, clock, origin, cookie } = await signIn(t, entry => {
    if (entry.event === 'web-session-socket-closed') serverCloses.push(String(entry.session));
  });
  const env = await openers(root);
  const initial = await clandWithEnv(root, env, 'web', '--sessions');
  assert.equal(initial.code, 0, initial.stderr);
  const fields = initial.stdout.trim().split('\n')[1]!.trim().split(/\s+/);
  const [id, createdAt, lastUsedAt, sockets] = fields;
  assert.match(id!, /^[a-f0-9-]{36}$/);
  assert.equal(createdAt, clock.now().toISOString());
  assert.equal(lastUsedAt, createdAt);
  assert.equal(sockets, '0');
  await clock.advance(1000);
  const first = await browser(t, origin, cookie, false);
  const second = await browser(t, origin, cookie, false);
  const { url } = await askHubFrame(hub.discovery, { type: 'web.link' }, 3000, {}) as { url: string };
  const otherCookie = (await get(url)).headers['set-cookie']![0]!.split(';')[0]!;
  const other = await browser(t, origin, otherCookie);
  const listed = await clandWithEnv(root, env, 'web', '--sessions');
  assert.equal(listed.code, 0, listed.stderr);
  assert.ok(listed.stdout.includes(`${id}  ${createdAt}  ${clock.now().toISOString()}  2`), listed.stdout);
  // Arm client waits before the action, but assert the server's own close
  // receipts at CLI return; notifications on separate client sockets may lag.
  const closes = [first.ws, second.ws].map(ws => once(ws, 'close', { signal: AbortSignal.timeout(2000) }));
  const revoked = await clandWithEnv(root, env, 'web', '--revoke', id!);
  assert.equal(revoked.code, 0, revoked.stderr);
  assert.deepEqual(serverCloses, [id, id], 'selected server sockets closed before CLI return');
  await Promise.all(closes);
  assert.equal(first.ws.readyState, WebSocket.CLOSED);
  assert.equal(second.ws.readyState, WebSocket.CLOSED);
  assert.equal(other.ws.readyState, WebSocket.OPEN);
  const remaining = await askHubFrame(hub.discovery, { type: 'web.sessions' }, 3000, {}) as { sessions: Array<{ id: string; sockets: number }> };
  assert.equal(remaining.sessions.length, 1);
  assert.notEqual(remaining.sessions[0]!.id, id);
  assert.equal(remaining.sessions[0]!.sockets, 1);
  const refused = await get(`${origin}/ws`, {
    Origin: origin, Cookie: cookie, Connection: 'Upgrade', Upgrade: 'websocket',
    'Sec-WebSocket-Version': '13', 'Sec-WebSocket-Key': 'dGhlIHNhbXBsZSBub25jZQ==',
  });
  assert.equal(refused.status, 401);
  assert.equal((await clandWithEnv(root, env, 'web', '--revoke', id!)).code, 1);
  await assert.rejects(readFile(join(root, 'opened')), { code: 'ENOENT' });
});

for (const type of ['web.sessions', 'web.revoke'] as const) {
  test(`${type} refuses browser and session-shell requests`, async t => {
    const { root, hub, origin, cookie } = await signIn(t);
    const frame = type === 'web.revoke' ? { type, session: 'unknown' } : { type };
    await assert.rejects(askHubFrame(hub.discovery, frame, 3000, { CLAND_SESSION_ID: 'unknown', CLAND_SESSION_NAME: 'session' }), /session "session" credential/);
    const flags = type === 'web.revoke' ? ['--revoke', 'unknown'] : ['--sessions'];
    const env = await openers(root);
    const result = await clandWithEnv(root, { ...env, CLAND_SESSION_ID: 'unknown', CLAND_SESSION_NAME: 'session' }, 'web', ...flags);
    await assert.rejects(readFile(join(root, 'opened')), { code: 'ENOENT' });
    assert.equal(result.code, 1);
    assert.match(result.stderr, /only the human|session "session" credential/);
    const { client } = await browser(t, origin, cookie);
    const welcome = client.waitFor(frame => frame.type === 'welcome');
    client.send({ type: 'hello', protocol: 2, client: 'web' });
    await welcome;
    const refused = await client.request(frame) as { ok: boolean; error?: string; code?: string };
    assert.equal(refused.ok, false);
    assert.equal(refused.code, 'cli-neovim-only');
    assert.match(refused.error!, /CLI and Neovim/);
  });
}

test('tunnel Host and exact Origin admit a web client and set Secure without trusting forwarded headers', async t => {
  const root = await tempProject(t);
  await mkdir(join(root, '.cland'));
  await writeFile(join(root, '.cland/config.toml'), '[web]\norigin = "https://phone.example:8443"\n');
  const hub = await projectHub(t, root, {}, { clock: new FakeClock() });
  const mint = async () => (await askHubFrame(hub.discovery, { type: 'web.link' }, 3000, {}) as { url: string }).url;
  const url = await mint();
  const tunnel = { Host: 'phone.example:8443', Origin: 'https://phone.example:8443' };
  const auth = await get(url, tunnel);
  assert.equal(auth.status, 302);
  assert.match(auth.headers['set-cookie']![0]!, /; Secure$/);
  const cookie = auth.headers['set-cookie']![0]!.split(';')[0]!;
  const ws = new WebSocket(`${new URL(url).origin.replace('http:', 'ws:')}/ws`, { headers: { ...tunnel, Cookie: cookie } });
  t.after(() => ws.terminate());
  const client = frameClient(line => ws.send(line.trim()), fn => ws.on('message', data => fn(`${data}\n`)), () => ws.terminate());
  await once(ws, 'open', { signal: AbortSignal.timeout(2000) });
  const welcomed = client.waitFor(f => f.type === 'welcome');
  client.send({ type: 'hello', protocol: 2, client: 'web' });
  assert.equal((await welcomed).name, 'human');
  assert.equal((await client.request({ type: 'hub.status' })).ok, true);
  for (const headers of [
    { Host: tunnel.Host },
    { Host: tunnel.Host, Origin: 'https://foreign.example' },
    { 'X-Forwarded-Host': tunnel.Host, 'X-Forwarded-Proto': 'https', Forwarded: 'host=phone.example:8443;proto=https', Origin: tunnel.Origin },
  ]) {
    const response = await get(await mint(), headers);
    assert.equal(response.status, 302);
    assert.doesNotMatch(response.headers['set-cookie']![0]!, /; Secure/);
  }
  for (const headers of [
    { ...tunnel, Origin: 'https://foreign.example' },
    { ...tunnel, Origin: 'null' },
    { ...tunnel, Host: 'foreign.example', 'X-Forwarded-Host': tunnel.Host },
  ]) {
    const refused = await get(`${new URL(url).origin}/ws`, { ...headers, Cookie: cookie, Connection: 'Upgrade', Upgrade: 'websocket', 'Sec-WebSocket-Version': '13', 'Sec-WebSocket-Key': 'dGhlIHNhbXBsZSBub25jZQ==' });
    assert.equal(refused.status, 403);
  }
});

test('web --qr refuses loopback alone with a reason and never opens a browser', async t => {
  const root = await tempProject(t);
  await projectHub(t, root, {}, { clock: new FakeClock() });
  const result = await clandWithEnv(root, await openers(root), 'web', '--qr');
  assert.equal(result.code, 1);
  assert.match(result.stderr, /phone cannot reach loopback/);
  assert.equal(result.stdout, '');
  await assert.rejects(readFile(join(root, 'opened')), { code: 'ENOENT' });
});


test('web --qr prints a decodable tunnel link without opening the browser', async t => {
  const root = await tempProject(t);
  await mkdir(join(root, '.cland'));
  await writeFile(join(root, '.cland/config.toml'), '[web]\norigin = "https://phone.example:8443"\n');
  const hub = await projectHub(t, root, {}, { clock: new FakeClock() });
  const result = await clandWithEnv(root, await openers(root), 'web', '--qr');
  assert.equal(result.code, 0, result.stderr);
  const [url, ...qr] = result.stdout.trimEnd().split('\n');
  assert.match(url!, /^https:\/\/phone\.example:8443\/auth\?token=[a-f0-9]{64}$/);
  assert.equal(decodeTerminalQr(qr.join('\n')), url);
  const local = `http://127.0.0.1:${(await askHubFrame(hub.discovery, { type: 'hub.status' }, 3000, {}) as { web: { port: number } }).web.port}${new URL(url!).pathname}${new URL(url!).search}`;
  assert.equal((await get(local, { Host: 'phone.example:8443', Origin: 'https://phone.example:8443' })).status, 302);
  assert.equal((await get(local, { Host: 'phone.example:8443' })).status, 401);
  await assert.rejects(readFile(join(root, 'opened')), { code: 'ENOENT' });
});


test('web --qr draws the LAN link from a recorded Unix frame fixture with scratch config only', async t => {
  const root = await tempProject(t);
  await mkdir(join(root, '.cland'));
  const configPath = join(root, '.cland/config.toml');
  await writeFile(configPath, '[web]\nbind = "192.0.2.4"\n');
  const web = parseConfig(await readFile(configPath, 'utf8'), 'fixture').web;
  const url = `${phoneOrigin(web.bind, web.origin, 1234)}/auth?token=${'ab'.repeat(32)}`;
  const socket = join(root, '.cland/qr.sock');
  const requests: Array<Record<string, unknown>> = [];
  const server = createServer(peer => {
    let buffer = '';
    peer.setEncoding('utf8');
    peer.on('data', chunk => {
      buffer += chunk;
      let newline: number;
      while ((newline = buffer.indexOf('\n')) >= 0) {
        const frame = JSON.parse(buffer.slice(0, newline));
        buffer = buffer.slice(newline + 1);
        if (frame.type === 'hello') peer.write(`${JSON.stringify({ type: 'welcome', protocol: 2, name: 'human' })}\n`);
        else {
          requests.push(frame);
          peer.end(`${JSON.stringify({ type: 'result', id: frame.id, ok: true, value: { url } })}\n`);
        }
      }
    });
  });
  await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(socket, resolve); });
  t.after(() => new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())));
  await writeFile(join(root, '.cland/hub.json'), JSON.stringify({ socket, secret: 'fixture', pid: process.pid, port: 1234, version: 'fixture' }));
  const result = await clandWithEnv(root, await openers(root), 'web', '--qr', '--no-open');
  assert.equal(result.code, 0, result.stderr);
  const [printed, ...qr] = result.stdout.trimEnd().split('\n');
  assert.equal(printed, url);
  assert.equal(decodeTerminalQr(qr.join('\n')), url);
  assert.equal(requests.length, 1);
  assert.equal(requests[0]!.type, 'web.link');
  assert.equal(requests[0]!.qr, true);
  await assert.rejects(readFile(join(root, 'opened')), { code: 'ENOENT' });
});
