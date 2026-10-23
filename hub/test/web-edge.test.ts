import { connect } from 'node:net';
// T2: the project's discovery, frames and HTTP edge in-process; no native harnesses or Git.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer, request, type IncomingHttpHeaders } from 'node:http';
import { askHub } from '../src/cli/socket-client.ts';
import type { HubStatus } from '../src/protocol.ts';
import { toolchain, report, check } from './doctor-fixture.ts';
import { mkdir, readFile, symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { readDiscovery } from '../src/project.ts';
import { projectHub, tempProject, inProcessSpoke } from './harness.ts';
import { FakeClock } from './fake-clock.ts';

test('the web port survives a hub restart and explicit configuration overrides it', async t => {
  const root = await tempProject(t);
  const first = await projectHub(t, root, {}, { clock: new FakeClock() });
  const port = readDiscovery(join(root, '.cland/hub.json'))?.webPort;
  assert.ok(port && port > 0);
  await first.stop();
  const second = await projectHub(t, root, {}, { clock: new FakeClock() });
  assert.equal(readDiscovery(join(root, '.cland/hub.json'))?.webPort, port);
  await second.stop();
  // Obtain a distinct ephemeral port for the configured restart.
  const otherRoot = await tempProject(t);
  const other = await projectHub(t, otherRoot, {}, { clock: new FakeClock() });
  const override = readDiscovery(join(otherRoot, '.cland/hub.json'))!.webPort!;
  await other.stop();
  const config = join(root, '.cland/config.toml');
  await writeFile(config, `${await readFile(config, 'utf8')}\n[web]\nport = ${override}\n`);
  await projectHub(t, root, {}, { clock: new FakeClock() });
  assert.equal(readDiscovery(join(root, '.cland/hub.json'))?.webPort, override);
});

test('an occupied web port disables only the web edge and doctor reports its reason', async t => {
  const root = await tempProject(t);
  const first = await projectHub(t, root, {}, { clock: new FakeClock() });
  const port = readDiscovery(join(root, '.cland/hub.json'))!.webPort!;
  await first.stop();
  const held = createServer();
  await new Promise<void>(resolve => held.listen(port, '127.0.0.1', resolve));
  t.after(() => new Promise<void>(resolve => held.close(() => resolve())));
  const logs: Record<string, unknown>[] = [];
  const running = await projectHub(t, root, {}, { clock: new FakeClock(), log: entry => logs.push(entry) });
  assert.equal(readDiscovery(join(root, '.cland/hub.json'))!.webPort, port);
  const status = await askHub(running.discovery, 'hub.status') as HubStatus;
  assert.equal(status.web?.port, port);
  assert.equal(status.web?.available, false);
  assert.match(status.web?.reason ?? '', /EADDRINUSE/);
  assert.match(status.web?.reason ?? '', new RegExp(String(port)));
  assert.ok(logs.some(entry => entry.event === 'web-unavailable' && entry.port === port && entry.reason === status.web?.reason));
  // The existing spoke edge still authenticates a session and dispatches frames.
  const spoke = await inProcessSpoke(t, { discover: true, cwd: root, name: 'web-test' });
  assert.equal((await spoke.call<{ ok: boolean }>('who')).ok, true);
  await spoke.close();
  const tools = await toolchain(t);
  const result = await report(root, tools.env, []);
  const warning = check(result.report, 'web edge');
  assert.equal(warning.verdict, 'warn');
  assert.match(warning.detail, /EADDRINUSE/);
  assert.match(warning.detail, new RegExp(String(port)));
});

async function fixtureBundle(root: string): Promise<void> {
  await mkdir(join(root, 'bundle/assets'), { recursive: true });
  await writeFile(join(root, 'bundle/index.html'), '<!doctype html><title>fixture shell</title>');
  await writeFile(join(root, 'bundle/assets/app-a1.js'), 'export const shell = true;');
  await writeFile(join(root, 'bundle/manifest.webmanifest'), JSON.stringify({ display: 'standalone' }));
  for (const file of ['sw.js', 'icon-192.png']) await writeFile(join(root, 'bundle', file), 'fixture');
  await mkdir(join(root, '.cland'), { recursive: true });
  await writeFile(join(root, '.cland/config.toml'), '[web]\ndist = "bundle"\n');
}

function get(port: number, path = '/', headers: Record<string, string> = {}, method = 'GET'): Promise<{ status: number; headers: IncomingHttpHeaders; body: string }> {
  return new Promise((resolve, reject) => {
    const req = request({ hostname: '127.0.0.1', port, path, method, headers, agent: false }, res => {
      const chunks: Buffer[] = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve({ status: res.statusCode!, headers: res.headers, body: Buffer.concat(chunks).toString() }));
      res.on('error', reject);
    });
    req.setTimeout(2000, () => req.destroy(new Error('web request timed out')));
    req.on('error', reject);
    req.end();
  });
}

