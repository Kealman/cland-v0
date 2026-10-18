// T3: native hard-limit error/hook contracts and an end-to-end account-limit hit.
// Deferred eligibility uses FakeClock; permission permutations are T1 in account-permissions.test.ts.
import { accountBinaries, accountClaude, accountCodex } from './account-fixture-env.ts';
import { FakeClock } from './fake-clock.ts';
import { inProcessSpoke } from './harness.ts';
import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { cland, clandWithEnv, connectUi, eventually, killDaemon, nativeProjectHub as projectHub, tempProject, type FrameClient } from './harness.ts';
import type { AccountList, AccountView } from '../src/accounts/limits.ts';
import type { HarnessProcessView } from '../src/protocol.ts';

type Result = { ok: boolean; value?: unknown; error?: string; code?: string; account?: string; resetsAt?: string | null; permission?: string; role?: string };

async function fixture(t: TestContext, extraEnv: Record<string, string> = {}, failed = false) {
  const root = await tempProject(t);
  const config = join(root, 'config');
  const claude = await accountClaude(t);
  const codex = await accountCodex(t);
  const oc = join(root, 'fake-opencode');
  for (const dir of [join(config, 'cland'), join(root, '.cland'), join(root, 'codex-a'), join(root, 'codex-b'), join(root, 'claude-b'), join(root, 'oc-b'), oc]) await mkdir(dir, { recursive: true });
  await writeFile(join(config, 'cland', 'accounts.toml'), `[accounts.codex-a]\nharness = "codex"\nhome = ${JSON.stringify(join(root, 'codex-a'))}\n[accounts.codex-b]\nharness = "codex"\nhome = ${JSON.stringify(join(root, 'codex-b'))}\n[accounts.claude-b]\nharness = "claude-code"\nconfig_dir = ${JSON.stringify(join(root, 'claude-b'))}\n[accounts.oc-b]\nharness = "opencode"\ndata_home = ${JSON.stringify(join(root, 'oc-b'))}\n`);
  if (failed) await writeFile(join(root, 'claude-b', 'usage-fail'), '1');
  await writeFile(join(root, 'claude-b', 'usage-report.json'), JSON.stringify({ rate_limits: { limits: [] } }));
  await writeFile(join(root, '.cland', 'roles.toml'), '[reviewer.launch]\nharness = "codex"\naccount = "codex-a"\n');
  await writeFile(join(root, '.cland', 'crew.toml'), '[crew.reviewer]\npolicy = "pool"\nsize = 4\nkeep_context = true\n');
  const env = { ...claude.env, ...codex.env, XDG_CONFIG_HOME: config, FAKE_OPENCODE_HOME: oc, FAKE_OPENCODE_TURN_MS: '30', CLAND_TEST_ACCOUNT_POLL_MINIMUM_MS: '1',
    ...accountBinaries(), ...extraEnv };
  const clock = new FakeClock(Date.now());
  const daemon = await projectHub(t, root, env, { clock });
  const ui = await connectUi(t, daemon.discovery);
  await ui.request({ type: 'subscribe' });
  await eventually('all startup polls settled', async () => (await journal(root, ui)).filter(e => e.event === 'account-polled').length === 3 || undefined);
  t.after(async () => {
    for (const file of await readdir(join(oc, 'servers')).catch(() => [])) {
      const s = JSON.parse(await readFile(join(oc, 'servers', file), 'utf8')) as { pid: number };
      await killDaemon(s.pid);
    }
  });
  await clock.advance(1);
  return { root, env, ui, daemon, codex, claude, clock };
}
async function launch(ui: FrameClient, name: string, account: string, extra: Record<string, unknown> = {}) {
  const r = await ui.request({ type: 'session.launch', name, account, role: 'reviewer', ...extra }, 30_000);
  assert.equal(r.ok, true, r.error);
  return (r.value as { process: HarnessProcessView }).process;
}
async function account(ui: FrameClient, name: string): Promise<AccountView> {
  const r = await ui.request({ type: 'account.list' });
  assert.equal(r.ok, true, r.error);
  return (r.value as AccountList).accounts.find(a => a.name === name)!;
}
async function send(ui: FrameClient, name: string, text: string) {
  const r = await ui.request({ type: 'topic.send', topic: 'general', to: [name], text: `@${name} ${text}` });
  assert.equal(r.ok, true, r.error);
}
async function journal(root: string, ui: FrameClient) {
  assert.equal((await ui.request({ type: 'hub.status', flushLogs: true })).ok, true);
  return (await readFile(join(root, '.cland/journal.jsonl'), 'utf8')).trim().split('\n').map(line => JSON.parse(line)) as Array<Record<string, unknown>>;
}
async function idle(ui: FrameClient, name: string) {
  return eventually(`${name} idle`, async () => {
    const r = await ui.request({ type: 'session.list' });
    return (r.value as { processes: HarnessProcessView[] }).processes.find(p => p.name === name)?.state === 'idle' || undefined;
  });
}
const limits = (reset: string, usedPercent = 0) => ({ rateLimits: { limitId: 'codex', primary: { usedPercent, windowDurationMins: 10080, resetsAt: Date.parse(reset) / 1000 }, secondary: null } });

