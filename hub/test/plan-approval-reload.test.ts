// T2: live plan policy through config and launch frames with in-process harnesses.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { stringify } from 'yaml';
import { defaultConfig, renderConfig } from '../src/init/config.ts';
import type { ItemView } from '../src/tracker/tracker.ts';
import { cland, connectUi, projectHub, tempProject } from './harness.ts';

test('config set gates plans created before or after a live approval change', { timeout: 2000 }, async t => {
  const root = await tempProject(t);
  await mkdir(join(root, '.cland'), { recursive: true });
  const config = defaultConfig('Live approval');
  config.verification.lockPath = join(root, 'suite.lock');
  await writeFile(join(root, '.cland/config.toml'), renderConfig(config));
  const { discovery, fakes } = await projectHub(t, root);
  const ui = await connectUi(t, discovery);
  const create = async (title: string, kind: string, parent?: string) => {
    const result = await ui.request({ type: 'task.create', title, kind, parent, ...(kind === 'task' ? { size: 'S' } : {}) });
    assert.equal(result.ok, true, result.error);
    return (result.value as { item: ItemView }).item;
  };
  for (const timing of ['before', 'after'] as const) {
    const epic = await create('Epic', 'epic');
    const item = await create('Work', 'task', epic.id);
    const setPlan = async () => {
      const result = await ui.request({ type: 'task.plan', item: epic.id, op: 'set', yaml: stringify({ stages: [{ name: 'Build', qa: { scope: 'none', when: 'per-item' }, lanes: [[item.id]] }] }) });
      assert.equal(result.ok, true, result.error);
    };
    if (timing === 'before') await setPlan();
    const human = await cland(root, 'config', 'set', 'plan.approval', 'human');
    assert.equal(human.code, 0, human.stderr);
    if (timing === 'after') await setPlan();
    const launch = () => ui.request({ type: 'session.launch', name: 'worker', role: 'implementer', harness: 'claude-code', item: item.id });
    const refused = await launch();
    assert.equal(refused.ok, false);
    assert.match(refused.error!, /awaiting human plan approval/);
    assert.equal(fakes['claude-code']!.spawns.length, timing === 'before' ? 0 : 1);
    assert.match(human.stdout, /plan.approval = "human"; applies now/);
    const none = await ui.request({ type: 'config.set', key: 'plan.approval', value: 'none' });
    assert.equal(none.ok, true, none.error);
    assert.deepEqual(none.value, { key: 'plan.approval', value: 'none', applies: 'now' });
    const allowed = await launch();
    assert.equal(allowed.ok, true, allowed.error);
    assert.equal(fakes['claude-code']!.spawns.length, timing === 'before' ? 1 : 2);
    assert.equal((await ui.request({ type: 'session.stop', session: 'worker' })).ok, true);
  }
});

test('hub reload applies approval while a QA default edit retains the last good gate', { timeout: 2000 }, async t => {
  const root = await tempProject(t);
  await mkdir(join(root, '.cland'), { recursive: true });
  const path = join(root, '.cland/config.toml');
  const config = defaultConfig('Reload approval');
  config.verification.lockPath = join(root, 'suite.lock');
  await writeFile(path, renderConfig(config));
  const { discovery } = await projectHub(t, root);
  const ui = await connectUi(t, discovery);
  const created = await ui.request({ type: 'task.create', kind: 'epic', title: 'Unapproved epic' });
  assert.equal(created.ok, true, created.error);
  const epic = (created.value as { item: ItemView }).item;
  const launch = () => ui.request({ type: 'session.launch', name: 'worker', role: 'implementer', harness: 'claude-code', item: epic.id });
  const approval = async () => {
    const view = await ui.request({ type: 'task.view', item: epic.id });
    assert.equal(view.ok, true, view.error);
    return (view.value as { item: ItemView }).item.approval;
  };
  config.plan.approval = 'human';
  await writeFile(path, renderConfig(config));
  const loaded = await cland(root, 'hub', 'reload');
  assert.equal(loaded.code, 0, loaded.stderr);
  assert.ok(JSON.parse(loaded.stdout.replace(/^config reloaded: /, '')).applied.includes('plan.approval'));
  assert.deepEqual(await approval(), { required: true, state: 'pending' });
  const refused = await launch();
  assert.equal(refused.ok, false);
  assert.match(refused.error!, /awaiting human plan approval/);
  config.plan.approval = 'none';
  config.plan.qaDefault = { scope: 'affected', when: 'per-item' };
  await writeFile(path, renderConfig(config));
  const restart = await cland(root, 'hub', 'reload');
  assert.equal(restart.code, 1);
  assert.match(restart.stderr, /plan.qa_default changed: restart required/);
  assert.deepEqual(await approval(), { required: true, state: 'pending' });
  const retained = await launch();
  assert.equal(retained.ok, false);
  assert.match(retained.error!, /awaiting human plan approval/);
  config.plan.qaDefault = { scope: 'none', when: 'per-item' };
  await writeFile(path, renderConfig(config));
  const none = await cland(root, 'hub', 'reload');
  assert.equal(none.code, 0, none.stderr);
  assert.ok(JSON.parse(none.stdout.replace(/^config reloaded: /, '')).applied.includes('plan.approval'));
  assert.deepEqual(await approval(), { required: false, state: 'not required' });
  const allowed = await launch();
  assert.equal(allowed.ok, true, allowed.error);
});
