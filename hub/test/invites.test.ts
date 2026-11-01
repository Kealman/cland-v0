// T1: durable invite consumption through the public Users Store API; no processes.
import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { Users } from '../src/hub/users.ts';

test('invite storage contains only digest and expiry, surviving a new Users owner', t => {
  const db = new DatabaseSync(':memory:');
  t.after(() => db.close());
  const users = new Users(db);
  const user = users.add('alex', 'Alex', [], 100);
  const token = users.mintInvite(user.id, 100);
  const row = db.prepare('select * from user_invites').get()!;
  assert.equal(row.digest, createHash('sha256').update(token).digest('hex'));
  assert.equal(row.expires, 86400100);
  assert.equal(JSON.stringify(row).includes(token), false);
  const reopened = new Users(db);
  assert.equal(reopened.consumeInvite(token, 86400099).id, user.id);
  assert.throws(() => reopened.consumeInvite(token, 86400099), /used invite/);
  assert.throws(() => reopened.consumeInvite('unknown', 100), /unknown invite/);
  const expired = users.mintInvite(user.id, 100);
  assert.throws(() => reopened.consumeInvite(expired, 86400100), /expired invite/);
});

test('replacement and reset revoke every open invite', t => {
  const db = new DatabaseSync(':memory:'); t.after(() => db.close());
  const users = new Users(db);
  const first = users.firstAdmin('Jane Doe', [], 1);
  users.setMode('users', 1);
  const old = users.mintInvite(first.id, 1);
  const next = users.mintInvite(first.id, 2);
  assert.throws(() => users.consumeInvite(old, 3), /revoked invite/);
  const second = users.add('alex', 'Alex', [], 3);
  const other = users.mintInvite(second.id, 3);
  users.reset(4);
  for (const token of [next, other]) assert.throws(() => users.consumeInvite(token, 5), /revoked invite/);
});

test('names reject reserved words, roles, sessions, duplicates and non-slugs with the rule', t => {
  const db = new DatabaseSync(':memory:'); t.after(() => db.close());
  const users = new Users(db);
  for (const [name, rule] of [['Jane', /lowercase slug/], ['a--b', /lowercase slug/], ['human', /reserved/], ['hub', /reserved/], ['all', /reserved/], ['admin', /role/], ['reviewer', /role/], ['worker', /session/]] as const) {
    assert.throws(() => users.add(name, name, ['reviewer', 'worker'], 1), rule);
  }
  users.add('alex', 'Alex', [], 1);
  assert.throws(() => users.add('alex', 'Alex', [], 1), /unique/);
});

test('invite frames retain explicit local authority and validate their fields', async () => {
  const { WEB_AUTHORITY } = await import('../src/hub/web-authority.ts');
  const { GATEWAY_AUTHORITY } = await import('../src/remote/authority.ts');
  const { isClientRequest } = await import('../src/protocol.ts');
  for (const type of ['user.add', 'user.invite'] as const) {
    assert.equal(typeof WEB_AUTHORITY[type], 'string');
    assert.equal(Object.hasOwn(GATEWAY_AUTHORITY, type), false);
    assert.equal(isClientRequest({ type, id: 'x', name: 'alex' }), true);
    assert.equal(isClientRequest({ type, id: 'x', name: 1 }), false);
  }
  assert.equal(isClientRequest({ type: 'user.add', id: 'x', name: 'alex', displayName: 1 }), false);
});
