// T1: trusted persisted metadata projection and the previous ordinary card shape.
import test from 'node:test';
import assert from 'node:assert/strict';
import { cardOf, type AskRow } from '../src/hub/store.ts';

test('sign-in card projection exposes only the persisted hub login identity', () => {
  const row: AskRow = { id: 'card', topic: 'general', from: 'hub', ts: '2026-11-12T00:00:00Z', question: 'Sign in work', options: [], free: true, state: 'open' };
  const previous = { question: 'Sign in work', options: [], free: true, state: 'open' };
  assert.deepEqual(cardOf(row), previous, 'previous ordinary card shape is unchanged');
  assert.deepEqual(cardOf({ ...row, hubKind: 'login-signin-code', payload: { login: 'work', admission: 'NATIVE-ONLY', url: 'https://example.test/signin' } }), { ...previous, signInLogin: 'work' });
  for (const candidate of [
    { ...row, from: 'worker', hubKind: 'login-signin-code', payload: { login: 'spoof' } },
    { ...row, hubKind: 'other', payload: { login: 'spoof' } },
    { ...row, hubKind: 'login-signin-code', payload: { login: 12 } },
    { ...row, hubKind: 'login-signin-code', payload: null },
    { ...row, hubKind: 'login-signin-code', payload: { login: '' } },
    { ...row, signInLogin: 'caller-supplied' },
  ]) assert.deepEqual(cardOf(candidate), previous);
});
