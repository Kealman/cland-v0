// T2: custom role settings, authority and reconnect through a sealed project hub and fake adapters.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { connectUi, eventually, inProcessSpoke, projectHub, tempProject } from './harness.ts';
import { FakeClock } from './fake-clock.ts';
import { onCleanup } from './process-cleanup.ts';
import { gateVerdicts } from '../src/tracker/gate-verdicts.ts';
import { MergeError } from '../src/merge.ts';
import { Tracker, type ItemView } from '../src/tracker/tracker.ts';

const definition = `[custom.docs-writer]
clause = "Write project docs and report to the item lead."
skills = ["docs"]
[custom.docs-writer.launch]
harness = "codex"
model = "custom-docs-model"
effort = "high"
sandbox = "workspace-write"
approval = "never"
[custom.docs-writer.permissions]
tools = ["who", "send:agents", "task.view"]
`;

test('a custom role launches with its settings and receives its own clause again on reconnect', async t => {
  const root = await tempProject(t);
  await mkdir(join(root, '.cland'), { recursive: true });
  await mkdir(join(root, '.agents/skills/docs'), { recursive: true });
  await writeFile(join(root, '.agents/skills/docs/SKILL.md'), '---\nname: docs\ndescription: Write docs\n---\nWrite docs.\n');
  await writeFile(join(root, '.cland/roles.toml'), definition);
  const { discovery, fakes } = await projectHub(t, root, {}, { clock: new FakeClock() });
  const ui = await connectUi(t, discovery);
  const result = await ui.request({ type: 'session.launch', name: 'writer-1', role: 'docs-writer' });
  assert.equal(result.ok, true, result.error);
  const launch = fakes.codex!.spawns.at(-1)!;
  assert.equal(launch.role, 'docs-writer');
  assert.equal(launch.model, 'custom-docs-model');
  assert.equal(launch.effort, 'high');
  assert.match(launch.clause!, /Write project docs and report to the item lead/);
  const peer = await inProcessSpoke(t, { discover: true, cwd: root, name: 'writer-1', sessionId: launch.sessionId!, launchToken: launch.launchToken!, assignRole: false });
  fakes.codex!.idle('writer-1');
  const first = await peer.waitForEvent(e => e.params.meta?.kind === 'role');
  assert.match(first.params.content, /Write project docs and report to the item lead/);
  assert.match(first.params.content, /Skills for this role: docs/);
  const who = await peer.call<{ ok: boolean; sessions: Array<{ name: string; role: string }> }>('who');
  assert.equal(who.ok, true);
  assert.equal(who.sessions.find(row => row.name === 'writer-1')?.role, 'docs-writer');
  assert.equal((await peer.call<{ ok: boolean }>('task.create', { title: 'Forbidden' })).ok, false);
  const listed = await ui.request({ type: 'role.list' });
  const roles = (listed.value as { roles: Array<{ role: string; holders: Array<{ name: string }> }> }).roles;
  assert.equal(roles.length, 7);
  assert.equal(roles.find(role => role.role === 'docs-writer')?.holders[0]?.name, 'writer-1');
  await peer.close();
  const back = await inProcessSpoke(t, { discover: true, cwd: root, name: 'writer-1', sessionId: launch.sessionId!, launchToken: launch.launchToken!, assignRole: false });
  const clause = await back.waitForEvent(e => e.params.meta?.kind === 'role');
  assert.match(clause.params.content, /Write project docs and report to the item lead/);
  const edited = await ui.request({ type: 'role.launch', role: 'docs-writer', fields: { model: 'next-docs-model' } });
  assert.equal(edited.ok, true, edited.error);
  assert.equal((await ui.request({ type: 'session.launch', name: 'writer-2', role: 'docs-writer' })).ok, true);
  assert.equal(fakes.codex!.spawns.at(-1)!.model, 'next-docs-model');
  await writeFile(join(root, '.cland/roles.toml'), definition + '[custom.constructor]\nclause = "Write docs"\n[custom.constructor.launch]\nharness = "claude-code"\n');
  assert.equal((await ui.request({ type: 'hub.reload' })).ok, true);
  const customEdit = await ui.request({ type: 'role.launch', role: 'constructor', fields: { harness: 'codex', model: 'constructor-model' } });
  assert.equal(customEdit.ok, true, customEdit.error);
  const editedLaunch = (customEdit.value as { launch: { harness: string; model: string } }).launch;
  assert.equal(editedLaunch.harness, 'codex');
  assert.equal(editedLaunch.model, 'constructor-model');

});

