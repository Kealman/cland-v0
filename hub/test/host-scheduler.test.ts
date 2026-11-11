import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decidePlacement, harnessWeightMilli, type PlacementHost, type PlacementInput } from '../src/host/scheduler.ts';

const host = (id: string, usedMilli = 0, state: PlacementHost['state'] = 'ready'): PlacementHost =>
  ({ id, state, usedMilli, promisedMilli: 0, slots: 8 });
const decide = (hosts: readonly PlacementHost[], harness = 'claude-code', extra: Partial<PlacementInput> = {}) =>
  decidePlacement({ hosts, harness, pool: { min_hosts: 0, max_hosts: 1, spread: false }, ...extra });

test('default weights fill eight slots with Claude Code or mixed Codex sessions', () => {
  const claude = harnessWeightMilli('claude-code');
  const codex = harnessWeightMilli('codex');
  const opencode = harnessWeightMilli('opencode');
  assert.deepEqual([claude, codex, opencode], [1000, 500, 750]);
  assert.equal(7 * claude + 2 * codex, 8000);
  assert.deepEqual(decide([host('a', 7000)]), { kind: 'place', host: 'a' });
  assert.deepEqual(decide([host('a', 8 * claude)]), { kind: 'wait', reason: 'waiting for a host' });
  assert.deepEqual(decide([host('a', 7500)], 'codex'), { kind: 'place', host: 'a' });
  assert.deepEqual(decide([host('a', 7 * claude + 2 * codex)], 'codex'), { kind: 'wait', reason: 'waiting for a host' });
  assert.deepEqual(decide([host('a', 7 * claude + codex)], 'opencode'), { kind: 'wait', reason: 'waiting for a host' });
  assert.deepEqual(decide([host('a', 7250)], 'opencode'), { kind: 'place', host: 'a' });
});

test('dense packing chooses fullest eligible host and spread chooses emptiest', () => {
  const hosts = [host('empty'), host('full', 8000), host('middle', 4000), host('dense', 7000)];
  assert.deepEqual(decide(hosts), { kind: 'place', host: 'dense' });
  assert.deepEqual(decide(hosts, 'claude-code', { pool: { min_hosts: 0, max_hosts: 4, spread: true } }),
    { kind: 'place', host: 'empty' });
  assert.deepEqual(hosts.map(h => h.id), ['empty', 'full', 'middle', 'dense']);
});

test('weight overrides change placement and leave unspecified defaults intact', () => {
  assert.deepEqual(decide([host('a', 7000)], 'claude-code', { weights: { 'claude-code': 2 } }),
    { kind: 'wait', reason: 'waiting for a host' });
  assert.deepEqual(decide([host('a', 7500)], 'codex', { weights: { 'claude-code': 2 } }),
    { kind: 'place', host: 'a' });
  assert.deepEqual(decide([host('a', 7000)], 'custom', { weights: { custom: 1 } }),
    { kind: 'place', host: 'a' });
  for (const weight of [0, -1, NaN, Infinity]) {
    assert.throws(() => decide([], 'codex', { weights: { codex: weight } }), /positive finite host weight/);
  }
  assert.throws(() => decide([], 'unknown'), /positive finite host weight/);
});

test('non-serving hosts are skipped for each verdict and default serves every harness', () => {
  for (const blocked of ['signed-out', 'no-login'] as const) {
    const seen: string[] = [];
    assert.deepEqual(decide([host('blocked', 7000), host('eligible')], 'codex', {
      verdict: (h, harness) => { seen.push(harness); return h.id === 'blocked' ? blocked : 'serves'; },
    }), { kind: 'place', host: 'eligible' });
    assert.deepEqual(seen, ['codex', 'codex']);
    assert.deepEqual(decide([host('blocked')], 'codex', { verdict: () => blocked }),
      { kind: 'wait', reason: 'waiting for a host' });
  }
  for (const harness of ['claude-code', 'codex', 'opencode']) {
    assert.deepEqual(decide([host('a')], harness), { kind: 'place', host: 'a' });
  }
});

test('no room creates below the limit but promises booting room before another create', () => {
  const pool = { min_hosts: 0, max_hosts: 2, spread: false };
  assert.deepEqual(decide([], 'claude-code', { pool }), { kind: 'create' });
  assert.deepEqual(decide([host('full', 8000)], 'claude-code', { pool }), { kind: 'create' });
  assert.deepEqual(decide([host('boot', 7000, 'booting')], 'claude-code', { pool }),
    { kind: 'wait', host: 'boot', reason: 'waiting for host boot to boot' });
  assert.deepEqual(decide([host('full', 8000), host('boot', 8000, 'booting')], 'claude-code', { pool }),
    { kind: 'wait', reason: 'waiting for a host' });
});

