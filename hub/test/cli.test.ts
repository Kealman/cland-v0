// T2: the executable CLI is the subject; an in-process hub serves task headings.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer, type Socket } from 'node:net';
import { readFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { cland, projectHub, tempProject } from './harness.ts';
import { beforeDirectories } from './process-cleanup.ts';

const VERSION = (JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')) as { version: string }).version;
const run = (...args: string[]) => cland(process.cwd(), ...args);

test('cland --version prints the version of the root package', async () => {
  for (const flag of ['--version', '-v']) {
    const r = await run(flag);
    assert.equal(r.code, 0, r.stderr);
    assert.equal(r.stdout, `${VERSION}\n`);
  }
});

test('cland with no command off a terminal prints the help; an unknown command is a usage error', async () => {
  const help = await run();
  assert.equal(help.code, 0);
  assert.match(help.stdout, /usage: cland \[<command>\]/);
  const bad = await run('serve');
  assert.equal(bad.code, 2);
  assert.match(bad.stderr, /unknown command "serve"/);
});

test('release help prints usage without a project hub or release work', async t => {
  const root = await tempProject(t);
  for (const flag of ['--help', '-h']) {
    const result = await cland(root, 'release', flag);
    assert.equal(result.code, 0, result.stderr);
    assert.equal(result.stderr, '');
    assert.match(result.stdout, /release <vX\.Y\.Z> \[--dry-run\] \[--json\]/);
    assert.match(result.stdout, /release --item T-n/);
  }
});

for (const [command, usage] of [
  ['sync', /sync \[--json\]/],
  ['publish', /publish <branch> --item T-n/],
  ['push', /push \[--json\]/],
  ['merge', /merge <T-id> \[--json\]/],
] as const) {
  test(`${command} help prints usage without a project hub or command work`, async t => {
    const root = await tempProject(t);
    for (const flag of ['--help', '-h']) {
      const result = await cland(root, command, flag);
      assert.equal(result.code, 0, result.stderr);
      assert.equal(result.stderr, '');
      assert.match(result.stdout, usage);
    }
  });
}

test('task view headings include release versions once, including in a child ancestry', async t => {
  const root = await tempProject(t);
  const dir = join(root, '.cland/tasks');
  await mkdir(dir, { recursive: true });
  for (const [id, title, version] of [
    ['R-228', 'Working with items', '0.1.2'],
    ['R-229', 'v0.1.1', '0.1.1'],
    ['R-230', '0.1.0', '0.1.0'],
    ['R-231', 'Unversioned', ''],
  ]) {
    await writeFile(join(dir, `${id}-release.md`), `---\nid: ${id}\nkind: release\ntitle: ${title}\nstate: open\n${version ? `version: ${version}\n` : ''}---\n`);
  }
  await writeFile(join(dir, 'E-269-epic.md'), '---\nid: E-269\nkind: epic\ntitle: Prefixes and categories\nstate: open\nparent: R-228\n---\n');
  await projectHub(t, root);
  for (const [id, heading] of [
    ['R-228', 'R-228  0.1.2  Working with items'],
    ['R-229', 'R-229  v0.1.1'],
    ['R-230', 'R-230  0.1.0'],
    ['R-231', 'R-231  Unversioned'],
    ['E-269', 'R-228  0.1.2  Working with items › E-269  Prefixes and categories'],
  ]) {
    const result = await cland(root, 'task', 'view', id!);
    assert.equal(result.code, 0, result.stderr);
    assert.equal(result.stdout.split('\n')[0], heading);
  }
});

test('task text output preserves an old-hub item without optional card fields', async t => {
  const root = await tempProject(t);
  const socket = join(root, 'hub.sock');
  await mkdir(join(root, '.cland'));
  await writeFile(join(root, '.cland/hub.json'), JSON.stringify({ root, socket, port: 0, secret: 'test', pid: process.pid, version: 'test' }));
  // Literal old-hub wire shape: deliberately no criteriaCounts, closed or verify.
  const item = {
    id: 'T-1', kind: 'task', title: 'Old hub item', state: 'open', rank: 10,
    labels: ['ready-for-agent'], assignee: null, parent: null, blocked_by: [],
    topic: null, branch: null, created: '2026-10-13T17:00:00Z', updated: '2026-10-13T17:01:00Z',
    path: '.cland/tasks/T-1-old-hub-item.md', ancestry: [{ id: 'T-1', kind: 'task', title: 'Old hub item' }],
    body: 'The item body remains visible.', plan: null, criteria: [], verdicts: [], claim: null, holds: [],
    comments: [{ author: 'coord', at: '2026-10-13T17:01:00Z', text: 'The comment remains visible.' }],
  };
  const peers = new Set<Socket>();
  const requests: string[] = [];
  const server = createServer(peer => {
    peers.add(peer);
    peer.on('close', () => peers.delete(peer));
    let buffer = '';
    peer.setEncoding('utf8');
    peer.on('data', chunk => {
      buffer += chunk;
      for (;;) {
        const nl = buffer.indexOf('\n');
        if (nl < 0) break;
        const frame = JSON.parse(buffer.slice(0, nl)) as { type: string; id?: string };
        buffer = buffer.slice(nl + 1);
        if (frame.type === 'hello') peer.write(JSON.stringify({ type: 'welcome', name: 'cli', presence: [] }) + '\n');
        else {
          requests.push(frame.type);
          peer.write(JSON.stringify({ type: 'result', id: frame.id, ok: true, value: { item } }) + '\n');
        }
      }
    });
  });
  beforeDirectories(t, async () => {
    for (const peer of peers) peer.destroy();
    await new Promise<void>(resolve => server.close(() => resolve()));
  });
  await new Promise<void>(resolve => server.listen(socket, resolve));
  for (const args of [['view', 'T-1'], ['comment', 'T-1', 'New comment']]) {
    const result = await cland(root, 'task', ...args);
    assert.equal(result.code, 0, result.stderr);
    assert.equal(result.stderr, '');
    assert.match(result.stdout, /^T-1  Old hub item\n/);
    assert.match(result.stdout, /^  labels    ready-for-agent$/m);
    assert.match(result.stdout, /^  file      \.cland\/tasks\/T-1-old-hub-item\.md$/m);
    assert.match(result.stdout, /The item body remains visible\./);
    assert.match(result.stdout, /The comment remains visible\./);
    assert.doesNotMatch(result.stdout, /^  (criteria|closed|verify)\s/m);
    assert.doesNotMatch(result.stdout, /undefined/);
  }
  assert.deepEqual(requests, ['task.view', 'task.comment']);
  Object.assign(item, {
    criteriaCounts: { total: 7, done: 2, verified: 3, stale: 1, failed: 1 },
    closed: '2026-10-13T17:02:00Z',
    verify: { executor: 'local', id: 'verify-1', state: 'finished', result: 'passed', head: 'abc123', finished: '2026-10-13T17:02:00Z', artifact: 'A-1', cached: { run: 'verify-0', head: 'abc123', tree: 'tree-1' } },
  });
  const current = await cland(root, 'task', 'view', 'T-1');
  assert.equal(current.code, 0, current.stderr);
  assert.match(current.stdout, /^  criteria  3 verified \/ 7 total · 2 done · 1 stale · 1 failed$/m);
  assert.match(current.stdout, /^  closed    2026-10-13T17:02:00Z$/m);
  assert.match(current.stdout, /^  verify    verify-1 · finished · passed · head abc123 · finished 2026-10-13T17:02:00Z · artifact A-1 · cached$/m);
});
