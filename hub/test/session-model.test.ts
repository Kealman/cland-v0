// T2: model journal rules over in-process flavours and real protocol frames.
// Native model selection and child parsing: session-native-lifecycle.test.ts and each adapter contract.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { connectUi, projectHub, tempProject, type FrameClient } from './harness.ts';
import { FakeClock } from './fake-clock.ts';
import { FAKE_FLAVOURS } from './fakes/harness.ts';
import type { HarnessProcessView } from '../src/protocol.ts';

async function records(root: string, ui: FrameClient): Promise<Array<Record<string, unknown>>> {
  assert.equal((await ui.request({ type: 'hub.status', flushLogs: true })).ok, true);
  return (await readFile(join(root, '.cland/journal.jsonl'), 'utf8')).trim().split('\n').filter(Boolean).map(line => JSON.parse(line));
}

test('model changes journal once with their launch identity across flavours', async t => {
  const root = await tempProject(t);
  const clock = new FakeClock();
  const { discovery, fakes } = await projectHub(t, root, {}, { clock, harnesses: 'fake', probes: 'fake' });
  const ui = await connectUi(t, discovery);
  for (const harness of FAKE_FLAVOURS) {
    const launched = await ui.request({ type: 'session.launch', name: harness, harness, model: 'original' });
    assert.equal(launched.ok, true, launched.error);
    const p = (launched.value as { process: HarnessProcessView }).process;
    for (const model of ['original', 'changed', 'changed', 'later']) fakes[harness]!.model(p.name, model);
    const journal = (await records(root, ui)).filter(r => r.event === 'session-model' && r.sessionId === p.sessionId);
    assert.deepEqual(journal.map(r => [r.session, r.sessionId, r.harness, r.role, r.item, r.model, r.source]), [
      [harness, p.sessionId, harness, null, null, 'changed', 'harness'],
      [harness, p.sessionId, harness, null, null, 'later', 'harness'],
    ]);
  }
});

test('first reported model is journalled once for explicit and default launches across flavours', async t => {
  const root = await tempProject(t);
  const clock = new FakeClock();
  const { discovery, fakes } = await projectHub(t, root, {}, { clock, harnesses: 'fake', probes: 'fake' });
  const ui = await connectUi(t, discovery);
  for (const harness of FAKE_FLAVOURS) for (const explicit of [false, true]) {
    const name = `${harness}-${explicit}`;
    const launched = await ui.request({ type: 'session.launch', name, harness, ...(explicit ? { model: 'reported-model' } : {}) });
    assert.equal(launched.ok, true, launched.error);
    const p = (launched.value as { process: HarnessProcessView }).process;
    assert.equal(p.model, explicit ? 'reported-model' : null);
    fakes[harness]!.model(name, 'reported-model');
    let journal = (await records(root, ui)).filter(r => r.sessionId === p.sessionId);
    assert.equal(journal.find(r => r.event === 'session-launched')?.model, explicit ? 'reported-model' : null);
    assert.deepEqual(journal.filter(r => r.event === 'session-model').map(r => r.model), explicit ? [] : ['reported-model']);
    fakes[harness]!.turn(name, { afterMs: 1, model: 'reported-model' });
    await clock.advance(1);
    journal = (await records(root, ui)).filter(r => r.sessionId === p.sessionId);
    assert.equal(journal.filter(r => r.event === 'session-model').length, explicit ? 0 : 1);
  }
});

test('live, fresh and native resume journal their launch model across flavours', async t => {
  const root = await tempProject(t);
  const clock = new FakeClock();
  const { discovery, fakes } = await projectHub(t, root, {}, { clock, harnesses: 'fake', probes: 'fake' });
  const ui = await connectUi(t, discovery);
  for (const harness of FAKE_FLAVOURS) for (const fresh of [null, false, true]) {
    const name = `${harness}-${fresh}`;
    const launched = await ui.request({ type: 'session.launch', name, harness });
    assert.equal(launched.ok, true, launched.error);
    fakes[harness]!.model(name, 'reported-model');
    fakes[harness]!.idle(name);
    if (fresh !== null) assert.equal((await ui.request({ type: 'session.stop', session: name })).ok, true);
    fakes[harness]!.scriptResume(name, 'found');
    const resumed = await ui.request({ type: 'session.resume', session: name, ...(fresh === null ? {} : fresh ? { fresh: true } : { relaunch: true }) });
    assert.equal(resumed.ok, true, resumed.error);
    assert.equal((resumed.value as { found: boolean }).found, true);
    const journal = (await records(root, ui)).filter(r => r.session === name);
    assert.deepEqual(journal.filter(r => r.event === 'session-launched').map(r => r.model), [null, 'reported-model']);
    assert.deepEqual(journal.filter(r => r.event === 'session-model').map(r => r.model), ['reported-model']);
  }
});

test('sub-agent hook attribution leaves the parent model and busy state intact', async t => {
  const root = await tempProject(t);
  const clock = new FakeClock();
  const { discovery } = await projectHub(t, root, {}, { clock, harnesses: 'fake', probes: 'fake' });
  const ui = await connectUi(t, discovery);
  const launched = await ui.request({ type: 'session.launch', name: 'parent', harness: 'claude-code', model: 'parent-model' });
  assert.equal(launched.ok, true, launched.error);
  const p = (launched.value as { process: HarnessProcessView }).process;
  assert.equal((await ui.request({ type: 'session.signal', session: p.name, launch: p.sessionId, event: 'turn-start' })).ok, true);
  for (const [id, model, requested] of [['known', 'child-model', 'requested-model'], ['requested', null, 'requested-model'], ['unknown', null, null]]) {
    const signal = await ui.request({ type: 'session.signal', session: p.name, launch: p.sessionId, event: 'subagent-start', payload: { agent_id: id, agent_type: 'Explore', ...(model ? { model } : {}), ...(requested ? { tool_input: { model: requested } } : {}) } });
    assert.equal(signal.ok, true, signal.error);
    assert.equal((await ui.request({ type: 'session.signal', session: p.name, launch: p.sessionId, event: 'subagent-stop', payload: { agent_id: id, model: 'stop-model' } })).ok, true);
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