for (const completedOnly of [false, true]) test(`Codex ${completedOnly ? 'failed completion' : 'error notification'} marks once, refuses launch, relaunch and retained handoff, and clears by hand`, async t => {
  const f = await fixture(t);
  const coord = await inProcessSpoke(t, { cwd: f.root, discover: true, name: 'coord', role: 'coordinator' });
  t.after(() => coord.close());
  await coord.waitForPresence(['coord']);
  const reset = new Date(f.clock.now().getTime() + 120_000).toISOString();
  await writeFile(join(f.root, 'codex-a', 'rate-limits.json'), JSON.stringify(limits(reset)));
  const p = await launch(f.ui, 'rev-one', 'codex-a', { role: 'reviewer' });
  await idle(f.ui, p.name);
  await eventually('startup poll settled', async () => (await journal(f.root, f.ui)).some(e => e.event === 'account-polled' && e.account === 'codex-a') || undefined);
  const before = await journal(f.root, f.ui);
  const servers = (await f.codex.servers()).map(s => s.pid);
  const reads = (await f.codex.log(p.pid!)).match(/account\/rateLimits\/read/g)?.length ?? 0;
  await send(f.ui, p.name, `hit the usage limit${completedOnly ? ' completed signal only' : ''}`);
  const mark = await eventually('limited Codex', async () => (await account(f.ui, 'codex-a')).limited);
  assert.equal(mark.resetsAt, reset);
  assert.equal(mark.reason, 'usageLimitExceeded');
  await coord.waitForEvent(e => e.params.content.includes('account codex-a hit its limit'));
  assert.ok((await journal(f.root, f.ui)).some(e => e.event === 'notification' && e.kind === 'account-limited'));
  const events = await f.ui.request({ type: 'events.list' });
  assert.ok((events.value as { rows: Array<{ warning?: boolean; text: string }> }).rows.some(r => r.warning && r.text.includes('codex-a hit its limit')));
  assert.equal(mark.session, p.name);
  await eventually('after-hit poll settled', async () => (await journal(f.root, f.ui)).filter(e => e.event === 'account-polled' && e.account === 'codex-a').length === before.filter(e => e.event === 'account-polled' && e.account === 'codex-a').length + 1 || undefined);
  await idle(f.ui, p.name);
  assert.equal((await f.codex.log(p.pid!)).match(/account\/rateLimits\/read/g)?.length, reads + 1, 'hit reads the live app-server once');
  const listed = await cland(f.root, 'account', 'list', '--json');
  assert.deepEqual(JSON.parse(listed.stdout).accounts.find((a: AccountView) => a.name === 'codex-a').limited, mark);
  const history = await f.ui.request({ type: 'topic.history', topic: 'agents' });
  const notices = (history.value as { messages: Array<{ kind: string; severity?: string; text: string }> }).messages.filter(m => m.kind === 'account-limited');
  assert.equal(notices.length, 1);
  assert.equal(notices[0]?.severity, 'warn');
  assert.match(notices[0]!.text, /codex-a.*usageLimitExceeded/);
  const made = await f.ui.request({ type: 'task.create', size: 'S', title: 'Retained review' });
  const item = (made.value as { item: { id: string } }).item.id;
  for (const request of [
    { type: 'session.launch', name: 'refused', account: 'codex-a' },
    { type: 'session.launch', name: 'role-refused', role: 'reviewer' },
    { type: 'session.resume', session: p.name, relaunch: true },
    { type: 'session.launch', name: 'pool-refused', role: 'reviewer', item },
  ]) {
    const r = await f.ui.request(request, 30_000) as Result;
    assert.equal(r.ok, false, JSON.stringify(r));
    assert.equal(r.code, 'account-limited', JSON.stringify(r));
    assert.equal(r.account, 'codex-a');
    assert.equal(r.resetsAt, reset);
    assert.match(r.error!, /codex-a.*limited until.*\(.*Z\).*--account/);
  }
  assert.deepEqual((await f.codex.servers()).map(s => s.pid), servers);
  await send(f.ui, p.name, 'hit the usage limit');
  await eventually('second failed turn', async () => (await journal(f.root, f.ui)).filter(e => e.event === 'turn-failed' && e.session === p.name).length === 2 || undefined);
  await idle(f.ui, p.name);
  // A successful round trip on the same session proves it kept running and settles earlier hit handling.
  await send(f.ui, p.name, 'still running');
  await eventually('session replies after limit', async () => (await f.codex.log(p.pid!)).includes('still running') || undefined);
  await idle(f.ui, p.name);
  const after = await journal(f.root, f.ui);
  assert.equal(after.filter(e => e.event === 'account-limited').length, 1);
  assert.equal(after.filter(e => e.event === 'account-polled' && e.account === 'codex-a').length, before.filter(e => e.event === 'account-polled' && e.account === 'codex-a').length + 1);
  const cleared = await cland(f.root, 'account', 'clear', 'codex-a');
  assert.equal(cleared.code, 0, cleared.stderr);
  assert.equal((await account(f.ui, 'codex-a')).limited, undefined);
  assert.ok((await journal(f.root, f.ui)).some(e => e.event === 'account-limit-lifted' && e.by === 'hand'));
  await launch(f.ui, 'after-clear', 'codex-a');
  const again = await f.ui.request({ type: 'topic.history', topic: 'agents' });
  assert.equal((again.value as { messages: Array<{ kind: string }> }).messages.filter(m => m.kind === 'account-limited').length, 1);
});

