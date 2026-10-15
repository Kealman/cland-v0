// Journal contracts through a daemon, launched fake harness and the frame/CLI protocol.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { cland, connectUi, eventually, fakeClaude, fakeCodex, projectHub, startDaemon, tempProject, type FrameClient } from './harness.ts';
import { copyPreparedProject } from './prepared-project.ts';
import type { HarnessProcessView } from '../src/protocol.ts';

async function records(root: string, ui: FrameClient): Promise<Array<Record<string, unknown>>> {
  assert.equal((await ui.request({ type: 'hub.status', flushLogs: true })).ok, true);
  const read = await cland(root, 'hub', 'journal', '--kind', 'session-launched,session-model,subagent-launched', '--json');
  assert.equal(read.code, 0, read.stderr);
  return read.stdout.trim().split('\n').filter(Boolean).map(line => JSON.parse(line));
}

test('harness model reports journal only changes and retain launch identity', async t => {
  const root = await tempProject(t);
  const fake = await fakeClaude(t);
  const { discovery } = await startDaemon(t, root, fake.env);
  const ui = await connectUi(t, discovery);
  const launched = await ui.request({ type: 'session.launch', name: 'model', harness: 'claude-code', model: 'original' });
  assert.equal(launched.ok, true, launched.error);
  const p = (launched.value as { process: HarnessProcessView }).process;
  await eventually('initial model hook applied', async () => (await fake.log(p.harnessId!)).includes('hooks SessionStart done') || undefined);
  for (const model of ['original', 'changed', 'changed', 'later']) {
    const result = await ui.request({ type: 'session.signal', session: p.name, launch: p.sessionId, event: 'mod-turn-complete', payload: { usage: { model } } });
    assert.equal(result.ok, true, result.error);
  }
  const journal = await records(root, ui);
  assert.deepEqual(journal.filter(r => r.event === 'session-model').map(r => [r.session, r.sessionId, r.harness, r.role, r.item, r.model, r.source]), [
    ['model', p.sessionId, 'claude-code', null, null, 'changed', 'harness'],
    ['model', p.sessionId, 'claude-code', null, null, 'later', 'harness'],
  ]);
});

for (const explicit of [false, true]) test(`Claude journals the first turn model once (${explicit ? 'explicit model' : 'harness default'})`, async t => {
  const root = await tempProject(t);
  const fake = await fakeClaude(t);
  const { discovery } = await startDaemon(t, root, fake.env);
  const ui = await connectUi(t, discovery);
  await ui.request({ type: 'subscribe' });
  const launched = await ui.request({ type: 'session.launch', name: 'impl', role: 'implementer', harness: 'claude-code', ...(explicit ? { model: 'claude-fake-1' } : {}) });
  assert.equal(launched.ok, true, launched.error);
  const p = (launched.value as { process: HarnessProcessView }).process;
  await ui.waitFor(f => f.type === 'session.usage' && f.sessionId === p.sessionId);
  assert.equal(p.model, explicit ? 'claude-fake-1' : null);
  let journal = await records(root, ui);
  assert.equal(journal.find(r => r.event === 'session-launched')?.model, explicit ? 'claude-fake-1' : null);
  assert.deepEqual(journal.filter(r => r.event === 'session-model').map(r => r.model), explicit ? [] : ['claude-fake-1']);
  const sent = await ui.request({ type: 'topic.send', topic: 'general', to: ['impl'], text: '@impl Another turn' });
  assert.equal(sent.ok, true, sent.error);
  await ui.waitFor(f => f.type === 'session.usage' && f.sessionId === p.sessionId && (f.usage as { total: { outputTokens: number } }).total.outputTokens === 4);
  journal = await records(root, ui);
  assert.equal(journal.filter(r => r.event === 'session-model').length, explicit ? 0 : 1);
});

