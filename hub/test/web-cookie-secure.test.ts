// T2: cookie attributes on HTTP responses from an isolated in-process hub.
import test from 'node:test';
import assert from 'node:assert/strict';
import { request, type IncomingHttpHeaders } from 'node:http';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { askHubFrame } from '../src/cli/socket-client.ts';
import { defaultConfig, renderConfig } from '../src/init/config.ts';
import { projectHub, tempProject } from './harness.ts';

function http(url: string, headers: Record<string, string>, body?: unknown): Promise<{ status: number; headers: IncomingHttpHeaders }> {
  return new Promise((resolve, reject) => {
    const req = request(url, { agent: false, method: body ? 'POST' : 'GET', headers: { ...headers, ...(body ? { 'Content-Type': 'application/json' } : {}) } }, res => {
      res.resume();
      res.on('end', () => resolve({ status: res.statusCode!, headers: res.headers }));
      res.on('error', reject);
    });
    req.setTimeout(2000, () => req.destroy(new Error('cookie HTTP timeout')));
    req.on('error', reject);
    req.end(body ? JSON.stringify(body) : undefined);
  });
}

test('/auth navigation with configured tunnel Host sets Secure without Origin', async t => {
  const root = await tempProject(t);
  await mkdir(join(root, '.cland'));
  await writeFile(join(root, '.cland/config.toml'), '[web]\norigin = "https://phone.example:8443"\n');
  const hub = await projectHub(t, root);
  const { url } = await askHubFrame(hub.discovery, { type: 'web.link' }, 3000, {}) as { url: string };
  const response = await http(url, { Host: 'phone.example:8443' });
  assert.equal(response.status, 302);
  assert.match(response.headers['set-cookie']![0]!, /; Path=\/; HttpOnly; SameSite=Strict; Max-Age=2592000; Secure$/);
});

for (const configured of [false, true]) {
  test(`cookie headers ignore forwarded claims with configured origin ${configured}`, async t => {
    const root = await tempProject(t);
    await mkdir(join(root, '.cland'));
    await writeFile(join(root, '.cland/config.toml'), configured ? '[web]\norigin = "https://phone.example:8443"\n' : '');
    const hub = await projectHub(t, root);
    for (const forwarded of [
      { 'X-Forwarded-Host': 'phone.example:8443' },
      { 'X-Forwarded-Proto': 'https' },
      { Forwarded: 'host=phone.example:8443;proto=https' },
      { 'X-Forwarded-Host': 'phone.example:8443', 'X-Forwarded-Proto': 'https', Forwarded: 'host=phone.example:8443;proto=https' },
    ]) {
      const { url } = await askHubFrame(hub.discovery, { type: 'web.link' }, 3000, {}) as { url: string };
      const response = await http(url, { ...forwarded, Origin: 'https://phone.example:8443' });
      assert.equal(response.status, 302);
      assert.doesNotMatch(response.headers['set-cookie']![0]!, /; Secure/);
      for (const host of ['192.0.2.10:8443', 'other.example:8443']) {
        const refused = await http(url, { ...forwarded, Host: host });
        assert.equal(refused.status, 403);
        assert.equal(refused.headers['set-cookie'], undefined);
      }
    }
  });
}

test('invite and password sign-in cookies share tunnel and local Secure policy', async t => {
  const root = await tempProject(t);
  await mkdir(join(root, '.cland'));
  await writeFile(join(root, '.cland/config.toml'), '[web]\norigin = "https://phone.example:8443"\n');
  const config = defaultConfig('Cookie policy');
  config.web.origin = 'https://phone.example:8443';
  config.verification.lockPath = join(root, 'suite.lock');
  await writeFile(join(root, '.cland/config.toml'), renderConfig(config));
  const hub = await projectHub(t, root, {}, { git: async () => 'Jane Doe\n' });
  const { url } = await askHubFrame(hub.discovery, { type: 'auth.mode', mode: 'users' }, 3000, {}) as { url: string };
  const invite = new URL(url);
  const status = await askHubFrame(hub.discovery, { type: 'hub.status' }, 3000, {}) as { web: { port: number } };
  const local = `http://127.0.0.1:${status.web.port}`;
  const password = 'a private scratch password';
  const tunnel = { Host: 'phone.example:8443', Origin: 'https://phone.example:8443' };
  const registered = await http(`${local}/invite/register`, tunnel, { token: invite.searchParams.get('token'), password });
  assert.equal(registered.status, 200);
  assert.match(registered.headers['set-cookie']![0]!, /; Secure$/);
  for (const [headers, secure] of [[tunnel, true], [{ Origin: local }, false]] as const) {
    const signedIn = await http(`${local}/signin/password`, headers, { name: 'jane-doe', password });
    assert.equal(signedIn.status, 200);
    assert.equal(/; Secure$/.test(signedIn.headers['set-cookie']![0]!), secure);
  }
  for (const path of ['/invite/register', '/signin/password', '/upload']) {
    for (const headers of [{ Host: tunnel.Host }, { ...tunnel, Origin: 'https://foreign.example' }]) {
      const refused = await http(`${local}${path}`, { ...headers, Cookie: registered.headers['set-cookie']![0]!.split(';')[0]! }, {});
      assert.equal(refused.status, 403);
      assert.equal(refused.headers['set-cookie'], undefined);
    }
  }
});