test('the bundle has strict headers, revalidation for entry files and immutable assets', async t => {
  const root = await tempProject(t);
  await fixtureBundle(root);
  await projectHub(t, root, {}, { clock: new FakeClock() });
  const port = readDiscovery(join(root, '.cland/hub.json'))!.webPort!;
  const index = await get(port);
  assert.equal(index.status, 200);
  assert.match(index.body, /fixture shell/);
  assert.match(String(index.headers['content-security-policy']), /frame-ancestors 'none'/);
  assert.match(String(index.headers['content-security-policy']), /default-src 'self'/);
  assert.equal(index.headers['x-content-type-options'], 'nosniff');
  assert.equal(index.headers['referrer-policy'], 'no-referrer');
  assert.equal(index.headers['cache-control'], 'no-cache');
  assert.ok(index.headers.etag);
  for (const path of ['/index.html', '/manifest.webmanifest', '/sw.js', '/icon-192.png']) {
    const file = await get(port, path);
    assert.equal(file.status, 200, path);
    assert.equal(file.headers['cache-control'], 'no-cache', path);
    assert.ok(file.headers.etag, path);
    if (path === '/sw.js') {
      assert.equal(file.headers['content-type'], 'text/javascript; charset=utf-8');
      assert.equal(file.headers['service-worker-allowed'], '/');
      assert.match(String(file.headers['content-security-policy']), /worker-src 'self'/);
    }
    const cached = await get(port, path, { 'If-None-Match': file.headers.etag! });
    assert.equal(cached.status, 304, path);
    assert.equal(cached.body, '');
    assert.equal(cached.headers['x-content-type-options'], 'nosniff');
  }
  const asset = await get(port, '/assets/app-a1.js');
  assert.equal(asset.status, 200);
  assert.match(asset.headers['cache-control']!, /max-age=31536000, immutable/);
  assert.match(asset.headers['content-type']!, /javascript/);
  const head = await get(port, '/', {}, 'HEAD');
  assert.equal(head.status, 200);
  assert.equal(head.body, '');
});

test('bundle path confinement with extensionless route fallback', async t => {
  const root = await tempProject(t);
  await fixtureBundle(root);
  await writeFile(join(root, 'private.txt'), 'project private data');
  await symlink(join(root, 'private.txt'), join(root, 'bundle/escape.txt'));
  await symlink(root, join(root, 'bundle/escape'));
  await projectHub(t, root, {}, { clock: new FakeClock() });
  const port = readDiscovery(join(root, '.cland/hub.json'))!.webPort!;
  for (const path of ['/../private.txt', '/%2e%2e/private.txt', '/%2E%2E%2Fprivate.txt', '/assets/../../private.txt', '/%5c..%5cprivate.txt', '/escape.txt', '/escape/private.txt']) {
    const response = await get(port, path);
    assert.equal(response.status, 403, path);
    assert.ok(!response.body.includes('project private data'), path);
    assert.match(String(response.headers['content-security-policy']), /frame-ancestors 'none'/);
  }
  for (const path of ['/topics/T-978', '/topics/T-978?tab=thread', '/assets/missing-route']) {
    const response = await get(port, path);
    assert.equal(response.status, 200, path);
    assert.match(response.body, /fixture shell/, path);
    assert.equal(response.headers['cache-control'], 'no-cache', path);
  }
  assert.equal((await get(port, '/absent.js')).status, 404);
  assert.equal((await get(port, '/%ZZ')).status, 400);
});

