// T2: approval, inbox and lane drafting with injected adapters; reopen the store for persistence.
import { sessionUi as connectUi, sessionClandWithEnv as clandWithEnv } from './session-credential-fixture.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { runInNewContext } from 'node:vm';
import { FakeClock } from './fake-clock.ts';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { stringify } from 'yaml';
import { eventually, cland, inProcessSpoke, projectHub, tempProject } from './harness.ts';
import { fileURLToPath } from 'node:url';
import type { ItemView } from '../src/tracker/tracker.ts';
import type { EpicPlan } from '../src/tracker/plan.ts';

test('draft chains into per-group lanes, holds launches for approval, authorizes human/Aide and survives store reopen (in-process)', async t => {
  const root = await tempProject(t);
  const draft = fileURLToPath(new URL('../../.agents/skills/plan-epic/draft.mjs', import.meta.url));
  await mkdir(join(root, '.cland'), { recursive: true });
  await writeFile(join(root, '.cland/config.toml'), '[plan]\napproval = "human"\n');
  const hub = await projectHub(t, root, {}, { clock: new FakeClock() });
  const { discovery } = hub;
  const fake = hub.fakes['claude-code']!;
  const ui = await connectUi(t, discovery);
  const create = async (title: string, kind = 'task', parent?: string) => {
    const result = await ui.request({ ...(['task'].includes(kind) ? { size: 'M' } : {}), type: 'task.create', title, kind, parent, body: '## Acceptance criteria\n- [ ] C1. Works' });
    assert.equal(result.ok, true, result.error);
    return (result.value as { item: ItemView }).item;
  };
  const epic = await create('Demo', 'epic');
  const a = await create('Schema', 'task', epic.id), b = await create('CLI', 'task', epic.id), c = await create('Panels', 'task', epic.id);
  const outside = await create('External prerequisite');
  const d = await create('Integrated demo', 'task', epic.id);
  assert.equal((await ui.request({ type: 'task.link', item: d.id, blocked_by: [b.id, c.id] })).ok, true);
  assert.equal((await ui.request({ type: 'task.link', item: b.id, blocked_by: [a.id, outside.id] })).ok, true);
  assert.equal((await ui.request({ type: 'crew.set', key: 'implementer.policy', value: 'per-group' })).ok, true);
  // Execute the shipped draft algorithm with captured read-only CLI responses.
  // Its native stdio contract is separate from the lane grouping rule.
  const responses = [
    (await ui.request({ type: 'task.view', item: epic.id })).value,
    (await ui.request({ type: 'crew.show' })).value,
    (await ui.request({ type: 'task.list', under: epic.id })).value,
  ];
  const commands = [
    ['task', 'view', epic.id, '--json'],
    ['crew', 'show', '--json'],
    ['task', 'list', '--under', epic.id, '--json'],
  ];
  let yaml = '';
  runInNewContext((await readFile(draft, 'utf8')).replace("import { spawnSync } from 'node:child_process';", ''), {
    spawnSync: (command: string, args: string[]) => {
      assert.equal(command, 'cland');
      assert.deepEqual([...args], commands.shift());
      return { status: 0, stdout: JSON.stringify(responses.shift()) };
    },
    process: { argv: ['node', draft, epic.id], env: {}, stdout: { write: (text: string) => { yaml += text; } }, stderr: { write: (text: string) => { throw new Error(text); } } },
  });
  assert.equal(responses.length, 0);
  const set = await ui.request({ type: 'task.plan', op: 'set', item: epic.id, yaml });
  assert.equal(set.ok, true, set.error);
  const value = set.value as { plan: EpicPlan; approval: ItemView['approval'] };
  assert.deepEqual(value.plan.stages[0]!.lanes, [[a.id, b.id], [c.id]]);
  assert.deepEqual(value.plan.stages[1]!.lanes, [[d.id]], 'cross-lane dependencies wait for the next stage');
  assert.equal(value.approval?.state, 'pending');
  const inbox = (await ui.request({ type: 'inbox.list' })).value as { plans: Array<{ id: string; layer: string }> };
  assert.ok(inbox.plans.some(p => p.id === epic.id && p.layer === 'now'));
  const launch = () => ui.request({ type: 'session.launch', name: 'impl-lane', role: 'implementer', harness: 'claude-code', item: a.id });
  const deniedLaunch = await launch();
  assert.equal(deniedLaunch.ok, false);
  assert.match(deniedLaunch.error!, /awaiting human plan approval/);
  const epicLaunch = await ui.request({ type: 'session.launch', name: 'impl-epic', role: 'implementer', harness: 'claude-code', item: epic.id });
  assert.equal(epicLaunch.ok, false);
  assert.match(epicLaunch.error!, /awaiting human plan approval/);
  assert.equal(fake.spawns.length, 0);
  const coord = await inProcessSpoke(t, { discover: true, cwd: root, name: 'coord', role: 'coordinator' });
  t.after(() => coord.close());
  const denied = await coord.call<{ ok: boolean; permission: string }>('task.plan', { id: epic.id, op: 'approve' });
  assert.equal(denied.ok, false);
  assert.equal(denied.permission, 'task.plan:approve');
  const approved = await cland(root, 'task', 'plan', 'approve', epic.id, '--json');
  assert.equal(approved.code, 0, approved.stderr);
  assert.equal(JSON.parse(approved.stdout).approval.state, 'approved');
  assert.equal(JSON.parse(approved.stdout).approval.by, 'human');
  const stored = await readFile(join(root, epic.path), 'utf8');
  assert.match(stored, /plan_approval:/);
  assert.equal((await cland(root, 'task', 'plan', 'approve', epic.id, '--json')).code, 0);
  assert.equal(await readFile(join(root, epic.path), 'utf8'), stored, 'retry is idempotent');
  const launched = await launch();
  assert.equal(launched.ok, true, launched.error);
  assert.equal((await ui.request({ type: 'session.stop', session: 'impl-lane' })).ok, true);
  ui.close();
  await coord.close();
  assert.equal(await hub.stop(), undefined, 'in-process hub/store stop succeeds');
  const restarted = await projectHub(t, root, {}, { clock: new FakeClock() });
  const again = await connectUi(t, restarted.discovery);
  const show = async () => (await again.request({ type: 'task.plan', item: epic.id, op: 'show' })).value as { approval: ItemView['approval'] };
  assert.equal((await show()).approval?.state, 'approved');
  const changed = structuredClone(value.plan);
  changed.stages[0]!.name = 'Revised demo';
  assert.equal((await again.request({ type: 'task.plan', item: epic.id, op: 'set', yaml: stringify(changed) })).ok, true);
  assert.equal((await show()).approval?.state, 'pending');
  const aide = await inProcessSpoke(t, { discover: true, cwd: root, name: 'aide-demo', role: 'aide' });
  t.after(() => aide.close());
  const aideApproved = await aide.call<{ ok: boolean; error?: string; approval: ItemView['approval'] }>('task.plan', { id: epic.id, op: 'approve' });
  assert.equal(aideApproved.ok, true, aideApproved.error);
  assert.equal(aideApproved.approval?.by, 'aide-demo');
  const cliDenied = await clandWithEnv(root, { CLAND_SESSION_NAME: 'aide-demo' }, 'task', 'plan', 'approve', a.id, '--json');
  assert.notEqual(cliDenied.code, 0, 'a task cannot be approved as an epic');
});

