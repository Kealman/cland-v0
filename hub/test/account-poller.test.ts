// Protocol-first idle polling; only scratch accounts and the fake harnesses.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { cland, connectUi, eventually, FAKE_CLAUDE_DIR, FAKE_CODEX_DIR, fakeClaude, fakeCodex, projectHub, startDaemon, tempProject } from './harness.ts';
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
  const cc = await fakeClaude(t);
  const cx = await fakeCodex(t);
  const env = { ...cc.env, ...cx.env, PATH: `${cc.env.PATH}:${cx.env.PATH}`, XDG_CONFIG_HOME: config, CLAND_CLAUDE_BIN: join(FAKE_CLAUDE_DIR, 'claude'), CLAND_CODEX_BIN: join(FAKE_CODEX_DIR, 'codex') };
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
  return (await readFile(path, 'utf8').catch(() => '')).trim().split('\n').filter(Boolean).map(line => JSON.parse(line));
}
async function pollJournal(root: string, ui: Awaited<ReturnType<typeof connectUi>>) {
  assert.equal((await ui.request({ type: 'hub.status', flushLogs: true })).ok, true);
  return (await rows(join(root, '.cland', 'journal.jsonl'))).filter(r => r.event === 'account-polled' || r.event === 'account-poll-failed');
}
const ccPolls = (f: Awaited<ReturnType<typeof setup>>) => rows(join(f.cc.home, 'polls.jsonl'));

test('last poll survives restart; a running named or default account and OpenCode are skipped', async t => {
  const f = await setup(t);
  const { discovery } = await startDaemon(t, f.root, f.env);
  let ui = await connectUi(t, discovery);
  await eventually('initial polls settled', async () => (await pollJournal(f.root, ui)).filter(r => r.event === 'account-polled').length === 2 || undefined);
  assert.equal((await cland(f.root, 'hub', 'stop')).code, 0);
  const next = await startDaemon(t, f.root, f.env);
  ui = await connectUi(t, next.discovery);
  await ui.request({ type: 'account.poll' });
  assert.equal((await ccPolls(f)).length, 1);
  assert.equal((await rows(join(f.cx.home, 'polls.jsonl'))).length, 1);
  // Force the manual minimum to be due on the next start; the 15m floor is still in force.
  assert.equal((await cland(f.root, 'hub', 'stop')).code, 0);
  const resumed = await startDaemon(t, f.root, { ...f.env, CLAUDE_CONFIG_DIR: f.claude, CLAND_TEST_ACCOUNT_POLL_MINIMUM_MS: '1' });
  ui = await connectUi(t, resumed.discovery);
  const r = await ui.request({ type: 'session.launch', name: 'live', harness: 'claude-code', account: 'cc' }, 30000);
  assert.equal(r.ok, true, r.error);
  const count = (await ccPolls(f)).length;
  await ui.request({ type: 'account.poll' });
  assert.equal((await ccPolls(f)).length, count, 'running named account is skipped');
  assert.equal((await ui.request({ type: 'session.stop', session: 'live' }, 30000)).ok, true);
  // A path-less registry alias refers to the same default as an unnamed launch.
  await writeFile(join(f.config, 'cland', 'accounts.toml'), '[accounts.alias]\nharness = "claude-code"\n[accounts.oc]\nharness = "opencode"\n');
  assert.equal((await ui.request({ type: 'session.launch', name: 'default-live', harness: 'claude-code' }, 30000)).ok, true);
  const before = (await ccPolls(f)).length;
  await ui.request({ type: 'account.poll' });
  assert.equal((await ccPolls(f)).length, before);
  assert.equal((await listed(ui)).find(a => a.name === 'oc')?.source, null);
});

