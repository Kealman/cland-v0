import { test } from 'node:test';
import assert from 'node:assert/strict';
import { globMatcher, parseTags, resolveTag } from './address.ts';

test('parseTags finds tags anywhere, once each, as tokens rather than mentions, and drops a sentence-final dot', () => {
  assert.deepEqual(parseTags('@alpha is the machine free? (@beta), @rate-* and @gamma.2.'), ['alpha', 'beta', 'rate-*', 'gamma.2']);
  assert.deepEqual(parseTags('mail me@example.com and @alpha @alpha'), ['alpha'], 'an address is not a tag; a repeat is one tag');
  assert.deepEqual(parseTags('nothing here'), []);
  assert.deepEqual(parseTags('@all'), ['all']);
});

test('globs match over the name charset only', () => {
  assert.equal(globMatcher('rate-*')('rate-cache'), true);
  assert.equal(globMatcher('rate-*')('rate'), false);
  assert.equal(globMatcher('*')('anything-9'), true);
  assert.equal(globMatcher('a*z')('abc'), false);
});

test('resolveTag classifies against the connected, the known-offline and the roles', () => {
  const ctx = {
    connected: ['alpha', 'rate-cache'],
    known: ['alpha', 'rate-cache', 'beta'],
    roles: new Map<string, string[]>([
      ['reviewer', ['beta']],
      ['qa', []],
    ]),
  };
  assert.deepEqual(resolveTag('@alpha', ctx), { kind: 'session', name: 'alpha', online: true });
  assert.deepEqual(resolveTag('beta', ctx), { kind: 'session', name: 'beta', online: false });
  assert.deepEqual(resolveTag('all', ctx), { kind: 'all' });
  assert.deepEqual(resolveTag('ALL', ctx), { kind: 'all' });
  assert.deepEqual(resolveTag('*', ctx), { kind: 'all' });
  assert.deepEqual(resolveTag('rate-*', ctx), { kind: 'glob', glob: 'rate-*', names: ['rate-cache'] });
  assert.deepEqual(resolveTag('@reviewer', ctx), { kind: 'role', role: 'reviewer', names: ['beta'] });
  assert.deepEqual(resolveTag('qa', ctx), { kind: 'role', role: 'qa', names: [] }, 'an unheld role is still a role, not unknown');
  assert.deepEqual(resolveTag('ghost', ctx), { kind: 'unknown', tag: 'ghost' });
});
