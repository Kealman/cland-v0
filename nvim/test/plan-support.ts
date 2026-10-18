// The plan view at the real hub frame and headless Neovim boundaries.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { stringify } from 'yaml';
import { connectUi, projectHub, tempProject } from '../../hub/test/harness.ts';
import type { ItemView } from '../../hub/src/tracker/tracker.ts';
import type { EpicPlan } from '../../hub/src/tracker/plan.ts';
import { startClient } from './harness.ts';
import { bin, skip } from './plan-view-support.ts';
export { bin, skip } from './plan-view-support.ts';
import { waitInitialSnapshots } from './readiness.ts';
export async function setup(t: test.TestContext) {
  const root = await tempProject(t);
  await mkdir(join(root, '.cland'), { recursive: true });
  await writeFile(join(root, '.cland/config.toml'), '[plan]\napproval = "human"\n');
  const { discovery } = await projectHub(t, root);
  const ui = await connectUi(t, discovery);
  const create = async (title: string, kind: string, parent?: string) => {
    const result = await ui.request({ ...(['task'].includes(kind) ? { size: 'M' } : {}), type: 'task.create', title, kind, parent, body: '## Acceptance criteria\n- [ ] C1. Works' });
    assert.equal(result.ok, true, result.error);
    const item = (result.value as { item: ItemView }).item;
    if (kind === 'task') assert.equal((await ui.request({ type: 'task.edit', item: item.id, status: 'planned' })).ok, true);
    return item;
  };
  const release = await create('Release', 'release');
  const epic = await create('Panels', 'epic', release.id);
  const a = await create('Registry', 'task', epic.id), b = await create('Sessions', 'task', epic.id), c = await create('Plan UI', 'task', epic.id);
  const outside = await create('External blocker', 'task', release.id);
  assert.equal((await ui.request({ type: 'task.link', item: a.id, blocked_by: [outside.id] })).ok, true);
  const plan: EpicPlan = {
    stages: [
      { name: 'registry and sessions', qa: { scope: 'affected', when: 'after-stage' }, lanes: [[a.id], [b.id]] },
      { name: 'plan view', qa: { scope: 'full', when: 'per-item' }, lanes: [[c.id]] },
    ],
    items: { [b.id]: { qa: { scope: 'none', when: 'per-item' } }, [c.id]: { qa_criteria: ['C1'] } },
  };
  assert.equal((await ui.request({ type: 'task.plan', item: epic.id, op: 'set', yaml: stringify(plan) })).ok, true);
  const client = await startClient(t, bin, root);
  await client.waitScreen(s => s.includes('hub: connected'), 'connected');
  await waitInitialSnapshots(client);
  await client.input(`<Esc>:Cland view item ${epic.id}<CR>`);
  await client.waitScreen(s => s.includes('Panels'), 'epic item');
  return { root, ui, epic, a, b, c, outside, plan, client };
}
export { planText, waitFor, openPlan, waitPlan } from './plan-view-support.ts';
