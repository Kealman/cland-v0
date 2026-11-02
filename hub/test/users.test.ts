// T1: durable users and authorized sign-in mode through Store's public API.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Store } from '../src/hub/store.ts';

test('the first admin is unique and reset retains attribution rows', t => {
  const store = new Store();
  t.after(() => store.close());
  assert.deepEqual(store.users.roles(), ['admin']);
  assert.throws(() => store.users.validateMode('users'), /cland auth mode users/);
  const user = store.users.firstAdmin('Jane Doe', [], 123);
  assert.equal(user.name, 'jane-doe');
  assert.equal(user.displayName, 'Jane Doe');
  assert.equal(user.role, 'admin');
  assert.equal(user.state, 'active');
  store.users.setMode('users', 124);
  assert.equal(store.users.firstAdmin('Other Name', [], 125).id, user.id);
  assert.throws(() => store.users.validateMode('single'), /cland auth reset/);
  store.users.setMode('single', 126);
  store.users.validateMode('single');
  assert.throws(() => store.users.validateMode('users'), /cland auth mode users/);
  assert.deepEqual(store.users.list(), [user]);
});

test('first user rejects reserved and colliding names without creating a user', t => {
  const store = new Store();
  t.after(() => store.close());
  for (const name of ['Human', 'Hub', 'All', 'Coordinator', 'Lead', 'Reviewer']) {
    assert.throws(() => store.users.firstAdmin(name, ['reviewer'], 1), /reserved|collision/);
    assert.deepEqual(store.users.list(), []);
  }
});

test('reset joins registered durable revokers in one transaction', t => {
  const store = new Store();
  t.after(() => store.close());
  store.users.firstAdmin('Jane Doe', [], 1);
  store.users.setMode('users', 2);
  const receipts: string[] = [];
  store.users.onReset(() => { receipts.push('invites'); });
  store.users.onReset(() => { receipts.push('pairings'); });
  store.users.reset(3);
  assert.deepEqual(receipts, ['invites', 'pairings']);
  store.users.validateMode('single');
  store.users.setMode('users', 4);
  store.users.onReset(() => { throw new Error('held revoker'); });
  assert.throws(() => store.users.reset(5), /held revoker/);
  assert.throws(() => store.users.validateMode('single'), /cland auth reset/);
});

test('auth changes stay local while user listing admits web authority and all stay absent from gateway', async () => {
  const { WEB_AUTHORITY } = await import('../src/hub/web-authority.ts');
  const { GATEWAY_AUTHORITY } = await import('../src/remote/authority.ts');
  const { isClientRequest } = await import('../src/protocol.ts');
  for (const type of ['auth.mode', 'auth.reset', 'user.list'] as const) {
    if (type === 'user.list') assert.equal(WEB_AUTHORITY[type], true);
    else assert.equal(typeof WEB_AUTHORITY[type], 'string');
    assert.equal(Object.hasOwn(GATEWAY_AUTHORITY, type), false);
    assert.equal(isClientRequest({ type, id: 'x', ...(type === 'auth.mode' ? { mode: 'users' } : {}) }), true);
  }
});