test('Claude hard StopFailure and OpenCode quota mark; overloaded and the two retryable throttles do not', async t => {
  const f = await fixture(t);
  const claude = await launch(f.ui, 'claude', 'claude-b', { role: 'implementer' });
  const oc = await launch(f.ui, 'oc', 'oc-b', { role: 'qa' });
  const codex = await launch(f.ui, 'codex', 'codex-b');
  for (const [p, text] of [[claude, 'hit an overloaded error'], [oc, 'hit a rate limit'], [codex, 'hit a rate limit']] as const) {
    await idle(f.ui, p.name);
    await send(f.ui, p.name, text);
    await eventually('failed turn recorded', async () => (await journal(f.root, f.ui)).some(e => e.event === 'turn-failed' && e.session === p.name) || undefined);
    assert.equal((await account(f.ui, p.account!)).limited, undefined);
  }
  const reset = new Date(f.clock.now().getTime() + 120_000).toISOString();
  assert.equal((await f.ui.request({ type: 'session.signal', session: claude.name, launch: claude.sessionId, event: 'mod-measure', payload: { rateLimits: [{ kind: 'five_hour', percentUsed: 100, resetsAt: reset }] } })).ok, true);
  await send(f.ui, claude.name, 'hit the usage limit');
  assert.equal((await eventually('Claude limited', async () => (await account(f.ui, 'claude-b')).limited)).resetsAt, reset);
  await send(f.ui, oc.name, 'hit the usage limit');
  assert.equal((await eventually('OpenCode limited', async () => (await account(f.ui, 'oc-b')).limited)).resetsAt, null);
  const refused = await f.ui.request({ type: 'session.launch', name: 'oc-refused', account: 'oc-b' }) as Result;
  assert.equal(refused.code, 'account-limited');
  assert.equal(refused.account, 'oc-b');
  assert.equal(refused.resetsAt, null);
  assert.match(refused.error!, /until cleared/);
  assert.match((await cland(f.root, 'account', 'list')).stdout, /oc-b.*limited.*until cleared/);
});

