// Coordinator launches through the spoke's MCP interface, with the fake harness at the process boundary.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fakeClaude, spawnSpoke, startDaemon, tempProject } from './harness.ts';
import type { HarnessProcessView } from '../src/protocol.ts';

test('a Coordinator spoke launches a session in the requested absolute cwd', async (t) => {
  const root = await tempProject(t);
  const cwd = join(root, '.cland', 'worktrees', 'T-45');
  await mkdir(cwd, { recursive: true });
  const fake = await fakeClaude(t);
  await startDaemon(t, root, fake.env);
  const coord = await spawnSpoke({ discover: true, cwd: root, name: 'coord', role: 'coordinator' });
  t.after(() => coord.close());
  await coord.waitForPresence(['coord']);

  const tool = (await coord.client.listTools()).tools.find((tool) => tool.name === 'session.launch');
  const cwdSchema = tool?.inputSchema.properties?.cwd;
  assert.ok(cwdSchema && 'type' in cwdSchema);
  assert.equal(cwdSchema.type, 'string');
  assert.ok(!tool?.inputSchema.required?.includes('cwd'));

  const launched = await coord.call<{ ok: boolean; error?: string; process: HarnessProcessView }>('session.launch', {
    name: 'impl-45', role: 'implementer', harness: 'claude-code', cwd,
  });
  assert.equal(launched.ok, true, launched.error);
  assert.equal(launched.process.cwd, cwd);
  const child = (await fake.sessions()).find((s) => s.name === 'impl-45');
  assert.equal(child?.cwd, cwd);
});

test('a Coordinator spoke gets a typed refusal for a missing directory or a file as launch cwd', async (t) => {
  const root = await tempProject(t);
  await writeFile(join(root, 'file'), 'not a directory');
  const fake = await fakeClaude(t);
  await startDaemon(t, root, fake.env);
  const coord = await spawnSpoke({ discover: true, cwd: root, name: 'coord', role: 'coordinator' });
  t.after(() => coord.close());
  await coord.waitForPresence(['coord']);

  for (const cwd of ['missing', 'file']) {
    const refused = await coord.call<{ ok: boolean; code?: string; error?: string }>('session.launch', {
      name: 'impl-invalid', role: 'implementer', harness: 'claude-code', cwd,
    });
    assert.equal(refused.ok, false);
    assert.equal(refused.code, 'invalid-cwd');
    assert.ok(refused.error?.includes(join(root, cwd)), refused.error);
  }
  assert.deepEqual(await fake.sessions(), []);
  // Refusal leaves the name usable, and omitting cwd still launches at the project root.
  const launched = await coord.call<{ ok: boolean; error?: string; process: HarnessProcessView }>('session.launch', {
    name: 'impl-invalid', role: 'implementer', harness: 'claude-code',
  });
  assert.equal(launched.ok, true, launched.error);
  assert.equal(launched.process.cwd, root);
  assert.equal((await fake.sessions()).find((s) => s.name === 'impl-invalid')?.cwd, root);
});

test('a Coordinator spoke resolves relative launch cwd against the project root', async (t) => {
  const root = await tempProject(t);
  const relative = '.cland/worktrees/T-45 relative';
  const cwd = join(root, relative);
  const coordinatorCwd = join(root, 'coordinator');
  await mkdir(cwd, { recursive: true });
  await mkdir(coordinatorCwd);
  const fake = await fakeClaude(t);
  await startDaemon(t, root, fake.env);
  const coord = await spawnSpoke({ discover: true, cwd: coordinatorCwd, name: 'coord', role: 'coordinator' });
  t.after(() => coord.close());
  await coord.waitForPresence(['coord']);

  const launched = await coord.call<{ ok: boolean; error?: string; process: HarnessProcessView }>('session.launch', {
    name: 'impl-relative', role: 'implementer', harness: 'claude-code', cwd: relative,
  });
  assert.equal(launched.ok, true, launched.error);
  assert.equal(launched.process.cwd, cwd);
  const child = (await fake.sessions()).find((s) => s.name === 'impl-relative');
  assert.equal(child?.cwd, cwd);
});