test('hand-edited forbidden grants are refused on reload and cannot authorize a custom spoke', async t => {
  const root = await tempProject(t);
  await mkdir(join(root, '.cland'), { recursive: true });
  const path = join(root, '.cland/roles.toml');
  await writeFile(path, definition);
  const { discovery } = await projectHub(t, root, {}, { clock: new FakeClock() });
  const ui = await connectUi(t, discovery);
  const peer = await inProcessSpoke(t, { discover: true, cwd: root, name: 'writer-1', role: 'docs-writer' });
  await peer.waitForEvent(e => e.params.meta?.kind === 'role');
  await writeFile(path, definition.replace('"task.view"', '"task.view", "merge", "task.comment:verdict"'));
  const reload = await ui.request({ type: 'hub.reload' });
  assert.equal(reload.ok, false);
  assert.match(reload.error!, /custom.docs-writer.permissions.tools/);
  const denied = await peer.call<{ ok: boolean; code: string; permission: string }>('merge', { item: 'T-1' });
  assert.equal(denied.ok, false);
  assert.equal(denied.code, 'forbidden');
  assert.equal(denied.permission, 'merge');
});

test('a custom claimant submits only review, marks its own criteria done, and becomes ready through a Reviewer evidence verdict', async t => {
  const root = await tempProject(t);
  await mkdir(join(root, '.cland'), { recursive: true });
  await writeFile(join(root, '.cland/roles.toml'), definition.replace('"task.view"', '"task.view", "task.claim:own", "task.edit:review", "task.criterion:done", "verify", "artifact.create"'));
  await writeFile(join(root, '.cland/config.toml'), '[verification]\ntest = "true"\n');
  const sha = 'a'.repeat(40);
  const { discovery } = await projectHub(t, root, {}, { clock: new FakeClock(), git: async args => {
    if (args[0] === 'for-each-ref') return `${sha} refs/heads/dev\n${sha} refs/heads/t/docs`;
    if (args[0] === 'rev-parse' || args[0] === 'merge-base') return sha;
    if (args[0] === 'diff') return '';
    return null;
  }, readBase: async () => 'dev', candidate: {
    head: async () => sha, tree: async () => 'b'.repeat(40), inspect: async () => ({
      head: sha, branch: 't/docs', tree: 'b'.repeat(40),
      selection: { mode: 'hub-only', files: ['hub/src/example.ts'], reason: 'sealed custom-role admission' }, tierPlan: [], budgetBase: undefined,
    }),
  } });
  const ui = await connectUi(t, discovery);
  assert.equal((await ui.request({ type: 'subscribe' })).ok, true);
  const peer = await inProcessSpoke(t, { discover: true, cwd: root, name: 'writer-1', role: 'docs-writer' });
  await peer.waitForEvent(e => e.params.meta?.kind === 'role');
  const made = await ui.request({ type: 'task.create', title: 'Documentation', size: 'M', assignee: 'writer-1', branch: 't/docs', body: '## Acceptance criteria\n- [ ] C1. Write docs' });
  assert.equal(made.ok, true, made.error);
  const item = (made.value as { item: { id: string } }).item.id;
  assert.equal((await peer.call<{ ok: boolean }>('task.claim', { id: item })).ok, true);
  const claimed = (await ui.request({ type: 'task.view', item })).value as { item: { status: string } };
  assert.equal(claimed.item.status, 'in progress');
  assert.equal((await peer.call<{ ok: boolean }>('task.criterion', { id: item, op: 'done', criterion: 'C1' })).ok, true);
  for (const status of ['ready', 'done', 'qa', 'in progress']) {
    assert.equal((await peer.call<{ ok: boolean }>('task.edit', { id: item, status })).ok, false, status);
  }
  const other = (await ui.request({ type: 'task.create', title: 'Other', size: 'S' })).value as { item: { id: string } };
  assert.equal((await peer.call<{ ok: boolean }>('task.edit', { id: other.item.id, status: 'review' })).ok, false);
  assert.equal((await peer.call<{ ok: boolean }>('task.criterion', { id: other.item.id, op: 'done', criterion: 'C1' })).ok, false);
  assert.equal((await peer.call<{ ok: boolean }>('task.edit', { id: item, status: 'review', title: 'Changed' })).ok, false);
  assert.equal((await peer.call<{ ok: boolean }>('task.edit', { id: item, status: 'review' })).ok, true);
  const topicResult = await ui.request({ type: 'topic.create', title: 'Docs item', item });
  assert.equal(topicResult.ok, true, topicResult.error);
  const topic = (topicResult.value as { topic: { id: string } }).topic.id;
  const rev = await inProcessSpoke(t, { discover: true, cwd: root, name: 'rev-1', role: 'reviewer', sessionId: 'reviewer-session' });
  await rev.waitForEvent(e => e.params.meta?.kind === 'role');
  const review = await peer.call<{ ok: boolean; outcomes: Array<{ resolvedTo?: string }> }>('send', { to: ['reviewer'], topic, text: `review request ${item}\nCustom-role source review` });
  assert.equal(review.ok, true);
  assert.equal(review.outcomes[0]?.resolvedTo, 'rev-1');
  await rev.waitForEvent(e => e.params.content.includes('Custom-role source review'));

  const preview = await peer.call<{ ok: boolean; error?: string }>('verify', { dryRun: true, report: topic, to: ['reviewer'] });
  assert.equal(preview.ok, true, preview.error);
  for (const override of [{ mode: 'all' }, { occasion: 'stage' }, { cwd: root }, { report: 'general' }]) {
    const refusal = await peer.call<{ ok: boolean; code?: string }>('verify', { dryRun: true, report: topic, to: ['reviewer'], ...override });
    assert.equal(refusal.ok, false, JSON.stringify(override));
    assert.equal(refusal.code, 'forbidden');
  }

  const ready = ui.waitFor(f => f.type === 'task' && (f.item as { id?: string; status?: string })?.id === item && (f.item as { status?: string }).status === 'ready');
  const verdict = await rev.call<{ ok: boolean; error?: string }>('task.comment', { id: item, verdict: 'review', scope: 'evidence', result: 'clear', run: 'custom-evidence', verified: 'all', findings: [] });
  assert.equal(verdict.ok, true, verdict.error);
  await ready;
  const view = (await ui.request({ type: 'task.view', item })).value as { item: { status: string; claim: { role: string } } };
  assert.equal(view.item.status, 'ready');
  assert.equal(view.item.claim.role, 'docs-writer');
});

