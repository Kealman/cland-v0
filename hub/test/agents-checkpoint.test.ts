import test from 'node:test';
import assert from 'node:assert/strict';
import { HubCore, AGENTS, AGENTS_JOURNAL_CHECKPOINT } from '../src/hub/core.ts';
import { Journal } from '../src/hub/journal.ts';
import { agentsRecord, replayAgentsRecord } from '../src/hub/agents-topic.ts';

test('recovery never resurrects pruned notices when the newest checkpoint append was held at a crash', async t => {
  const old = { ts: '2020-01-01T00:00:00Z', event: 'role-assigned', session: 'old', role: 'implementer', agentsNotice: 'pruned' };
  let completed = `${JSON.stringify(old)}\n`;
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const journal = new Journal('/memory', undefined, { open: async () => ({
    stat: async () => ({ size: 0 }), read: async () => ({ bytesRead: 0 }),
    write: async (buffer: Buffer, offset: number, length: number) => { await gate; completed += buffer.subarray(offset, offset + length).toString(); return { bytesWritten: length }; },
    close: async () => {},
  }) });
  const agents = agentsRecord();
  const core = new HubCore();
  t.after(() => { core.close(); core.store.close(); });
  agents.attach(core);
  agents.tap(journal.tap(() => {}))({ event: 'role-assigned', session: 'new', role: 'implementer' });
  await Promise.resolve();
  assert.ok(core.store.meta(AGENTS_JOURNAL_CHECKPOINT));
  const surviving = completed.trim().split('\n').map(line => JSON.parse(line));
  assert.equal(replayAgentsRecord(core, surviving), 0);
  assert.equal(core.topicHistory(AGENTS.id).messages.some(message => message.id === 'pruned'), false);
  release();
  await journal.close();
});

for (const olderPrefix of [true, false]) {
  test(`recovery advances its boundary before a later run loses notice recording (older prefix: ${olderPrefix})`, t => {
    const core = new HubCore();
    t.after(() => { core.close(); core.store.close(); });
    const old = { event: 'role-assigned', session: 'old', role: 'implementer', agentsNotice: 'pruned' };
    core.store.setMeta(AGENTS_JOURNAL_CHECKPOINT, 'unflushed-checkpoint');
    const previous = olderPrefix ? [old] : [];
    assert.equal(replayAgentsRecord(core, previous), 0);
    // A subsequent run appended this record, but the Agents DB write failed before moving its checkpoint.
    const later = { event: 'role-assigned', session: 'later', role: 'implementer', agentsNotice: 'recover-later' };
    assert.equal(replayAgentsRecord(core, [...previous, later]), 1);
    assert.deepEqual(core.topicHistory(AGENTS.id).messages.map(message => message.id), ['recover-later']);
    assert.equal(replayAgentsRecord(core, [...previous, later]), 0, 'later notice recovers once');
  });
}
