// Offline fixtures for the release check's public contract comparison. No upstream fetch or model call.
import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { once } from 'node:events';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { adapterEventNames, compareEventNames, compareOpenCodeContract, type OpenApi } from '../src/doctor/opencode-contract.ts';
import { cland, nativeProjectHub as projectHub, tempProject } from './harness.ts';
import { onCleanup, ownProcess } from './process-cleanup.ts';

function document(): OpenApi {
  const paths: OpenApi = {};
  for (const [method, path] of [
    ['get', '/api/session/{sessionID}'], ['post', '/api/session'],
    ['post', '/api/session/{sessionID}/move'], ['get', '/api/model'],
    ['post', '/api/session/{sessionID}/prompt'], ['get', '/api/session/active'],
    ['get', '/api/session/{sessionID}/permission'], ['get', '/api/session/{sessionID}/form'],
    ['get', '/api/session/{sessionID}/message/{messageID}'], ['get', '/api/event'],
  ]) {
    const item = paths[path!] ??= {};
    assert.ok(item && typeof item === 'object' && !Array.isArray(item));
    item[method!] = {
      operationId: `${method} ${path}`, parameters: [],
      ...(method === 'post' ? { requestBody: { content: { 'application/json': { schema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] } } } } } : {}),
      responses: { '200': { description: 'Success', content: { 'application/json': { schema: { $ref: '#/components/schemas/Reply' } } } } },
    };
  }
  return { paths, components: { schemas: { Reply: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] } } } };
}

test('release contract accepts additive fields, reference renames and documentation changes', () => {
  const old = document();
  const next = JSON.parse(JSON.stringify(old).replaceAll('Reply', 'RenamedReply')) as OpenApi;
  const schemas = JSON.parse('{"RenamedReply":{"type":"object","title":"A renamed type","properties":{"id":{"type":"string"},"extra":{"type":"number"}},"required":["id","extra"],"additionalProperties":false}}');
  next.components = { schemas };
  assert.deepEqual(compareOpenCodeContract(old, next), []);
});

test('release contract rejects removed routes, changed response types and new required input', () => {
  const old = document();
  const missing = document();
  assert.ok(missing.paths && typeof missing.paths === 'object' && !Array.isArray(missing.paths));
  delete missing.paths['/api/model'];
  assert.match(compareOpenCodeContract(old, missing).join('\n'), /GET \/api\/model: missing operation/);
  const changed = JSON.parse(JSON.stringify(old).replace('"id":{"type":"string"}', '"id":{"type":"number"}')) as OpenApi;
  assert.match(compareOpenCodeContract(old, changed).join('\n'), /response.*id.type/);
  const required = JSON.parse(JSON.stringify(old).replaceAll('"required":["text"]', '"required":["text","newField"]')) as OpenApi;
  assert.match(compareOpenCodeContract(old, required).join('\n'), /new required field newField/);
  const narrowed = JSON.parse(JSON.stringify(old).replaceAll('"text":{"type":"string"}', '"text":{"type":"string","maxLength":1}')) as OpenApi;
  assert.match(compareOpenCodeContract(old, narrowed).join('\n'), /text.maxLength: new request constraint/);
});

test('release event check covers adapter subscriptions and state cases against both upstream versions', () => {
  const names = adapterEventNames(["case 'session.execution.started':", "e.type === 'permission.asked'", "e.type === 'session.execution.started'"]);
  assert.deepEqual(names, ['permission.asked', 'session.execution.started']);
  assert.deepEqual(compareEventNames(names, '"permission.asked" "session.execution.started"', "'permission.asked' 'session.execution.started'"), []);
  assert.deepEqual(compareEventNames(names, '"permission.asked" "session.execution.started"', '"permission.asked"'), ['session.execution.started: absent from newest event source']);
  assert.deepEqual(compareEventNames(names, '"permission.asked"', '"permission.asked"'), ['session.execution.started: absent from tested event source']);
});

test('release contract retains required response data while accepting optional unused SSE wrapper ids', () => {
  const old = document();
  old.components = { schemas: { Reply: { type: 'object', properties: { data: { type: 'object' } }, required: ['data'] } } };
  const missingGuarantee = JSON.parse(JSON.stringify(old).replace('"required":["data"]', '"required":[]')) as OpenApi;
  const errors = compareOpenCodeContract(old, missingGuarantee);
  assert.equal(errors.length, 10);
  assert.ok(errors.every(error => error.includes('response no longer guarantees required field data')));

  const withEvent = (required: string[]): OpenApi => ({
    ...document(), paths: {
      ...(document().paths as OpenApi),
      '/api/event': { get: { parameters: [], responses: { '200': { content: { 'text/event-stream': {
        schema: { type: 'object', properties: { id: { type: 'string' }, data: { type: 'string' } }, required },
      } } } } } },
    },
  });
  assert.deepEqual(compareOpenCodeContract(withEvent(['id', 'data']), withEvent(['data'])), []);
  assert.match(compareOpenCodeContract(withEvent(['id', 'data']), withEvent(['id'])).join('\n'), /required field data/);
});

