// T1: credential hashing and atomic registration through the public Users seam.
import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { Users } from '../src/hub/users.ts';
import { hashPassword, verifyPassword } from '../src/hub/passwords.ts';

test('scrypt records have independent salts and verify only the supplied password', async () => {
  const password = 'a private long password';
  const first = await hashPassword(password), second = await hashPassword(password);
  assert.notEqual(first, second);
  assert.equal(await verifyPassword(password, first), true);
  assert.equal(await verifyPassword('another long password', first), false);
  assert.equal(await verifyPassword(password, 'invalid'), false);
  await assert.rejects(hashPassword('short'), /12 characters/);
});

test('credential commit rolls back invite and activation when session issuance fails; expired invites stay refused', () => {
  const db = new DatabaseSync(':memory:');
  try {
    const users = new Users(db); users.setMode('users', 0);
    const user = users.add('alex', 'Alex', [], 0), token = users.mintInvite(user.id, 0);
    assert.throws(() => users.registerPassword(token, 'test-hash', 1, () => { throw new Error('storage fault'); }), /storage fault/);
    assert.equal(users.checkInvite(token, 1).state, 'invited'); assert.equal(users.password(user.id), null);
    assert.throws(() => users.registerPassword(token, 'test-hash', 86400000, () => {}), /expired invite/);
    assert.equal(users.password(user.id), null);
    users.registerPassword(token, 'test-hash', 1, () => {});
    assert.equal(users.get(user.id)!.state, 'active'); assert.equal(users.password(user.id), 'test-hash');
    assert.throws(() => users.checkInvite(token, 2), /used invite/);
  } finally { db.close(); }
});