test('custom role-name routing is distinct from built-ins and lead addresses skip custom claims', async t => {
  const root = await tempProject(t);
  await mkdir(join(root, '.cland'), { recursive: true });
  await writeFile(join(root, '.cland/roles.toml'), definition.replace('"task.view"', '"task.view", "task.claim:own"'));
  const { discovery } = await projectHub(t, root, {}, { clock: new FakeClock() });
  const ui = await connectUi(t, discovery);
  for (const [name, role] of [['coord-1', 'coordinator'], ['rev-1', 'reviewer'], ['qa-1', 'qa'], ['writer-1', 'docs-writer']]) {
    assert.equal((await ui.request({ type: 'role.set', session: name, role })).ok, true);
    const peer = await inProcessSpoke(t, { discover: true, cwd: root, name: name!, sessionId: `${name}-id`, assignRole: false });
    await peer.waitForEvent(e => e.params.meta?.kind === 'role');
  }
  const item = ((await ui.request({ type: 'task.create', title: 'Docs routing', size: 'S', assignee: 'writer-1' })).value as { item: { id: string } }).item.id;
  assert.equal((await ui.request({ type: 'task.claim', item, as: { name: 'writer-1' } })).ok, true);
  for (const [tag, expected] of [['docs-writer', 'writer-1'], ['coordinator', 'coord-1'], ['reviewer', 'rev-1'], ['qa', 'qa-1'], [`lead ${item}`, 'coord-1']]) {
    const sent = await ui.request({ type: 'topic.send', topic: 'general', to: [tag], text: `Routing ${tag}` });
    assert.equal(sent.ok, true, sent.error);
    assert.deepEqual((sent.value as { message: { to: string[] } }).message.to, [expected]);
  }
  const mentioned = await ui.request({ type: 'topic.send', topic: 'general', text: '@docs-writer inspect the docs' });
  assert.equal(mentioned.ok, true, mentioned.error);
  assert.deepEqual((mentioned.value as { message: { to: string[] } }).message.to, ['writer-1']);
  const aide = await inProcessSpoke(t, { discover: true, cwd: root, name: 'aide-1', role: 'aide', sessionId: 'aide-session' });
  await aide.waitForEvent(e => e.params.meta?.kind === 'role');
  const broadcast = await aide.call<{ ok: boolean; code: string }>('send', { to: ['docs-writer'], text: 'Aide cannot use custom role broadcasts' });
  assert.equal(broadcast.ok, false);
  assert.equal(broadcast.code, 'forbidden');
  const collision = await ui.request({ type: 'session.launch', name: 'docs-writer', role: 'implementer' });
  assert.equal(collision.ok, false);
  assert.match(collision.error!, /reserved/);
});