test('mark survives restart; live re-find succeeds, reset lifts the mark, and the next launch succeeds', async t => {
  const f = await fixture(t);
  const reset = new Date(f.clock.now().getTime() + 30_000).toISOString();
  await writeFile(join(f.root, 'codex-a', 'rate-limits.json'), JSON.stringify(limits(reset)));
  const p = await launch(f.ui, 'persisted', 'codex-a');
  await idle(f.ui, p.name);
  await send(f.ui, p.name, 'hit the usage limit');
  const mark = await eventually('saved mark', async () => (await account(f.ui, 'codex-a')).limited);
  await f.daemon.stop();
  const next = await projectHub(t, f.root, f.env, { clock: f.clock });
  const ui = await connectUi(t, next.discovery);
  await ui.request({ type: 'subscribe' });
  assert.deepEqual((await account(ui, 'codex-a')).limited, mark);
  await idle(ui, p.name);
  const rows = (await ui.request({ type: 'session.list' })).value as { processes: HarnessProcessView[] };
  assert.equal(rows.processes.find(r => r.name === p.name)?.pid, p.pid);
  const refusal = await ui.request({ type: 'session.launch', name: 'before-reset', account: 'codex-a' }) as Result;
  assert.equal(refusal.code, 'account-limited');
  await f.clock.advance(30_001);
  await ui.waitFor(e => e.type === 'account' && (e.account as AccountView).name === 'codex-a' && !(e.account as AccountView).limited);
  assert.equal((await account(ui, 'codex-a')).limited, undefined);
  assert.ok((await journal(f.root, ui)).some(e => e.event === 'account-limit-lifted' && e.by === 'reset'));
  await launch(ui, 'after-reset', 'codex-a');
});

test('account.clear permits human and Coordinator shells only, with typed inline role refusals', async t => {
  const f = await fixture(t);
  const oc = await launch(f.ui, 'oc', 'oc-b', { role: 'qa' });
  await idle(f.ui, oc.name);
  await send(f.ui, oc.name, 'hit the usage limit');
  await eventually('held mark', async () => (await account(f.ui, 'oc-b')).limited);
  for (const role of ['implementer']) {
    const name = `${role}-shell`;
    const spoke = await inProcessSpoke(t, { cwd: f.root, discover: true, name, role });
    t.after(() => spoke.close());
    await spoke.waitForPresence([name]);
    const r = await f.ui.request({ type: 'account.clear', account: 'oc-b', as: { name } }) as Result;
    assert.equal(r.ok, false);
    assert.equal(r.code, 'forbidden');
    assert.equal(r.permission, 'account.clear');
    assert.equal(r.role, role);
    const cli = await clandWithEnv(f.root, { CLAND_SESSION_NAME: name }, 'account', 'clear', 'oc-b');
    assert.equal(cli.code, 1);
    assert.match(cli.stderr, /forbidden.*account.clear/);
    assert.ok((await account(f.ui, 'oc-b')).limited);
  }
  const coord = await inProcessSpoke(t, { cwd: f.root, discover: true, name: 'coord', role: 'coordinator' });
  t.after(() => coord.close());
  await coord.waitForPresence(['coord']);
  const clear = await clandWithEnv(f.root, { CLAND_SESSION_NAME: 'coord' }, 'account', 'clear', 'oc-b');
  assert.equal(clear.code, 0, clear.stderr);
  assert.equal((await account(f.ui, 'oc-b')).limited, undefined);
});


