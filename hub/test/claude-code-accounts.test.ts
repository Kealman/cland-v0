// Real hub frames and the fake per-directory Claude supervisor; every account is scratch-owned.
import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { HarnessProcessView } from '../src/protocol.ts';
import { clandWithEnv, clauseAnswered, connectUi, eventually, FAKE_CLAUDE_DIR, fakeClaude, killDaemon, NO_PS, sleep, projectHub, startDaemon, tempProject } from './harness.ts';

async function fixture(t: TestContext, extraEnv: Record<string, string> = {}, serve: typeof projectHub | typeof startDaemon = projectHub) {
  const root = await tempProject(t);
  const fake = await fakeClaude(t);
  const config = join(root, 'registry');
  const dirs = { a: join(root, 'claude-a'), b: join(root, "claude-b's directory"), idle: join(root, 'idle'), default: join(root, 'default') };
  for (const dir of [...Object.values(dirs), join(config, 'cland')]) await mkdir(dir, { recursive: true });
  const registry = join(config, 'cland', 'accounts.toml');
  await writeFile(registry, Object.entries(dirs).filter(([name]) => name !== 'default').map(([name, dir]) => `[accounts.claude-${name}]\nharness = "claude-code"\nconfig_dir = ${JSON.stringify(dir)}\n`).join(''));
  const env: Record<string, string> = { ...fake.env, CLAND_CLAUDE_BIN: join(FAKE_CLAUDE_DIR, 'claude'), XDG_CONFIG_HOME: config, CLAUDE_CONFIG_DIR: dirs.default, ANTHROPIC_API_KEY: 'fake-key', ANTHROPIC_AUTH_TOKEN: 'fake-auth', CLAUDE_CODE_OAUTH_TOKEN: 'fake-oauth', ...extraEnv };
  const { discovery } = await serve(t, root, env);
  const ui = await connectUi(t, discovery);
  const jobs = async () => Promise.all((await readdir(join(fake.home, 'jobs'))).filter(file => /^[^.]+\.json$/.test(file)).map(async file => JSON.parse(await readFile(join(fake.home, 'jobs', file), 'utf8')) as { id: string; sessionId: string; name: string; configDir: string; authVariables: string[]; resume: boolean }));
  t.after(async () => { for (const file of await readdir(join(fake.home, 'sessions')).catch(() => [])) { const s = JSON.parse(await readFile(join(fake.home, 'sessions', file), 'utf8')); await killDaemon(s.pid); } });
  const launch = async (name: string, account?: string) => {
    const r = await ui.request({ type: 'session.launch', name, harness: 'claude-code', ...(account ? { account } : {}) }, 30000);
    assert.equal(r.ok, true, r.error);
    return (r.value as { process: HarnessProcessView }).process;
  };
  const calls = async () => (await readFile(join(fake.home, 'invocations.jsonl'), 'utf8')).trim().split('\n').filter(Boolean).map(line => JSON.parse(line)) as Array<{ at: number; args: string[]; configDir: string }>;
  return { root, fake, dirs, registry, env, ui, launch, jobs, calls };
}

test('Claude account commands and attach use their own directory and named accounts exclude inherited authentication', async t => {
  const f = await fixture(t);
  const a = await f.launch('a', 'claude-a');
  const b = await f.launch('b', 'claude-b');
  const defaultSession = await f.launch('default');
  const jobs = await f.jobs();
  for (const [p, dir] of [[a, f.dirs.a], [b, f.dirs.b], [defaultSession, f.dirs.default]] as const) {
    const job = jobs.find(j => j.id === p.harnessId)!;
    assert.equal(job.configDir, dir);
    assert.deepEqual(job.authVariables, p.account ? [] : ['ANTHROPIC_API_KEY', 'ANTHROPIC_AUTH_TOKEN', 'CLAUDE_CODE_OAUTH_TOKEN']);
  }
  assert.ok(b.attach?.startsWith('CLAUDE_CONFIG_DIR='));
  assert.ok(!defaultSession.attach?.startsWith('CLAUDE_CONFIG_DIR='));
  const attached = await new Promise<string>((resolve, reject) => execFile('/bin/sh', ['-c', b.attach!], { env: { ...process.env, ...f.env }, encoding: 'utf8' }, (err, out) => err ? reject(err) : resolve(out)));
  assert.match(attached, /fake claude attached/);
  for (const p of [a, b, defaultSession]) assert.equal((await f.ui.request({ type: 'session.stop', session: p.name }, 30000)).ok, true);
  const calls = await f.calls();
  for (const [p, dir] of [[a, f.dirs.a], [b, f.dirs.b], [defaultSession, f.dirs.default]] as const) {
    assert.ok(calls.some(c => c.args[0] === '--bg' && c.args.includes(p.name) && c.configDir === dir));
    assert.ok(calls.some(c => c.args[0] === 'agents' && c.configDir === dir));
    assert.ok(calls.some(c => c.args[0] === 'stop' && c.args[1] === p.harnessId && c.configDir === dir));
  }
});

