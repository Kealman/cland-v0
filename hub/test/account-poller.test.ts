// T3: native usage-command contract, sanitized child environments and process-group timeout cleanup.
// Scheduling rules live in account-poller-clock.test.ts; only native process deadlines use real time.
import { completeJournalLines } from './journal-lines.ts';
import { accountClaude, accountCodex } from './account-fixture-env.ts';
import { FakeClock } from './fake-clock.ts';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { cland, connectUi, eventually, nativeProjectHub as projectHub, startDaemon, tempProject } from './harness.ts';
import type { AccountList } from '../src/accounts/limits.ts';

const usage = { rate_limits: { limits: [
  { kind: 'session', percent: 12, resets_at: '2026-10-15T00:00:00Z', severity: 'normal' },
  { kind: 'weekly_all', percent: 25, resets_at: '2026-10-20T00:00:00Z' },
  { kind: 'weekly_scoped', group: 'sonnet', scope: 'sonnet', percent: 33, resets_at: '2026-10-20T00:00:00Z', severity: 'warning' },
] } };
async function setup(t: import('node:test').TestContext) {
  const root = await tempProject(t);
  const config = join(root, 'config');
  const claude = join(root, 'claude-a');
  const codex = join(root, 'codex-a');
  for (const path of [join(config, 'cland'), claude, codex]) await mkdir(path, { recursive: true });
  await writeFile(join(config, 'cland', 'accounts.toml'), `[accounts.cc]\nharness = "claude-code"\nconfig_dir = ${JSON.stringify(claude)}\n[accounts.cx]\nharness = "codex"\nhome = ${JSON.stringify(codex)}\n[accounts.oc]\nharness = "opencode"\n`);
  await writeFile(join(claude, 'usage-report.json'), JSON.stringify(usage));
  await writeFile(join(codex, 'rate-limits.json'), JSON.stringify({ rateLimits: { primary: { usedPercent: 41, windowDurationMins: 10080, resetsAt: 1792454400 } } }));
  const cc = await accountClaude(t);
  const cx = await accountCodex(t);
  const env = { ...cc.env, ...cx.env, PATH: `${cc.env.PATH}:${cx.env.PATH}`, XDG_CONFIG_HOME: config };
  return { root, config, claude, codex, cc, cx, env };
}
const listed = async (ui: Awaited<ReturnType<typeof connectUi>>) => {
  const r = await ui.request({ type: 'account.list' });
  assert.equal(r.ok, true, r.error);
  return (r.value as AccountList).accounts;
};

test('startup polls idle Claude and Codex through their harness and refresh keeps a younger reading', async t => {
  const f = await setup(t);
  const { discovery } = await projectHub(t, f.root, f.env);
  const ui = await connectUi(t, discovery);
  const accounts = await eventually('both idle readings', async () => {
    const a = await listed(ui);
    return a.filter(a => a.source?.kind === 'poll').length === 2 ? a : undefined;
  }, 6000);
  assert.deepEqual(accounts.find(a => a.name === 'cc')!.windows.map(w => [w.label, w.usedPercent, w.scope, w.severity]), [
    ['5h', 12, undefined, 'normal'], ['wk', 25, undefined, undefined], ['wk sonnet', 33, 'sonnet', 'warning'],
  ]);
  assert.equal(accounts.find(a => a.name === 'cx')!.windows[0]?.usedPercent, 41, JSON.stringify(accounts));
  assert.deepEqual(accounts.find(a => a.name === 'oc')!.windows, []);
  const calls = (await f.cc.calls()).filter(c => c.args[0] === '-p');
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0]!.args, ['-p', '/usage', '--output-format', 'stream-json', '--verbose']);
  assert.equal(calls[0]!.configDir, f.claude);
  const refreshed = await ui.request({ type: 'account.poll' });
  assert.equal(refreshed.ok, true, refreshed.error);
  assert.deepEqual((refreshed.value as AccountList).accounts, accounts);
  const cli = await cland(f.root, 'account', 'list', '--refresh', '--json');
  assert.equal(cli.code, 0, cli.stderr);
  assert.deepEqual(JSON.parse(cli.stdout).accounts, accounts);
  assert.equal((await f.cc.calls()).filter(c => c.args[0] === '-p').length, 1);
});

async function rows(path: string): Promise<Array<Record<string, unknown>>> {
  return completeJournalLines(await readFile(path, 'utf8').catch(() => '')).filter(Boolean).map(line => JSON.parse(line));
}
async function pollJournal(root: string, ui: Awaited<ReturnType<typeof connectUi>>) {
  assert.equal((await ui.request({ type: 'hub.status', flushLogs: true })).ok, true);
  return (await rows(join(root, '.cland', 'journal.jsonl'))).filter(r => r.event === 'account-polled' || r.event === 'account-poll-failed');
}
const ccPolls = (f: Awaited<ReturnType<typeof setup>>) => rows(join(f.cc.home, 'polls.jsonl'));

