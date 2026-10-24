// T2: published MCP verify schema and admission through an in-process spoke/hub;
// candidate Git facts are injected, so no executor or native process is needed.
import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { appendFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { connectUi, inProcessSpoke, projectHub, tempProject } from './harness.ts';
import { FakeClock } from './fake-clock.ts';
import type { VerificationQueue } from '../src/protocol.ts';
import { verificationFixture } from './verification-fixture.ts';

async function fixture(t: TestContext) {
  const root = await tempProject(t, 'verify-tool-');
  // Since T-666 verify admits nothing until the project names its test command;
  // a cland-shaped candidate keeps the injected selection (T-667).
  await mkdir(join(root, '.cland'), { recursive: true });
  await appendFile(join(root, '.cland/config.toml'), `\n[verification]\n${await verificationFixture(root)}`);
  const hub = await projectHub(t, root, {}, { clock: new FakeClock(), durationContext: null,
    candidate: { head: async () => 'a'.repeat(40), tree: async () => null,
      inspect: async (cwd: string) => ({ head: 'a'.repeat(40), tree: null, branch: 'candidate',
        selection: { mode: 'hub-only', files: [], reason: cwd }, tierPlan: [], budgetBase: undefined }) },
  });
  const ui = await connectUi(t, hub.discovery);
  assert.equal((await ui.request({ type: 'role.set', session: 'impl', role: 'implementer' })).ok, true);
  const spoke = await inProcessSpoke(t, { cwd: root, discover: true, assignRole: false, name: 'impl', sessionId: 'verify-tool', role: 'implementer' });
  await spoke.waitForPresence(['impl']);
  return { root, ui, spoke };
}

test('MCP verify publishes described inputs with an optional claimed-worktree cwd', async t => {
  const { spoke } = await fixture(t);
  const tool = (await spoke.client.listTools()).tools.find(tool => tool.name === 'verify')!;
  const properties = tool.inputSchema.properties as Record<string, { type: string; description?: string; enum?: string[] }>;
  for (const field of ['cwd', 'mode', 'executor', 'report', 'to', 'occasion', 'dryRun', 'diagnostics', 'workers', 'size', 'fresh']) {
    assert.ok(properties[field]?.description, `${field} needs a description`);
  }
  assert.equal(properties.cwd!.type, 'string');
  assert.match(properties.cwd!.description!, /claimed item worktree/);
  assert.ok(!tool.inputSchema.required?.includes('cwd'));
  assert.deepEqual(properties.mode!.enum, ['auto', 'all', 'hub', 'nvim']);
  assert.deepEqual(properties.executor!.enum, ['local', 'droplet']);
});

test('MCP verify defaults cwd to the claimed item worktree before admission', async t => {
  const { root, spoke, ui } = await fixture(t);
  const created = await ui.request({ type: 'task.create', title: 'Verify default', size: 'XS', assignee: 'impl' });
  const item = (created.value as { item: { id: string } }).item.id;
  const claimed = await spoke.call<{ ok: boolean }>('task.claim', { id: item });
  assert.equal(claimed.ok, true, JSON.stringify(claimed));
  const worktree = join(root, '.cland/worktrees', item);
  await mkdir(worktree, { recursive: true });
  await verificationFixture(worktree);
  const preview = await spoke.call<{ ok: boolean; selection: { reason: string }; dryRun: boolean }>('verify', { dryRun: true });
  assert.equal(preview.ok, true, JSON.stringify(preview));
  assert.equal(preview.selection.reason, worktree, 'the spoke launched in the project root, not this directory');
  const explicit = await spoke.call<{ ok: boolean; selection: { reason: string } }>('verify', { dryRun: true, cwd: root });
  assert.equal(explicit.ok, true, JSON.stringify(explicit));
  assert.equal(explicit.selection.reason, root);
  assert.deepEqual(((await ui.request({ type: 'suite.queue' })).value as VerificationQueue).waiters, []);
});

test('MCP verify names missing or invalid fields before enqueue', async t => {
  const { root, spoke, ui } = await fixture(t);
  const cases: Array<{ args: Record<string, unknown>; fields: string[] }> = [
    { args: {}, fields: ['cwd'] },
    { args: { cwd: 'relative', dryRun: true }, fields: ['cwd'] },
    { args: { cwd: root, dryRun: true, diagnostics: true }, fields: [] },
    ...Object.entries({ cwd: 1, mode: null, executor: 'other', report: 1, to: 'impl', occasion: 'task',
      dryRun: 'true', workers: 0, size: '../bad', fresh: 1, diagnostics: 'true' })
      .map(([field, value]) => ({ args: { cwd: root, dryRun: true, [field]: value }, fields: [field] })),
    { args: { cwd: root, report: 'general', diagnostics: true }, fields: ['diagnostics', 'dryRun'] },
  ];
  for (const { args, fields } of cases) {
    const result = await spoke.call<{ ok: boolean; error?: string }>('verify', args);
    assert.equal(result.ok, fields.length === 0, JSON.stringify({ args, result }));
    for (const field of fields) assert.match(result.error!, new RegExp(`\\b${field}\\b`), JSON.stringify({ args, result }));
  }
  const queue = (await ui.request({ type: 'suite.queue' })).value as VerificationQueue;
  assert.deepEqual(queue.waiters, []);
  assert.deepEqual(queue.remote, []);
});
