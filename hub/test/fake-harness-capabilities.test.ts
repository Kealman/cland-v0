// T1: the simulation follows the production adapter's advertised capabilities.
import test from 'node:test';
import assert from 'node:assert/strict';
import { CLAUDE_CODE_CLAUSE_AT_SPAWN, CLAUDE_CODE_CAPABILITIES } from '../src/adapters/claude-code.ts';
import { CODEX_CLAUSE_AT_SPAWN, CODEX_CAPABILITIES } from '../src/adapters/codex.ts';
import { OPENCODE_CLAUSE_AT_SPAWN, OPENCODE_CAPABILITIES } from '../src/adapters/opencode.ts';
import { FakeClock } from './fake-clock.ts';
import { InjectUncertain } from '../src/adapters/contract.ts';
import type { Message } from '../src/protocol.ts';
import { fakeHarness } from './fakes/harness.ts';

test('fake flavours inherit production capabilities and first-clause semantics', () => {
  for (const [flavour, capabilities, clauseAtSpawn] of [
    ['claude-code', CLAUDE_CODE_CAPABILITIES, CLAUDE_CODE_CLAUSE_AT_SPAWN],
    ['codex', CODEX_CAPABILITIES, CODEX_CLAUSE_AT_SPAWN],
    ['opencode', OPENCODE_CAPABILITIES, OPENCODE_CLAUSE_AT_SPAWN],
  ] as const) {
    const fake = fakeHarness(flavour);
    assert.equal(fake.capabilities, capabilities);
    assert.equal(fake.clauseAtSpawn, clauseAtSpawn);
  }
});

// T1: adapter confirmation and cancellation, with no socket or process.
test('held confirmations belong to a session and delayed outcomes use the injected clock', async () => {
  const clock = new FakeClock();
  const fake = fakeHarness('codex', { clock });
  const request = { role: null, model: null, cwd: '/fixture' };
  const first = await fake.spawn({ ...request, name: 'first' });
  const second = await fake.spawn({ ...request, name: 'second' });
  const message: Message = { id: 'broadcast', from: 'human', fromKind: 'human', via: 'hub', to: ['first', 'second'], text: 'work', ts: clock.now().toISOString() };
  fake.scriptInject('first', 'hold');
  fake.scriptInject('second', { outcome: 'uncertain', afterMs: 50 });
  let firstDone = false, secondDone = false;
  const accepted = fake.inject(first, message, null).then(() => { firstDone = true; });
  const uncertain = assert.rejects(fake.inject(second, message, null), InjectUncertain).then(() => { secondDone = true; });
  fake.confirm(second, 'different-message');
  fake.confirm(first, message.id);
  await accepted;
  assert.equal(firstDone, true);
  await clock.advance(49);
  assert.equal(secondDone, false, 'confirming one recipient cannot settle another');
  await clock.advance(1);
  await uncertain;
  assert.equal(secondDone, true);
  assert.equal(clock.pending, 0);

  fake.scriptInject('first', { outcome: 'reject', afterMs: 100 });
  const confirmed = fake.inject(first, { ...message, id: 'confirmed' }, null);
  fake.confirm(first, 'confirmed');
  await confirmed;
  assert.equal(clock.pending, 0, 'early confirmation cancels its deadline');
  fake.scriptInject('first', 'hold');
  const stopped = assert.rejects(fake.inject(first, { ...message, id: 'stopped' }, null), /rejected/);
  await fake.stop(first);
  await stopped;
  assert.deepEqual(await fake.resume(first), { found: false, reason: 'fake conversation gone' });
  fake.close();
  assert.equal(clock.pending, 0);
});

test('a scheduled turn follows its session identity across rename and name reuse', async () => {
  const clock = new FakeClock();
  const signals: Array<{ id: string; state: string | undefined }> = [];
  const usages: string[] = [];
  const fake = fakeHarness('codex', { clock, host: {
    root: '/fixture', discoveryFile: '/fixture/hub.json', node: 'node', cli: 'cland', spoke: 'spoke',
    log: () => {}, recordPid: () => {}, exited: () => {},
    signal: (id, signal) => signals.push({ id, state: signal.state }),
    usageChanged: id => usages.push(id),
  } });
  const request = { role: null, model: null, cwd: '/fixture' };
  const original = await fake.spawn({ ...request, name: 'old' });
  const usage = { model: 'turn-model' };
  fake.turn('old', { afterMs: 100, usage });
  fake.renamed({ ...original, name: 'new' });
  const reused = await fake.spawn({ ...request, name: 'old' });
  await clock.advance(100);
  assert.deepEqual(signals, [{ id: original.sessionId, state: 'busy' }, { id: original.sessionId, state: 'idle' }]);
  assert.deepEqual(usages, [original.sessionId]);
  assert.deepEqual(fake.usage(original), usage);
  assert.equal(fake.usage(reused), null);
  fake.close();
  assert.equal(clock.pending, 0);
});
