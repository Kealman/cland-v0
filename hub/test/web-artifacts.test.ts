// T2: cookie-authenticated frames and cookie-free artifact HTTP on an in-process hub.
import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { request, type IncomingHttpHeaders } from 'node:http';
import { constants } from 'node:fs';
import { open, mkdir, rename, symlink, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { WebSocket } from 'ws';
import { connectUi, frameClient, projectHub, tempProject } from './harness.ts';
import type { FrameClient } from './harness.ts';
import { FakeClock } from './fake-clock.ts';

function get(url: string, path = new URL(url).pathname + new URL(url).search, method = 'GET'):
Promise<{ status: number; headers: IncomingHttpHeaders; body: string }> {
  const { hostname, port } = new URL(url);
  return new Promise((resolve, reject) => {
    const req = request({ hostname, port, path, method, agent: false }, res => {
      const chunks: Buffer[] = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve({ status: res.statusCode!, headers: res.headers, body: Buffer.concat(chunks).toString() }));
      res.on('error', reject);
    });
    req.setTimeout(2000, () => req.destroy(new Error('artifact request timed out')));
    req.on('error', reject);
    req.end();
  });
}

async function fixture(t: TestContext, artifactOpen?: typeof open) {
  // Keep a lexical symlinked ancestor on every platform, including Linux where
  // the system temp directory normally has none. Only this prefix is trusted;
  // the artifact/folder symlink substitutions below must still be refused.
  const scratch = await tempProject(t);
  await mkdir(join(scratch, 'physical', 'project'), { recursive: true });
  await symlink(join(scratch, 'physical'), join(scratch, 'alias'));
  const root = join(scratch, 'alias', 'project');
  const clock = new FakeClock();
  const hub = await projectHub(t, root, {}, { clock, ...(artifactOpen ? { artifactOpen } : {}) });
  const local = await connectUi(t, hub.discovery);
  const link = await local.request({ type: 'web.link' });
  assert.equal(link.ok, true, link.error);
  const { url } = link.value as { url: string };
  const auth = await get(url);
  assert.equal(auth.status, 302);
  const cookie = auth.headers['set-cookie']![0]!.split(';')[0]!;
  const origin = new URL(url).origin;
  const web = await browser(t, origin, cookie);
  return { root, clock, hub, local, web, origin, cookie };
}

async function browser(t: TestContext, origin: string, cookie: string): Promise<FrameClient> {
  const ws = new WebSocket(`${origin.replace('http:', 'ws:')}/ws`, { origin, headers: { Cookie: cookie } });
  t.after(() => ws.terminate());
  const web = frameClient(line => ws.send(line.trim()), fn => ws.on('message', data => fn(`${data.toString()}\n`)), () => ws.terminate());
  await once(ws, 'open', { signal: AbortSignal.timeout(2000) });
  const welcome = web.waitFor(frame => frame.type === 'welcome');
  web.send({ type: 'hello', protocol: 2, client: 'web' });
  assert.equal((await welcome).name, 'human');
  return web;
}

async function artifact(local: FrameClient, fields: Record<string, unknown> = {}) {
  const created = await local.request({ type: 'artifact.create', kind: 'file', title: 'Capability file', topic: 'general', content: 'artifact bytes', ...fields });
  assert.equal(created.ok, true, created.error);
  return (created.value as { artifact: { id: string; path: string } }).artifact;
}

async function mint(web: FrameClient, id: string): Promise<string> {
  const result = await web.request({ type: 'artifact.url', artifact: id });
  assert.equal(result.ok, true, result.error);
  return (result.value as { url: string }).url;
}