test('manual refresh respects the minimum, timer respects the floor, and queued calls share one poll', async t => {
  const f = await setup(t);
  await writeFile(join(f.claude, 'usage-hold'), '1');
  const floorMs = 600, minimumMs = 200;
  const { discovery } = await projectHub(t, f.root, { ...f.env, CLAND_TEST_ACCOUNT_POLL_FLOOR_MS: String(floorMs), CLAND_TEST_ACCOUNT_POLL_MINIMUM_MS: String(minimumMs) });
  const ui = await connectUi(t, discovery);
  await eventually('held poll started', async () => (await ccPolls(f)).length === 1 || undefined);
  const requests = Array.from({ length: 4 }, () => ui.request({ type: 'account.poll' }, 15000));
  await new Promise(r => setTimeout(r, 1.1 * minimumMs)); // Negative: single flight persists beyond the configured manual minimum.
  assert.equal((await ccPolls(f)).length, 1, 'still single flight beyond the manual minimum');
  await writeFile(join(f.claude, 'usage-release'), '1');
  for (const result of await Promise.all(requests)) assert.equal(result.ok, true, result.error);
  await eventually('timer polls again', async () => (await ccPolls(f)).length >= 2 || undefined);
  const calls = await ccPolls(f);
  assert.ok(Number(calls[1]!.at) - Number(calls[0]!.at) >= floorMs, JSON.stringify(calls));
  const before = calls.length;
  assert.equal((await ui.request({ type: 'account.poll' })).ok, true);
  assert.equal((await ccPolls(f)).length, before, 'manual minimum keeps cached reading');
});

test('failed polls back off across restart, timeouts kill the process group, signed-out views recover', async t => {
  const f = await setup(t);
  await writeFile(join(f.claude, 'usage-fail'), '1');
  await writeFile(join(f.codex, 'logged-out'), '1');
  const env = { ...f.env, CLAND_TEST_ACCOUNT_POLL_FLOOR_MS: '1300', CLAND_TEST_ACCOUNT_POLL_MINIMUM_MS: '1', CLAND_TEST_ACCOUNT_POLL_BOUND_MS: '1200' };
  const { discovery } = await startDaemon(t, f.root, env);
  let ui = await connectUi(t, discovery);
  await eventually('failed polls journalled', async () => (await pollJournal(f.root, ui)).filter(r => r.event === 'account-polled').length === 2 || undefined);
  assert.equal((await listed(ui)).find(a => a.name === 'cx')?.signedOut, true);
  for (let i = 0; i < 3; i++) assert.equal((await ui.request({ type: 'account.poll' })).ok, true);
  assert.equal((await ccPolls(f)).length, 1, 'refresh cannot bypass failure backoff');
  assert.equal((await cland(f.root, 'hub', 'stop')).code, 0);
  const restarted = await startDaemon(t, f.root, env);
  ui = await connectUi(t, restarted.discovery);
  await ui.request({ type: 'account.poll' });
  assert.equal((await ccPolls(f)).length, 1, 'backoff persists');
  await eventually('second failed poll', async () => (await ccPolls(f)).length === 2 || undefined, 6000);
  let calls = await ccPolls(f);
  assert.ok(Number(calls[1]!.at) - Number(calls[0]!.at) >= 2600);
  const { unlink } = await import('node:fs/promises');
  await unlink(join(f.claude, 'usage-fail'));
  await writeFile(join(f.claude, 'usage-hang'), '1');
  await eventually('hung poll started', async () => (await ccPolls(f)).length === 3 || undefined, 9000);
  await eventually('timeout journalled', async () => (await pollJournal(f.root, ui)).some(r => r.reason === 'timeout') || undefined, 5000);
  const descendant = Number(await readFile(join(f.claude, 'usage-descendant'), 'utf8'));
  const parent = Number((await ccPolls(f))[2]!.pid);
  for (const pid of [parent, descendant]) await eventually(`poll process ${pid} killed`, () => {
    try { process.kill(pid, 0); return undefined; } catch { return true; }
  });
  calls = await ccPolls(f);
  assert.ok(Number(calls[2]!.at) - Number(calls[1]!.at) >= 5200, 'floor caps at four times the base');
  await unlink(join(f.claude, 'usage-hang'));
  await unlink(join(f.codex, 'logged-out'));
  await eventually('signed-out Codex recovers', async () => {
    const a = (await listed(ui)).find(a => a.name === 'cx')!;
    return !a.signedOut && a.windows.length ? true : undefined;
  }, 9000);
  await eventually('Claude recovers', async () => (await listed(ui)).find(a => a.name === 'cc')?.source?.kind === 'poll' || undefined, 9000);
  const recovery = (await ccPolls(f)).length;
  await eventually('success restores base floor', async () => (await ccPolls(f)).length > recovery || undefined, 5000);
  calls = await ccPolls(f);
  const lastInterval = Number(calls.at(-1)!.at) - Number(calls.at(-2)!.at);
  assert.ok(lastInterval >= 1300 && lastInterval < 5200, String(lastInterval));
  const journal = await pollJournal(f.root, ui);
  assert.ok(journal.filter(r => r.event === 'account-poll-failed').every(r => typeof r.reason === 'string' && !r.reason.includes('\n') && !r.reason.includes('private output')));
});

