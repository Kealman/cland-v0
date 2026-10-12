// Plan policy through the daemon's frame protocol, CLI and real verifier spokes.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile, writeFile, rename } from 'node:fs/promises';
import { join } from 'node:path';
import { stringify } from 'yaml';
import type { ItemView } from '../src/tracker/tracker.ts';
import type { QaPolicy, EpicPlan } from '../src/tracker/plan.ts';
import { cland, connectUi, eventually, spawnSpoke, startDaemon, tempProject } from './harness.ts';
import { copyPreparedProject } from './prepared-project.ts';
import { taskWriteGate } from './tracker-write-gate.ts';

const git = (cwd: string, ...args: string[]) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
async function setup(t: test.TestContext, fallback: QaPolicy = { scope: 'none', when: 'per-item' }, options: { levels?: string[]; gate?: boolean } = {}) {
  const root = await tempProject(t);
  await copyPreparedProject(root);
  await writeFile(join(root, '.cland/config.toml'), `${options.levels ? `[tracker]\nlevels = ${JSON.stringify(options.levels)}\n` : ''}[plan]\nqa_default = {scope = "${fallback.scope}", when = "${fallback.when}"}\n`);
  const gate = options.gate ? await taskWriteGate(t, root) : undefined;
  const { discovery } = await startDaemon(t, root, gate?.env);
  const ui = await connectUi(t, discovery);
  const rev = await spawnSpoke({ discover: true, cwd: root, name: 'rev', role: 'reviewer' });
  const qa = await spawnSpoke({ discover: true, cwd: root, name: 'qa-one', role: 'qa' });
  t.after(async () => { await rev.close(); await qa.close(); });
  const create = async (title: string, kind = 'task', parent?: string, labels?: string[]) => {
    const r = await ui.request({ type: 'task.create', title, kind, parent, labels });
    assert.equal(r.ok, true, r.error);
    return (r.value as { item: ItemView }).item;
  };
  const epic = await create('Plan', 'epic');
  const item = await create('Feature', 'task', epic.id);
  const claim = await ui.request({ type: 'task.claim', item: item.id });
  assert.equal(claim.ok, true, claim.error);
  const work = (claim.value as { worktree: { path: string } }).worktree;
  await writeFile(join(work.path, 'feature'), 'reviewed\n');
  git(work.path, 'add', 'feature'); git(work.path, 'commit', '-qm', 'Feature');
  const read = async () => ((await ui.request({ type: 'task.view', item: item.id })).value as { item: ItemView }).item;
  const set = async (plan: EpicPlan) => {
    const r = await ui.request({ type: 'task.plan', item: epic.id, op: 'set', yaml: stringify(plan) });
    assert.equal(r.ok, true, r.error);
  };
  const review = async (verified?: string) => {
    const r = await rev.call<{ ok: boolean; error?: string }>('task.comment', { id: item.id, verdict: 'review', result: 'clear', run: 'review', verified });
    assert.equal(r.ok, true, r.error);
    await eventually('current review', async () => (await read()).verdicts[0]?.current === true ? true : undefined);
  };
  return { root, ui, rev, qa, epic, item, create, read, set, review, gate };
}

for (const policy of [
  { scope: 'none', when: 'per-item' },
  { scope: 'affected', when: 'per-item' },
  { scope: 'full', when: 'per-item' },
  { scope: 'full', when: 'after-stage' },
] as QaPolicy[]) {
  test(`stage ${policy.scope}/${policy.when}: ready agrees with merge`, async t => {
    const { ui, qa, epic, item, read, set, review } = await setup(t);
    await set({ stages: [{ name: 'Stage', qa: policy, lanes: [[item.id]] }] });
    await review();
    assert.deepEqual((await read()).qaPolicy, policy);
    if (policy.scope !== 'none' && policy.when === 'per-item') {
      const refused = await ui.request({ type: 'merge', item: item.id }, 30_000);
      assert.equal((refused as { code?: string }).code, 'qa-missing');
      assert.notEqual((await read()).status, 'ready');
      assert.equal((await qa.call<{ ok: boolean }>('task.comment', { id: item.id, verdict: 'qa', result: 'clear', run: 'qa' })).ok, true);
    }
    await eventually('ready', async () => (await read()).status === 'ready' ? true : undefined);
    const merged = await ui.request({ type: 'merge', item: item.id }, 30_000);
    assert.equal(merged.ok, true, merged.error);
    const parent = ((await ui.request({ type: 'task.view', item: epic.id })).value as { item: ItemView }).item;
    assert.equal(parent.state, 'open', 'item merge leaves stage closure to stage QA');
  });
}