test('approval none is the default; no-plan and broken-plan approvals refuse (in-process)', async t => {
  const root = await tempProject(t);
  const { discovery } = await projectHub(t, root, {}, { clock: new FakeClock() });
  const ui = await connectUi(t, discovery);
  const result = await ui.request({ type: 'task.create', title: 'Empty', kind: 'epic' });
  const epic = (result.value as { item: ItemView }).item;
  assert.equal(epic.approval?.state, 'not required');
  assert.equal((await ui.request({ type: 'task.plan', op: 'approve', item: epic.id })).ok, false);
  const child = (await ui.request({ size: 'M', type: 'task.create', title: 'Child', parent: epic.id })).value as { item: ItemView };
  const plan = { stages: [{ name: 'demo', qa: { scope: 'none', when: 'per-item' }, lanes: [[child.item.id]] }] };
  assert.equal((await ui.request({ type: 'task.plan', op: 'set', item: epic.id, yaml: stringify(plan) })).ok, true);
  const path = join(root, epic.path);
  await writeFile(path, (await readFile(path, 'utf8')).replace('scope: none', 'scope: broken'));
  assert.equal((await ui.request({ type: 'task.plan', op: 'approve', item: epic.id })).ok, false);
});

test('the inbox sees a refused plan recover when its missing child is created (in-process)', async t => {
  const root = await tempProject(t);
  await mkdir(join(root, '.cland'), { recursive: true });
  await writeFile(join(root, '.cland/config.toml'), '[plan]\napproval = "human"\n');
  const { discovery } = await projectHub(t, root, {}, { clock: new FakeClock() });
  const ui = await connectUi(t, discovery);
  const created = await ui.request({ type: 'task.create', title: 'Future child', kind: 'epic' });
  const epic = (created.value as { item: ItemView }).item;
  const path = join(root, epic.path);
  await writeFile(path, `${await readFile(path, 'utf8')}\n## Plan\n\n\`\`\`yaml\nstages:\n  - name: recovered\n    qa: {scope: none, when: per-item}\n    lanes: [[T-2]]\n\`\`\`\n`);
  await eventually('missing child plan refused', async () => {
    const listed = (await ui.request({ type: 'task.list' })).value as { items: ItemView[] };
    return listed.items.find(item => item.id === epic.id)?.planError?.includes('no such plan item') || undefined;
  });
  const child = await ui.request({ size: 'M', type: 'task.create', title: 'Now present', parent: epic.id });
  assert.equal(child.ok, true, child.error);
  const childId = (child.value as { item: ItemView }).item.id;
  const inbox = (await ui.request({ type: 'inbox.list' })).value as { plans: Array<{ id: string }> };
  assert.ok(inbox.plans.some(plan => plan.id === epic.id), 'recovered plan immediately waits for approval');
  const other = await ui.request({ type: 'task.create', title: 'Other parent', kind: 'epic' });
  const otherId = (other.value as { item: ItemView }).item.id;
  assert.equal((await ui.request({ type: 'task.link', item: childId, parent: otherId })).ok, true);
  const invalidated = (await ui.request({ type: 'inbox.list' })).value as { plans: Array<{ id: string }> };
  assert.ok(!invalidated.plans.some(plan => plan.id === epic.id), 'moving the child invalidates the waiting plan');
  assert.equal((await ui.request({ type: 'task.link', item: childId, parent: epic.id })).ok, true);
  const recovered = (await ui.request({ type: 'inbox.list' })).value as { plans: Array<{ id: string }> };
  assert.ok(recovered.plans.some(plan => plan.id === epic.id), 'restoring the child recovers the same accepted plan');
});