test('launching a custom role for a task adopts the item claim through the normal worktree path', async t => {
  const root = await tempProject(t);
  await mkdir(join(root, '.cland'), { recursive: true });
  await writeFile(join(root, '.cland/roles.toml'), definition);
  const { discovery } = await projectHub(t, root, {}, { clock: new FakeClock() });
  const ui = await connectUi(t, discovery);
  const made = await ui.request({ type: 'task.create', title: 'Assigned docs', size: 'S' });
  const item = (made.value as { item: { id: string } }).item.id;
  const launch = await ui.request({ type: 'session.launch', name: 'writer-1', role: 'docs-writer', item });
  assert.equal(launch.ok, true, launch.error);
  const view = (await ui.request({ type: 'task.view', item })).value as { item: { claim: { session: string; role: string }; status: string } };
  assert.equal(view.item.claim.session, 'writer-1');
  assert.equal(view.item.claim.role, 'docs-writer');
  assert.equal(view.item.status, 'in progress');
});


for (const kind of ['review', 'qa'] as const) test(`a custom claimant reassigned to ${kind} cannot supply its own accepted verdict`, async t => {
  const root = await tempProject(t);
  await mkdir(join(root, '.cland'), { recursive: true });
  await writeFile(join(root, '.cland/roles.toml'), definition.replace('"task.view"', '"task.view", "task.claim:own"'));
  const sha = 'a'.repeat(40);
  const { discovery } = await projectHub(t, root, {}, { clock: new FakeClock(), git: async args => {
    if (args[0] === 'for-each-ref') return `${sha} refs/heads/dev\n${sha} refs/heads/t/docs`;
    if (args[0] === 'rev-parse' || args[0] === 'merge-base') return sha;
    if (args[0] === 'diff') return '';
    return null;
  }, readBase: async () => 'dev' });
  const ui = await connectUi(t, discovery);
  const worker = await inProcessSpoke(t, { discover: true, cwd: root, name: 'writer-1', role: 'docs-writer', sessionId: 'claimant-session' });
  await worker.waitForEvent(e => e.params.meta?.kind === 'role');
  const made = await ui.request({ type: 'task.create', title: 'Independent custom work', size: 'S', branch: 't/docs', assignee: 'writer-1' });
  const item = (made.value as { item: { id: string } }).item.id;
  assert.equal((await worker.call<{ ok: boolean }>('task.claim', { id: item })).ok, true);
  assert.equal((await ui.request({ type: 'role.set', session: 'writer-1', role: kind === 'review' ? 'reviewer' : 'qa' })).ok, true);
  const post = (peer: typeof worker, run: string) => peer.call<{ ok: boolean; error?: string }>('task.comment', {
    id: item, verdict: kind, ...(kind === 'review' ? { scope: 'full' } : {}), result: 'clear', run, commit: sha, findings: [],
  });
  const own = await post(worker, 'self-verdict');
  assert.equal(own.ok, true, own.error);
  const read = async () => ((await ui.request({ type: 'task.view', item })).value as { item: ItemView }).item;
  const view = await read();
  assert.equal(view.claim?.role, 'docs-writer');
  assert.equal(view.claim?.sessionId, 'claimant-session');
  if (kind === 'review') {
    assert.throws(() => gateVerdicts(view), error => error instanceof MergeError && error.code === 'review-claimant');
  } else assert.equal(view.qaSatisfied, false, 'same-session QA does not satisfy the shared gate');
  const independent = await inProcessSpoke(t, { discover: true, cwd: root, name: 'independent-1', role: kind === 'review' ? 'reviewer' : 'qa', sessionId: 'independent-session' });
  const clear = await post(independent, 'independent-verdict');
  assert.equal(clear.ok, true, clear.error);
  const independentView = await read();
  if (kind === 'review') assert.equal(gateVerdicts(independentView).review.writer?.sessionId, 'independent-session');
  else assert.equal(independentView.qaSatisfied, true);
});


