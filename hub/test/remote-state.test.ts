// T1: remote persistence on the hub's SQLite handle, no transport or process.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { join } from 'node:path';
import { Store } from '../src/hub/store.ts';
import { tempProject } from './harness.ts';

test('remote pairing and cursors survive reopening hub.db without rounding Discord ids', async t => {
  const root = await tempProject(t);
  const path = join(root, 'hub.db');
  const first = new Store(path);
  try {
    const remote = first.remotes.forMessenger('discord');
    remote.setPairing({ userId: '9007199254740993', chatId: '1234567890123456789', guildId: '987654321098765432', name: 'Fixture human' });
    remote.set('lastMessageId', '1234567890123456791');
    remote.set('resume', JSON.stringify({ session: 'fixture-session', sequence: 42 }));
    remote.set('identifyCount', '3');
    remote.setStatus({ disabled: true, reason: 'fixture remote unavailable' });
    first.remotes.forMessenger('telegram').set('offset', '37');
  } finally { first.close(); }
  const reopened = new Store(path);
  try {
    const remote = reopened.remotes.forMessenger('discord');
    assert.deepEqual(remote.pairing(), { userId: '9007199254740993', chatId: '1234567890123456789', guildId: '987654321098765432', name: 'Fixture human' });
    assert.equal(remote.get('lastMessageId'), '1234567890123456791');
    assert.equal(remote.get('resume'), '{"session":"fixture-session","sequence":42}');
    assert.equal(remote.get('identifyCount'), '3');
    assert.deepEqual(remote.status(), { disabled: true, reason: 'fixture remote unavailable' });
    assert.equal(reopened.remotes.forMessenger('telegram').get('offset'), '37');
    assert.equal(remote.get('offset'), null, 'one messenger cannot read the other cursor');
  } finally { reopened.close(); }
});

test('waiting codes, stranger counts, message maps and outbox attempts survive a database reopen', async t => {
  const root = await tempProject(t);
  const path = join(root, 'hub.db');
  const first = new Store(path);
  try {
    const remote = first.remotes.forMessenger('discord');
    remote.putRequest({ code: 'fixture-code', userId: '9007199254740993', chatId: '1234567890123456789', guildId: '987654321098765432', name: 'Stranger', created: '2026-10-26T10:00:00Z', expires: '2026-10-26T10:05:00Z' });
    assert.equal(remote.countReply('9007199254740993'), 1);
    assert.equal(remote.countReply('9007199254740993'), 2);
    remote.putMessage({ chatId: '1234567890123456789', messageId: '1234567890123456791', topic: 'general', message: 'hub-message', ask: 'hub-ask', approval: null });
    remote.putOutbox({ id: 'job-1', kind: 'card', source: 'hub-ask', state: 'queued', payload: { text: 'Fixture card' }, created: '2026-10-26T10:00:00Z', updated: '2026-10-26T10:00:00Z' });
    remote.putAttempt({ id: 'attempt-1', job: 'job-1', at: '2026-10-26T10:00:01Z', outcome: null });
  } finally { first.close(); }
  const reopened = new Store(path);
  try {
    const remote = reopened.remotes.forMessenger('discord');
    assert.deepEqual(remote.requests(), [{ code: 'fixture-code', userId: '9007199254740993', chatId: '1234567890123456789', guildId: '987654321098765432', name: 'Stranger', created: '2026-10-26T10:00:00Z', expires: '2026-10-26T10:05:00Z' }]);
    assert.equal(remote.replies('9007199254740993'), 2);
    assert.deepEqual(remote.message('1234567890123456789', '1234567890123456791'), { chatId: '1234567890123456789', messageId: '1234567890123456791', topic: 'general', message: 'hub-message', ask: 'hub-ask', approval: null });
    assert.deepEqual(remote.outbox(), [{ id: 'job-1', kind: 'card', source: 'hub-ask', state: 'queued', payload: { text: 'Fixture card' }, created: '2026-10-26T10:00:00Z', updated: '2026-10-26T10:00:00Z' }]);
    assert.deepEqual(remote.attempts('job-1'), [{ id: 'attempt-1', job: 'job-1', at: '2026-10-26T10:00:01Z', outcome: null }]);
    const other = reopened.remotes.forMessenger('telegram');
    assert.deepEqual(other.requests(), []);
    assert.equal(other.replies('9007199254740993'), 0);
    assert.equal(other.message('1234567890123456789', '1234567890123456791'), null);
    assert.deepEqual(other.outbox(), []);
    assert.deepEqual(other.attempts('job-1'), []);
  } finally { reopened.close(); }
});