test('artifact.url mints random web-only URLs serving extension types without cookies', async t => {
  const { local, web, origin } = await fixture(t);
  const a = await artifact(local, { kind: 'note' });
  const url = await mint(web, a.id);
  assert.equal(new URL(url).origin, origin);
  assert.match(new URL(url).pathname, /^\/a\/[a-f0-9]{64}\//);
  assert.notEqual(await mint(web, a.id), url);
  const response = await get(url);
  assert.equal(response.status, 200);
  assert.equal(response.body, 'artifact bytes');
  assert.equal(response.headers['content-type'], 'text/markdown; charset=utf-8');
  assert.equal(response.headers['cache-control'], 'no-store');
  assert.equal(response.headers['x-content-type-options'], 'nosniff');
  assert.equal(response.headers['referrer-policy'], 'no-referrer');
  assert.equal((await get(url, undefined, 'HEAD')).body, '');
  const refused = await local.request({ type: 'artifact.url', artifact: a.id });
  assert.equal(refused.ok, false);
  assert.match(refused.error!, /web edge/);
  assert.equal((await web.request({ type: 'artifact.url', artifact: 'A-999999' })).ok, false);
  const source = '\nflowchart TD\n%% </pre><script>untrusted()</script>\nA-->B';
  const diagram = await artifact(local, { kind: 'diagram', content: source });
  const raw = await mint(web, diagram.id);
  assert.equal((await get(raw)).body, source, 'raw capability remains source bytes');
  const rendered = await get(`${raw}?render=mermaid`);
  assert.equal(rendered.status, 200);
  assert.equal(rendered.headers['content-type'], 'text/html; charset=utf-8');
  assert.ok(rendered.body.includes('&lt;/pre&gt;&lt;script&gt;untrusted()&lt;/script&gt;'));
  assert.ok(rendered.body.includes('src="/mermaid.js"'));
  assert.equal(rendered.headers['content-security-policy'], `sandbox allow-scripts; default-src 'none'; script-src ${origin}; style-src ${origin} 'unsafe-inline'; img-src data:; font-src ${origin}`);
  const head = await get(`${raw}?render=mermaid`, undefined, 'HEAD');
  assert.equal(head.body, '');
  assert.equal(head.headers['content-length'], String(Buffer.byteLength(rendered.body)));
});

test('capabilities confine files and folders, including encoded traversal and symlinks', async t => {
  const { root, local, web } = await fixture(t);
  const a = await artifact(local);
  const b = await artifact(local, { title: 'Other artifact', content: 'private other bytes' });
  const url = await mint(web, a.id);
  assert.equal((await get(url)).status, 200, 'the authorized file is readable before testing refusals');
  const prefix = new URL(url).pathname.slice(0, new URL(url).pathname.lastIndexOf('/') + 1);
  for (const name of [basename(b.path), `../${basename(b.path)}`, `%2e%2e/${basename(b.path)}`, `%2e%2e%2f${basename(b.path)}`, '%5c..%5cprivate.txt', '%00', '/private.txt', './file']) {
    const response = await get(url, prefix + name);
    assert.ok([403, 404].includes(response.status), name);
    assert.ok(!response.body.includes('private other bytes'), name);
  }
  assert.equal((await get(url, '/a/' + '0'.repeat(64) + '/' + basename(a.path))).status, 404);
  const source = join(root, 'source');
  await mkdir(source);
  await writeFile(join(source, 'index.html'), '<link rel="stylesheet" href="style.css">');
  await writeFile(join(source, 'style.css'), 'body { color: green }');
  const folder = await artifact(local, { content: undefined, path: source, entry: 'index.html' });
  const page = await mint(web, folder.id);
  assert.equal((await get(page)).status, 200, 'the authorized folder entry is readable before testing refusals');
  const folderPrefix = new URL(page).pathname.replace(/index.html$/, '');
  await symlink(b.path, join(folder.path, 'escape.txt'));
  await symlink(root, join(folder.path, 'escape'));
  for (const name of ['escape.txt', 'escape/source/index.html', '../' + basename(b.path), '%2e%2e%2f' + basename(b.path), basename(b.path)]) {
    const response = await get(page, folderPrefix + name);
    assert.ok([403, 404].includes(response.status), name);
    assert.ok(!response.body.includes('private other bytes'), name);
  }
});

test('folder HTML carries the script-only sandbox and relative assets use its capability', async t => {
  const { root, local, web } = await fixture(t);
  const source = join(root, 'page');
  await mkdir(join(source, 'nested'), { recursive: true });
  await writeFile(join(source, 'nested/index.html'), '<link rel="stylesheet" href="style.css">');
  await writeFile(join(source, 'nested/style.css'), 'body { color: green }');
  const folder = await artifact(local, { content: undefined, path: source, entry: 'nested/index.html' });
  const url = await mint(web, folder.id);
  const page = await get(url);
  assert.equal(page.status, 200);
  assert.equal(page.headers['content-type'], 'text/html; charset=utf-8');
  assert.equal(page.headers['content-security-policy'], 'sandbox allow-scripts');
  const href = /href="([^"]+)"/.exec(page.body)![1]!;
  const css = await get(new URL(href, url).href);
  assert.equal(css.status, 200);
  assert.equal(css.headers['content-type'], 'text/css; charset=utf-8');
  assert.equal(css.body, 'body { color: green }');
});

test('capabilities survive hub restart and revocation invalidates only the minting session URLs', async t => {
  const { root, hub, local: originalLocal, web, origin, clock } = await fixture(t);
  let local = originalLocal;
  const a = await artifact(local);
  const url = await mint(web, a.id);
  await hub.stop();
  const restarted = await projectHub(t, root, {}, { clock });
  local = await connectUi(t, restarted.discovery);
  assert.equal((await get(url)).status, 200);
  const sessions = await local.request({ type: 'web.sessions' });
  assert.equal(sessions.ok, true, sessions.error);
  const session = (sessions.value as { sessions: Array<{ id: string }> }).sessions[0]!;
  const link = await local.request({ type: 'web.link' });
  const auth = await get((link.value as { url: string }).url);
  const secondCookie = auth.headers['set-cookie']![0]!.split(';')[0]!;
  const second = await browser(t, origin, secondCookie);
  const otherUrl = await mint(second, a.id);
  assert.equal((await get(url)).status, 200);
  const result = await local.request({ type: 'web.revoke', session: session.id });
  assert.equal(result.ok, true, result.error);
  assert.equal((await get(url)).status, 404);
  assert.equal((await get(otherUrl)).status, 200);
});