test('Claude without a full push learns its reset from one after-hit harness poll', async t => {
  const f = await fixture(t);
  const p = await launch(f.ui, 'claude-poll', 'claude-b', { role: 'implementer' });
  await idle(f.ui, p.name);
  const reset = new Date(f.clock.now().getTime() + 120_000).toISOString();
  await writeFile(join(f.root, 'claude-b', 'usage-report.json'), JSON.stringify({ rate_limits: { limits: [{ kind: 'session', percent: 100, resets_at: reset }] } }));
  const before = await journal(f.root, f.ui);
  await send(f.ui, p.name, 'hit the usage limit');
  // Reset publication precedes the poll's completion receipt; wait for both within the same budget.
  await eventually('poll supplies reset', async () => {
    if ((await account(f.ui, 'claude-b')).limited?.resetsAt !== reset) return undefined;
    return (await journal(f.root, f.ui)).filter(e => e.event === 'account-polled' && e.account === 'claude-b').length === before.filter(e => e.event === 'account-polled' && e.account === 'claude-b').length + 1 || undefined;
  });
  const after = await journal(f.root, f.ui);
  assert.equal(after.filter(e => e.event === 'account-polled' && e.account === 'claude-b').length, before.filter(e => e.event === 'account-polled' && e.account === 'claude-b').length + 1);
});

test('a hard hit before the native first-turn response is retained through launch publication', async t => {
  const f = await fixture(t);
  const reset = new Date(f.clock.now().getTime() + 120_000).toISOString();
  await writeFile(join(f.root, 'codex-a', 'rate-limits.json'), JSON.stringify(limits(reset)));
  const p = await launch(f.ui, 'early-hit', 'codex-a', { brief: 'hit the usage limit; fail recovered turn before response' });
  const mark = await eventually('early hit saved', async () => (await account(f.ui, 'codex-a')).limited);
  assert.equal(mark.session, p.name);
  assert.equal(mark.resetsAt, reset);
  assert.equal((await journal(f.root, f.ui)).filter(e => e.event === 'account-limited').length, 1);
});


for (const failed of [false, true]) test(`after-hit read waits for a recent ${failed ? 'failed poll backoff' : 'poll minimum'} and duplicate hits share it`, async t => {
  const pollDelayMs = failed ? 16000 : 12000;
  const f = await fixture(t, { CLAND_TEST_ACCOUNT_POLL_MINIMUM_MS: failed ? '6000' : '12000', CLAND_TEST_ACCOUNT_POLL_FLOOR_MS: failed ? '8000' : '60000' }, failed);
  const p = await launch(f.ui, 'waiting-claude', 'claude-b', { role: 'implementer' });
  await idle(f.ui, p.name);
  let ui = f.ui;
  const { unlink } = await import('node:fs/promises');
  if (failed) await unlink(join(f.root, 'claude-b', 'usage-fail'));
  const reset = new Date(f.clock.now().getTime() + 120_000).toISOString();
  await writeFile(join(f.root, 'claude-b', 'usage-report.json'), JSON.stringify({ rate_limits: { limits: [{ kind: 'session', percent: 100, resets_at: reset }] } }));
  const before = (await journal(f.root, ui)).filter(e => e.event === 'account-polled' && e.account === 'claude-b');
  await send(ui, p.name, 'hit the usage limit');
  const mark = await eventually('held until eligible', async () => (await account(ui, 'claude-b')).limited);
  assert.equal(mark.resetsAt, null);
  await eventually('first failure completed', async () => (await journal(f.root, ui)).filter(e => e.event === 'turn-failed' && e.session === p.name).length === 1 || undefined);
  await send(ui, p.name, 'hit the usage limit');
  await eventually('second failure completed', async () => (await journal(f.root, ui)).filter(e => e.event === 'turn-failed' && e.session === p.name).length === 2 || undefined);
  assert.equal((await journal(f.root, ui)).filter(e => e.event === 'account-polled' && e.account === 'claude-b').length, before.length, 'no early read');
  // A refresh stays bounded and cached while the after-hit read is waiting.
  assert.equal((await ui.request({ type: 'account.poll' }, 3000)).ok, true);
  if (!failed) {
    await f.daemon.stop();
    const next = await projectHub(t, f.root, f.env, { clock: f.clock });
    ui = await connectUi(t, next.discovery);
    assert.deepEqual((await account(ui, 'claude-b')).limited, mark, 'restart retains the mark and outstanding read');
  }
  await f.clock.advance(pollDelayMs - 2);
  assert.equal((await journal(f.root, ui)).filter(e => e.event === 'account-polled' && e.account === 'claude-b').length, before.length, 'still ineligible just before the boundary');
  await f.clock.advance(2);
  await eventually('deferred poll supplies reset', async () => {
    if ((await account(ui, 'claude-b')).limited?.resetsAt !== reset) return undefined;
    return (await journal(f.root, ui)).filter(e => e.event === 'account-polled' && e.account === 'claude-b').length === before.length + 1 || undefined;
  }, pollDelayMs + 5000);
  const after = (await journal(f.root, ui)).filter(e => e.event === 'account-polled' && e.account === 'claude-b');
  assert.equal(after.length, before.length + 1);
  assert.equal((await journal(f.root, ui)).filter(e => e.event === 'account-limited' && e.account === 'claude-b').length, 1);
});


