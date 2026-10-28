// T2 component: tracker rules over real sockets and CLI with in-process hub/MCP peers.
// Epic plans through the project hub, socket frames, CLI and in-process MCP handlers.
import { reindexedAfter } from './tracker-reindex.ts';
import { completeJournalLines } from './journal-lines.ts';
import { componentTask } from './component-task.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { stringify } from 'yaml';
import type { ItemView } from '../src/tracker/tracker.ts';
import { withPlan, type EpicPlan } from '../src/tracker/plan.ts';
import { cland, connectUi, eventually, inProcessSpoke, projectHub, tempProject } from './harness.ts';

// Persistence proofs close and reopen the hub/store in this process.
const hubs = new Map<string, Awaited<ReturnType<typeof projectHub>>>();
const openHub: typeof projectHub = async (...args) => {
  const hub = await projectHub(...args);
  hubs.set(args[1], hub);
  args[0].after(() => { if (hubs.get(args[1]) === hub) hubs.delete(args[1]); });
  return hub;
};
const stopHub = async (root: string) => { await hubs.get(root)!.stop(); };

type Result = { ok: boolean; error?: string; id: string; plan: EpicPlan | null; planError?: string };

async function setup(t: test.TestContext, levels?: string[]) {
  const root = await tempProject(t);
  if (levels) {
    await mkdir(join(root, '.cland'), { recursive: true });
    await writeFile(join(root, '.cland/config.toml'), `[tracker]\nlevels = ${JSON.stringify(levels)}\n`);
  }
  const { discovery } = await openHub(t, root);
  const ui = await connectUi(t, discovery);
  const create = async (title: string, kind = 'task', parent?: string) => {
    const result = await ui.request({ ...(['task'].includes(kind) ? { size: 'M' } : {}), type: 'task.create', title, kind, parent, body: '## Acceptance criteria\n- [ ] C1. Works\n\n## Notes\nKeep this prose.' });
    assert.equal(result.ok, true, result.error);
    return (result.value as { item: ItemView }).item;
  };
  const epic = await create('Epic', levels?.[1] ?? 'epic');
  const a = await create('Schema', 'task', epic.id), b = await create('CLI', 'task', epic.id), c = await create('Panels', 'task', epic.id);
  const plan: EpicPlan = {
    stages: [
      { name: 'schema and CLI', qa: { scope: 'affected', when: 'after-stage' }, lanes: [[a.id, b.id]] },
      { name: 'panels', qa: { scope: 'full', when: 'per-item' }, lanes: [[c.id]] },
    ],
    items: { [b.id]: { qa: { scope: 'none', when: 'per-item' } }, [c.id]: { qa_criteria: ['C1'] } },
  };
  const set = (yaml: string) => ui.request({ type: 'task.plan', item: epic.id, op: 'set', yaml });
  return { root, ui, create, epic, a, b, c, plan, set };
}