test('reservations, unavailable hosts and verdicts preserve the boot and maximum fences', () => {
  const pool = { min_hosts: 1, max_hosts: 2, spread: false };
  assert.deepEqual(decide([host('down', 0, 'unavailable'), host('full', 8000)], 'codex', { pool }), { kind: 'create' });
  assert.deepEqual(decide([host('a', 8000, 'booting'), host('b', 8000, 'booting')], 'codex', { pool }),
    { kind: 'wait', reason: 'waiting for a host' });
  assert.deepEqual(decide([host('boot', 7500, 'booting')], 'codex', { pool }),
    { kind: 'wait', host: 'boot', reason: 'waiting for host boot to boot' });
  assert.deepEqual(decide([host('boot', 8000, 'booting')], 'codex', { pool }), { kind: 'create' });
  assert.deepEqual(decide([host('boot', 0, 'booting')], 'codex', { pool, verdict: () => 'no-login' }),
    { kind: 'create' });
  assert.deepEqual(decide([host('boot', 0, 'booting'), host('ready')], 'codex', { pool }),
    { kind: 'place', host: 'ready' });
  assert.deepEqual(decide([], 'codex', { pool: { ...pool, min_hosts: 0, max_hosts: 0 } }),
    { kind: 'wait', reason: 'waiting for a host' });
});

test('fractional overrides convert once to milli-slots and reject one milli excess', () => {
  const weights = { codex: 0.1 };
  for (const state of ['ready', 'booting'] as const) {
    const exact = state === 'ready' ? { kind: 'place', host: 'h' }
      : { kind: 'wait', host: 'h', reason: 'waiting for host h to boot' };
    assert.deepEqual(decide([host('h', 7900, state)], 'codex', { weights }), exact);
    assert.deepEqual(decide([host('h', 7901, state)], 'codex', { weights }),
      { kind: 'wait', reason: 'waiting for a host' });
  }
  assert.equal(harnessWeightMilli('codex', { codex: 0.1004 }), 100);
  assert.equal(harnessWeightMilli('codex', { codex: 0.1006 }), 101);
  assert.equal(harnessWeightMilli('codex', { codex: Number.MIN_VALUE }), 0);
});

test('accumulated fractional weights fill eight slots exactly', () => {
  let usedMilli = 0;
  for (let count = 0; count < 39; count++) usedMilli += harnessWeightMilli('codex', { codex: 0.2 });
  assert.equal(usedMilli, 7800);
  for (const state of ['ready', 'booting'] as const) {
    assert.deepEqual(decide([host('h', usedMilli, state)], 'codex', { weights: { codex: 0.2 } }),
      state === 'ready' ? { kind: 'place', host: 'h' }
        : { kind: 'wait', host: 'h', reason: 'waiting for host h to boot' });
    assert.deepEqual(decide([host('h', usedMilli + 200, state)], 'codex', { weights: { codex: 0.2 } }),
      { kind: 'wait', reason: 'waiting for a host' });
  }
});

test('used and promised milli-slots share capacity and affect dense packing', () => {
  const boot = { ...host('boot', 4000, 'booting'), promisedMilli: 3800 };
  const weights = { codex: 0.2 };
  assert.deepEqual(decide([boot], 'codex', { weights }),
    { kind: 'wait', host: 'boot', reason: 'waiting for host boot to boot' });
  assert.deepEqual(decide([{ ...boot, promisedMilli: 3801 }], 'codex', { weights }),
    { kind: 'wait', reason: 'waiting for a host' });
  assert.deepEqual(decide([boot, host('ready', 7800)], 'codex', { weights }), { kind: 'place', host: 'ready' });
  assert.deepEqual(decide([host('running', 4000), { ...host('reserved', 1000), promisedMilli: 6000 }]),
    { kind: 'place', host: 'reserved' });
  for (const invalid of [-1, 0.5, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => decide([{ ...boot, usedMilli: invalid }]), /safe integer milli-slots/);
    assert.throws(() => decide([{ ...boot, promisedMilli: invalid }]), /safe integer milli-slots/);
  }
});


test('healthy binding precedes can-bind and bindable room precedes creation', () => {
 const verdict: NonNullable<PlacementInput['verdict']> = h => h.id === 'bound' ? 'serves' : 'can-bind';
 assert.deepEqual(decide([host('free',7000),host('bound')], 'codex', {verdict}), {kind:'place',host:'bound'});
 assert.deepEqual(decide([host('free')], 'codex', {verdict}), {kind:'place',host:'free'});
 assert.deepEqual(decide([host('free',0,'booting')], 'codex', {verdict}), {kind:'wait',host:'free',reason:'waiting for host free to boot'});
});
