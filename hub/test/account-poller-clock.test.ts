// T1: AccountPoller's public refresh/poll lifecycle with fake time and a live-reader boundary fake.
import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AccountPoller } from '../src/accounts/poller.ts';
import { HubCore } from '../src/hub/core.ts';
import { Store } from '../src/hub/store.ts';
import type { HarnessProcessView } from '../src/protocol.ts';
import type { Sessions } from '../src/adapters/sessions.ts';
import type { LimitWindow } from '../src/accounts/limits.ts';
import { FakeClock } from './fake-clock.ts';

const windows: LimitWindow[] = [{ id: 'primary', label: '5h', usedPercent: 41, resetsAt: '2099-10-20T00:00:00Z' }];
async function fixture(t: TestContext) {
  const root = await mkdtemp(join(tmpdir(), 'account-clock-'));
  const clock = new FakeClock();
  const env = { XDG_CONFIG_HOME: root };
  const database = join(root, 'hub.db');
  let store: Store | undefined;
  let core: HubCore | undefined;
  let read = async (_name: string): Promise<LimitWindow[]> => windows;
  const pollers: AccountPoller[] = [];
  const releases = new Set<() => void>();
  const refreshes = new Set<Promise<unknown>>();
  let disposing: Promise<void> | undefined;
  const dispose = () => disposing ??= (async () => {
    const errors: unknown[] = [];
    const attempt = async (work: () => unknown) => { try { await work(); } catch (error) { errors.push(error); } };
    // Release the fake boundary before draining callers or closing a poller that awaits it.
    read = async () => windows;
    for (const release of releases) release();
    while (refreshes.size) {
      for (const result of await Promise.allSettled([...refreshes])) if (result.status === 'rejected') errors.push(result.reason);
    }
    for (const poller of pollers) await attempt(() => poller.close());
    await attempt(() => core?.close());
    await attempt(() => store?.close());
    await attempt(() => rm(root, { recursive: true, force: true }));
    if (errors.length) throw new AggregateError(errors, 'account fixture cleanup failed');
  })();
  t.after(dispose); // Own partial construction as well as assertion failures.
  await mkdir(join(root, 'cland'));
  await writeFile(join(root, 'cland/accounts.toml'), '[accounts.cx]\nharness = "codex"\n');
  store = new Store(database);
  core = new HubCore({ env, clock, store });
  let reads = 0;
  const running: HarnessProcessView[] = [];
  const sessions: Pick<Sessions, 'list' | 'readAccountLimits'> = { list: () => running, readAccountLimits: async (name: string) => { reads++; return read(name); } };
  const logs: Array<Record<string, unknown>> = [];
  const receipts: Array<{ count: number; done: () => void }> = [];
  const polled = (count: number): Promise<void> => logs.filter(row => row.event === 'account-polled').length >= count ? Promise.resolve() : new Promise(done => receipts.push({ count, done }));
  const log = (row: Record<string, unknown>) => {
    logs.push(row);
    const count = logs.filter(row => row.event === 'account-polled').length;
    for (const receipt of receipts) if (count >= receipt.count) receipt.done();
  };
  const makePoller = () => new AccountPoller(core!, sessions, root, log, { ...env, CLAND_TEST_ACCOUNT_POLL_FLOOR_MS: '600', CLAND_TEST_ACCOUNT_POLL_MINIMUM_MS: '200' }, clock);
  const poller = makePoller();
  pollers.push(poller);
  const refresh = (target = poller) => {
    assert.equal(disposing, undefined, 'fixture is still open');
    const work = target.refresh();
    refreshes.add(work);
    void work.then(() => refreshes.delete(work), () => refreshes.delete(work));
    return work;
  };
  const holdRead = () => {
    const entered = Promise.withResolvers<void>();
    const gate = Promise.withResolvers<LimitWindow[]>();
    const release = (value = windows) => { gate.resolve(value); };
    releases.add(release);
    return { entered: entered.promise, release, read: (_name: string) => { entered.resolve(); return gate.promise; } };
  };
  return { root, clock, get core() { return core!; }, poller, refresh, holdRead, dispose, get pendingRefreshes() { return refreshes.size; }, logs, polled, running, reopen: () => {
    core!.close();
    store!.close();
    store = new Store(database);
    core = new HubCore({ env, clock, store });
    const next = makePoller();
    pollers.push(next);
    return next;
  }, get reads() { return reads; }, set read(next: typeof read) { read = next; } };
}