test('discovery, watch and restart share each live directory schedule; saved directories survive registry and hub environment edits', async t => {
  const f = await fixture(t, {}, startDaemon);
  const a = await f.launch('a', 'claude-a');
  const anotherA = await f.launch('another-a', 'claude-a');
  const b = await f.launch('b', 'claude-b');
  const unpinned = await f.launch('unpinned');
  await eventually('all three live directories polled twice', async () => {
    const polls = (await f.calls()).filter(c => c.args[0] === 'agents');
    return [f.dirs.a, f.dirs.b, f.dirs.default].every(dir => polls.filter(c => c.configDir === dir).length >= 2) ? true : undefined;
  });
  const polls = (await f.calls()).filter(c => c.args[0] === 'agents');
  for (const dir of [f.dirs.a, f.dirs.b, f.dirs.default]) {
    const own = polls.filter(c => c.configDir === dir);
    assert.ok(own.length >= 2);
    for (let i = 1; i < own.length; i++) assert.ok(own[i]!.at - own[i - 1]!.at >= Number(f.env.CLAND_CLAUDE_AGENTS_MS), 'one agents invocation per directory per interval, discovery included');
  }
  assert.ok(!polls.some(c => c.configDir === f.dirs.idle));
  const originalJobs = await f.jobs();
  // After a restart, all four rows re-find their native conversation from the shared snapshots.
  assert.equal((await clandWithEnv(f.root, f.env, 'hub', 'stop')).code, 0);
  await writeFile(f.registry, `[accounts.claude-a]\nharness = "claude-code"\nconfig_dir = ${JSON.stringify(f.dirs.idle)}\n`);
  // Keep a long restart interval: four explicit resumes must share one snapshot.
  const restartAgentsMs = 2000;
  const lastPollAt = Math.max(...(await f.calls()).filter(c => c.args[0] === 'agents').map(c => c.at));
  await eventually('saved floor expires while stopped', () => Date.now() - lastPollAt >= restartAgentsMs ? true : undefined);
  const before = (await f.calls()).length;
  const { discovery } = await startDaemon(t, f.root, { ...f.env, CLAUDE_CONFIG_DIR: f.dirs.idle, CLAND_CLAUDE_AGENTS_MS: String(restartAgentsMs) });
  const ui = await connectUi(t, discovery);
  for (const p of [a, anotherA, b, unpinned]) {
    const r = await ui.request({ type: 'session.resume', session: p.name }, 30000);
    assert.equal(r.ok, true, r.error);
    const found = r.value as { found: boolean; process: HarnessProcessView };
    assert.equal(found.found, true);
    if (p.pid !== null) assert.equal(found.process.pid, p.pid);
    assert.equal(typeof found.process.pid, 'number');
    assert.equal(found.process.harnessSessionId, originalJobs.find(job => job.id === p.harnessId)?.sessionId);
  }
  const startupCalls = (await f.calls()).slice(before).filter(c => c.args[0] === 'agents');
  for (const dir of [f.dirs.a, f.dirs.b, f.dirs.default]) assert.equal(startupCalls.filter(c => c.configDir === dir).length, 1, 'startup shares one fresh query per directory');
  assert.ok(!startupCalls.some(c => c.configDir === f.dirs.idle));
  for (const [p, dir] of [[a, f.dirs.a], [unpinned, f.dirs.default]] as const) {
    const r = await ui.request({ type: 'session.resume', session: p.name, relaunch: true }, 30000);
    assert.equal(r.ok, true, r.error);
    assert.equal((r.value as { process: HarnessProcessView }).process.harnessSessionId, p.harnessSessionId);
    const job = (await f.jobs()).find(j => j.name === p.name)!;
    assert.equal(job.configDir, dir);
    assert.equal(job.resume, true);
    assert.ok((await f.calls()).some(c => c.args[0] === '--bg' && c.args.includes('--resume') && c.args.includes(p.harnessSessionId!) && c.configDir === dir));
  }
  assert.equal((await ui.request({ type: 'session.stop', session: b.name }, 30000)).ok, true);
  const bStopped = (await f.calls()).filter(c => c.args[0] === 'agents' && c.configDir === f.dirs.b).length;
  const aBefore = (await f.calls()).filter(c => c.args[0] === 'agents' && c.configDir === f.dirs.a).length;
  await eventually('a still polls after the last b session stops', async () => (await f.calls()).filter(c => c.args[0] === 'agents' && c.configDir === f.dirs.a).length > aBefore ? true : undefined);
  assert.equal((await f.calls()).filter(c => c.args[0] === 'agents' && c.configDir === f.dirs.b).length, bStopped);
  for (const p of [a, anotherA, unpinned]) {
    const r = await ui.request({ type: 'session.stop', session: p.name }, 30000);
    assert.equal(r.ok, true, r.error);
  }
  const stoppedAt = (await f.calls()).length;
  await sleep(1.15 * restartAgentsMs); // Negative: no directory polling after one full interval.
  assert.equal((await f.calls()).length, stoppedAt, 'no directory is polled after its last session stops');
});