test('capabilities and minting expire at the cookie session fixed thirty-day boundary', async t => {
  const { root, hub, clock, local, web, origin, cookie } = await fixture(t);
  const a = await artifact(local);
  const url = await mint(web, a.id);
  await hub.stop();
  await projectHub(t, root, {}, { clock });
  const reopened = await browser(t, origin, cookie);
  clock.block(30 * 24 * 60 * 60 * 1000 - 1);
  assert.equal((await get(url)).status, 200);
  clock.block(1);
  assert.equal((await get(url)).status, 404);
  const refused = await reopened.request({ type: 'artifact.url', artifact: a.id });
  assert.equal(refused.ok, false);
  assert.match(refused.error!, /expired|revoked/);
});


test('moved file and folder capabilities refuse substituted ancestor symlinks', async t => {
  const { root, local, web } = await fixture(t);
  const source = join(root, 'folder');
  await mkdir(join(source, 'nested'), { recursive: true });
  await writeFile(join(source, 'nested/index.html'), 'folder entry');
  await writeFile(join(source, 'sibling.txt'), 'sibling bytes');
  const folder = await artifact(local, { content: undefined, path: source, entry: 'nested/index.html' });
  const a = await artifact(local);
  const moved = await local.request({ type: 'artifact.move', artifact: a.id, folder: folder.id, name: 'moved.txt' });
  assert.equal(moved.ok, true, moved.error);
  const url = await mint(web, a.id);
  assert.equal((await get(url)).body, 'artifact bytes');
  assert.equal((await get(url, new URL(url).pathname.replace(/moved.txt$/, 'sibling.txt'))).status, 404);
  const outside = join(root, 'outside');
  await mkdir(join(outside, 'nested'), { recursive: true });
  await writeFile(join(outside, 'moved.txt'), 'private outside bytes');
  await writeFile(join(outside, 'nested/index.html'), 'private outside page');
  await rename(folder.path, folder.path + '-kept');
  await symlink(outside, folder.path);
  assert.equal((await get(url)).status, 404);
  // Use a separate unmodified folder to exercise a nested ancestor substitution.
  const nestedFolder = await artifact(local, { content: undefined, path: source, entry: 'nested/index.html', title: 'Nested ancestor' });
  const nestedUrl = await mint(web, nestedFolder.id);
  assert.equal((await get(nestedUrl)).body, 'folder entry');
  await rename(join(nestedFolder.path, 'nested'), join(nestedFolder.path, 'nested-kept'));
  await symlink(join(outside, 'nested'), join(nestedFolder.path, 'nested'));
  assert.equal((await get(nestedUrl)).status, 404);
});


test('a parent swap at final open cannot return an outside file', async t => {
  let swap: (() => Promise<void>) | undefined;
  let swaps = 0;
  const { root, local, web } = await fixture(t, async (path, flags, mode) => {
    if (swap && typeof flags === 'number' && !(flags & constants.O_DIRECTORY)) {
      const action = swap;
      swap = undefined;
      await action();
      swaps++;
    }
    return open(path, flags, mode);
  });
  const source = join(root, 'page');
  await mkdir(join(source, 'nested'), { recursive: true });
  await writeFile(join(source, 'nested/index.html'), 'authorized bytes');
  const folder = await artifact(local, { content: undefined, path: source, entry: 'nested/index.html' });
  const url = await mint(web, folder.id);
  const outside = join(root, 'outside');
  await mkdir(outside);
  await writeFile(join(outside, 'index.html'), 'private outside bytes');
  swap = async () => {
    await rename(join(folder.path, 'nested'), join(folder.path, 'nested-kept'));
    await symlink(outside, join(folder.path, 'nested'));
  };
  const response = await get(url);
  assert.equal(swaps, 1, 'fault injection reached the final filesystem open');
  assert.ok(!response.body.includes('private outside bytes'));
  if (process.platform === 'linux') {
    assert.equal(response.status, 200);
    assert.equal(response.body, 'authorized bytes', 'the opened parent remains anchored');
  } else assert.equal(response.status, 404, 'macOS refuses every symlink during open');
  assert.equal((await get(url)).status, 404, 'later reads refuse the substituted ancestor');
});