test('an expired full reading cannot lift a new hard hit while its after-hit poll is delayed', async t => {
  const f = await fixture(t, { CLAND_TEST_ACCOUNT_POLL_MINIMUM_MS: '8000' });
  const p = await launch(f.ui, 'expired-window', 'claude-b', { role: 'implementer' });
  await idle(f.ui, p.name);
  const expired = new Date(f.clock.now().getTime() - 60_000).toISOString();
  const future = new Date(f.clock.now().getTime() + 120_000).toISOString();
  await f.ui.request({ type: 'session.signal', session: p.name, launch: p.sessionId, event: 'mod-measure', payload: { rateLimits: [{ kind: 'five_hour', percentUsed: 100, resetsAt: expired }] } });
  await f.clock.advance(1000);
  await eventually('expired cached window published', async () => (await account(f.ui, 'claude-b')).windows.some(w => w.resetsAt === expired) || undefined);
  await writeFile(join(f.root, 'claude-b', 'usage-report.json'), JSON.stringify({ rate_limits: { limits: [{ kind: 'session', percent: 100, resets_at: future }] } }));
  await writeFile(join(f.root, 'claude-b', 'usage-hold'), '1');
  const priorPolls = (await f.claude.calls()).filter(c => c.args[0] === '-p').length;
  await send(f.ui, p.name, 'hit the usage limit');
  const mark = await eventually('new mark remains held', async () => (await account(f.ui, 'claude-b')).limited);
  assert.equal(mark.resetsAt, null);
  await f.clock.advance(8000);
  await eventually('after-hit read waiting on fake answer', async () => (await f.claude.calls()).filter(c => c.args[0] === '-p').length === priorPolls + 1 || undefined);
  assert.deepEqual((await account(f.ui, 'claude-b')).limited, mark);
  const r = await f.ui.request({ type: 'session.launch', name: 'held-launch', account: 'claude-b' }) as Result;
  assert.equal(r.code, 'account-limited');
  assert.equal(r.resetsAt, null);
  assert.match(r.error!, /until cleared/);
  await writeFile(join(f.root, 'claude-b', 'usage-release'), '1');
  await eventually('released after-hit poll completion receipt', async () => (await journal(f.root, f.ui)).filter(e => e.event === 'account-polled' && e.account === 'claude-b').length === priorPolls + 1 || undefined);
  await eventually('future reset learnt', async () => (await account(f.ui, 'claude-b')).limited?.resetsAt === future || undefined);
  const logs = await journal(f.root, f.ui);
  assert.equal(logs.filter(e => e.event === 'account-limit-lifted' && e.account === 'claude-b').length, 0);
});