test('a signed-out account has one directory notice and event while another account keeps polling', async t => {
  const f = await fixture(t);
  const a = await f.launch('a', 'claude-a');
  const b = await f.launch('b', 'claude-b');
  await eventually('both sessions completed startup hooks', async () => {
    const logs = await Promise.all([a, b].map(p => f.fake.log(p.harnessId!)));
    return logs.every(log => log.includes('hooks SessionStart done') && log.includes('mod bridge bridged')) ? true : undefined;
  });
  await writeFile(join(f.dirs.b, 'agents-hold'), '');
  const inFlight = await eventually('a b poll is in flight before authentication fails', async () => {
    return await readFile(join(f.dirs.b, 'agents-started'), 'utf8').catch(() => undefined);
  });
  await writeFile(join(f.dirs.b, 'logged-out'), '');
  const signal = { type: 'session.signal', session: b.name, launch: b.sessionId, event: 'turn-end', payload: { hook_event_name: 'StopFailure', error: 'authentication_failed' } };
  for (let i = 0; i < 2; i++) assert.equal((await f.ui.request(signal)).ok, true);
  // A CLI child admitted before the latch may only reach its call log afterwards.
  // Drain that known child rather than guessing at its startup time with a sleep.
  await writeFile(join(f.dirs.b, 'agents-release'), '');
  await eventually('the pre-latch child finishes', async () => {
    return await readFile(join(f.dirs.b, 'agents-finished'), 'utf8').catch(() => undefined);
  });
  const before = (await f.calls()).filter(c => c.args[0] === 'agents');
  await eventually('claude-a keeps polling while claude-b is signed out', async () => {
    const polls = (await f.calls()).filter(c => c.args[0] === 'agents' && c.configDir === f.dirs.a);
    return polls.length >= before.filter(c => c.configDir === f.dirs.a).length + 2 ? true : undefined;
  });
  const after = (await f.calls()).filter(c => c.args[0] === 'agents');
  assert.equal(after.filter(c => c.configDir === f.dirs.b).length, before.filter(c => c.configDir === f.dirs.b).length);
  assert.equal(await readFile(join(f.dirs.b, 'agents-started'), 'utf8'), inFlight, 'no new child starts in the latched directory');
  assert.ok(after.filter(c => c.configDir === f.dirs.a).length > before.filter(c => c.configDir === f.dirs.a).length);
  const rows = ((await f.ui.request({ type: 'session.list' })).value as { processes: HarnessProcessView[] }).processes;
  assert.equal(rows.find(p => p.name === b.name)?.stateReason, 'signed-out');
  assert.equal(rows.find(p => p.name === a.name)?.stateReason, undefined);
  assert.equal((await f.ui.request({ type: 'hub.status', flushLogs: true })).ok, true);
  const journal = (await readFile(join(f.root, '.cland', 'journal.jsonl'), 'utf8')).trim().split('\n').map(line => JSON.parse(line));
  const events = journal.filter(e => e.event === 'claude-signed-out');
  assert.equal(events.length, 1);
  assert.equal(events[0].account, 'claude-b');
  assert.equal(events[0].configDir, f.dirs.b);
  const history = (await f.ui.request({ type: 'topic.history', topic: 'agents' })).value as { messages: Array<{ kind?: string; text: string }> };
  const notices = history.messages.filter(m => m.kind === 'claude-signed-out');
  assert.equal(notices.length, 1);
  assert.ok(notices[0]!.text.includes('claude-b'));
  assert.ok(notices[0]!.text.includes(f.dirs.b));
  assert.ok(!(await f.calls()).some(c => ['auth', 'doctor'].includes(c.args[0]!)));
});