test('plan overrides and QA-specific criteria invalidate ready; reviewer marks cannot replace QA', async t => {
  const { root, ui, qa, epic, item, read, set, review } = await setup(t);
  const plan: EpicPlan = { stages: [{ name: 'Stage', qa: { scope: 'full', when: 'per-item' }, lanes: [[item.id]] }], items: { [item.id]: { qa: { scope: 'none', when: 'per-item' } } } };
  assert.equal((await ui.request({ type: 'task.edit', item: item.id, body: '## Acceptance criteria\n- [ ] C1. Works' })).ok, true);
  assert.equal((await ui.request({ type: 'task.criterion', item: item.id, op: 'done', criterion: 'C1' })).ok, true);
  await set(plan);
  await review('all');
  await eventually('review suffices for override', async () => (await read()).status === 'ready' ? true : undefined);
  plan.items![item.id]!.qa_criteria = ['C1'];
  await set(plan);
  await eventually('plan criterion revokes ready', async () => (await read()).status === 'in progress' ? true : undefined);
  const refused = await ui.request({ type: 'merge', item: item.id }, 30_000);
  assert.equal((refused as { code?: string }).code, 'criteria-incomplete');
  assert.match(refused.error ?? '', /C1.*not verified by QA/);
  const mark = await qa.call<{ ok: boolean }>('task.criterion', { id: item.id, op: 'verify', criterion: 'C1', run: 'qa-criterion' });
  assert.equal(mark.ok, true);
  await eventually('QA mark allows ready', async () => (await read()).status === 'ready' ? true : undefined);
  const markedBody = (await read()).body;
  assert.equal((await ui.request({ type: 'task.edit', item: item.id, body: '## Acceptance criteria\n' })).ok, true);
  const missing = await ui.request({ type: 'merge', item: item.id }, 30_000);
  assert.equal((missing as { code?: string }).code, 'criteria-incomplete');
  assert.match(missing.error ?? '', /C1: QA criterion is missing/);
  assert.equal((await ui.request({ type: 'task.edit', item: item.id, body: markedBody })).ok, true);
  plan.items![item.id]!.qa = { scope: 'affected', when: 'per-item' };
  await set(plan);
  await eventually('QA override revokes ready', async () => (await read()).status === 'in progress' ? true : undefined);
  assert.equal(((await ui.request({ type: 'merge', item: item.id }, 30_000)) as { code?: string }).code, 'qa-missing');
  // A malformed hand edit keeps the accepted per-item policy in force.
  const parent = ((await ui.request({ type: 'task.view', item: epic.id })).value as { item: ItemView }).item;
  const path = join(root, parent.path);
  const original = await readFile(path, 'utf8');
  await writeFile(path, original.replace('scope: affected', 'scope: broken'));
  assert.equal(((await ui.request({ type: 'merge', item: item.id }, 30_000)) as { code?: string }).code, 'qa-missing');
  await writeFile(path, original);
  assert.equal((await qa.call<{ ok: boolean }>('task.comment', { id: item.id, verdict: 'qa', result: 'clear', run: 'qa', verified: 'all' })).ok, true);
  await eventually('ready with QA verdict', async () => (await read()).status === 'ready' ? true : undefined);
  assert.equal((await ui.request({ type: 'merge', item: item.id }, 30_000)).ok, true);
});