test('sub-agent hooks journal parent attribution and never change the parent model or state', async t => {
  const root = await tempProject(t);
  // T-389 staging race: native idle polls must not overwrite the synthetic parent turn during journal reads.
  const fake = await fakeClaude(t, { pushTrustMs: 120_000 });
  const { discovery } = await projectHub(t, root, fake.env);
  const ui = await connectUi(t, discovery);
  const launched = await ui.request({ type: 'session.launch', name: 'parent', harness: 'claude-code', model: 'parent-model' });
  assert.equal(launched.ok, true, launched.error);
  const p = (launched.value as { process: HarnessProcessView }).process;
  await eventually('initial hook settled', async () => (await fake.log(p.harnessId!)).includes('hooks SessionStart done') || undefined);
  await ui.request({ type: 'session.signal', session: p.name, launch: p.sessionId, event: 'turn-start' });
  for (const [id, model, requested] of [['known', 'child-model', 'requested-model'], ['requested', null, 'requested-model'], ['unknown', null, null]]) {
    const signal = await ui.request({ type: 'session.signal', session: p.name, launch: p.sessionId, event: 'subagent-start', payload: { agent_id: id, agent_type: 'Explore', ...(model ? { model } : {}), ...(requested ? { tool_input: { model: requested } } : {}) } });
    assert.equal(signal.ok, true, signal.error);
    await ui.request({ type: 'session.signal', session: p.name, launch: p.sessionId, event: 'subagent-stop', payload: { agent_id: id, model: 'stop-model' } });
  }
  const journal = await records(root, ui);
  assert.deepEqual(journal.filter(r => r.event === 'subagent-launched').map(r => [r.session, r.sessionId, r.harness, r.role, r.item, r.agentId, r.agentType, r.model]), [
    ['parent', p.sessionId, 'claude-code', null, null, 'known', 'Explore', 'child-model'],
    ['parent', p.sessionId, 'claude-code', null, null, 'requested', 'Explore', 'requested-model'],
    ['parent', p.sessionId, 'claude-code', null, null, 'unknown', 'Explore', 'unreported'],
  ]);
  const listed = (await ui.request({ type: 'session.list' })).value as { processes: HarnessProcessView[] };
  assert.equal(listed.processes[0]?.model, 'parent-model');
  assert.equal(listed.processes[0]?.state, 'busy');
});

test('launched Claude sub-agents retain their parent role and launch item through real hook commands', async t => {
  const root = await tempProject(t);
  await copyPreparedProject(root);
  const fake = await fakeClaude(t);
  const { discovery } = await projectHub(t, root, fake.env);
  const ui = await connectUi(t, discovery);
  const created = await ui.request({ size: 'M', type: 'task.create', title: 'Parent attribution' });
  assert.equal(created.ok, true, created.error);
  const item = (created.value as { item: { id: string } }).item.id;
  const launched = await ui.request({ type: 'session.launch', name: 'impl', role: 'implementer', harness: 'claude-code', item, brief: 'spawn subagents' }, 30_000);
  assert.equal(launched.ok, true, launched.error);
  const p = (launched.value as { process: HarnessProcessView }).process;
  const journal = await eventually('both sub-agent starts journalled', async () => {
    const journal = await records(root, ui);
    return journal.filter(r => r.event === 'subagent-launched').length === 2 && journal.some(r => r.event === 'session-model') ? journal : undefined;
  });
  assert.deepEqual(journal.filter(r => r.event === 'subagent-launched').sort((a, b) => String(a.agentId).localeCompare(String(b.agentId))).map(r => [r.session, r.sessionId, r.role, r.item, r.agentId, r.agentType, r.model]), [
    ['impl', p.sessionId, 'implementer', item, 'known-child', 'Explore', 'claude-child-1'],
    ['impl', p.sessionId, 'implementer', item, 'unknown-child', 'Explore', 'unreported'],
  ]);
  assert.deepEqual(journal.filter(r => r.event === 'session-model').map(r => r.model), ['claude-fake-1']);
  const viewed = await cland(root, 'task', 'view', item, '--json');
  assert.equal(viewed.code, 0, viewed.stderr);
  const usage = JSON.parse(viewed.stdout).item.usage;
  assert.deepEqual(usage?.subagents.map((r: Record<string, unknown>) => [r.session, r.sessionId, r.harness, r.agentId, r.model]), [
    ['impl', p.sessionId, 'claude-code', 'known-child', 'claude-child-1'],
    ['impl', p.sessionId, 'claude-code', 'unknown-child', 'unreported'],
  ]);
  const human = await cland(root, 'task', 'view', item);
  assert.equal(human.code, 0, human.stderr);
  assert.match(human.stdout, /usage:[\s\S]*sub-agent known-child.*claude-child-1/);
  assert.match(human.stdout, /sub-agent unknown-child.*unreported/);
  const other = await ui.request({ size: 'XS', type: 'task.create', title: 'Unrelated item' });
  assert.equal(other.ok, true, other.error);
  const otherId = (other.value as { item: { id: string } }).item.id;
  const unrelated = await cland(root, 'task', 'view', otherId, '--json');
  assert.equal(unrelated.code, 0, unrelated.stderr);
  assert.deepEqual(JSON.parse(unrelated.stdout).item.usage.subagents, []);
});

