import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile, readFile, readdir, rm, rename } from 'node:fs/promises';
import { join } from 'node:path';
import { Tracker } from '../src/tracker/tracker.ts';
import { DEFAULT_ROLES_TOML } from '../src/roles/default-roles.ts';
import { cland, connectUi, connectWsUi, eventually, spawnSpoke, startDaemon, startHub, tempProject } from './harness.ts';

const legacy = (id: string, kind: string, extra = '') => `---\nid: ${id}\nkind: ${kind}\ntitle: Legacy ${kind}\nstate: open\n${extra}---\n`;

test('kind prefixes resolve the same numeric identity through real hub, spoke and CLI', async t => {
  const root = await tempProject(t);
  const dir = join(root, '.cland/tasks');
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, 'T-107-old-epic.md'), legacy('T-107', 'epic'));
  await writeFile(join(dir, 'T-228-old-release.md'), legacy('T-228', 'release'));
  for (const [n, kind] of [[229, 'task'], [230, 'question'], [231, 'map'], [232, 'spec']] as const) {
    await writeFile(join(dir, `T-${n}-${kind}.md`), legacy(`T-${n}`, kind, kind === 'task' ? 'status: backlog\n' : ''));
  }
  const { discovery } = await startDaemon(t, root);
  const ui = await connectUi(t, discovery);
  const spoke = await spawnSpoke({ discover: true, cwd: root, name: 'coord', role: 'coordinator' });
  t.after(() => spoke.close());
  await spoke.waitForPresence(['coord']);
  for (const id of ['E-107', 'R-107', 'T-107', 'e-107', '107']) {
    const result = await ui.request({ type: 'task.view', item: id });
    assert.equal(result.ok, true, JSON.stringify(result));
    assert.equal((result.value as { item: { id: string } }).item.id, 'E-107');
    const cli = await cland(root, 'task', 'view', id, '--json');
    assert.equal(cli.code, 0, cli.stderr);
    assert.equal(JSON.parse(cli.stdout).item.id, 'E-107');
    const mcp = await spoke.call<{ ok: boolean; item: { id: string } }>('task.view', { id });
    assert.equal(mcp.ok, true);
    assert.equal(mcp.item.id, 'E-107');
  }
  for (const id of ['999', 'A-107']) assert.equal((await ui.request({ type: 'task.view', item: id })).ok, false);
  const list = await cland(root, 'task', 'list', '--json');
  assert.deepEqual(JSON.parse(list.stdout).items.map((i: { id: string }) => i.id), ['E-107', 'R-228', 'T-229', 'Q-230', 'M-231', 'S-232']);
  const status = await ui.request({ type: 'hub.status' });
  assert.equal((status.value as { tracker: { prefixes: Record<string, string> } }).tracker.prefixes.epic, 'E');
});

test('creation and kind edits retain a shared number and duplicate files prefer their own prefix', async t => {
  const root = await tempProject(t), dir = join(root, '.cland/tasks');
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, 'E-500-epic.md'), legacy('E-500', 'epic'));
  await writeFile(join(dir, 'T-500-stale.md'), legacy('T-500', 'epic'));
  const { discovery } = await startDaemon(t, root);
  const ui = await connectUi(t, discovery);
  const created = await ui.request({ type: 'task.create', title: 'New question', kind: 'question', parent: 'T-500' });
  assert.equal(created.ok, true, JSON.stringify(created));
  assert.equal((created.value as { item: { id: string; parent: string } }).item.id, 'Q-501');
  assert.equal((created.value as { item: { parent: string } }).item.parent, 'E-500');
  const edited = await ui.request({ type: 'task.edit', item: 'R-501', kind: 'spec' });
  assert.equal(edited.ok, true, JSON.stringify(edited));
  assert.equal((edited.value as { item: { id: string } }).item.id, 'S-501');
  assert.ok((await readdir(dir)).includes('S-501-new-question.md'));
  assert.ok(!(await readdir(dir)).includes('Q-501-new-question.md'));
  assert.match(await readFile(join(dir, 'S-501-new-question.md'), 'utf8'), /id: S-501/);
  const viewed = await ui.request({ type: 'task.view', item: '500' });
  assert.equal((viewed.value as { item: { file: string } }).item.file, 'E-500-epic.md');
  assert.match(JSON.stringify(viewed.value), /duplicate/i);
  await ui.request({ type: 'hub.status', flushLogs: true });
  const log = await readFile(join(root, '.cland/log/hub.log'), 'utf8');
  assert.match(log, /task-duplicate-number/);
  assert.match(log, /T-500-stale.md/);
  assert.match(log, /E-500-epic.md/);
});