test('logged-out turns fail authentication and a per-account latch survives the restart reconnect turn for three 30 s periods', async t => {
  const f = await fixture(t, { CLAND_CLAUDE_AGENTS_MS: '30000' }, startDaemon);
  assert.equal((await f.ui.request({ type: 'subscribe' })).ok, true);
  const launched = await f.ui.request({ type: 'session.launch', name: 'signed-out', harness: 'claude-code', account: 'claude-b', role: 'coordinator' }, 30000);
  assert.equal(launched.ok, true, launched.error);
  const b = (launched.value as { process: HarnessProcessView }).process;
  await clauseAnswered(f.ui, b.name);
  await eventually('the initial successful turn hooks have posted', async () => {
    const log = await f.fake.log(b.harnessId!);
    return log.includes('hooks Stop done') && log.includes('session.measure done') ? true : undefined;
  });
  const initialLog = await f.fake.log(b.harnessId!);
  await writeFile(join(f.dirs.b, 'logged-out'), '');
  assert.equal((await f.ui.request({ type: 'topic.send', topic: 'general', to: [b.name], text: 'try a signed-out turn' })).ok, true);
  const failedLog = await eventually('the logged-out delivery finishes its hook', async () => {
    const log = (await f.fake.log(b.harnessId!)).slice(initialLog.length);
    return /hooks (Stop|StopFailure) done/.test(log) && log.includes('session.measure done') ? log : undefined;
  });
  assert.match(failedLog, /hooks StopFailure done/, 'a logged-out turn reports authentication failure');
  assert.doesNotMatch(failedLog, /hooks Stop done|pong:/, 'no successful Stop or answer while signed out');
  const row = async (ui: typeof f.ui) => {
    const r = await ui.request({ type: 'session.list' });
    assert.equal(r.ok, true, r.error);
    return (r.value as { processes: HarnessProcessView[] }).processes.find(p => p.name === b.name)!;
  };
  assert.equal((await row(f.ui)).stateReason, 'signed-out', 'the real auth failure latches the directory');
  const before = (await f.calls()).filter(c => c.args[0] === 'agents' && c.configDir === f.dirs.b).length;
  const beforeRestartLog = await f.fake.log(b.harnessId!);
  f.ui.close();
  assert.equal((await clandWithEnv(f.root, f.env, 'hub', 'stop')).code, 0);
  const { discovery } = await startDaemon(t, f.root, f.env);
  const ui = await connectUi(t, discovery);
  const restartedAt = Date.now();
  await eventually('the reconnect role delivery also fails authentication', async () => {
    const log = (await f.fake.log(b.harnessId!)).slice(beforeRestartLog.length);
    return log.includes('submitted:') && log.includes('cland hub: you hold the role') && log.includes('hooks StopFailure done') && log.includes('session.measure done') ? true : undefined;
  });
  assert.doesNotMatch((await f.fake.log(b.harnessId!)).slice(beforeRestartLog.length), /hooks Stop done|pong:/);
  for (let period = 1; period <= 3; period++) {
    await sleep(Math.max(0, restartedAt + period * 30000 - Date.now()));
    assert.equal((await f.calls()).filter(c => c.args[0] === 'agents' && c.configDir === f.dirs.b).length, before, `no signed-out agents call through period ${period}`);
    const current = await row(ui);
    assert.equal(current.status, 'running');
    assert.equal(current.stateReason, 'signed-out');
  }
  assert.ok(Date.now() - restartedAt >= 90000);
  assert.equal((await ui.request({ type: 'hub.status', flushLogs: true })).ok, true);
  const journal = (await readFile(join(f.root, '.cland', 'journal.jsonl'), 'utf8')).trim().split('\n').map(line => JSON.parse(line));
  assert.equal(journal.filter(e => e.event === 'claude-signed-out' && e.configDir === f.dirs.b).length, 1);
  const history = (await ui.request({ type: 'topic.history', topic: 'agents' })).value as { messages: Array<{ kind?: string }> };
  assert.equal(history.messages.filter(m => m.kind === 'claude-signed-out').length, 1);
  await rm(join(f.dirs.b, 'logged-out'));
  const beforeRecoveryLog = await f.fake.log(b.harnessId!);
  assert.equal((await ui.request({ type: 'topic.send', topic: 'general', to: [b.name], text: 'signed in again' })).ok, true);
  await eventually('a genuinely successful turn lifts the latch', async () => {
    const log = (await f.fake.log(b.harnessId!)).slice(beforeRecoveryLog.length);
    return log.includes('hooks Stop done') && (await row(ui)).stateReason === undefined ? true : undefined;
  });
});

