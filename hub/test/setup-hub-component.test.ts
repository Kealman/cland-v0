// T2: setup's real socket session launch with an in-process hub and fake adapter; no harness child.
import test from 'node:test';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { projectHub, tempProject } from './harness.ts';
import { FakeClock } from './fake-clock.ts';
import { setupHub } from '../src/setup/hub.ts';
import { aide } from '../src/setup/steps/aide.ts';
import { scriptedPrompter } from './setup-prompter.ts';

test('setup launches aide-1 through the real hub with the onboarding brief', async t => {
  const root = await tempProject(t);
  const { fakes } = await projectHub(t, root, {}, { clock: new FakeClock() });
  await writeFile(join(root, '.cland/roles.toml'), '[aide.launch]\nharness = "codex"\n');
  const client = setupHub(root, {});
  const lines = await aide({ root, env: {}, interactive: true, yes: false, hub: client, kind: async () => 'empty', prompter: scriptedPrompter([]), machine: {
    requiredHarnesses: async () => ['codex'],
    projectExists: async () => true, read: async () => null, write: async () => {}, run: async () => 0, onPath: async () => true,
    harness: async id => ({ id, bin: id === 'codex' ? '/tools/codex' : null, version: null, checks: [] }),
  } });
  assert.equal(lines[0]?.verdict, 'done', JSON.stringify(lines));
  assert.equal((await client.session('aide-1'))?.status, 'running');
  const spawn = fakes.codex!.spawns.at(-1)!;
  assert.equal(spawn.name, 'aide-1');
  assert.equal(spawn.role, 'aide');
  assert.ok(spawn.brief?.text.includes("Run the onboarding skill; project: empty; harnesses: codex; human's harness: codex"));
});
