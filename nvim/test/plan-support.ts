// The plan view at the real hub frame and headless Neovim boundaries.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { stringify } from 'yaml';
import { connectUi, projectHub, tempProject } from '../../hub/test/harness.ts';
import type { ItemView } from '../../hub/src/tracker/tracker.ts';
import type { EpicPlan } from '../../hub/src/tracker/plan.ts';
import { nvimOrSkip, startClient, type Client } from './harness.ts';
import { waitInitialSnapshots } from './readiness.ts';
const nvim = await nvimOrSkip();
export const skip = 'skip' in nvim ? nvim.skip : false;
export const bin = 'bin' in nvim ? nvim.bin : '';
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
export async function planText(client: Client, id: string) {
  return client.lua<string>("return table.concat(vim.api.nvim_buf_get_lines(require('cland.plan').bufs[...],0,-1,false),'\\n')", id);
}
export async function waitFor(predicate: () => Promise<boolean>, what: string) {
  // Yield to Neovim between lookups so queued navigation and receipt frames can run.
  const until = Date.now() + 5000;
  let ready = false;
  while (Date.now() < until) {
    ready = await predicate();
    if (ready) break;
    await new Promise(resolve => setTimeout(resolve, 20));
  }
  assert.ok(ready, `${what} not ready within 5000 ms`);
}
export async function openPlan(client: Client, id: string) {
  // Connected precedes the task/ladder snapshots. An early command is refused,
  // so waiting for plan text after issuing it cannot recover that navigation.
  await waitFor(() => client.lua<boolean>("local id=...; return require('cland.plan').owner(id) == id", id), `epic ${id} from task and tracker snapshots`);
  await client.input(`<Esc>:Cland view plan ${id}<CR>`);
}
export async function waitPlan(client: Client, id: string, text: string) {
  await waitFor(() => client.lua<boolean>("local id,text=...; local view=require('cland.state').S.ui.view; local p=require('cland.plan'); local b,v=p.bufs[id],p.visits[id]; return view.kind == 'plan' and view.id == id and v ~= nil and not v.acknowledge and b ~= nil and vim.api.nvim_buf_is_valid(b) and table.concat(vim.api.nvim_buf_get_lines(b,0,-1,false),'\\n'):find(text,1,true) ~= nil", id, text), `plan showing ${text}`);
  assert.ok((await planText(client, id)).includes(text), text);
}
