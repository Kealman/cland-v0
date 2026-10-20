// T2: the executable CLI and HTTP authentication against an in-process project hub.
import { test, type TestContext } from 'node:test';
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

function get(url: string, headers: Record<string, string> = {}): Promise<{ status: number; headers: IncomingHttpHeaders; body: string }> {
  return new Promise((resolve, reject) => {
    const req = request(url, { agent: false, headers }, res => {
      const chunks: Buffer[] = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve({ status: res.statusCode!, headers: res.headers, body: Buffer.concat(chunks).toString() }));
      res.on('error', reject);
    });
    req.setTimeout(2000, () => req.destroy(new Error('web request timed out')));
    req.on('upgrade', (_res, socket) => { socket.destroy(); reject(new Error('unexpected upgrade')); });
    req.on('error', reject);
    req.end();
  });
}

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

async function signIn(t: TestContext) {
  const root = await tempProject(t);
  const clock = new FakeClock();
  const hub = await projectHub(t, root, {}, { clock });
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
  await assert.rejects(askHubFrame(hub.discovery, { type: 'web.link' }, 3000, { CLAND_SESSION_ID: 'unknown', CLAND_SESSION_NAME: 'session' }), /only the human/);
  const result = await clandWithEnv(root, { CLAND_SESSION_ID: 'unknown', CLAND_SESSION_NAME: 'session' }, 'web', '--no-open');
  assert.equal(result.code, 1);
  assert.equal(result.stdout, '');
  assert.match(result.stderr, /only the human/);
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
  // Verification builds the installed bundle before tests. Scan all of its files
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
  const ping = once(ws, 'ping', { signal: AbortSignal.timeout(2000) });
  await clock.advance(30_000);
  await ping;
  const closed = once(ws, 'close', { signal: AbortSignal.timeout(2000) });
  await clock.advance(30_000);
  assert.equal((await closed)[0], 1006);
});