test('a missing bundle directory or index returns the build instruction', async t => {
  const root = await tempProject(t);
  await mkdir(join(root, '.cland'));
  await writeFile(join(root, '.cland/config.toml'), '[web]\ndist = "missing-bundle"\n');
  await projectHub(t, root, {}, { clock: new FakeClock() });
  const port = readDiscovery(join(root, '.cland/hub.json'))!.webPort!;
  const response = await get(port);
  assert.equal(response.status, 503);
  assert.match(response.body, /npm run build --workspace web/);
  await mkdir(join(root, 'missing-bundle'));
  const missingIndex = await get(port, '/index.html');
  assert.equal(missingIndex.status, 503);
  assert.match(missingIndex.body, /npm run build --workspace web/);
  assert.match(response.headers['content-type']!, /text\/plain/);
  assert.equal(response.headers['cache-control'], 'no-cache');
  assert.match(String(response.headers['content-security-policy']), /frame-ancestors 'none'/);
});

test('the web edge accepts only a loopback Host with its exact port', async t => {
  const root = await tempProject(t);
  await fixtureBundle(root);
  await projectHub(t, root, {}, { clock: new FakeClock() });
  const port = readDiscovery(join(root, '.cland/hub.json'))!.webPort!;
  for (const host of [`127.0.0.1:${port}`, `localhost:${port}`, `[::1]:${port}`]) {
    assert.equal((await get(port, '/', { Host: host })).status, 200, host);
  }
  for (const host of [`evil.example:${port}`, `localhost.evil.example:${port}`, `127.0.0.2:${port}`, `127.0.0.1:${port + 1}`, 'localhost', '127.0.0.1', '[::1]', `user@localhost:${port}`]) {
    const response = await get(port, '/', { Host: host });
    assert.equal(response.status, 403, host);
    assert.equal(response.headers['x-content-type-options'], 'nosniff');
  }
});

test('configured web bind is independent of the spoke loopback listener', async t => {
  const root = await tempProject(t);
  await mkdir(join(root, '.cland'));
  // Loopback alias stands in for a LAN interface without exposing the fixture.
  await writeFile(join(root, '.cland/config.toml'), '[web]\nbind = "::1"\n');
  const hub = await projectHub(t, root, {}, { clock: new FakeClock() });
  const status = await askHub(hub.discovery, 'hub.status') as HubStatus;
  assert.equal(status.web?.bind, '::1');
  assert.equal(status.spokeBind, '127.0.0.1');
  const addresses = await Promise.all([
    new Promise<string>((resolve, reject) => {
      const req = request({ hostname: '::1', port: status.web!.port, agent: false }, res => {
        const address = res.socket.remoteAddress!;
        res.resume();
        res.on('end', () => resolve(address));
      });
      req.setTimeout(2000, () => req.destroy(new Error('bind request timed out')));
      req.on('error', reject); req.end();
    }),
    new Promise<string>((resolve, reject) => {
      const socket = connect(hub.discovery.port, '127.0.0.1');
      socket.setTimeout(2000, () => socket.destroy(new Error('spoke connection timed out')));
      socket.on('error', reject);
      let address: string;
      socket.on('connect', () => { address = socket.remoteAddress!; socket.end(); });
      socket.on('close', () => resolve(address));
    }),
  ]);
  assert.deepEqual(addresses, ['::1', '127.0.0.1']);
});

test('doctor warns about plain HTTP on a network bind without a tunnel, including a stopped hub', async t => {
  const root = await tempProject(t);
  await mkdir(join(root, '.cland'));
  const path = join(root, '.cland/config.toml');
  await writeFile(path, '[web]\nbind = "192.0.2.4"\n');
  const tools = await toolchain(t);
  const warning = check((await report(root, tools.env, [])).report, 'web network');
  assert.equal(warning.verdict, 'warn');
  assert.match(warning.detail, /plain HTTP.*cookie.*clear/);
  assert.match(warning.fix!, /web.*origin/);
  await writeFile(path, '[web]\nbind = "192.0.2.4"\norigin = "https://phone.example"\n');
  assert.equal(check((await report(root, tools.env, [])).report, 'web network').verdict, 'ok');
  await writeFile(path, '[web]\nbind = "::1"\n');
  assert.equal(check((await report(root, tools.env, [])).report, 'web network').verdict, 'ok');
});