test('a newer session push wins over a delayed idle poll', async t => {
  const f = await setup(t);
  await writeFile(join(f.claude, 'usage-hold'), '1');
  const { discovery } = await projectHub(t, f.root, f.env);
  const ui = await connectUi(t, discovery);
  await eventually('poll started', async () => (await ccPolls(f)).length === 1 || undefined);
  const launch = await ui.request({ type: 'session.launch', name: 'push', harness: 'claude-code', account: 'cc' }, 30000);
  assert.equal(launch.ok, true, launch.error);
  const p = (launch.value as { process: { sessionId: string } }).process;
  const at = Date.now();
  assert.equal((await ui.request({ type: 'session.signal', session: 'push', launch: p.sessionId, event: 'mod-measure', at, payload: { rateLimits: [{ kind: 'five_hour', percentUsed: 77, resetsAt: '2026-10-15T00:00:00Z' }] } })).ok, true);
  await eventually('newer push stored', async () => (await listed(ui)).find(a => a.name === 'cc')?.windows[0]?.usedPercent === 77 || undefined);
  await writeFile(join(f.claude, 'usage-release'), '1');
  await eventually('poll finished', async () => (await pollJournal(f.root, ui)).filter(r => r.event === 'account-polled').length === 2 || undefined);
  const reading = (await listed(ui)).find(a => a.name === 'cc')!;
  assert.deepEqual(reading.source, { kind: 'session', session: 'push' });
  assert.equal(reading.windows[0]?.usedPercent, 77);
  assert.equal(reading.at, new Date(at).toISOString());
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
  await eventually('Codex admitted after a slot freed', async () => (await rows(join(f.cx.home, 'polls.jsonl'))).length === 1 || undefined);
  await writeFile(join(extra, 'usage-release'), '1');
  await eventually('all polls settled', async () => (await pollJournal(f.root, ui)).filter(r => r.event === 'account-polled').length === 3 || undefined);
  const calls = [...await ccPolls(f), ...await rows(join(f.cx.home, 'polls.jsonl'))];
  for (const call of calls) {
    assert.ok(String(call.cwd).startsWith(join(f.root, '.cland', 'run', 'accounts') + '/'), String(call.cwd));
    const env = call.env as Record<string, string>;
    assert.ok(Object.keys(env).every(key => !key.startsWith('CLAND_') && !['ANTHROPIC_API_KEY', 'ANTHROPIC_AUTH_TOKEN', 'CLAUDE_CODE_OAUTH_TOKEN'].includes(key)), JSON.stringify(env));
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

test('hub source has no provider endpoint or credential-store access', async () => {
  const { readdir } = await import('node:fs/promises');
  const root = new URL('../src/', import.meta.url);
  const forbidden = ['api.anthropic.com', 'oauth/usage', 'chatgpt.com', 'wham/usage', 'opencode.ai', 'auth.json', '.credentials.json', 'opencode.db', 'security find-generic-password'];
  // Exact passive literals only: a provider target elsewhere (including any new call site) fails.
  const allowedTargets = [
    { name: 'OpenCode schema metadata', file: '/adapters/opencode.ts', literal: "$schema: 'https://opencode.ai/config.json',", reason: 'editor metadata; no request is made' },
    { name: 'OpenCode installation guidance', file: '/doctor/toolchain.ts', literal: "install: 'install OpenCode v2 (https://opencode.ai/v2/install)',", reason: 'human-facing doctor text; no request is made' },
    { name: 'OpenCode unsupported-major remedy', file: '/doctor/toolchain.ts', literal: '`install OpenCode ${formatVersion(range.min)} (https://opencode.ai/v2/install)`', reason: 'human-facing doctor text; no request is made' },
    { name: 'OpenCode selected database path', file: '/accounts/registry.ts', literal: "export const openCodeDatabase = (env: NodeJS.ProcessEnv) => env.OPENCODE_DB || join(dataHome(env), 'opencode', 'opencode.db');", reason: 'pure saved/default database path selection for launch and doctor; no database contents are read' },
    { name: 'cland OpenCode database path', file: '/accounts/registry.ts', literal: "export const clandOpenCodeDatabase = (env: NodeJS.ProcessEnv) => join(dataHome(env), 'cland', 'opencode', 'opencode.db');", reason: 'pure isolated database path construction; no database contents are read' },
    { name: 'E-271 DigitalOcean client', file: '/executor/droplet/api.ts', literal: 'https://api.digitalocean.com/v2', reason: 'authorized executor lifecycle calls, not harness-account limits' },
  ];
  const scan = async (dir: URL): Promise<void> => {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const path = new URL(entry.name + (entry.isDirectory() ? '/' : ''), dir);
      if (entry.isDirectory()) await scan(path);
      else if (entry.name.endsWith('.ts')) {
        let text = await readFile(path, 'utf8');
        for (const allowed of allowedTargets) if (path.pathname.endsWith(allowed.file)) text = text.replace(allowed.literal, '');
        for (const needle of forbidden) assert.ok(!text.includes(needle), `${path.pathname} contains ${needle}`);
      }
    }
  };
  await scan(root);
});

test('manual frame and CLI refresh poll after five-minute minimum even before the normal floor', async t => {
  const f = await setup(t);
  const { discovery } = await projectHub(t, f.root, { ...f.env, CLAND_TEST_ACCOUNT_POLL_MINIMUM_MS: '400' });
  const ui = await connectUi(t, discovery);
  await eventually('startup cycle settled', async () => (await pollJournal(f.root, ui)).filter(r => r.event === 'account-polled').length === 2 || undefined);
  await writeFile(join(f.claude, 'usage-report.json'), JSON.stringify({ rate_limits: { limits: [{ ...usage.rate_limits.limits[0], percent: 51 }] } }));
  await new Promise(r => setTimeout(r, 450));
  const refreshed = await ui.request({ type: 'account.poll' }, 15000);
  assert.equal(refreshed.ok, true, refreshed.error);
  assert.equal((refreshed.value as AccountList).accounts.find(a => a.name === 'cc')?.windows[0]?.usedPercent, 51);
  assert.equal((await ccPolls(f)).length, 2);
  await writeFile(join(f.claude, 'usage-report.json'), JSON.stringify({ rate_limits: { limits: [{ ...usage.rate_limits.limits[0], percent: 63 }] } }));
  await new Promise(r => setTimeout(r, 450));
  // A slow but bounded harness still gets a fresh CLI answer, beyond its usual 3s read deadline.
  await writeFile(join(f.claude, 'usage-hold'), '1');
  const result = cland(f.root, 'account', 'list', '--refresh', '--json');
  await eventually('CLI poll held', async () => (await ccPolls(f)).length === 3 || undefined);
  await new Promise(r => setTimeout(r, 3200)); // Deadline: a held CLI refresh must outlive the ordinary three-second read budget.
  await writeFile(join(f.claude, 'usage-release'), '1');
  const cli = await result;
  assert.equal(cli.code, 0, cli.stderr);
  assert.equal(JSON.parse(cli.stdout).accounts.find((a: { name: string }) => a.name === 'cc').windows[0].usedPercent, 63);
});