test('custom claimant identity also excludes its own stage QA while independent QA can close the stage', async t => {
  const root = await tempProject(t);
  const head = 'a'.repeat(40), tree = 'b'.repeat(40);
  const tracker = new Tracker({ root, db: join(root, '.cland/hub.db'),
    git: async args => args[0] === 'for-each-ref' ? `${head} refs/heads/dev` : args[0] === 'rev-parse' ? head : '',
    readBase: async () => 'dev', stageTree: async () => tree,
    scheduleTips: () => ({ poke() {}, stop() {} }),
  });
  tracker.start(); onCleanup(t, () => tracker.stop());
  const human = { id: 'human', name: 'human', role: null };
  const epic = await tracker.create(human, { kind: 'epic', title: 'Independent stage QA' });
  const child = await tracker.create(human, { size: 'S', title: 'Evidence-only task', parent: epic.id });
  await tracker.setPlan(human, epic.id, JSON.stringify({ stages: [{ name: 'docs', qa: { scope: 'affected', when: 'after-stage' }, lanes: [[child.id]] }] }));
  await tracker.close(human, child.id);
  await tracker.claim({ id: 'claimant-session', name: 'writer-1', role: 'docs-writer' }, epic.id);
  tracker.useVerify(() => null, () => [
    { id: 'linux', head, tree, platform: 'Linux droplet' },
    { id: 'mac', head, tree, platform: 'macOS' },
  ]);
  await tracker.refreshFreshness();
  const verdict = { verdict: 'qa' as const, result: 'clear' as const, run: 'stage-qa', stage: 'docs' };
  await assert.rejects(tracker.comment({ id: 'claimant-session', name: 'writer-1', role: 'qa' }, epic.id, '', verdict), /the claiming session cannot supply stage QA/);
  await tracker.comment({ id: 'independent-session', name: 'qa-1', role: 'qa' }, epic.id, '', verdict);
  const stage = await eventually('independent QA closes the exact stage', async () => {
    const stage = (await tracker.viewAsync(epic.id)).stages![0]!;
    return stage.state === 'closed' && stage.verdict?.current === true ? stage : undefined;
  });
  assert.equal(stage.state, 'closed');
  assert.equal(stage.verdict?.writer?.sessionId, 'independent-session');
});
