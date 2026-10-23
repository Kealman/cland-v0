// T1: source-shaped account projection, with no hub or browser.
import test from 'node:test';
import assert from 'node:assert/strict';
import type { AccountView } from '../../shared/wire/index.ts';
import { accountModel, accountModels, resetTime } from '../../web/src/accounts/model.ts';

const now = new Date(2026, 9, 23, 12, 0).getTime();
const reset = new Date(2026, 9, 23, 15, 10).toISOString();
const account: AccountView = {
  name: 'fake-main', harness: 'claude-code', path: '/scratch/fake-main', variable: 'CLAUDE_CONFIG_DIR',
  at: new Date(now - 120_000).toISOString(), source: { kind: 'session', session: 'fake-worker' },
  windows: [
    { id: '5h', label: '5h', usedPercent: 38, resetsAt: reset },
    { id: 'week', label: 'wk', usedPercent: 81, resetsAt: reset },
  ],
};

test('account projection preserves every window and selects the highest share with source severity', () => {
  const model = accountModel(account, now);
  assert.deepEqual(model.windows.map(w => [w.label, w.share, w.reset, w.tone]), [
    ['5h', '38%', '15:10', 'normal'], ['wk', '81%', '15:10', 'warning'],
  ]);
  assert.equal(model.worst?.id, 'week');
  assert.equal(model.share, '81%');
  assert.equal(model.age, '2m');
  assert.equal(model.source, 'from fake-worker');
  for (const [usedPercent, severity, tone] of [
    [74, undefined, 'normal'], [75, undefined, 'warning'], [89, undefined, 'warning'],
    [90, undefined, 'critical'], [20, 'critical', 'critical'], [95, 'warning', 'warning'],
    [95, 'normal', 'normal'],
  ] as const) {
    assert.equal(accountModel({ ...account, windows: [{ id: 'one', label: 'one', usedPercent, resetsAt: reset, ...(severity ? { severity } : {}) }] }, now).worst?.tone, tone);
  }
});

test('missing readings stay a dash and limited marks retain reset, reason, since and session', () => {
  for (const override of [{ at: null }, { signedOut: true }, { harness: 'opencode' }, { windows: [] }]) {
    const model = accountModel({ ...account, ...override }, now);
    assert.equal(model.share, '—');
    assert.equal(model.worst, undefined);
    assert.deepEqual(model.windows, []);
  }
  assert.equal(accountModel({ ...account, at: null }, now).status, 'no reading yet');
  assert.equal(accountModel({ ...account, signedOut: true }, now).status, 'signed out');
  assert.equal(accountModel({ ...account, harness: 'opencode' }, now).status, 'no limit data');
  const limited = { since: account.at!, reason: 'quota exceeded', session: 'fake-worker', resetsAt: reset };
  const model = accountModel({ ...account, limited }, now);
  assert.deepEqual(model.limit, { ...limited, sinceTime: '11:58', reset: '15:10' });
  assert.equal(model.tone, 'critical');
  assert.equal(accountModel({ ...account, limited: { ...limited, resetsAt: null } }, now).limit?.reset, 'until cleared');
  assert.equal(accountModel({ ...account, source: { kind: 'poll' } }, now).source, 'poll');
  assert.equal(accountModel({ ...account, at: new Date(now - 86_400_000).toISOString() }, now).age, '1d');
  assert.equal(accountModel({ ...account, at: new Date(now + 1000).toISOString() }, now).age, '<1m');
});

test('account order keeps registry order with synthetic defaults last and resets follow local calendar', () => {
  const rows = accountModels([
    { ...account, name: 'default:codex' }, { ...account, name: 'z-first' },
    { ...account, name: 'a-second' }, { ...account, name: 'default:claude-code' },
  ], now);
  assert.deepEqual(rows.map(row => row.name), ['z-first', 'a-second', 'default:codex', 'default:claude-code']);
  assert.equal(resetTime(new Date(2026, 9, 24, 9).toISOString(), now), 'Sat 09:00');
  assert.equal(resetTime(new Date(2026, 10, 10, 9).toISOString(), now), '2026-11-10');
  assert.equal(resetTime('bad timestamp', now), '--:--');
});