test('manual minimum and timer floor use the injected clock', { timeout: 5000 }, async t => {
  const f = await fixture(t);
  f.poller.start();
  await f.refresh();
  assert.equal(f.reads, 1);
  await f.clock.advance(199);
  await f.refresh();
  assert.equal(f.reads, 1, 'minimum has not expired');
  await f.clock.advance(1);
  await f.refresh();
  assert.equal(f.reads, 2, 'manual refresh becomes eligible at the minimum');
  await f.clock.advance(599);
  assert.equal(f.reads, 2, 'timer does not bypass the floor');
  const nextRead = Promise.withResolvers<void>();
  f.read = async () => { nextRead.resolve(); return windows; };
  await f.clock.advance(401); // next periodic check after the completed attempt's floor
  await nextRead.promise;
  await f.polled(3);
  assert.equal(f.reads, 3);
});

test('failed attempts double the floor up to four times and success restores the base', { timeout: 5000 }, async t => {
  const f = await fixture(t);
  f.read = async () => { throw new Error('private output\nnever expose this'); };
  await f.refresh();
  for (const delay of [1200, 2400, 2400]) {
    const before = f.reads;
    await f.clock.advance(delay - 1);
    await f.refresh();
    assert.equal(f.reads, before, 'refresh cannot bypass backoff');
    await f.clock.advance(1);
    await f.refresh();
    assert.equal(f.reads, before + 1);
  }
  f.read = async () => windows;
  await f.clock.advance(2400);
  await f.refresh();
  const recovered = f.reads;
  await f.clock.advance(200);
  await f.refresh();
  assert.equal(f.reads, recovered + 1, 'success restores the manual minimum');
  f.poller.start();
  const timerRead = Promise.withResolvers<void>();
  f.read = async () => { timerRead.resolve(); return windows; };
  await f.clock.advance(599);
  assert.equal(f.reads, recovered + 1);
  await f.clock.advance(1);
  await timerRead.promise;
  await f.polled(recovered + 2);
  assert.equal(f.reads, recovered + 2, 'success also restores the timer floor');
  assert.ok(f.logs.filter(r => r.event === 'account-poll-failed').every(r => r.reason === 'harness poll failed'));
});

for (const failed of [false, true]) test(`after-hit latch retains duplicate hits through ${failed ? 'failure backoff' : 'the minimum'}`, { timeout: 5000 }, async t => {
  const f = await fixture(t);
  if (failed) f.read = async () => { throw new Error('failure'); };
  await f.refresh();
  f.read = async () => windows;
  f.core.accountLimits.mark('cx', { since: f.clock.now().toISOString(), reason: 'usageLimitExceeded', session: 'live', resetsAt: null });
  const one = f.poller.poll('cx');
  assert.equal(f.poller.poll('cx'), one, 'duplicate hits share the outstanding read');
  await f.refresh();
  const delay = failed ? 1200 : 200;
  await f.clock.advance(delay - 1);
  assert.equal(f.reads, 1, 'no early read');
  await f.clock.advance(1);
  await one;
  assert.equal(f.reads, 2);
  assert.equal(f.core.accountLimits.view({ name: 'cx', harness: 'codex', path: null, variable: 'CODEX_HOME' }).windows[0]?.usedPercent, 41);
});

test('a pending poll stays single flight beyond the minimum and a newer push wins', { timeout: 5000 }, async t => {
  const f = await fixture(t);
  const held = f.holdRead();
  f.read = held.read;
  const first = f.refresh();
  await held.entered;
  const queued = Array.from({ length: 4 }, () => f.refresh());
  await f.clock.advance(601);
  assert.equal(f.reads, 1);
  await f.core.publishAccountLimits({ account: 'cx', harness: 'codex', windows: [{ ...windows[0]!, usedPercent: 77 }], at: f.clock.now().toISOString(), source: { kind: 'session', session: 'push' } });
  held.release();
  await first;
  await Promise.all(queued);
  const reading = f.core.accountLimits.view({ name: 'cx', harness: 'codex', path: null, variable: 'CODEX_HOME' });
  assert.equal(reading.windows[0]?.usedPercent, 77);
  assert.deepEqual(reading.source, { kind: 'session', session: 'push' });
  assert.equal(reading.at, f.clock.now().toISOString());
  await f.refresh();
  assert.equal(f.reads, 1, 'floor starts at completion');
});