test('a hung native poll kills its process group and signed-out readings recover', async t => {
  const f = await setup(t);
  await writeFile(join(f.claude, 'usage-hang'), '1');
  await writeFile(join(f.codex, 'logged-out'), '1');
  const clock = new FakeClock(Date.now());
  const { discovery } = await projectHub(t, f.root, { ...f.env, CLAND_TEST_ACCOUNT_POLL_BOUND_MS: '1200' }, { clock });
  const ui = await connectUi(t, discovery);
  await eventually('timeout journalled', async () => (await pollJournal(f.root, ui)).some(r => r.reason === 'timeout') || undefined);
  assert.equal((await listed(ui)).find(a => a.name === 'cx')?.signedOut, true);
  const descendant = Number(await readFile(join(f.claude, 'usage-descendant'), 'utf8'));
  const parent = Number((await ccPolls(f))[0]!.pid);
  for (const pid of [parent, descendant]) await eventually(`poll process ${pid} killed`, () => {
    try { process.kill(pid, 0); return undefined; } catch { return true; }
  });
  for (const pid of [parent, descendant]) assert.throws(() => process.kill(pid, 0), { code: 'ESRCH' });
  const { unlink } = await import('node:fs/promises');
  await unlink(join(f.claude, 'usage-hang'));
  await unlink(join(f.codex, 'logged-out'));
  await clock.advance(30 * 60_000);
  await ui.request({ type: 'account.poll' });
  const accounts = await listed(ui);
  assert.equal(accounts.find(a => a.name === 'cx')?.signedOut, undefined);
  assert.equal(accounts.find(a => a.name === 'cc')?.source?.kind, 'poll');
  assert.ok((await pollJournal(f.root, ui)).filter(r => r.event === 'account-poll-failed').every(r => typeof r.reason === 'string' && !r.reason.includes('\n') && !r.reason.includes('private output')));
});

test('only two account polls run across the hub, with scratch cwd and sanitized environments', async t => {
  const f = await setup(t);
  const extra = join(f.root, 'claude-b');
  await mkdir(extra);
  await writeFile(join(extra, 'usage-report.json'), JSON.stringify(usage));
  const registry = join(f.config, 'cland', 'accounts.toml');
  const initial = await readFile(registry, 'utf8');
  await writeFile(registry, initial + `[accounts.cd]\nharness = "claude-code"\nconfig_dir = ${JSON.stringify(extra)}\n`);
  for (const dir of [f.claude, extra]) await writeFile(join(dir, 'usage-hold'), '1');
  const { discovery } = await projectHub(t, f.root, { ...f.env, ANTHROPIC_API_KEY: 'test-key', ANTHROPIC_AUTH_TOKEN: 'test-token', CLAUDE_CODE_OAUTH_TOKEN: 'test-oauth', CLAND_TEST_SENTINEL: 'private' });
  const ui = await connectUi(t, discovery);
  await eventually('two Claude polls held', async () => (await ccPolls(f)).length === 2 || undefined);
  assert.equal((await rows(join(f.cx.home, 'polls.jsonl'))).length, 0, 'third poll waits');
  await writeFile(join(f.claude, 'usage-release'), '1');
  await eventually('first Claude poll completion receipt', async () => (await pollJournal(f.root, ui)).some(r => r.event === 'account-polled' && r.account === 'cc') || undefined);
  await eventually('Codex admitted after a slot freed', async () => (await rows(join(f.cx.home, 'polls.jsonl'))).length === 1 || undefined);
  await writeFile(join(extra, 'usage-release'), '1');
  await eventually('second Claude poll completion receipt', async () => (await pollJournal(f.root, ui)).some(r => r.event === 'account-polled' && r.account === 'cd') || undefined);
  await eventually('all polls settled', async () => (await pollJournal(f.root, ui)).filter(r => r.event === 'account-polled').length === 3 || undefined);
  const calls = [...await ccPolls(f), ...await rows(join(f.cx.home, 'polls.jsonl'))];
  for (const call of calls) {
    assert.ok(String(call.cwd).startsWith(join(f.root, '.cland', 'run', 'accounts') + '/'), String(call.cwd));
    const env = call.env as Record<string, string>;
    assert.ok(Object.keys(env).every(key => !key.startsWith('CLAND_') && !['ANTHROPIC_API_KEY', 'ANTHROPIC_AUTH_TOKEN', 'CLAUDE_CODE_OAUTH_TOKEN'].includes(key)), 'poll environment contains only allowed key names');
  }
  assert.equal((calls.find(c => (c.args as string[])[0] === 'app-server')!.env as Record<string, string>).CODEX_HOME, f.codex);
  const { readdir } = await import('node:fs/promises');
  const logs = await readdir(join(f.cx.home, 'log'));
  assert.match(await readFile(join(f.cx.home, 'log', logs[0]!), 'utf8'), /account\/rateLimits\/read {"excludeResetCreditDetails":true}/);
  assert.deepEqual(await readdir(join(f.root, '.cland', 'run', 'accounts')), [], 'scratch directories removed');
});