test('a failed account launch names its directory and sign-in or trust remedies and makes no retry', async t => {
  const f = await fixture(t);
  await writeFile(join(f.dirs.b, 'logged-out'), '');
  const r = await f.ui.request({ type: 'session.launch', name: 'failed', account: 'claude-b' });
  assert.equal(r.ok, false);
  for (const text of ['claude-b', f.dirs.b, 'CLAUDE_CONFIG_DIR=', 'claude auth login', 'trust the project', f.root]) assert.ok(r.error?.includes(text), `error names ${text}`);
  await sleep(4 * Number(f.env.CLAND_CLAUDE_AGENTS_MS)); // Negative: failed launch makes no discovery calls for four intervals.
  assert.deepEqual((await f.calls()).filter(c => c.args[0] !== '-p').map(c => c.args[0]), ['--bg']);
  assert.deepEqual(await f.jobs(), []);
});

test('a late Claude PID can be stopped while its identity probe is pending', { skip: NO_PS }, async t => {
  const bin = await tempProject(t, 'cland-claude-pid-probe-');
  const target = join(bin, 'target');
  const entered = join(bin, 'entered');
  const release = join(bin, 'release');
  await writeFile(join(bin, 'ps'), `#!${process.execPath}
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
const args = process.argv.slice(2);
if (args[0] === '-o' && args[1] === 'pid=,lstart=' && existsSync(${JSON.stringify(target)}) && args[3].split(',').includes(readFileSync(${JSON.stringify(target)}, 'utf8'))) {
  writeFileSync(${JSON.stringify(entered)}, '');
  while (!existsSync(${JSON.stringify(release)})) await new Promise(r => setTimeout(r, 10));
}
const r = spawnSync('/bin/ps', args, { encoding: 'utf8' });
process.stdout.write(r.stdout); process.stderr.write(r.stderr); process.exitCode = r.status ?? 1;
`, { mode: 0o755 });
  const f = await fixture(t, { PATH: `${bin}:${process.env.PATH}` });
  await writeFile(join(f.dirs.a, 'agents-omit'), '');
  const p = await f.launch('late', 'claude-a');
  assert.equal(p.pid, null, 'the supervisor has not published the PID at launch');
  const session = JSON.parse(await readFile(join(f.fake.home, 'sessions', `${p.harnessId}.json`), 'utf8')) as { pid: number };
  await writeFile(target, String(session.pid));
  try {
    await rm(join(f.dirs.a, 'agents-omit'));
    await eventually('the discovered PID identity probe starts', async () => readFile(entered, 'utf8').then(() => true).catch(() => undefined));
    const r = await f.ui.request({ type: 'session.stop', session: p.name }, 30000);
    assert.equal(r.ok, true, r.error);
    assert.equal((r.value as { process: HarnessProcessView }).process.status, 'stopped');
  } finally {
    await writeFile(release, '');
  }
});
