// T2: the README's literal config through loopback HTTP/WS and the sealed executable QR CLI.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { chmod, mkdir, readFile, writeFile } from 'node:fs/promises';
import { request, type IncomingHttpHeaders } from 'node:http';
import { join } from 'node:path';
import { WebSocket } from 'ws';
import { askHubFrame } from '../src/cli/socket-client.ts';
import type { HubStatus } from '../src/protocol.ts';
import { FakeClock } from './fake-clock.ts';
import { clandWithEnv, frameClient, projectHub, tempProject } from './harness.ts';
import { decodeTerminalQr } from './qr-decode.ts';

function get(url: string, headers: Record<string, string>): Promise<{ status: number; headers: IncomingHttpHeaders }> {
  return new Promise((resolve, reject) => {
    const req = request(url, { headers, agent: false }, res => {
      res.resume();
      res.on('end', () => resolve({ status: res.statusCode!, headers: res.headers }));
      res.on('error', reject);
    });
    req.setTimeout(2000, () => req.destroy(new Error('guide HTTP request timed out')));
    req.on('error', reject);
    req.end();
  });
}

test('the HTTPS tunnel guide config admits its Host and Origin and prints its QR sign-in link', async t => {
  const readme = await readFile(new URL('../../web/README.md', import.meta.url), 'utf8');
  const guide = readme.split('## HTTPS on your phone\n')[1]?.split('\n## ')[0];
  assert.ok(guide, 'README must contain the HTTPS phone guide');
  const snippets = [...guide.matchAll(/```toml\n([\s\S]*?)```/g)];
  assert.equal(snippets.length, 1, 'guide has one executable configuration snippet');
  const snippet = snippets[0]![1]!;
  assert.match(snippet, /^\[web\]\n/m);
  assert.match(snippet, /^bind = "127\.0\.0\.1"$/m);
  const origin = snippet.match(/^origin = "([^"]+)"$/m)?.[1];
  assert.ok(origin, 'guide names the HTTPS origin');
  const publicUrl = new URL(origin);
  assert.equal(publicUrl.protocol, 'https:');

  const root = await tempProject(t);
  await mkdir(join(root, '.cland'));
  await writeFile(join(root, '.cland/config.toml'), snippet);
  // Stub both platform openers even though --qr promises not to open either.
  const bin = join(root, 'openers');
  await mkdir(bin);
  for (const name of ['open', 'xdg-open']) {
    const path = join(bin, name);
    await writeFile(path, '#!/bin/sh\nprintf opened > "$WEB_OPEN_RECEIPT"\n');
    await chmod(path, 0o700);
  }
  const hub = await projectHub(t, root, {}, { clock: new FakeClock() });
  const status = await askHubFrame(hub.discovery, { type: 'hub.status' }, 3000, {}) as HubStatus;
  assert.equal(status.web?.available, true);
  assert.equal(status.web.bind, '127.0.0.1');
  const local = `http://127.0.0.1:${status.web.port}`;
  const result = await clandWithEnv(root, {
    PATH: `${bin}:${process.env.PATH ?? ''}`, WEB_OPEN_RECEIPT: join(root, 'opened'),
  }, 'web', '--qr');
  assert.equal(result.code, 0, result.stderr);
  const [link, ...qr] = result.stdout.trimEnd().split('\n');
  assert.ok(link);
  const printed = new URL(link);
  assert.equal(printed.origin, origin);
  assert.equal(printed.pathname, '/auth');
  assert.match(printed.search, /^\?token=[a-f0-9]{64}$/);
  assert.equal(decodeTerminalQr(qr.join('\n')), link);
  await assert.rejects(readFile(join(root, 'opened')), { code: 'ENOENT' });

  // Only loopback is contacted: simulate the proxy preserving the browser headers.
  const headers = { Host: publicUrl.host, Origin: origin };
  const auth = await get(`${local}${printed.pathname}${printed.search}`, headers);
  assert.equal(auth.status, 302);
  assert.match(auth.headers['set-cookie']![0]!, /; Secure$/);
  const cookie = auth.headers['set-cookie']![0]!.split(';')[0]!;
  const ws = new WebSocket(`${local.replace('http:', 'ws:')}/ws`, { headers: { ...headers, Cookie: cookie } });
  t.after(() => ws.terminate());
  const client = frameClient(line => ws.send(line.trim()), fn => ws.on('message', data => fn(`${data}\n`)), () => ws.terminate());
  await once(ws, 'open', { signal: AbortSignal.timeout(2000) });
  const welcome = client.waitFor(frame => frame.type === 'welcome');
  client.send({ type: 'hello', protocol: 2, client: 'web' });
  assert.equal((await welcome).name, 'human');
  assert.equal((await client.request({ type: 'hub.status' })).ok, true);
});