test('Claude signed out and malformed answers are bounded failures and refresh cannot hammer them', async t => {
  const f = await setup(t);
  await writeFile(join(f.claude, 'logged-out'), '1');
  await writeFile(join(f.codex, 'rate-limits.json'), '{"rateLimits": {"primary": {"usedPercent": "invalid"}}}');
  const { discovery } = await projectHub(t, f.root, f.env);
  const ui = await connectUi(t, discovery);
  await eventually('both failed polls settled', async () => (await pollJournal(f.root, ui)).filter(r => r.event === 'account-polled').length === 2 || undefined);
  assert.equal((await listed(ui)).find(a => a.name === 'cc')?.signedOut, true);
  assert.match((await cland(f.root, 'account', 'list')).stdout, /cc.*signed out/);
  const journal = await pollJournal(f.root, ui);
  assert.deepEqual(journal.filter(r => r.event === 'account-poll-failed').map(r => r.reason).sort(), ['signed out', 'unparsable answer']);
  for (let i = 0; i < 3; i++) await ui.request({ type: 'account.poll' });
  assert.equal((await ccPolls(f)).length, 1);
});

test('a complete idle poll cycle makes no non-loopback connection and runs only usage commands', async t => {
  const f = await setup(t);
  const record = join(f.root, 'connections.jsonl');
  await writeFile(record, '');
  const preload = new URL('./account-network-preload.ts', import.meta.url).href;
  const { discovery } = await startDaemon(t, f.root, { ...f.env, NODE_OPTIONS: `--import ${preload}`, ACCOUNT_NETWORK_RECORD: record });
  const ui = await connectUi(t, discovery);
  await eventually('instrumented cycle complete', async () => (await pollJournal(f.root, ui)).filter(r => r.event === 'account-polled' && r.ok).length === 2 || undefined);
  const loaded = (await readFile(record + '.loaded', 'utf8')).trim().split('\n').map(Number);
  assert.ok(loaded.includes(discovery.pid), 'recorder loaded in the actual daemon');
  for (const call of [...await ccPolls(f), ...await rows(join(f.cx.home, 'polls.jsonl'))]) assert.ok(loaded.includes(Number(call.pid)), 'recorder also loaded in each fake harness');
  assert.equal(await readFile(record, 'utf8'), '');
  assert.deepEqual((await f.cc.calls()).map(c => c.args[0]), ['-p']);
  const polls = await rows(join(f.cx.home, 'polls.jsonl'));
  assert.deepEqual(polls.map(c => c.args), [['app-server']]);
});

test('manual frame and CLI refresh poll after five-minute minimum even before the normal floor', async t => {
  const f = await setup(t);
  const clock = new FakeClock(Date.now());
  const { discovery } = await projectHub(t, f.root, { ...f.env, CLAND_TEST_ACCOUNT_POLL_MINIMUM_MS: '400' }, { clock });
  const ui = await connectUi(t, discovery);
  await eventually('startup cycle settled', async () => (await pollJournal(f.root, ui)).filter(r => r.event === 'account-polled').length === 2 || undefined);
  await writeFile(join(f.claude, 'usage-report.json'), JSON.stringify({ rate_limits: { limits: [{ ...usage.rate_limits.limits[0], percent: 51 }] } }));
  await clock.advance(450);
  const refreshed = await ui.request({ type: 'account.poll' }, 15000);
  assert.equal(refreshed.ok, true, refreshed.error);
  assert.equal((refreshed.value as AccountList).accounts.find(a => a.name === 'cc')?.windows[0]?.usedPercent, 51);
  assert.equal((await ccPolls(f)).length, 2);
  await writeFile(join(f.claude, 'usage-report.json'), JSON.stringify({ rate_limits: { limits: [{ ...usage.rate_limits.limits[0], percent: 63 }] } }));
  await clock.advance(450);
  // Native held-refresh freshness; account-cli.test.ts separately advances the CLI deadline.
  await writeFile(join(f.claude, 'usage-hold'), '1');
  const result = cland(f.root, 'account', 'list', '--refresh', '--json');
  await eventually('CLI poll held', async () => (await ccPolls(f)).length === 3 || undefined);
  await writeFile(join(f.claude, 'usage-release'), '1');
  await eventually('held CLI poll completion receipt', async () => (await pollJournal(f.root, ui)).filter(r => r.event === 'account-polled' && r.account === 'cc').length === 3 || undefined);
  const cli = await result;
  assert.equal(cli.code, 0, cli.stderr);
  assert.equal(JSON.parse(cli.stdout).accounts.find((a: { name: string }) => a.name === 'cc').windows[0].usedPercent, 63);
});
