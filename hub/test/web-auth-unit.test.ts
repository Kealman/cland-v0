// T1: token storage and expiry under an injected clock; no sockets or real time.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { WebAuth } from '../src/hub/web-auth.ts';

test('links retain only a SHA-256 digest, spend once, and expire at five minutes', () => {
  let now = 0;
  const links = new Map<string, number>();
  const auth = new WebAuth('/fixture/project', () => now, links);
  const token = auth.mint();
  assert.equal(Buffer.from(token, 'hex').length, 32);
  assert.deepEqual([...links], [[createHash('sha256').update(token).digest('hex'), 300_000]]);
  assert.ok(!links.has(token));
  now = 299_999;
  assert.ok(auth.redeem(token));
  assert.equal(auth.redeem(token), null);
  const expired = auth.mint();
  now += 300_000;
  assert.equal(auth.redeem(expired), null);
  assert.equal(auth.redeem('unknown'), null);
  assert.equal(links.size, 0);
});

test('cookie sessions last thirty days and use a project-specific name', () => {
  let now = 0;
  const auth = new WebAuth('/fixture/project', () => now);
  assert.equal(auth.cookieName, 'cland_4c92ce3babb5');
  const cookie = auth.redeem(auth.mint())!;
  assert.equal(auth.accepts(`${auth.cookieName}=${cookie}`), true);
  assert.equal(auth.accepts(`other=${cookie}`), false);
  assert.equal(auth.accepts(`${auth.cookieName}=unknown`), false);
  assert.equal(auth.accepts(`${auth.cookieName}=${cookie}; ${auth.cookieName}=unknown`), false);
  now = 30 * 24 * 60 * 60 * 1000 - 1;
  assert.equal(auth.accepts(`${auth.cookieName}=${cookie}`), true);
  now++;
  assert.equal(auth.accepts(`${auth.cookieName}=${cookie}`), false);
});