for (const failed of [false, true]) test(`reopening retains ${failed ? 'backoff' : 'minimum'} and an outstanding after-hit read`, { timeout: 5000 }, async t => {
  const f = await fixture(t);
  if (failed) f.read = async () => { throw new Error('failure'); };
  await f.refresh();
  // The original after-hit restart scenario has a live account session. Background idle polls
  // must stay ineligible while its deferred hit owns the read.
  f.running.push({ harness: 'codex', account: 'cx', status: 'running' } as HarnessProcessView);
  f.core.accountLimits.mark('cx', { since: f.clock.now().toISOString(), reason: 'limit', session: 'live', resetsAt: null });
  const cancelled = f.poller.poll('cx');
  await f.poller.close();
  await cancelled;
  f.read = async () => windows;
  const next = f.reopen();
  next.start();
  const pending = next.poll('cx');
  await f.clock.advance((failed ? 1200 : 200) - 1);
  await f.refresh(next);
  assert.equal(f.reads, 1);
  await f.clock.advance(1);
  await pending;
  assert.equal(f.reads, 2, 'reopen retains exactly one deferred read');
});

test('idle eligibility skips running named/default accounts and OpenCode', { timeout: 5000 }, async t => {
  const f = await fixture(t);
  const registry = join(f.root, 'cland/accounts.toml');
  await writeFile(registry, '[accounts.cx]\nharness = "codex"\n[accounts.oc]\nharness = "opencode"\n');
  for (const account of ['cx', null]) {
    f.running.splice(0, f.running.length, { harness: 'codex', account, status: 'running' } as HarnessProcessView);
    await f.refresh();
    assert.equal(f.reads, 0);
  }
  f.running.length = 0;
  await f.refresh();
  assert.equal(f.reads, 1, 'OpenCode is never read');
});

test('only two accounts read concurrently while queued duplicate refreshes share admission', { timeout: 5000 }, async t => {
  const f = await fixture(t);
  await writeFile(join(f.root, 'cland/accounts.toml'), ['a', 'b', 'c'].map(name => `[accounts.${name}]\nharness = "codex"\nhome = "/scratch/${name}"\n`).join(''));
  const gates = new Map(['a', 'b', 'c'].map(name => [name, f.holdRead()]));
  f.read = name => gates.get(name)!.read(name);
  const initial = f.refresh();
  await Promise.all([gates.get('a')!.entered, gates.get('b')!.entered]);
  const duplicate = f.refresh();
  await f.clock.advance(1000);
  assert.equal(f.reads, 2, 'third account stays queued, including beyond the minimum');
  gates.get('a')!.release();
  await gates.get('c')!.entered;
  assert.equal(f.reads, 3);
  gates.get('b')!.release();
  gates.get('c')!.release();
  await Promise.all([initial, duplicate]);
  assert.equal(f.logs.filter(row => row.event === 'account-polled').length, 3);
});

test('held-read owners drain refreshes after a controlled pre-release assertion failure', { timeout: 5000 }, async t => {
  for (const queued of [false, true]) {
    const f = await fixture(t);
    const names = queued ? ['a', 'b', 'c'] : ['cx'];
    if (queued) await writeFile(join(f.root, 'cland/accounts.toml'), names.map(name => `[accounts.${name}]\nharness = "codex"\nhome = "/scratch/${name}"\n`).join(''));
    const gates = new Map(names.map(name => [name, f.holdRead()]));
    f.read = name => gates.get(name)!.read(name);
    await assert.rejects(async () => {
      try {
        void f.refresh();
        await Promise.all(names.slice(0, queued ? 2 : 1).map(name => gates.get(name)!.entered));
        void f.refresh();
        assert.equal(f.reads, queued ? 2 : 1, 'held concurrency assertion precedes the injected failure');
        assert.fail('controlled pre-release assertion failure');
      } finally { await f.dispose(); }
    }, /controlled pre-release assertion failure/);
    assert.equal(f.pendingRefreshes, 0);
    assert.equal(f.clock.pending, 0);
    await assert.rejects(stat(f.root), { code: 'ENOENT' });
  }
});