test('a two-stage plan is written by CLI, shown by MCP and view JSON, changed and journalled', async t => {
  const { root, ui, epic, a, b, c, plan } = await setup(t);
  const planFile = join(root, 'plan.yaml');
  await writeFile(planFile, stringify(plan));
  assert.equal((await ui.request({ type: 'task.comment', item: epic.id, text: 'Keep this comment.' })).ok, true);
  for (const item of [a, b]) assert.equal((await ui.request({ type: 'task.edit', item: item.id, size: 'L' })).ok, true);
  const before = await readFile(join(root, epic.path), 'utf8');
  for (const allow_large of [null, [], 'reason', { [a.id]: 42 }, { [a.id]: ' ' }, { [c.id]: 'Not large' }, { 'T-999': 'Missing' }, { [a.id]: 'First', [a.id.replace('T-', 'E-')]: 'Alias' }]) {
    const refused = await ui.request({ type: 'task.plan', item: epic.id, op: 'set', yaml: stringify(plan), allow_large });
    assert.equal(refused.ok, false);
    assert.match(refused.error ?? '', /allow_large|allow-large/);
    assert.equal(await readFile(join(root, epic.path), 'utf8'), before);
  }
  for (const allowances of [[], ['--allow-large', `${a.id}=One atomic schema migration`], ['--allow-large', `${a.id}=`]]) {
    const refused = await cland(root, 'task', 'plan', 'set', epic.id, '--file', planFile, ...allowances);
    assert.notEqual(refused.code, 0);
    assert.match(refused.stderr, /split.*2–3 M|non-empty reason/);
    assert.equal(await readFile(join(root, epic.path), 'utf8'), before);
  }
  const cli = await componentTask(root, 'task', 'plan', 'set', epic.id, '--file', planFile,
    '--allow-large', `${a.id.replace('T-', 'E-')}=One atomic schema migration`, '--allow-large', `${b.id}=One CLI compatibility switch`, '--json');
  assert.equal(cli.code, 0, cli.stderr);
  assert.deepEqual(JSON.parse(cli.stdout).plan, plan);
  assert.match(JSON.parse(cli.stdout).history.at(-1).reason, new RegExp(`${a.id}: One atomic schema migration`));
  assert.match(JSON.parse(cli.stdout).history.at(-1).reason, new RegExp(`${b.id}: One CLI compatibility switch`));
  const stored = await readFile(join(root, epic.path), 'utf8');
  assert.match(stored, /## Plan\n\n```yaml\nstages:/);
  assert.match(stored, /Keep this prose\./);
  assert.match(stored, /Keep this comment\./);
  const viewed = await componentTask(root, 'task', 'view', epic.id, '--json');
  assert.equal(viewed.code, 0, viewed.stderr);
  assert.deepEqual(JSON.parse(viewed.stdout).item.plan, plan);
  const coord = await inProcessSpoke(t, { discover: true, cwd: root, name: 'coord', role: 'coordinator' });
  t.after(() => coord.close());
  const shown = await coord.call<Result>('task.plan', { id: epic.id, op: 'show' });
  assert.equal(shown.ok, true, shown.error);
  assert.deepEqual(shown.plan, plan);
  await eventually('current-stage tasks planned', async () => {
    const tasks = await Promise.all([a, b].map(item => ui.request({ type: 'task.view', item: item.id })));
    return tasks.every(r => (r.value as { item: ItemView }).item.status === 'planned') ? true : undefined;
  });
  const children = await Promise.all([a, b, c].map(item => readFile(join(root, item.path), 'utf8')));
  const changed = structuredClone(plan);
  changed.stages[0]!.lanes = [[a.id], [b.id]];
  const update = await coord.call<Result>('task.plan', { id: epic.id, op: 'set', yaml: stringify(changed), reason: 'Split work for parallel lanes', allow_large: { [a.id]: 'One atomic schema migration', [b.id]: 'One CLI compatibility switch' } });
  assert.equal(update.ok, true, update.error);
  assert.deepEqual(update.plan, changed);
  assert.equal((await readFile(join(root, epic.path), 'utf8')).match(/^## Plan$/gm)?.length, 1);
  assert.deepEqual(await Promise.all([a, b, c].map(item => readFile(join(root, item.path), 'utf8'))), children);
  await eventually('journal contains both changes', async () => {
    assert.equal((await ui.request({ type: 'hub.status', flushLogs: true })).ok, true);
    const records = completeJournalLines(await readFile(join(root, '.cland/journal.jsonl'), 'utf8')).map(line => JSON.parse(line));
    const changes = records.filter(record => record.event === 'task-plan-changed');
    return changes.length === 2 ? changes : undefined;
  }).then(changes => {
    assert.equal(changes[0].previous, null);
    assert.deepEqual(changes[0].plan, plan);
    assert.deepEqual(changes[1].previous, plan);
    assert.deepEqual(changes[1].plan, changed);
    assert.equal(changes[1].by, 'coord');
    assert.match(changes[1].reason, /^Split work for parallel lanes\n/);
    assert.match(changes[1].reason, new RegExp(`${b.id}: One CLI compatibility switch`));
  });
  await eventually('plan notice exposes the accepted comparison and reason', async () => {
    const result = await ui.request({ type: 'topic.history', topic: 'agents', item: epic.id });
    const messages = (result.value as { messages: Array<{ detail?: { previous?: EpicPlan; plan?: EpicPlan; reason?: string } }> }).messages;
    const notice = messages.find(m => m.detail?.reason?.startsWith('Split work for parallel lanes'));
    if (!notice) return undefined;
    assert.deepEqual(notice.detail?.previous, plan);
    assert.deepEqual(notice.detail?.plan, changed);
    return true;
  });
const beforeRestart = await coord.call<{ history: Array<{ id: string; reason?: string }> }>('task.plan', { id: epic.id, op: 'show' });
  assert.match(beforeRestart.history.at(-1)?.reason ?? '', /^Split work for parallel lanes\n/);
  await stopHub(root);
  await openHub(t, root);
  const restored = await componentTask(root, 'task', 'plan', 'show', epic.id, '--json');
  assert.equal(restored.code, 0, restored.stderr);
  assert.deepEqual(JSON.parse(restored.stdout).history, beforeRestart.history);
  // An existing plan still needs an auditable exception even if its YAML is unchanged.
  await writeFile(planFile, stringify(changed));
  const unchanged = await componentTask(root, 'task', 'plan', 'set', epic.id, '--file', planFile,
    '--allow-large', `${a.id}=Retain the atomic schema migration`, '--allow-large', `${b.id}=Retain the CLI switch`, '--json');
  assert.equal(unchanged.code, 0, unchanged.stderr);
  const history = JSON.parse(unchanged.stdout).history;
  assert.equal(history.length, beforeRestart.history.length + 1);
  assert.deepEqual(history.at(-1).previous, changed);
  assert.deepEqual(history.at(-1).plan, changed);
  assert.match(history.at(-1).reason, /Retain the atomic schema migration/);
});

test('a refused epic close does not accept or journal the proposed plan', async t => {
  const { root, ui, epic, a, b, c, plan, set } = await setup(t);
  assert.equal((await set(stringify(plan))).ok, true);
  for (const child of [a, b, c]) assert.equal((await ui.request({ type: 'task.close', item: child.id })).ok, true);
  const original = await readFile(join(root, epic.path), 'utf8');
  const current = (await ui.request({ type: 'task.view', item: epic.id })).value as { item: ItemView };
  const changed = structuredClone(plan);
  changed.stages[0]!.name = 'Unpublished stage';
  const changes = async () => completeJournalLines(await readFile(join(root, '.cland/journal.jsonl'), 'utf8')).filter(line => line.includes('"event":"task-plan-changed"'));
  assert.equal((await ui.request({ type: 'hub.status', flushLogs: true })).ok, true);
  const accepted = await changes();
  const refused = await ui.request({ type: 'task.edit', item: epic.id, state: 'closed', body: withPlan(current.item.body, changed) });
  assert.equal(refused.ok, false);
  assert.match(refused.error ?? '', /qa-missing/);
  assert.equal(await readFile(join(root, epic.path), 'utf8'), original);
  assert.equal((await ui.request({ type: 'hub.status', flushLogs: true })).ok, true);
  assert.deepEqual(await changes(), accepted, 'a refused publication cannot record an accepted plan');
  const view = (await ui.request({ type: 'task.view', item: epic.id })).value as { item: ItemView };
  assert.deepEqual(view.item.plan, plan);
});

test('invalid schema and references are refused without changing the previous epic or its plan', async t => {
  const { root, epic, a, b, plan, set, create } = await setup(t);
  assert.equal((await set(stringify(plan))).ok, true);
  const original = await readFile(join(root, epic.path), 'utf8');
  const outside = await create('Outside');
  const cases: Array<[unknown, RegExp]> = [
    [{ stages: [] }, /stages must be a nonempty list/],
    [{ stages: [{ name: 'a', lanes: [[a.id]], qa: { scope: 'bad', when: 'per-item' } }] }, /scope must/],
    [{ stages: [{ name: 'a', lanes: [[a.id]], qa: { scope: ['full'], when: 'per-item' } }] }, /scope must/],
    [{ stages: [{ name: 'a', lanes: [[a.id]], qa: { scope: 'full', when: 'later' } }] }, /when must/],
    [{ stages: [{ name: 'a', lanes: [], qa: plan.stages[0]!.qa }] }, /lanes must/],
    [{ stages: [{ name: 'a', lanes: [[]], qa: plan.stages[0]!.qa }] }, /nonempty list/],
    [{ stages: [{ name: 'a', lanes: [[a.id, a.id]], qa: plan.stages[0]!.qa }] }, new RegExp(`${a.id} appears`)],
    [{ stages: [{ name: 'a', lanes: [['T-999']], qa: plan.stages[0]!.qa }] }, /T-999: no such/],
    [{ stages: [{ name: 'a', lanes: [[outside.id]], qa: plan.stages[0]!.qa }] }, /not under epic/],
    [{ stages: [{ name: 'a', lanes: [[epic.id]], qa: plan.stages[0]!.qa }] }, /must be a task/],
    [{ stages: plan.stages, items: { 'T-999': { qa: plan.stages[0]!.qa } } }, /T-999: override item is not in/],
    [{ stages: plan.stages, items: { [b.id]: { qa_criteria: ['C99'] } } }, /no criterion C99/],
    [{ stages: plan.stages, typo: true }, /unknown field typo/],
  ];
  for (const [raw, reason] of cases) {
    const result = await set(stringify(raw));
    assert.equal(result.ok, false, JSON.stringify(raw));
    assert.match(result.error ?? '', reason);
    assert.equal(await readFile(join(root, epic.path), 'utf8'), original);
  }
  const duplicateYaml = await set('stages: []\nstages: []');
  assert.equal(duplicateYaml.ok, false);
  assert.match(duplicateYaml.error ?? '', /not valid YAML/);
  const brokenFile = join(root, 'broken.yaml');
  await writeFile(brokenFile, 'stages: [');
  const cli = await cland(root, 'task', 'plan', 'set', epic.id, '--file', brokenFile);
  assert.equal(cli.code, 1);
  assert.match(cli.stderr, /not valid YAML/);
  assert.equal(await readFile(join(root, epic.path), 'utf8'), original);
});

test('invalid hand edits keep the accepted plan across restart, and valid hand edits replace it', async t => {
  const { root, epic, ui, plan, set } = await setup(t);
  assert.equal((await set(stringify(plan))).ok, true);
  const file = join(root, epic.path);
  const original = await readFile(file, 'utf8');
  const broken = original.replace('scope: affected', 'scope: broken');
  await reindexedAfter(t, root, file, () => writeFile(file, broken));
  await eventually('watcher refuses plan', async () => {
    assert.equal((await ui.request({ type: 'hub.status', flushLogs: true })).ok, true);
    const records = await readFile(join(root, '.cland/journal.jsonl'), 'utf8');
    return records.includes('"event":"task-plan-refused"') ? true : undefined;
  });
  const view = (await ui.request({ type: 'task.view', item: epic.id })).value as { item: ItemView };
  assert.deepEqual(view.item.plan, plan);
  assert.match(view.item.planError ?? '', /scope must/);
  assert.equal(await readFile(file, 'utf8'), broken);
  await stopHub(root);
  const restart = await openHub(t, root);
  const restartedUi = await connectUi(t, restart.discovery);
  const restarted = await cland(root, 'task', 'plan', 'show', epic.id, '--json');
  assert.equal(restarted.code, 0, restarted.stderr);
  assert.deepEqual(JSON.parse(restarted.stdout).plan, plan);
  assert.match(JSON.parse(restarted.stdout).planError, /scope must/);
  await reindexedAfter(t, root, file, () => writeFile(file, original.replace('scope: affected', 'scope: full')));
  await eventually('valid hand plan is journalled', async () => {
    assert.equal((await restartedUi.request({ type: 'hub.status', flushLogs: true })).ok, true);
    const records = completeJournalLines(await readFile(join(root, '.cland/journal.jsonl'), 'utf8')).map(line => JSON.parse(line));
    return records.some(record => record.event === 'task-plan-changed' && record.by === 'hand' && record.source === 'hand' && record.previous && record.plan?.stages[0]?.qa.scope === 'full') ? true : undefined;
  });
  const valid = await cland(root, 'task', 'plan', 'show', epic.id, '--json');
  assert.equal(JSON.parse(valid.stdout).plan.stages[0].qa.scope, 'full');
  assert.equal(JSON.parse(valid.stdout).planError, undefined);
});

test('an epic-first hand save is accepted and retained when its child criterion arrives later', async t => {
  const { root, epic, ui, c, plan, set } = await setup(t);
  assert.equal((await set(stringify(plan))).ok, true);
  const epicFile = join(root, epic.path), childFile = join(root, c.path);
  const originalEpic = await readFile(epicFile, 'utf8');
  const changedEpic = originalEpic.replace('      - C1', '      - C2');
  assert.notEqual(changedEpic, originalEpic);
  await writeFile(epicFile, changedEpic);
  await eventually('epic is indexed before its missing child criterion', async () => {
    assert.equal((await ui.request({ type: 'hub.status', flushLogs: true })).ok, true);
    const log = await readFile(join(root, '.cland/journal.jsonl'), 'utf8');
    return log.includes(`"error":"${c.id}: no criterion C2"`) ? true : undefined;
  });
  const child = await readFile(childFile, 'utf8');
  await writeFile(childFile, child.replace('C1. Works', 'C1. Works\n- [ ] C2. More'));
  await eventually('child criterion is indexed', async () => {
    const result = await ui.request({ type: 'task.view', item: c.id });
    return (result.value as { item: ItemView }).item.criteria.some(criterion => criterion.id === 'C2') ? true : undefined;
  });
  // Let the watcher process the child's save, then prove the read and retained version agree.
  await eventually('child save reaches the tracker index', async () => {
    assert.equal((await ui.request({ type: 'hub.status', flushLogs: true })).ok, true);
    const log = await readFile(join(root, '.cland/log/hub.log'), 'utf8');
    return log.split('\n').some(line => line.includes('"event":"task-reindexed"') && line.includes(`"id":"${c.id}"`)) ? true : undefined;
  });
  await eventually('dependent plan is accepted and journalled before a plan read', async () => {
    assert.equal((await ui.request({ type: 'hub.status', flushLogs: true })).ok, true);
    const records = completeJournalLines(await readFile(join(root, '.cland/journal.jsonl'), 'utf8')).map(line => JSON.parse(line));
    return records.some(record => record.event === 'task-plan-changed' && record.plan?.items?.[c.id]?.qa_criteria?.[0] === 'C2') ? true : undefined;
  });
  const shown = await ui.request({ type: 'task.plan', item: epic.id, op: 'show' });
  assert.deepEqual((shown.value as Result).plan?.items?.[c.id]?.qa_criteria, ['C2']);
  await writeFile(epicFile, changedEpic.replace('scope: affected', 'scope: broken'));
  const broken = await ui.request({ type: 'task.plan', item: epic.id, op: 'show' });
  assert.match((broken.value as Result).planError ?? '', /scope must/);
  assert.deepEqual((broken.value as Result).plan?.items?.[c.id]?.qa_criteria, ['C2']);
  assert.equal((await ui.request({ type: 'hub.status', flushLogs: true })).ok, true);
  const changes = completeJournalLines(await readFile(join(root, '.cland/journal.jsonl'), 'utf8')).map(line => JSON.parse(line)).filter(record => record.event === 'task-plan-changed');
  assert.ok(changes.some(record => record.plan?.items?.[c.id]?.qa_criteria?.[0] === 'C2'), 'accepted dependent plan change is journalled');
});

test('body edits cannot bypass plan validation and section replacement preserves surrounding sections', async t => {
  const { root, epic, ui, plan, set, a } = await setup(t);
  const body = '## Before\nKept before.\n\n## Plan\n\n```yaml\nstages: []\n```\n\n## After\nKept after.';
  const invalid = await ui.request({ type: 'task.edit', item: epic.id, body });
  assert.equal(invalid.ok, false);
  // A hand save may be repaired with task.plan set even when the old plan block is invalid.
  const original = await readFile(join(root, epic.path), 'utf8');
  await writeFile(join(root, epic.path), original.replace(epic.body, body));
  const repaired = await set(stringify(plan));
  assert.equal(repaired.ok, true, repaired.error);
  const saved = await readFile(join(root, epic.path), 'utf8');
  assert.match(saved, /## Before\nKept before\./);
  assert.match(saved, /## After\nKept after\./);
  const leaf = await ui.request({ type: 'task.plan', op: 'set', item: a.id, yaml: stringify(plan) });
  assert.equal(leaf.ok, false);
  assert.match(leaf.error ?? '', /only to an epic/);
  assert.equal((await ui.request({ type: 'task.plan', op: 'unknown', item: epic.id })).ok, false);
  assert.equal((await ui.request({ type: 'task.plan', op: 'set', item: epic.id })).ok, false);
  assert.equal((await ui.request({ type: 'task.plan', op: 'set', item: epic.id, yaml: 42 })).ok, false);
});

test('plan reads are available to sessions but writes require a set grant', async t => {
  const { root, epic, plan, set } = await setup(t);
  assert.equal((await set(stringify(plan))).ok, true);
  const impl = await inProcessSpoke(t, { discover: true, cwd: root, name: 'impl-1', role: 'implementer' });
  t.after(() => impl.close());
  const read = await impl.call<Result>('task.plan', { id: epic.id, op: 'show' });
  assert.equal(read.ok, true, read.error);
  assert.deepEqual(read.plan, plan);
  const before = await readFile(join(root, epic.path), 'utf8');
  const denied = await impl.call<{ ok: boolean; permission?: string }>('task.plan', { id: epic.id, op: 'set', yaml: stringify(plan) });
  assert.equal(denied.ok, false);
  assert.equal(denied.permission, 'task.plan:set');
  assert.equal(await readFile(join(root, epic.path), 'utf8'), before);
});

test('a new project indexes file plans after all their lane items, and absent plans show null', async t => {
  const { root, epic, ui, plan, set } = await setup(t);
  const empty = await ui.request({ type: 'task.plan', item: epic.id, op: 'show' });
  assert.equal(empty.ok, true);
  assert.equal((empty.value as Result).plan, null);
  assert.equal((await set(stringify(plan))).ok, true);
  await stopHub(root);
  // Rebuild from files with no retained database snapshot; epic filenames sort before lane items.
  const { rm } = await import('node:fs/promises');
  await rm(join(root, '.cland/hub.db'));
  await openHub(t, root);
  const shown = await cland(root, 'task', 'plan', 'show', epic.id, '--json');
  assert.equal(shown.code, 0, shown.stderr);
  assert.deepEqual(JSON.parse(shown.stdout).plan, plan);
  assert.equal(JSON.parse(shown.stdout).planError, undefined);
});

test('Plan headings inside examples are ignored; duplicate sections and unclosed fences refuse writes', async t => {
  const { root, epic, ui, plan, set } = await setup(t);
  const example = '## Notes\n\n````markdown\n## Plan\n```yaml\nstages: []\n```\n````\n\nKeep this example.';
  const edited = await ui.request({ type: 'task.edit', item: epic.id, body: example });
  assert.equal(edited.ok, true, edited.error);
  assert.equal((edited.value as { item: ItemView }).item.plan, null);
  assert.equal((await set(stringify(plan))).ok, true);
  const file = join(root, epic.path), valid = await readFile(file, 'utf8');
  assert.match(valid, /Keep this example\./);
  const actual = valid.slice(valid.lastIndexOf('## Plan'));
  await writeFile(file, valid + '\n' + actual);
  const duplicate = await set(stringify(plan));
  assert.equal(duplicate.ok, false);
  assert.match(duplicate.error ?? '', /duplicate ## Plan/);
  await writeFile(file, valid + '\n## Notes\n```markdown\nunfinished');
  const unclosed = await set(stringify(plan));
  assert.equal(unclosed.ok, false);
  assert.match(unclosed.error ?? '', /unclosed Markdown fence/);
});

test('plans follow the second configured container level through set, show and hand-save retention', async t => {
  const { root, epic, ui, plan, set, create } = await setup(t, ['milestone', 'initiative']);
  assert.equal(epic.kind, 'initiative');
  const saved = await set(stringify(plan));
  assert.equal(saved.ok, true, saved.error);
  const shown = await ui.request({ type: 'task.plan', op: 'show', item: epic.id });
  assert.equal(shown.ok, true, shown.error);
  assert.deepEqual((shown.value as Result).plan, plan);
  const top = await create('Top', 'milestone');
  const refused = await ui.request({ type: 'task.plan', op: 'set', item: top.id, yaml: stringify(plan) });
  assert.equal(refused.ok, false);
  const file = join(root, epic.path), valid = await readFile(file, 'utf8');
  await writeFile(file, valid.replace('scope: affected', 'scope: broken'));
  const invalid = await ui.request({ type: 'task.plan', op: 'show', item: epic.id });
  assert.deepEqual((invalid.value as Result).plan, plan);
  assert.match((invalid.value as Result).planError ?? '', /scope must/);
});