test('legacy claims, topics, subscriptions and approved plans survive restart and route by number', async t => {
  const root = await tempProject(t), dir = join(root, '.cland/tasks');
  await mkdir(dir, { recursive: true });
  await writeFile(join(root, '.cland/roles.toml'), DEFAULT_ROLES_TOML.replace('[lead.permissions]\ntools = [', '[lead.permissions]\ntools = ["task.claim", '));
  await writeFile(join(dir, 'T-10-legacy-epic.md'), legacy('T-10', 'epic'));
  await writeFile(join(dir, 'T-11-child.md'), legacy('T-11', 'task', 'parent: T-10\nstatus: backlog\n'));
  let { discovery } = await startDaemon(t, root);
  let ui = await connectUi(t, discovery);
  const lead = await spawnSpoke({ discover: true, cwd: root, name: 'lead-one', role: 'lead', sessionId: 'sess-lead' });
  const coord = await spawnSpoke({ discover: true, cwd: root, name: 'coord', role: 'coordinator', sessionId: 'sess-coord' });
  const nextLead = await spawnSpoke({ discover: true, cwd: root, name: 'lead-two', role: 'implementer', sessionId: 'sess-next-lead' });
  const reviewer = await spawnSpoke({ discover: true, cwd: root, name: 'reviewer-one', role: 'reviewer', sessionId: 'sess-reviewer' });
  t.after(() => Promise.all([lead.close(), nextLead.close(), coord.close(), reviewer.close()]));
  await coord.waitForPresence(['lead-two', 'coord', 'reviewer-one']);
  assert.equal((await lead.call<{ ok: boolean }>('task.claim', { id: 'T-10' })).ok, true);
  const note = { goals_now: 'Keep T-10 working', work_in_flight: 'Review', open_decisions: 'None', waiting_on: 'Verification' };
  assert.equal((await lead.call<{ ok: boolean }>('role.handover', { to: 'lead-two', note })).ok, true);
  const topic = await coord.call<{ ok: boolean; topic: { id: string; item: string } }>('topic.create', { item: 'T-10', title: 'Legacy epic' });
  assert.equal(topic.ok, true);
  assert.equal(topic.topic.item, 'E-10');
  assert.equal((await coord.call<{ ok: boolean }>('subscribe', { subject: { subtree: 'T-10' }, events: ['task'] })).ok, true);
  const yaml = 'stages:\n  - name: build\n    qa: {scope: none, when: after-stage}\n    lanes: [[T-11]]\n';
  const planned = await ui.request({ type: 'task.plan', item: 'T-10', op: 'set', yaml });
  assert.equal(planned.ok, true, JSON.stringify(planned));
  assert.equal((await ui.request({ type: 'task.plan', item: 'R-10', op: 'approve' })).ok, true);
  const stopped = await cland(root, 'hub', 'stop');
  assert.equal(stopped.code, 0, stopped.stderr);
  ({ discovery } = await startDaemon(t, root));
  ui = await connectUi(t, discovery);
  await coord.waitForPresence(['lead-two', 'coord', 'reviewer-one']);
  const view = await ui.request({ type: 'task.view', item: 'E-10' });
  assert.equal(view.ok, true, JSON.stringify(view));
  const item = (view.value as { item: { claim: { session: string }; approval: { state: string }; topic: string } }).item;
  assert.equal(item.claim.session, 'lead-two');
  const role = await nextLead.call<{ ok: boolean; item: string; note: { sections: unknown } }>('role.state');
  assert.equal(role.ok, true);
  assert.equal(role.item, 'E-10');
  assert.deepEqual(role.note.sections, note);
  assert.equal(item.approval.state, 'approved');
  assert.equal(item.topic, topic.topic.id);
  const subscriptions = await coord.call<{ subscriptions: Array<{ subject: { subtree?: string } }> }>('subscriptions');
  assert.ok(subscriptions.subscriptions.some(s => s.subject.subtree === 'E-10'));
  const routed = await coord.call<{ ok: boolean; outcomes: Array<{ to: string; resolvedTo?: string }> }>('send', { to: ['lead R-10'], topic: topic.topic.id, text: 'Resolve legacy epic by number' });
  assert.equal(routed.ok, true, JSON.stringify(routed));
  const delivered = await nextLead.waitForEvent(event => /(?:^|\n)Resolve legacy epic by number(?:\n|$)/.test(event.params.content));
  assert.equal(delivered.params.meta?.to, 'lead-two');
  assert.equal(delivered.params.meta?.topic, topic.topic.id);
  assert.equal(delivered.params.meta?.topic_item, 'E-10');
  const review = await coord.call<{ ok: boolean; outcomes: Array<{ to: string; resolvedTo?: string }> }>('send', { to: ['reviewer'], topic: topic.topic.id, text: 'review request E-10\nVerify canonical identity' });
  assert.equal(review.ok, true, JSON.stringify(review));
  assert.ok(review.outcomes.some(outcome => outcome.resolvedTo === 'reviewer-one'));
  const alt = await ui.request({ type: 'task.plan', item: 'M-10', op: 'set', yaml: yaml.replace('T-11', 'e-11') });
  assert.equal(alt.ok, true, JSON.stringify(alt));
  const child = await ui.request({ type: 'task.view', item: '11' });
  assert.equal((child.value as { item: { parent: string } }).item.parent, 'E-10');
});


