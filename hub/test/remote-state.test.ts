// T1: remote persistence on the hub's SQLite handle, no transport or process.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DatabaseSync } from 'node:sqlite';
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


test('pre-outbox hub.db rows retain their previous shape while edit targets migrate additively', async t => {
  const root = await tempProject(t);
  const path = join(root, 'hub.db');
  const legacy = new DatabaseSync(path);
  try {
    legacy.exec(`create table remote_outbox (
      messenger text not null, id text not null, kind text not null, source text,
      state text not null, payload text not null, created text not null, updated text not null,
      primary key (messenger, id)
    ); insert into remote_outbox values ('telegram', 'legacy', 'general', 'm1', 'queued', '{"text":"legacy"}', 'then', 'then');`);
  } finally { legacy.close(); }
  const db = new Store(path);
  const old = { id: 'legacy', kind: 'general', source: 'm1', state: 'queued', payload: { text: 'legacy' }, created: 'then', updated: 'then' };
  try {
    const remote = db.remotes.forMessenger('telegram');
    assert.deepEqual(remote.outbox(), [old], 'old readers see no synthetic optional field');
    remote.putOutbox({ ...old, id: 'edit', kind: 'edit', target: '9007199254740993' });
  } finally { db.close(); }
  const reopened = new Store(path);
  try {
    assert.deepEqual(reopened.remotes.forMessenger('telegram').outbox(), [old, { ...old, id: 'edit', kind: 'edit', target: '9007199254740993' }]);
  } finally { reopened.close(); }
});

test('a failed completion rolls back the job, attempt outcome and platform receipt together', async t => {
  const root = await tempProject(t);
  const db = new Store(join(root, 'hub.db'));
  try {
    const remote = db.remotes.forMessenger('telegram');
    const job = { id: 'job', kind: 'card', source: 'ask', state: 'sending', payload: { text: 'Choose' }, created: 'then', updated: 'then' };
    const attempt = { id: 'attempt', job: 'job', at: 'then', outcome: null };
    remote.writeOutbox(job, attempt);
    const message = { chatId: 'chat', messageId: '9007199254740993', topic: 'general', message: null, ask: 'ask', approval: null };
    assert.throws(() => remote.writeOutbox({ ...job, state: 'sent' }, { ...attempt, outcome: 'sent' }, { ...message, chatId: null as unknown as string }), /NOT NULL/);
    assert.deepEqual(remote.outbox(), [job]);
    assert.deepEqual(remote.attempts('job'), [attempt]);
    assert.equal(remote.message('chat', message.messageId), null);
    remote.writeOutbox({ ...job, state: 'sent' }, { ...attempt, outcome: 'sent' }, message);
    assert.equal(remote.outbox()[0]?.state, 'sent');
    assert.deepEqual(remote.message('chat', message.messageId), message);
  } finally { db.close(); }
});
