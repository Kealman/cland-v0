// T1: newest-wins account storage, parsing and reopening; no transport or real time.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Store } from '../src/hub/store.ts';
import { AccountLimits, AccountLimited, claudeWindows, codexWindows, fullWindowReset, mergeLimits, type AccountReading } from '../src/accounts/limits.ts';
import { HubCore } from '../src/hub/core.ts';
import { FakeClock } from './fake-clock.ts';
const registry = { registry: '/scratch/accounts.toml', accounts: [{ name: 'oc', harness: 'opencode', path: null, variable: 'XDG_DATA_HOME' }, { name: 'unread', harness: 'codex', path: null, variable: 'CODEX_HOME' }] };
const at = Date.parse('2026-10-16T12:00:00Z');
const reading = (percent: number, offset: number, session: string): AccountReading => ({ account: 'default:claude-code', harness: 'claude-code', windows: claudeWindows([{ kind: 'five_hour', percentUsed: percent, resetsAt: '2026-10-15T04:03:00Z' }]), at: new Date(at + offset).toISOString(), source: { kind: 'session', session } });

test('full windows expire at the injected clock boundary far from wall time', async () => {
  for (const year of [2000, 2099]) {
    const clock = new FakeClock(new Date(`${year}-01-01T00:00:00Z`));
    const reset = `${year}-01-01T00:00:01.000Z`;
    const windows = [{ id: 'primary', label: '5h', usedPercent: 100, resetsAt: reset }];
    assert.equal(fullWindowReset(windows, clock), reset, 'full window is live before its reset');
    await clock.advance(1000);
    assert.equal(fullWindowReset(windows, clock), null, 'full window expires exactly at its reset');
  }
});

for (const source of ['cached hit', 'updated reading'] as const) test(`account reset scheduler uses the ${source}'s clock`, async () => {
  for (const year of [2000, 2099]) {
    const clock = new FakeClock(new Date(`${year}-01-01T00:00:00Z`));
    const store = new Store();
    const core = new HubCore({ clock, store, env: { XDG_CONFIG_HOME: '/nonexistent/T-726' } });
    const reset = `${year}-01-01T00:00:01.000Z`;
    const reading: AccountReading = { account: 'cx', harness: 'codex', windows: [{ id: 'primary', label: '5h', usedPercent: 100, resetsAt: reset }], at: clock.now().toISOString(), source: { kind: 'poll' } };
    try {
      if (source === 'cached hit') {
        await core.publishAccountLimits(reading);
        core.limitAccount('cx', 'codex', 'live', { reason: 'usageLimitExceeded' });
      } else {
        core.limitAccount('cx', 'codex', 'live', { reason: 'usageLimitExceeded' });
        await core.publishAccountLimits(reading);
      }
      assert.equal(core.accountLimits.limited('cx')?.resetsAt, reset);
      await clock.advance(999);
      assert.throws(() => core.checkAccountLimit('cx'), AccountLimited, 'launch stays blocked before reset');
      await clock.advance(1);
      // Inspect before checkAccountLimit: the scheduled reset itself must clear the mark.
      assert.equal(core.accountLimits.limited('cx'), undefined, 'scheduler clears at the window reset');
      assert.doesNotThrow(() => core.checkAccountLimit('cx'));
    } finally { core.close(); store.close(); }
  }
});
test('account protocol keeps newest readings and reopens equal-window age silently', async t => {
  const root = await mkdtemp(join(tmpdir(), 'account-limits-'));
  const path = join(root, 'hub.db');
  let store = new Store(path);
  t.after(async () => { store.close(); await rm(root, { recursive: true, force: true }); });
  const state = { read: (key: string) => store.meta(key), write: (key: string, value: string) => store.setMeta(key, value) };
  const limits = new AccountLimits(state);
  assert.deepEqual(limits.list(registry).accounts.map(a => [a.name, a.windows, a.at, a.source]), [['oc', [], null, null], ['unread', [], null, null]]);
  assert.equal(limits.update(reading(7, 0, 'first')), true);
  assert.equal(limits.update(reading(21, 2000, 'second')), true);
  assert.equal(limits.update(reading(8, 1000, 'first')), false, 'late older reading loses');
  const account = limits.list(registry).accounts.find(a => a.name === 'default:claude-code')!;
  assert.equal(account.windows[0]?.usedPercent, 21);
  assert.equal(account.windows[0]?.label, '5h');
  assert.equal(account.at, new Date(at + 2000).toISOString());
  assert.deepEqual(account.source, { kind: 'session', session: 'second' });
  assert.equal(limits.update(reading(21, 3000, 'second')), false, 'equal windows refresh age without publication');
  const before = limits.list(registry);
  assert.equal(before.accounts[0]?.at, new Date(at + 3000).toISOString());
  store.close();
  store = new Store(path);
  assert.deepEqual(new AccountLimits(state).list(registry), before);
});
test('Codex sparse windows retain omitted values while full readings remove omitted buckets', () => {
  const primary = { usedPercent: 19, windowDurationMins: 10080, resetsAt: 1792123380 };
  const previous = { limitId: 'review', limitName: 'Code review', primary, secondary: null };
  const sparse = mergeLimits(previous, { primary: { usedPercent: 27 } });
  const expected = [{ id: 'review:primary', label: 'Code review', scope: 'Code review', usedPercent: 27, resetsAt: '2026-10-16T04:03:00.000Z', windowMins: 10080 }];
  for (const map of [undefined, { review: sparse }]) assert.deepEqual(codexWindows(sparse, map), expected);
  assert.deepEqual(codexWindows(mergeLimits(sparse, { primary: null }), undefined), []);
  assert.deepEqual(codexWindows({ primary: { usedPercent: 22, windowDurationMins: 10080, resetsAt: 1792123380 }, secondary: { usedPercent: 31, windowDurationMins: 2880, resetsAt: 1792036980, severity: 'warning' } }, undefined).map(w => [w.label, w.usedPercent, w.windowMins, w.severity]), [['wk', 22, 10080, undefined], ['2d', 31, 2880, 'warning']]);
});
