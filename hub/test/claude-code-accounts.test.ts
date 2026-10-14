// Real hub frames and the fake per-directory Claude supervisor; every account is scratch-owned.
import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { HarnessProcessView } from '../src/protocol.ts';
import { clandWithEnv, connectUi, eventually, FAKE_CLAUDE_DIR, fakeClaude, killDaemon, sleep, startDaemon, tempProject } from './harness.ts';

async function fixture(t: TestContext) {
  const root = await tempProject(t);
  const fake = await fakeClaude(t, { pollMs: 200 });
  const config = join(root, 'registry');
  const dirs = { a: join(root, 'claude-a'), b: join(root, "claude-b's directory"), idle: join(root, 'idle'), default: join(root, 'default') };
  for (const dir of [...Object.values(dirs), join(config, 'cland')]) await mkdir(dir, { recursive: true });
  const registry = join(config, 'cland', 'accounts.toml');
  await writeFile(registry, Object.entries(dirs).filter(([name]) => name !== 'default').map(([name, dir]) => `[accounts.claude-${name}]\nharness = "claude-code"\nconfig_dir = ${JSON.stringify(dir)}\n`).join(''));
  const env = { ...fake.env, CLAND_CLAUDE_BIN: join(FAKE_CLAUDE_DIR, 'claude'), XDG_CONFIG_HOME: config, CLAUDE_CONFIG_DIR: dirs.default, ANTHROPIC_API_KEY: 'fake-key', ANTHROPIC_AUTH_TOKEN: 'fake-auth', CLAUDE_CODE_OAUTH_TOKEN: 'fake-oauth' };
  const { discovery } = await startDaemon(t, root, env);
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
  const f = await fixture(t);
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
    for (let i = 1; i < own.length; i++) assert.ok(own[i]!.at - own[i - 1]!.at >= 200, 'one agents invocation per directory per interval, discovery included');
  }
  assert.ok(!polls.some(c => c.configDir === f.dirs.idle));
  const originalJobs = await f.jobs();
  // After a restart, all four rows re-find their native conversation from the shared snapshots.
  assert.equal((await clandWithEnv(f.root, f.env, 'hub', 'stop')).code, 0);
  await writeFile(f.registry, `[accounts.claude-a]\nharness = "claude-code"\nconfig_dir = ${JSON.stringify(f.dirs.idle)}\n`);
  await sleep(2100); // Let the saved floor expire while the hub is stopped.
  const before = (await f.calls()).length;
  const { discovery } = await startDaemon(t, f.root, { ...f.env, CLAUDE_CONFIG_DIR: f.dirs.idle, CLAND_CLAUDE_AGENTS_MS: '2000' });
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
  for (const p of [a, anotherA, unpinned]) assert.equal((await ui.request({ type: 'session.stop', session: p.name }, 30000)).ok, true);
  const stoppedAt = (await f.calls()).length;
  await sleep(2300);
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
  await writeFile(join(f.dirs.b, 'logged-out'), '');
  const signal = { type: 'session.signal', session: b.name, launch: b.sessionId, event: 'turn-end', payload: { hook_event_name: 'StopFailure', error: 'authentication_failed' } };
  for (let i = 0; i < 2; i++) assert.equal((await f.ui.request(signal)).ok, true);
  await sleep(250);
  const before = (await f.calls()).filter(c => c.args[0] === 'agents');
  await eventually('claude-a keeps polling while claude-b is signed out', async () => {
    const polls = (await f.calls()).filter(c => c.args[0] === 'agents' && c.configDir === f.dirs.a);
    return polls.length > before.filter(c => c.configDir === f.dirs.a).length ? true : undefined;
  });
  const after = (await f.calls()).filter(c => c.args[0] === 'agents');
  assert.equal(after.filter(c => c.configDir === f.dirs.b).length, before.filter(c => c.configDir === f.dirs.b).length);
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

test('a failed account launch names its directory and sign-in or trust remedies and makes no retry', async t => {
  const f = await fixture(t);
  await writeFile(join(f.dirs.b, 'logged-out'), '');
  const r = await f.ui.request({ type: 'session.launch', name: 'failed', account: 'claude-b' });
  assert.equal(r.ok, false);
  for (const text of ['claude-b', f.dirs.b, 'CLAUDE_CONFIG_DIR=', 'claude auth login', 'trust the project', f.root]) assert.ok(r.error?.includes(text), `error names ${text}`);
  await sleep(700);
  assert.deepEqual((await f.calls()).filter(c => c.args[0] !== '-p').map(c => c.args[0]), ['--bg']);
  assert.deepEqual(await f.jobs(), []);
});