test('mixed lane and override prefixes retain after-stage QA policy', async t => {
  const root = await tempProject(t);
  const { discovery } = await startDaemon(t, root);
  const ui = await connectUi(t, discovery);
  assert.equal((await ui.request({ type: 'task.create', title: 'Epic', kind: 'epic' })).ok, true);
  assert.equal((await ui.request({ type: 'task.create', title: 'Child', parent: 'T-1' })).ok, true);
  const yaml = 'stages:\n  - name: build\n    qa: {scope: none, when: after-stage}\n    lanes: [[T-2]]\nitems:\n  E-2:\n    qa: {scope: full, when: after-stage}\n';
  const set = await ui.request({ type: 'task.plan', item: 'R-1', op: 'set', yaml });
  assert.equal(set.ok, true, JSON.stringify(set));
  const view = await ui.request({ type: 'task.view', item: '1' });
  const item = (view.value as { item: { stages: Array<{ qa: unknown }> } }).item;
  assert.deepEqual(item.stages[0]!.qa, { scope: 'full', when: 'after-stage' });
  const child = await ui.request({ type: 'task.view', item: '2' });
  assert.deepEqual((child.value as { item: { qaPolicy: unknown } }).item.qaPolicy, { scope: 'full', when: 'after-stage' });
  const duplicate = await ui.request({ type: 'task.plan', item: '1', op: 'set', yaml: yaml + '  T-2:\n    qa: {scope: none, when: per-item}\n' });
  assert.equal(duplicate.ok, false);
});

test('non-task review requests keep verifier affinity across alternate prefixes', async t => {
  const root = await tempProject(t);
  const { discovery } = await startDaemon(t, root);
  const ui = await connectUi(t, discovery);
  assert.equal((await ui.request({ type: 'task.create', title: 'Epic', kind: 'epic' })).ok, true);
  const topicResult = await ui.request({ type: 'topic.create', title: 'Epic work', item: 'T-1' });
  const topic = (topicResult.value as { topic: { id: string } }).topic.id;
  const coord = await spawnSpoke({ discover: true, cwd: root, name: 'coord', role: 'coordinator', sessionId: 'sess-coord' });
  const first = await spawnSpoke({ discover: true, cwd: root, name: 'reviewer-z', role: 'reviewer', sessionId: 'sess-z' });
  t.after(() => Promise.all([coord.close(), first.close()]));
  await coord.waitForPresence(['coord', 'reviewer-z']);
  const request = async (id: string) => coord.call<{ ok: boolean; outcomes: Array<{ to: string; resolvedTo?: string }> }>('send', { to: ['reviewer'], topic, text: `review request ${id}\nCheck the epic` });
  const initial = await request('T-1');
  assert.equal(initial.ok, true);
  assert.ok(initial.outcomes.some(outcome => outcome.resolvedTo === 'reviewer-z'));
  const newer = await spawnSpoke({ discover: true, cwd: root, name: 'reviewer-a', role: 'reviewer', sessionId: 'sess-a' });
  t.after(() => newer.close());
  await coord.waitForPresence(['reviewer-a']);
  const repeat = await request('R-1');
  assert.equal(repeat.ok, true, JSON.stringify(repeat));
  assert.ok(repeat.outcomes.some(outcome => outcome.resolvedTo === 'reviewer-z'), JSON.stringify(repeat));
});

