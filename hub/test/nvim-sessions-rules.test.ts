// T2: verifier work and source-shaped account events with injected hub adapters and clock.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { connectUi, eventually, inProcessSpoke, projectHub, tempProject } from './harness.ts';
import { FakeClock } from './fake-clock.ts';
import { fakeHarness } from './fakes/harness.ts';
import type { AdapterHost } from '../src/adapters/contract.ts';
import type { AccountList, LimitWindow } from '../src/accounts/limits.ts';

test('verifier hold release preserves an independent item claim', async t => {
  const root = await tempProject(t);
  const { discovery } = await projectHub(t, root);
  const ui = await connectUi(t, discovery);
  assert.equal((await ui.request({ size: 'M', type: 'task.create', title: 'Panel holds' })).ok, true);
  const rev = await inProcessSpoke(t, { discover: true, cwd: root, name: 'rev', sessionId: 'rev-id', role: 'reviewer' });
  const qa = await inProcessSpoke(t, { discover: true, cwd: root, name: 'qa-one', sessionId: 'qa-id', role: 'qa' });
  t.after(async () => { await rev.close(); await qa.close(); });
  await rev.waitForPresence(['rev', 'qa-one']);
  for (const session of [rev, qa]) {
    assert.equal((await session.call<{ ok: boolean }>('task.hold', { id: 'T-1' })).ok, true);
    const held = await session.call<{ item: { holds: Array<{ session: string }> } }>('task.view', { id: 'T-1' });
    assert.equal(held.item.holds.length, 1);
    assert.equal((await session.call<{ ok: boolean }>('task.hold', { id: 'T-1', release: true })).ok, true);
    const free = await session.call<{ item: { holds: unknown[] } }>('task.view', { id: 'T-1' });
    assert.deepEqual(free.item.holds, []);
  }
  // A retained claim beside verifier work: the claim is displayed first.
  assert.equal((await ui.request({ size: 'M', type: 'task.create', title: 'Claim beside review', assignee: 'rev' })).ok, true);
  assert.equal((await ui.request({ type: 'role.set', session: 'rev', role: 'implementer' })).ok, true);
  const claim = await rev.call<{ ok: boolean }>('task.claim', { id: 'T-2' });
  assert.equal(claim.ok, true, JSON.stringify(claim));
  assert.equal((await ui.request({ type: 'role.set', session: 'rev', role: 'reviewer' })).ok, true);
  assert.equal((await rev.call<{ ok: boolean }>('task.hold', { id: 'T-1' })).ok, true);
  assert.equal((await rev.call<{ ok: boolean }>('task.hold', { id: 'T-1', release: true })).ok, true);
  const retained = await rev.call<{ item: { claim: { session: string } | null } }>('task.view', { id: 'T-2' });
  assert.equal(retained.item.claim?.session, 'rev');
});

async function accounts(ui: Awaited<ReturnType<typeof connectUi>>) {
  const result = await ui.request({ type: 'account.list' });
  assert.equal(result.ok, true, result.error);
  return (result.value as AccountList).accounts;
}

test('weekly account readings are published through pushes without re-reading the UI snapshot', async t => {
  const root = await tempProject(t);
  const config = join(root, 'config');
  const home = join(root, 'codex-b');
  await mkdir(join(config, 'cland'), { recursive: true });
  await mkdir(home);
  await writeFile(join(config, 'cland/accounts.toml'), `[accounts.codex-b]\nharness = "codex"\nhome = ${JSON.stringify(home)}\n[accounts.oc-b]\nharness = "opencode"\n[accounts.unread]\nharness = "claude-code"\n`);
  const clock = new FakeClock(Date.parse('2026-10-19T12:00:00Z'));
  const reset = '2026-10-19T23:59:00Z';
  const percent = 19;
  const { discovery } = await projectHub(t, root, { XDG_CONFIG_HOME: config, CLAND_TEST_ACCOUNT_POLL_MINIMUM_MS: '1' }, {
    clock,
    accountReader: async a => {
      if (a.name !== 'codex-b') throw new Error('unread');
      return [{ id: 'weekly', label: 'wk', usedPercent: percent, windowMins: 10080, resetsAt: reset }];
    },
    adapters: [(host, clock) => Object.assign(fakeHarness('codex', { host, clock }), {
      interpret: (_event: string, payload: Record<string, unknown>) => ({ rateLimits: { windows: payload.windows as LimitWindow[] } }),
    })],
  });
  const ui = await connectUi(t, discovery);
  await ui.request({ type: 'subscribe' });
  const launched = await ui.request({ type: 'session.launch', name: 'rev-x', role: 'reviewer', harness: 'codex', model: 'gpt-6.1-sol', account: 'codex-b' });
  assert.equal(launched.ok, true, launched.error);
  await eventually('initial reading', async () => (await accounts(ui)).find(a => a.name === 'codex-b')?.windows[0]?.usedPercent === 19 || undefined);
  for (const used of [91, 75]) {
    const process = (launched.value as { process: { sessionId: string } }).process;
    assert.equal((await ui.request({ type: 'session.signal', session: 'rev-x', launch: process.sessionId, event: 'reading', at: clock.now().getTime(), payload: { windows: [{ id: 'weekly', label: 'wk', usedPercent: used, windowMins: 10080, resetsAt: reset }] } })).ok, true);
    await clock.advance(1000);
    const push = await ui.waitFor(f => f.type === 'account' && (f.account as { name: string; windows: LimitWindow[] }).name === 'codex-b' && (f.account as { windows: LimitWindow[] }).windows[0]?.usedPercent === used);
    assert.equal((push.account as { windows: LimitWindow[] }).windows[0]!.usedPercent, used);
  }
});