for (const harness of ['codex', 'opencode']) test(`${harness} journals its selected model and reported child models`, async t => {
  const root = await tempProject(t);
  const home = await tempProject(t, 'fake-model-opencode-');
  const env = harness === 'codex' ? (await fakeCodex(t)).env : {
    PATH: `${fileURLToPath(new URL('./fakes/opencode', import.meta.url))}:${process.env.PATH ?? ''}`,
    FAKE_OPENCODE_HOME: home, FAKE_OPENCODE_TURN_MS: '30',
    CLAND_ADAPTER_POLL_MS: '50',
  };
  const { discovery } = await startDaemon(t, root, env);
  const ui = await connectUi(t, discovery);
  await ui.request({ type: 'subscribe' });
  const launched = await ui.request({ type: 'session.launch', name: 'parent', harness, role: 'implementer' }, 30_000);
  assert.equal(launched.ok, true, launched.error);
  const p = (launched.value as { process: HarnessProcessView }).process;
  const model = harness === 'codex' ? 'gpt-fake-1' : 'opencode/fake-free';
  assert.equal(p.model, model);
  assert.equal((await records(root, ui)).find(r => r.event === 'session-launched')?.model, model);
  const sent = await ui.request({ type: 'topic.send', topic: 'general', to: ['parent'], text: '@parent spawn subagents' });
  assert.equal(sent.ok, true, sent.error);
  const journal = await eventually('native sub-agent records', async () => {
    const journal = await records(root, ui);
    return journal.filter(r => r.event === 'subagent-launched').length === 2 ? journal : undefined;
  });
  assert.deepEqual(journal.filter(r => r.event === 'subagent-launched').map(r => [r.session, r.sessionId, r.harness, r.agentId, r.model]), [
    ['parent', p.sessionId, harness, 'known-child', harness === 'codex' ? 'gpt-child-1' : 'opencode/child-1'],
    ['parent', p.sessionId, harness, 'unknown-child', 'unreported'],
  ]);
  if (harness === 'codex') {
    const legacy = await ui.request({ type: 'topic.send', topic: 'general', to: ['parent'], text: '@parent spawn legacy subagent' });
    assert.equal(legacy.ok, true, legacy.error);
    const recordsWithLegacy = await eventually('legacy spawn signal journalled', async () => {
      const journal = await records(root, ui);
      return journal.find(r => r.event === 'subagent-launched' && r.agentId === 'legacy-child') ? journal : undefined;
    });
    assert.equal(recordsWithLegacy.filter(r => r.agentId === 'legacy-child').length, 1);
    assert.equal(recordsWithLegacy.find(r => r.agentId === 'legacy-child')?.model, 'gpt-legacy-1');
  }

});

for (const fresh of [null, false, true]) test(`${fresh === null ? 'live resume' : fresh ? 'fresh resume' : 'native relaunch'} journals its own launch model`, async t => {
  const root = await tempProject(t);
  const fake = await fakeClaude(t);
  const { discovery } = await startDaemon(t, root, fake.env);
  const ui = await connectUi(t, discovery);
  await ui.request({ type: 'subscribe' });
  const launched = await ui.request({ type: 'session.launch', name: 'impl', harness: 'claude-code', role: 'implementer' });
  assert.equal(launched.ok, true, launched.error);
  const p = (launched.value as { process: HarnessProcessView }).process;
  await ui.waitFor(f => f.type === 'session.usage' && f.sessionId === p.sessionId);
  if (fresh !== null) assert.equal((await ui.request({ type: 'session.stop', session: 'impl' }, 30_000)).ok, true);
  const mark = ui.frames.length;
  const resumed = await ui.request({ type: 'session.resume', session: 'impl', ...(fresh === null ? {} : fresh ? { fresh: true } : { relaunch: true }) }, 30_000);
  assert.equal(resumed.ok, true, resumed.error);
  assert.equal((resumed.value as { found: boolean }).found, true);
  if (fresh) await ui.waitFor(f => f.type === 'session.usage' && ui.frames.indexOf(f) >= mark);
  const journal = await records(root, ui);
  assert.deepEqual(journal.filter(r => r.event === 'session-launched').map(r => r.model), [null, 'claude-fake-1']);
  assert.deepEqual(journal.filter(r => r.event === 'session-model').map(r => r.model), ['claude-fake-1']);
});

test('a Codex child reported before launch admission is retained after its parent launch record', async t => {
  const root = await tempProject(t);
  const fake = await fakeCodex(t, { env: { FAKE_CODEX_SUBAGENT_AT_LAUNCH: '1' } });
  const { discovery } = await startDaemon(t, root, fake.env);
  const ui = await connectUi(t, discovery);
  const launched = await ui.request({ type: 'session.launch', name: 'impl', role: 'implementer', harness: 'codex' }, 30_000);
  assert.equal(launched.ok, true, launched.error);
  const journal = await records(root, ui);
  assert.deepEqual(journal.map(r => [r.event, r.model]), [['session-launched', 'gpt-fake-1'], ['subagent-launched', 'gpt-early-child']]);
});