async function releaseFixture(t: TestContext, failure?: 'contract' | 'smoke') {
  const root = await tempProject(t, 'cland-release-check-');
  await projectHub(t, root);
  const category = await cland(root, 'task', 'create', 'Bugs', '--kind', 'category', '--json');
  assert.equal(category.code, 0, category.stderr);
  const bugs = (JSON.parse(category.stdout) as { item: { id: string } }).item.id;
  await mkdir(join(root, 'hub/src/doctor'), { recursive: true });
  await mkdir(join(root, 'hub/src/adapters/opencode'), { recursive: true });
  await writeFile(join(root, 'hub/src/adapters/opencode.ts'), "e.type === 'session.execution.started'");
  await writeFile(join(root, 'hub/src/adapters/opencode/state.ts'), "case 'permission.asked':");
  const ranges = join(root, 'hub/src/doctor/ranges.ts');
  const original = 'opencode: { min: [2, 0, 24], below: [2, 0, 25] },\n';
  await writeFile(ranges, original);
  await mkdir(join(root, 'package/bin'), { recursive: true });
  let fake = await readFile(new URL('./fixtures/opencode-check.mjs', import.meta.url), 'utf8');
  if (failure === 'smoke') fake = fake.replace('session.execution.succeeded', 'session.execution.failed');
  await writeFile(join(root, 'package/bin/opencode'), `#!${process.execPath}\n${fake}`, { mode: 0o755 });
  const tarball = join(root, 'binary.tgz');
  await promisify(execFile)('tar', ['-czf', tarball, '-C', root, 'package']);
  const archive = await readFile(tarball);
  const newest = document();
  if (failure === 'contract') {
    assert.ok(newest.paths && typeof newest.paths === 'object' && !Array.isArray(newest.paths));
    delete newest.paths['/api/model'];
  }
  const upstream = createServer((req, res) => {
    if (req.url?.endsWith('/binary.tgz')) { res.end(archive); return; }
    const value = req.url === '/@opencode/cli' ? { versions: { '1.99.0': {}, '2.0.24': {}, '2.0.30': {}, '2.1.0-beta': {}, '3.0.0': {} } }
      : req.url?.startsWith('/@opencode/cli-') ? { dist: { tarball: 'https://fixture.invalid/binary.tgz', integrity: `sha512-${createHash('sha512').update(archive).digest('base64')}` } }
      : req.url?.endsWith('openapi.json') ? (req.url.includes('v2.0.30') ? newest : document())
      : undefined;
    if (value) res.end(JSON.stringify(value));
    else res.end('"session.execution.started" "permission.asked"');
  });
  onCleanup(t, async () => { upstream.closeAllConnections(); await new Promise<void>(resolve => upstream.close(() => resolve())); });
  upstream.listen(0, '127.0.0.1');
  await once(upstream, 'listening');
  const address = upstream.address();
  assert.ok(address && typeof address !== 'string');
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('CLAND_')));
  Object.assign(env, { CLAND_TEST_OPENCODE_CHECK_ROOT: root, CLAND_TEST_OPENCODE_CHECK_ORIGIN: `http://127.0.0.1:${address.port}` });
  const result = await new Promise<{ code: number; stdout: string; stderr: string }>((resolve, reject) => {
    const child = execFile(process.execPath, [fileURLToPath(new URL('../bin/check-opencode.ts', import.meta.url))], { cwd: root, env, timeout: 30_000 }, (error, stdout, stderr) => {
      if (error && typeof error.code !== 'number') reject(error);
      else resolve({ code: error?.code as number ?? 0, stdout, stderr });
    });
    ownProcess(t, child.pid);
  });
  return { root, ranges, original, bugs, ...result };
}

test('release CLI checks newest stable 2.x and advances the bound after a completed fake-provider turn', async t => {
  const result = await releaseFixture(t);
  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /newest stable 2.x 2.0.30/);
  assert.match(result.stdout, /fake-provider smoke passed/);
  assert.match(await readFile(result.ranges, 'utf8'), /below: \[2, 0, 31\]/);
});

for (const failure of ['contract', 'smoke'] as const) test(`release CLI retains the range and files a Bug when ${failure} fails`, async t => {
  const result = await releaseFixture(t, failure);
  assert.equal(result.code, 1);
  assert.match(result.stderr, /Tested range unchanged/);
  assert.match(result.stderr, /Bug filed: T-/);
  assert.equal(await readFile(result.ranges, 'utf8'), result.original);
  const listed = await cland(result.root, 'task', 'list', '--json');
  assert.equal(listed.code, 0, listed.stderr);
  const bug = (JSON.parse(listed.stdout).items as Array<{ title: string; labels: string[]; parent: string }>).find(item => item.labels.includes('bug'));
  assert.equal(bug?.parent, result.bugs);
  assert.match(bug?.title ?? '', /OpenCode 2.0.30 release compatibility check failed/);
});
