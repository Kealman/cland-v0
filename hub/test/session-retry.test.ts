// T2: isolated project hub, fake harness and sealed native CLI; no real harness or browser.
import assert from 'node:assert/strict';
import test from 'node:test';
import { cland, tempProject } from './harness.ts';
import { caseDeadlines } from './case-deadlines.ts';
import { claudeComponentOwner } from './claude-component-fixture.ts';
import { FakeClock } from './fake-clock.ts';
import type { HarnessProcessView, Message } from '../src/protocol.ts';

test('session retry without a message id forces old queued input via the CLI', async t => {
  const deadlines = caseDeadlines(t);
  const root = await deadlines.wait('disposable root acquisition', () => tempProject(deadlines.fixtures));
  const clock = new FakeClock();
  const owner = claudeComponentOwner(deadlines.fixtures, root, clock, {});
  const { ui, fake } = await deadlines.wait('hub, UI and spoke setup receipt', async () => {
    const { hub, ui } = await owner.start();
    const launched = await ui.request({ type: 'session.launch', harness: 'claude-code', name: 'impl', role: 'implementer' });
    assert.equal(launched.ok, true, launched.error);
    const process = (launched.value as { process: HarnessProcessView }).process;
    const fake = hub.fakes['claude-code']!;
    await owner.spoke({ cwd: root, discover: true, name: 'impl', sessionId: process.sessionId, launchToken: fake.spawns[0]!.launchToken! });
    return { ui, fake };
  });
  fake.busy('impl');
  const sent = await ui.request({ type: 'topic.send', topic: 'general', to: ['impl'], text: 'operator forces this input' });
  assert.equal(sent.ok, true, sent.error);
  const id = (sent.value as { message: Message }).message.id;
  const fresh = await deadlines.wait('fresh queued refusal', () => cland(root, 'session', 'retry', 'impl', id));
  assert.notEqual(fresh.code, 0);
  assert.match(fresh.stderr, /stage queued, age \d+ ms/);
  await clock.advance(60_001);
  const injected = owner.frame(ui, f => f.type === 'delivery' && f.message === id && f.stage === 'injected');
  const retried = await deadlines.wait('native retry CLI result', () => cland(root, 'session', 'retry', 'impl'));
  assert.equal(retried.code, 0, retried.stderr);
  await deadlines.wait('exact injected delivery receipt', () => injected);
  assert.equal(fake.injections.filter(i => i.message.id === id).length, 1);
  const settled = await deadlines.wait('injected refusal', () => cland(root, 'session', 'retry', 'impl', id));
  assert.notEqual(settled.code, 0);
  assert.match(settled.stderr, /stage injected, age \d+ ms/);
});