test('migration preserves plan QA overrides, reports fallback ids and retires labels idempotently', async t => {
  const { root, ui, epic, item, create, read, set } = await setup(t);
  await set({ stages: [{ name: 'Stage', qa: { scope: 'none', when: 'per-item' }, lanes: [[item.id]] }] });
  const outside = await create('Outside', 'task', undefined, ['qa-required']);
  const omitted = await create('Omitted', 'task', epic.id, ['qa-required']);
  assert.equal((await ui.request({ type: 'task.edit', item: item.id, add_labels: ['qa-required'] })).ok, true);
  const result = await cland(root, 'task', 'plan', 'migrate', '--json');
  assert.equal(result.code, 0, result.stderr);
  const migrated = JSON.parse(result.stdout) as { migrated: string[]; fallback: string[]; report: string };
  assert.deepEqual(migrated.migrated, [item.id, omitted.id]);
  assert.deepEqual(migrated.fallback, [outside.id]);
  assert.match(migrated.report, new RegExp(`${outside.id}.*old QA requirement may no longer be met`, 's'));
  assert.deepEqual((await read()).qaPolicy, { scope: 'affected', when: 'per-item' });
  for (const id of [item.id, outside.id, omitted.id]) {
    const view = ((await ui.request({ type: 'task.view', item: id })).value as { item: ItemView }).item;
    assert.equal(view.labels.includes('qa-required'), false);
  }
  const second = await cland(root, 'task', 'plan', 'migrate', '--json');
  assert.equal(second.code, 0, second.stderr);
  assert.deepEqual(JSON.parse(second.stdout).migrated, []);
  assert.deepEqual(JSON.parse(second.stdout).fallback, [outside.id]);
  await eventually('migration report is journalled', async () => {
    const rows = (await readFile(join(root, '.cland/journal.jsonl'), 'utf8')).trim().split('\n').map(line => JSON.parse(line));
    return rows.some(r => r.event === 'task-qa-migrated' && r.fallback.includes(outside.id)) && rows.some(r => r.event === 'task-qa-migration-fallback' && r.id === outside.id) ? true : undefined;
  });
});


test('tool and hand-edited ancestor moves recheck descendant ready under the new default', async t => {
  const { root, ui, epic, item, create, read, set, review } = await setup(t, { scope: 'affected', when: 'per-item' }, { levels: ['release', 'epic', 'feature'] });
  const feature = await create('Feature container', 'feature', epic.id);
  const other = await create('No plan', 'epic');
  assert.equal((await ui.request({ type: 'task.link', item: item.id, parent: feature.id })).ok, true);
  await set({ stages: [{ name: 'Stage', qa: { scope: 'none', when: 'per-item' }, lanes: [[item.id]] }] });
  await review();
  await eventually('review-only ready', async () => (await read()).status === 'ready' ? true : undefined);
  assert.equal((await ui.request({ type: 'task.link', item: feature.id, parent: other.id })).ok, true);
  await eventually('ancestor move revokes ready', async () => (await read()).status === 'in progress' ? true : undefined);
  assert.deepEqual((await read()).qaPolicy, { scope: 'affected', when: 'per-item' });
  assert.equal(((await ui.request({ type: 'merge', item: item.id }, 30_000)) as { code?: string }).code, 'qa-missing');
  const path = join(root, feature.path);
  const moved = await readFile(path, 'utf8');
  await writeFile(path, moved.replace(`parent: ${other.id}`, `parent: ${epic.id}`));
  await eventually('hand move restores ready', async () => (await read()).status === 'ready' ? true : undefined);
  await writeFile(path, moved);
  await eventually('hand move revokes ready again', async () => (await read()).status === 'in progress' ? true : undefined);
});

test('interrupted migration keeps retired fallback warnings in files, retry response and journal across restart', async t => {
  const { root, ui, rev, qa, item, create, gate } = await setup(t, undefined, { gate: true });
  const outside = await create('Second outside', 'task', undefined, ['qa-required']);
  assert.equal((await ui.request({ type: 'task.edit', item: item.id, add_labels: ['qa-required'] })).ok, true);
  await gate!.arm();
  const migrating = cland(root, 'task', 'plan', 'migrate', '--json');
  await gate!.entered();
  const path = join(root, outside.path), held = `${path}.held`;
  await rename(path, held);
  await gate!.release();
  const failed = await migrating;
  assert.notEqual(failed.code, 0, 'the next native task open fails after the first retirement');
  await rename(held, path);
  const first = ((await ui.request({ type: 'task.view', item: item.id })).value as { item: ItemView }).item;
  assert.equal(first.labels.includes('qa-required'), false);
  assert.ok(first.comments.some(c => c.text.startsWith('QA migration fallback:')));
  await rev.close(); await qa.close(); ui.close();
  assert.equal((await cland(root, 'hub', 'stop')).code, 0);
  await startDaemon(t, root);
  const retry = await cland(root, 'task', 'plan', 'migrate', '--json');
  assert.equal(retry.code, 0, retry.stderr);
  assert.deepEqual(JSON.parse(retry.stdout).fallback, [item.id, outside.id]);
  await eventually('recovered warning in journal', async () => {
    const rows = (await readFile(join(root, '.cland/journal.jsonl'), 'utf8')).trim().split('\n').map(line => JSON.parse(line));
    return rows.some(r => r.event === 'task-qa-migrated' && r.fallback.includes(item.id) && r.fallback.includes(outside.id)) ? true : undefined;
  });
});
