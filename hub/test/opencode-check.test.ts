// T1: recorded documents and a fake download exercise the informational probe without sockets or processes.
import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runOpenCodeCheck } from '../bin/check-opencode.ts';
import { adapterEventNames, compareEventNames, compareOpenCodeContract, type OpenApi } from '../src/doctor/opencode-contract.ts';

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

async function releaseFixture(t: TestContext) {
  const root = await mkdtemp(join(tmpdir(), 'cland-release-check-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const files = {
    'hub/src/adapters/opencode.ts': "e.type === 'session.execution.started'",
    'hub/src/adapters/opencode/state.ts': "case 'permission.asked':",
    'hub/src/doctor/ranges.ts': 'opencode: { min: [2, 0, 24], below: [2, 0, 31] },\n',
    '.cland/tasks/T-1-existing.md': '# An existing tracker item\n',
  };
  for (const [path, bytes] of Object.entries(files)) {
    const full = join(root, path);
    await mkdir(join(full, '..'), { recursive: true });
    await writeFile(full, bytes);
  }
  const stdout: string[] = [];
  const stderr: string[] = [];
  const requests: string[] = [];
  const download = async (url: string): Promise<string> => {
    requests.push(url);
    if (url === 'https://registry.npmjs.org/@opencode/cli') return JSON.stringify({ versions: {
      '1.99.0': {}, '2.0.24': {}, '2.0.9': {}, '2.0.30': {}, '2.1.0-beta': {}, '3.0.0': {},
    } });
    if (url.endsWith('openapi.json')) return url.includes('v2.0.30')
      ? readFile(new URL('./fixtures/opencode-newer-openapi.json', import.meta.url), 'utf8')
      : JSON.stringify(document());
    return url.includes('v2.0.30') ? '"permission.asked"' : '"session.execution.started" "permission.asked"';
  };
  return { root, files, stdout, stderr, requests, options: { root, download, stdout: (line: string) => stdout.push(line), stderr: (line: string) => stderr.push(line) } };
}

test('release check reports recorded operation and event differences without repository writes', async t => {
  const fixture = await releaseFixture(t);
  const code = await runOpenCodeCheck(fixture.options);
  assert.equal(code, 0, fixture.stderr.join('\n'));
  const report = fixture.stdout.join('\n');
  assert.match(report, /newest stable 2.x 2.0.30/);
  assert.match(report, /GET \/api\/model: missing operation in newest document/);
  assert.match(report, /session.execution.started: absent from newest event source/);
  assert.match(report, /informational/i);
  assert.deepEqual(fixture.stderr, []);
  assert.equal(fixture.requests.length, 9, 'only registry, two OpenAPI documents and six event sources are downloaded');
  const after = (await readdir(fixture.root, { recursive: true, withFileTypes: true }))
    .filter(entry => entry.isFile()).map(entry => join(entry.parentPath, entry.name)).sort();
  assert.deepEqual(after, Object.keys(fixture.files).map(path => join(fixture.root, path)).sort());
  for (const [path, bytes] of Object.entries(fixture.files)) assert.deepEqual(await readFile(join(fixture.root, path)), Buffer.from(bytes));
});

test('release check reports compatible operations without a release gate', async t => {
  const fixture = await releaseFixture(t);
  const code = await runOpenCodeCheck({ ...fixture.options, download: async url => {
    if (url.endsWith('openapi.json')) return JSON.stringify(document());
    if (url.endsWith('.ts')) return '"session.execution.started" "permission.asked"';
    return fixture.options.download(url);
  } });
  assert.equal(code, 0);
  assert.match(fixture.stdout.join('\n'), /10 wire operations and 2 adapter event names compatible/);
  assert.deepEqual(fixture.stderr, []);
});

test('release check distinguishes network and probe failures from compatibility differences', async t => {
  const fixture = await releaseFixture(t);
  for (const [download, message] of [
    [async () => { throw new Error('network unavailable'); }, /network unavailable/],
    [async () => 'not JSON', /JSON/],
    [async () => '{"versions":{"3.0.0":{}}}', /no stable OpenCode 2.x release/],
  ] as const) {
    fixture.stderr.length = 0;
    assert.equal(await runOpenCodeCheck({ ...fixture.options, download }), 1);
    assert.match(fixture.stderr.join('\n'), message);
  }
});