test('source windows preserve severity and named/default identity through session signals', async t => {
  const root = await tempProject(t);
  const config = join(root, 'config');
  await mkdir(join(config, 'cland'), { recursive: true });
  await writeFile(join(config, 'cland/accounts.toml'), '[accounts.claude-a]\nharness = "claude-code"\n');
  const clock = new FakeClock(Date.parse('2026-10-19T12:00:00Z'));
  const { discovery } = await projectHub(t, root, { XDG_CONFIG_HOME: config }, { clock, accountReader: async () => { throw new Error('unread'); } });
  const ui = await connectUi(t, discovery);
  const launch = async (name: string, account?: string) => {
    const result = await ui.request({ type: 'session.launch', name, harness: 'claude-code', role: 'implementer', account });
    assert.equal(result.ok, true, result.error);
    return (result.value as { process: { sessionId: string } }).process;
  };
  const named = await launch('impl-a', 'claude-a');
  const plain = await launch('impl-default');
  const now = clock.now().getTime();
  const windows = [
    { kind: 'five_hour', percentUsed: 12.4, resetsAt: new Date(now + 60_000).toISOString(), severity: 'warning' },
    { kind: 'seven_day', percentUsed: 3, resetsAt: new Date(now + 86400_000).toISOString(), severity: 'critical' },
    { kind: 'Fable', percentUsed: 98, resetsAt: new Date(now + 14 * 86400_000).toISOString(), severity: 'normal' },
  ];
  for (const [name, process, at] of [['impl-a', named, now - 31 * 60_000], ['impl-default', plain, now]] as const) {
    const result = await ui.request({ type: 'session.signal', session: name, launch: process.sessionId, event: 'mod-measure', at, payload: { rateLimits: windows } });
    assert.equal(result.ok, true, result.error);
  }
  await clock.advance(1000);
  const readings = await eventually('both session readings published', async () => {
    const readings = await accounts(ui);
    return readings.filter(a => a.windows.length === 3).length === 2 ? readings : undefined;
  });
  const namedReading = readings.find(a => a.name === 'claude-a')!;
  const defaultReading = readings.find(a => a.name === 'default:claude-code')!;
  assert.deepEqual(namedReading.windows.map(w => [w.usedPercent, w.severity]), [[12.4, 'warning'], [3, 'critical'], [98, 'normal']]);
  assert.deepEqual(defaultReading.windows, namedReading.windows);
  assert.equal(namedReading.at, new Date(now - 31 * 60_000).toISOString());
  assert.equal(defaultReading.at, new Date(now).toISOString());
});

test('hard-limit account marks and their clearance are pushed by the injected adapter host', async t => {
  const root = await tempProject(t);
  const config = join(root, 'config');
  await mkdir(join(config, 'cland'), { recursive: true });
  await writeFile(join(config, 'cland/accounts.toml'), '[accounts.codex-a]\nharness = "codex"\n[accounts.oc-b]\nharness = "opencode"\n');
  const clock = new FakeClock(Date.parse('2026-10-19T12:00:00Z'));
  const hosts = new Map<string, AdapterHost>();
  const { discovery } = await projectHub(t, root, { XDG_CONFIG_HOME: config }, {
    clock, accountReader: async () => [],
    adapters: ['codex', 'opencode'].map(harness => (host, clock) => {
      hosts.set(harness, host);
      return fakeHarness(harness as 'codex' | 'opencode', { host, clock });
    }),
  });
  const ui = await connectUi(t, discovery);
  await ui.request({ type: 'subscribe' });
  for (const [name, account, role] of [['codex', 'codex-a', 'reviewer'], ['oc', 'oc-b', 'qa']]) {
    const result = await ui.request({ type: 'session.launch', name, account, role, harness: name === 'oc' ? 'opencode' : 'codex' });
    assert.equal(result.ok, true, result.error);
    const process = (result.value as { process: { sessionId: string; harness: string } }).process;
    hosts.get(process.harness)!.limitHit!(process.sessionId, { reason: 'usageLimitExceeded', ...(name === 'codex' ? { resetsAt: '2026-10-20T00:01:00.000Z' } : {}) });
    const push = await ui.waitFor(f => f.type === 'account' && (f.account as { name: string; limited?: unknown }).name === account && !!(f.account as { limited?: unknown }).limited);
    assert.equal((push.account as { limited: { resetsAt: string | null } }).limited.resetsAt, name === 'codex' ? '2026-10-20T00:01:00.000Z' : null);
  }
  for (const account of ['codex-a', 'oc-b']) {
    assert.equal((await ui.request({ type: 'account.clear', account })).ok, true);
    const push = await ui.waitFor(f => f.type === 'account' && (f.account as { name: string; limited?: unknown }).name === account && !(f.account as { limited?: unknown }).limited);
    assert.equal((push.account as { limited?: unknown }).limited, undefined);
  }
});