test('removing a planned legacy epic drops its candidate; prefix renames preserve a live plan', async t => {
  const root = await tempProject(t), dir = join(root, '.cland/tasks');
  await mkdir(dir, { recursive: true });
  const plan = '## Plan\n\n```yaml\nstages:\n  - name: build\n    qa: {scope: none, when: after-stage}\n    lanes: [[T-2]]\n```\n';
  await writeFile(join(dir, 'T-1-epic.md'), legacy('T-1', 'epic') + plan);
  await writeFile(join(dir, 'T-2-child.md'), legacy('T-2', 'task', 'parent: T-1\nstatus: backlog\n'));
  const { discovery } = await startDaemon(t, root);
  const ui = await connectUi(t, discovery);
  const view = async () => (await ui.request({ type: 'task.view', item: '1' })).value as { item: { plan: unknown; file: string; planError?: string } };
  assert.ok((await view()).item.plan);
  await rename(join(dir, 'T-1-epic.md'), join(dir, 'E-1-epic.md'));
  await eventually('prefix rename is indexed', async () => (await view()).item.file === 'E-1-epic.md' || undefined);
  assert.ok((await view()).item.plan);
  await rm(join(dir, 'E-1-epic.md'));
  await eventually('epic removal is indexed', async () => (await ui.request({ type: 'task.view', item: '1' })).ok === false || undefined);
  await writeFile(join(dir, 'E-1-epic.md'), legacy('E-1', 'epic') + '## Plan\n\ninvalid plan\n');
  await eventually('replacement epic is indexed', async () => (await ui.request({ type: 'task.view', item: '1' })).ok || undefined);
  assert.equal((await view()).item.plan, null);
});


test('task publication lookup work stays bounded with two thousand unrelated items', async t => {
  const root = await tempProject(t), dir = join(root, '.cland/tasks');
  await mkdir(dir, { recursive: true });
  await Promise.all(Array.from({ length: 2000 }, (_, i) => writeFile(join(dir, `T-${i + 1}-item.md`), legacy(`T-${i + 1}`, 'task', 'status: backlog\n'))));
  const tracker = new Tracker({ root, db: join(root, '.cland/hub.db') });
  tracker.start();
  t.after(() => tracker.stop());
  const hub = await startHub({ tracker });
  t.after(() => hub.close());
  const ui = await connectWsUi(t, hub);
  const resolve = tracker.resolveId.bind(tracker);
  let calls = 0;
  t.mock.method(tracker, 'resolveId', (id: string) => { calls++; return resolve(id); });
  for (let i = 0; i < 5; i++) assert.equal((await ui.request({ type: 'task.edit', item: 'E-1', status: i % 2 ? 'backlog' : 'planned' })).ok, true);
  assert.ok(calls < 100, `${calls} resolver calls for five task events`);
});

test('removing an unclaimed child sends its terminal event to the surviving parent Lead', async t => {
  const root = await tempProject(t), dir = join(root, '.cland/tasks');
  await mkdir(dir, { recursive: true });
  await writeFile(join(root, '.cland/roles.toml'), DEFAULT_ROLES_TOML.replace('[lead.permissions]\ntools = [', '[lead.permissions]\ntools = ["task.claim", '));
  await writeFile(join(dir, 'T-1-epic.md'), legacy('T-1', 'epic'));
  await writeFile(join(dir, 'T-2-child.md'), legacy('T-2', 'task', 'parent: T-1\nstatus: backlog\n'));
  const { discovery } = await startDaemon(t, root);
  const ui = await connectUi(t, discovery);
  const coord = await spawnSpoke({ discover: true, cwd: root, name: 'coord', role: 'coordinator', sessionId: 'sess-coord' });
  const lead = await spawnSpoke({ discover: true, cwd: root, name: 'parent-lead', role: 'lead', sessionId: 'sess-lead' });
  t.after(() => Promise.all([coord.close(), lead.close()]));
  await coord.waitForPresence(['coord', 'parent-lead']);
  assert.equal((await lead.call<{ ok: boolean }>('task.claim', { id: 'T-1' })).ok, true);
  await rm(join(dir, 'T-2-child.md'));
  const event = await eventually('removed child is reported', async () => {
    const result = await ui.request({ type: 'topic.history', topic: 'agents' });
    return (result.value as { messages: Array<{ kind: string; text: string; to: string[] }> }).messages.find(message => message.kind === 'event' && message.text.includes('T-2 removed'));
  });
  assert.deepEqual(event.to, ['parent-lead']);
});
