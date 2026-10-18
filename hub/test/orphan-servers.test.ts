// T3: hub startup orphan sweeping, verified PID ownership, server stop/relaunch and deleted-root lifecycle.
import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { delimiter, dirname, join, resolve } from 'node:path';
import { nativeProjectHub as projectHub, flushProjectLogs, clandWithEnv, connectUi, fakeCodex, pidAlive, startDaemon, tempProject, eventually, fakeClaude } from './harness.ts';

import { fakeOpenCode, leftoverOpenCode, OPENCODE_FAKE } from './orphan-server-fixture.ts';
import { serveProject } from '../src/hub/daemon.ts';
import { projectSessions } from '../src/adapters/index.ts';
import { findOrphans, sweepOrphans } from '../src/orphans.ts';
import { spawn } from 'node:child_process';
import { mkdir, readFile, rm, writeFile, chmod } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { ownProcess } from './process-cleanup.ts';

type Harness = { pid: number; name: string };
function fixtureDatabase(root: string): DatabaseSync {
  const db = new DatabaseSync(join(root, '.cland', 'hub.db'));
  // A live hub can hold the writer lock. SQLite's default zero timeout made
  // these fixture mutations fail with SQLITE_BUSY under Linux load.
  db.exec('pragma busy_timeout = 5000');
  return db;
}

async function startupSweep(root: string, pid: number): Promise<void> {
  await eventually('this daemon completed its startup sweep', async () => {
    const rows = (await readFile(join(root, '.cland/log/hub.log'), 'utf8')).split('\n').filter(line => line.startsWith('{')).map(line => JSON.parse(line));
    const serving = rows.findLastIndex(row => row.event === 'serving' && row.pid === pid);
    return serving >= 0 && rows.slice(serving + 1).some(row => row.event === 'orphan-sweep-completed') ? true : undefined;
  });
}

async function leftoverCodex(t: import('node:test').TestContext, status: string, serve: typeof projectHub | typeof startDaemon = projectHub) {
  const root = await tempProject(t);
  const fake = await fakeCodex(t);
  const first = await serve(t, root, fake.env, { sweep: true });
  const ui = await connectUi(t, first.discovery);
  const launched = await ui.request({ type: 'session.launch', name: 'impl', harness: 'codex' }, 30_000);
  assert.equal(launched.ok, true, launched.error);
  const p = (launched.value as { process: Harness }).process;
  ui.close();
  if ('stop' in first) await first.stop();
  else assert.equal((await clandWithEnv(root, fake.env, 'hub', 'stop')).code, 0);
  const db = fixtureDatabase(root);
  db.prepare("update harness_processes set status = ? where name = 'impl'").run(status);
  db.close();
  return { root, env: fake.env, pid: p.pid };
}

test('an exited server with an unknown recorded start time is reported but never swept', async t => {
  const { root, env, pid } = await leftoverCodex(t, 'exited');
  const db = fixtureDatabase(root);
  db.prepare("update harness_processes set pid_started = null where name = 'impl'").run();
  db.close();
  const orphan = (await findOrphans(root)).find(p => p.process.pid === pid);
  assert.ok(orphan);
  assert.equal(orphan.owned, false, 'log/socket hints cannot replace the missing recorded identity');
  assert.match(orphan.reason, /session impl.*identity cannot be verified/);
  assert.deepEqual(await sweepOrphans(root, () => {}), []);
  await clandWithEnv(root, env, 'doctor', '--fix', '--json');
  const restarted = await projectHub(t, root, { ...env, CLAND_TEST_SKIP_ORPHAN_SWEEP: '0' });
  await startupSweep(root, restarted.discovery.pid);
  assert.equal(pidAlive(pid), true);
});

test('a reused pid is preserved even when its server has project cwd, socket and log hints', async t => {
  const { root, env, pid } = await leftoverCodex(t, 'exited');
  const db = fixtureDatabase(root);
  db.prepare("update harness_processes set pid_started = 'Thu Jan 1 00:00:00 1970' where name = 'impl'").run();
  db.close();
  const orphan = (await findOrphans(root)).find(p => p.process.pid === pid);
  assert.ok(orphan);
  assert.equal(orphan.owned, false);
  assert.match(orphan.reason, /session impl.*PID was reused/);
  assert.deepEqual(await sweepOrphans(root, () => {}), []);
  const fixed = await clandWithEnv(root, env, 'doctor', '--fix', '--json');
  assert.match(fixed.stdout, /PID was reused/);
  const restarted = await projectHub(t, root, { ...env, CLAND_TEST_SKIP_ORPHAN_SWEEP: '0' });
  await startupSweep(root, restarted.discovery.pid);
  assert.equal(pidAlive(pid), true);
});

test('doctor --fix ends leftover servers in each terminal status and preserves a running session', async t => {
  const root = await tempProject(t);
  const fake = await fakeCodex(t);
  const hub = await projectHub(t, root, fake.env);
  const ui = await connectUi(t, hub.discovery);
  const rows: Array<{ status: string; pid: number }> = [];
  for (const status of ['exited', 'stopped', 'offline', 'running']) {
    const launched = await ui.request({ type: 'session.launch', name: status, harness: 'codex' }, 30_000);
    assert.equal(launched.ok, true, launched.error);
    rows.push({ status, pid: (launched.value as { process: Harness }).process.pid });
  }
  ui.close();
  await hub.stop();
  const db = fixtureDatabase(root);
  for (const { status } of rows) db.prepare('update harness_processes set status = ? where name = ?').run(status, status);
  db.close();
  const restarted = await projectHub(t, root, { ...fake.env, CLAND_TEST_SKIP_ORPHAN_SWEEP: '0' });
  for (const { status, pid } of rows) {
    if (status === 'running') assert.equal(pidAlive(pid), true);
    else {
      await eventually(`startup sweep ends ${status} server`, () => !pidAlive(pid) ? true : undefined, 15_000);
      assert.equal(pidAlive(pid), false);
    }
  }
  const nextUi = await connectUi(t, restarted.discovery);
  const leftovers: Array<{ status: string; name: string; pid: number }> = [];
  for (const status of ['exited', 'stopped', 'offline']) {
    const name = `leftover-${status}`;
    const launched = await nextUi.request({ type: 'session.launch', name, harness: 'codex' }, 30_000);
    assert.equal(launched.ok, true, launched.error);
    leftovers.push({ status, name, pid: (launched.value as { process: Harness }).process.pid });
  }
  nextUi.close();
  await restarted.stop();
  const nextDb = fixtureDatabase(root);
  for (const { status, name } of leftovers) nextDb.prepare('update harness_processes set status = ? where name = ?').run(status, name);
  nextDb.close();
  const fixed = await clandWithEnv(root, fake.env, 'doctor', '--fix', '--json');
  for (const { status, name, pid } of leftovers) {
    assert.ok(fixed.stdout.includes(`ended pid ${pid}: session ${name} (${status})`), `missing ${status} cleanup receipt`);
    await eventually(`${status} server is reaped`, () => !pidAlive(pid) ? true : undefined);
    assert.equal(pidAlive(pid), false);
  }
  assert.equal(pidAlive(rows.find(row => row.status === 'running')!.pid), true);
});

test('doctor names an exited session’s leftover app-server; hub start sweeps it and says which PID ended', async t => {
  const { root, env, pid } = await leftoverCodex(t, 'exited', startDaemon);
  assert.equal(pidAlive(pid), true);
  const report = await clandWithEnv(root, env, 'doctor', '--json');
  const checks = (JSON.parse(report.stdout) as { checks: Array<{ name: string; detail: string; fix?: string }> }).checks;
  assert.ok(checks.some(check => check.name === 'orphan harness' && check.detail.includes(String(pid)) && check.detail.includes('session impl (exited)') && check.fix === 'cland doctor --fix'), report.stdout);
  assert.equal(pidAlive(pid), true, 'doctor is read-only by default');
  const second = await startDaemon(t, root, env, { sweep: true });
  await eventually('background sweep ends exited server', async () => !pidAlive(pid) ? true : undefined, 15_000);
  assert.match(second.result.stdout, /orphan cleanup runs in the background/);
  const swept = await clandWithEnv(root, env, 'doctor', '--json');
  assert.match(swept.stdout, new RegExp(`ended pid ${pid}`));
  await flushProjectLogs(t, root);
  assert.match(await readFile(join(root, '.cland', 'journal.jsonl'), 'utf8'), /"event":"orphan-ended"/);
});

test('a foreground hub writes ended and preserved sweep diagnostics to stderr', async t => {
  const { root, env, pid } = await leftoverCodex(t, 'exited', startDaemon);
  const other = await tempProject(t);
  const fake = await fakeOpenCode(t);
  const ambiguous = await leftoverOpenCode(t, root, OPENCODE_FAKE, fake.env, other);
  const cli = fileURLToPath(new URL('../bin/cland.ts', import.meta.url));
  const child = spawn(process.execPath, [cli, 'hub', 'serve'], { cwd: root, env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
  ownProcess(t, child.pid);
  let stderr = '';
  child.stderr.setEncoding('utf8'); child.stderr.on('data', chunk => { stderr += chunk; });
  child.stdout.resume();
  await eventually('background sweep completes', async () => /"event":"orphan-sweep-completed"/.test(stderr) ? true : undefined, 15_000);
  assert.equal(pidAlive(pid), false);
  assert.equal(pidAlive(ambiguous), true);
  const diagnostics = stderr.split('\n').filter(line => line.startsWith('{')).map(line => JSON.parse(line) as { event: string; pid?: number });
  assert.ok(diagnostics.some(entry => entry.event === 'orphan-ended' && entry.pid === pid), stderr);
  assert.ok(diagnostics.some(entry => entry.event === 'orphan-preserved' && entry.pid === ambiguous), stderr);
});

test('stop and relaunch await server death across the harness adapters', async t => {
  const root = await tempProject(t);
  const codex = await fakeCodex(t, { turnMs: 10000 });
  const opencode = await fakeOpenCode(t);
  const claude = await fakeClaude(t);
  const { discovery } = await projectHub(t, root, { ...codex.env, ...opencode.env, ...claude.env, CLAND_STOP_GRACE_MS: '200', FAKE_CODEX_TERM_DELAY_MS: '10000', FAKE_OPENCODE_IGNORE_TERM: '1', FAKE_OPENCODE_CHILD: '1', FAKE_CLAUDE_IGNORE_TERM: '1' });
  const ui = await connectUi(t, discovery);
  for (const harness of ['codex', 'opencode', 'claude-code']) {
    const launch = await ui.request({ type: 'session.launch', name: harness, harness }, 30_000);
    assert.equal(launch.ok, true, launch.error);
    const first = (launch.value as { process: Harness }).process;
    const resume = await ui.request({ type: 'session.resume', session: harness, relaunch: true }, 30_000);
    assert.equal(resume.ok, true, resume.error);
    assert.equal((resume.value as { found: boolean; reason?: string }).found, true, JSON.stringify(resume.value));
    const second = (resume.value as { process: Harness }).process;
    const child = harness === 'opencode' ? (JSON.parse(await readFile(join(opencode.env.FAKE_OPENCODE_HOME, 'servers', `${second.pid}.json`), 'utf8')) as { childPid: number }).childPid : null;
    assert.notEqual(first.pid, second.pid);
    if (harness === 'codex') t.diagnostic(`Codex resume found:true; PID ${first.pid} -> ${second.pid}`);
    assert.equal(pidAlive(first.pid), false, 'relaunch awaits the old server');
    assert.equal(pidAlive(second.pid), true);
    const stop = await ui.request({ type: 'session.stop', session: harness }, 15_000);
    assert.equal(stop.ok, true, stop.error);
    assert.equal(pidAlive(second.pid), false, 'stop awaits the replacement server');
    if (child !== null) assert.equal(pidAlive(child), false, 'stop also ends a descendant that ignores SIGTERM');
    assert.equal((await ui.request({ type: 'hub.status', flushLogs: true })).ok, true);
    const journal = (await readFile(join(root, '.cland', 'journal.jsonl'), 'utf8')).split('\n').filter(Boolean).map(line => JSON.parse(line) as { event: string; pid?: number; forced?: boolean });
    assert.ok(journal.some(entry => entry.event === 'harness-ended' && entry.pid === first.pid && entry.forced));
    assert.ok(journal.some(entry => entry.event === 'harness-ended' && entry.pid === second.pid && entry.forced));
    assert.equal(journal.some(entry => entry.event === 'harness-exited'), false, 'an intentional stop/relaunch is not a crash');
  }
});

test('hub start sweeps an OpenCode server without a process-table row and preserves a live session’s server', async t => {
  const root = await tempProject(t);
  const fake = await fakeOpenCode(t);
  const orphan = await leftoverOpenCode(t, root, OPENCODE_FAKE, fake.env);
  const { discovery } = await startDaemon(t, root, fake.env, { sweep: true });
  await eventually('background sweep ends untracked server', async () => !pidAlive(orphan) ? true : undefined, 15_000);
  const ui = await connectUi(t, discovery);
  const launch = await ui.request({ type: 'session.launch', name: 'impl', harness: 'opencode' }, 30_000);
  assert.equal(launch.ok, true, launch.error);
  const p = (launch.value as { process: Harness }).process;
  ui.close();
  await clandWithEnv(root, fake.env, 'hub', 'stop');
  await startDaemon(t, root, fake.env, { sweep: true });
  assert.equal(pidAlive(p.pid), true, 'a running row is resumed, never swept');
});

test('real OpenCode serve left behind is swept by hub start', async t => {
  const root = await tempProject(t);
  const home = join(root, 'opencode-home');
  const data = join(home, 'data');
  const config = join(home, 'config');
  await mkdir(join(data, 'opencode'), { recursive: true });
  await mkdir(config, { recursive: true });
  const configFile = join(config, 'opencode.json');
  await writeFile(configFile, '{}');
  const env = {
    HOME: home,
    XDG_DATA_HOME: data,
    XDG_CONFIG_HOME: config,
    OPENCODE_DB: join(data, 'opencode', 'opencode.db'),
    // Explicit config overrides must not reintroduce host settings through process.env.
    OPENCODE_CONFIG: configFile,
    OPENCODE_CONFIG_CONTENT: '{}',
    // The shared fixture prepends a fake; this test must reach the installed binary.
    PATH: (process.env.PATH ?? '').split(delimiter).filter(dir => resolve(dir) !== dirname(OPENCODE_FAKE)).join(delimiter),
  };
  assert.ok(env.OPENCODE_DB?.startsWith(`${root}/`), 'real OpenCode database must stay inside the temp project');
  assert.ok(env.OPENCODE_CONFIG.startsWith(`${root}/`), 'real OpenCode config must stay inside the temp project');
  assert.equal(env.OPENCODE_CONFIG_CONTENT, '{}', 'real OpenCode inline config must be fixture-owned');
  const version = await new Promise<boolean>(done => {
    const child = spawn('opencode', ['--version'], { stdio: 'ignore', env: { ...process.env, ...env } });
    child.on('error', () => done(false)); child.on('exit', code => done(code === 0));
  });
  if (!version) { t.skip('OpenCode is absent or cannot run on this machine'); return; }
  const pid = await leftoverOpenCode(t, root, 'opencode', env);
  const { result } = await startDaemon(t, root, env, { sweep: true });
  await eventually('background sweep ends real OpenCode', async () => !pidAlive(pid) ? true : undefined, 15_000);
  assert.match(result.stdout, /orphan cleanup runs in the background/);
});

test('doctor reports a hub whose project was deleted; --fix ends it while preserving a hub with a live project', async t => {
  const scope = await tempProject(t, 'cland-doctor-scope-');
  const root = await tempProject(t, 'live-', scope);
  const removed = await tempProject(t, 'removed-', scope);
  const env = { CLAND_TEST_ORPHAN_ROOT: scope };
  const { discovery } = await startDaemon(t, removed, {}, { sweep: true });
  const live = await startDaemon(t, root, {}, { sweep: true });
  await rm(removed, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 });
  const readOnly = await clandWithEnv(root, env, 'doctor', '--json');
  const check = (JSON.parse(readOnly.stdout) as { checks: Array<{ name: string; detail: string; fix?: string }> }).checks.find(c => c.name === 'orphan hub' && c.detail.includes(String(discovery.pid)));
  assert.ok(check, readOnly.stdout);
  assert.equal(pidAlive(discovery.pid), true);
  assert.equal(check.fix, 'cland doctor --fix');
  const fixed = await clandWithEnv(root, env, 'doctor', '--fix', '--json');
  assert.match(fixed.stdout, new RegExp(`ended pid ${discovery.pid}`));
  assert.equal(pidAlive(discovery.pid), false);
  assert.equal(pidAlive(live.discovery.pid), true);
});

test('a project-specific log without a verified project cwd is reported and preserved', async t => {
  const root = await tempProject(t);
  const other = await tempProject(t);
  const fake = await fakeOpenCode(t);
  const pid = await leftoverOpenCode(t, root, OPENCODE_FAKE, fake.env, other);
  const { result } = await startDaemon(t, root, fake.env, { sweep: true });
  assert.equal(pidAlive(pid), true);
  assert.match(result.stdout, /orphan cleanup runs in the background/);
  await eventually('ambiguity journalled', async () => /orphan-preserved/.test(await readFile(join(root, '.cland', 'journal.jsonl'), 'utf8')) ? true : undefined);
  const report = await clandWithEnv(root, fake.env, 'doctor', '--fix', '--json');
  assert.match(report.stdout, /ambiguous ownership/);
  assert.equal(pidAlive(pid), true);
});

test('a Codex app-server whose row was lost is swept even when a long project path put its socket in the temp dir', async t => {
  const root = await tempProject(t);
  const fake = await fakeCodex(t);
  const first = await projectHub(t, root, { ...fake.env, CLAND_TEST_SKIP_ORPHAN_SWEEP: '0' });
  const ui = await connectUi(t, first.discovery);
  const launched = await ui.request({ type: 'session.launch', name: 'impl', harness: 'codex' }, 30_000);
  assert.equal(launched.ok, true, launched.error);
  const p = (launched.value as { process: Harness }).process;
  ui.close();
  await first.stop();
  const db = fixtureDatabase(root);
  db.exec('delete from harness_processes'); db.close();
  await projectHub(t, root, { ...fake.env, CLAND_TEST_SKIP_ORPHAN_SWEEP: '0' });
  await eventually('background sweep ends lost-row Codex', async () => !pidAlive(p.pid) ? true : undefined, 15_000);
});

test('hub start preserves the server child of a verified running wrapper session', async t => {
  const root = await tempProject(t);
  const fake = await fakeOpenCode(t);
  const wrapper = join(fake.env.FAKE_OPENCODE_HOME, 'wrapper.mjs');
  await writeFile(wrapper, `#!${process.execPath}\nimport { spawn } from 'node:child_process';
spawn(${JSON.stringify(OPENCODE_FAKE)}, process.argv.slice(2), { stdio: 'inherit' });
setInterval(() => {}, 1000);
`);
  await chmod(wrapper, 0o755);
  const env = { ...fake.env, CLAND_OPENCODE_BIN: wrapper };
  const first = await projectHub(t, root, { ...env, CLAND_TEST_SKIP_ORPHAN_SWEEP: '0' });
  const ui = await connectUi(t, first.discovery);
  const launch = await ui.request({ type: 'session.launch', name: 'impl', harness: 'opencode' }, 30_000);
  assert.equal(launch.ok, true, launch.error);
  const p = (launch.value as { process: Harness }).process;
  const files = await import('node:fs/promises').then(fs => fs.readdir(join(fake.env.FAKE_OPENCODE_HOME, 'servers')));
  const child = JSON.parse(await readFile(join(fake.env.FAKE_OPENCODE_HOME, 'servers', files[0]!), 'utf8')) as { pid: number };
  assert.notEqual(p.pid, child.pid);
  ui.close();
  await first.stop();
  const second = await projectHub(t, root, { ...env, CLAND_TEST_SKIP_ORPHAN_SWEEP: '0' });
  await startupSweep(root, second.discovery.pid);
  assert.equal(pidAlive(p.pid), true);
  assert.equal(pidAlive(child.pid), true, 'the verified running wrapper protects its server child');
  const next = await connectUi(t, second.discovery);
  const stop = await next.request({ type: 'session.stop', session: 'impl' }, 15_000);
  assert.equal(stop.ok, true, stop.error);
});

test('an offline wrapper proves ownership of its server child outside the project cwd', async t => {
  const root = await tempProject(t);
  const other = await tempProject(t);
  const fake = await fakeOpenCode(t);
  const wrapper = join(fake.env.FAKE_OPENCODE_HOME, 'wrapper.mjs');
  const extraFile = join(fake.env.FAKE_OPENCODE_HOME, 'extra-child.json');
  await writeFile(wrapper, `#!${process.execPath}\nimport { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
spawn(${JSON.stringify(OPENCODE_FAKE)}, process.argv.slice(2), { cwd: ${JSON.stringify(other)}, stdio: 'inherit' });
const extra = spawn(process.execPath, ['-e', 'process.on("SIGTERM", () => {}); setInterval(() => {}, 1000);'], { cwd: ${JSON.stringify(other)}, stdio: 'ignore' });
writeFileSync(${JSON.stringify(extraFile)}, JSON.stringify({ pid: extra.pid }));
setInterval(() => {}, 1000);
`);
  await chmod(wrapper, 0o755);
  const env = { ...fake.env, CLAND_OPENCODE_BIN: wrapper };
  const first = await startDaemon(t, root, env, { sweep: true });
  const ui = await connectUi(t, first.discovery);
  const launch = await ui.request({ type: 'session.launch', name: 'impl', harness: 'opencode' }, 30_000);
  assert.equal(launch.ok, true, launch.error);
  const wrapperPid = (launch.value as { process: Harness }).process.pid;
  const files = await import('node:fs/promises').then(fs => fs.readdir(join(fake.env.FAKE_OPENCODE_HOME, 'servers')));
  const child = JSON.parse(await readFile(join(fake.env.FAKE_OPENCODE_HOME, 'servers', files[0]!), 'utf8')) as { pid: number };
  const extra = JSON.parse(await readFile(extraFile, 'utf8')) as { pid: number };
  ownProcess(t, extra.pid);
  ui.close();
  const db = fixtureDatabase(root);
  db.prepare("update harness_processes set status = 'offline' where name = 'impl'").run();
  db.close();
  const candidates = await findOrphans(root);
  const server = candidates.find(p => p.process.pid === child.pid);
  assert.ok(server);
  assert.equal(server.owned, true, 'descent from a verified project wrapper is ownership proof');
  assert.match(server.reason, /session impl \(offline\)/);
  await sweepOrphans(root, () => {});
  assert.equal(pidAlive(wrapperPid), false);
  assert.equal(pidAlive(child.pid), false);
  assert.equal(pidAlive(extra.pid), false, 'a reparented non-server descendant is still owned by the recorded wrapper');
  assert.equal(pidAlive(first.discovery.pid), true, 'the recorded wrapper tree can be ended while its hub is still live');
});

for (const harness of ['codex', 'opencode']) {
  test(`${harness}: an unverifiable live server remains running and supervised after refused stop/relaunch`, async t => {
    const root = await tempProject(t);
    const fake = harness === 'codex' ? await fakeCodex(t) : await fakeOpenCode(t);
    const { discovery } = await projectHub(t, root, fake.env);
    const ui = await connectUi(t, discovery);
    const launch = await ui.request({ type: 'session.launch', name: 'impl', harness }, 30_000);
    assert.equal(launch.ok, true, launch.error);
    const p = (launch.value as { process: Harness }).process;
    const db = fixtureDatabase(root);
    t.after(() => db.close());
    const before = db.prepare("select pid_started from harness_processes where name = 'impl'").get() as { pid_started: string };
    db.prepare("update harness_processes set pid_started = null where name = 'impl'").run();
    for (const frame of [{ type: 'session.stop', session: 'impl' }, { type: 'session.resume', session: 'impl', relaunch: true }]) {
      const refused = await ui.request(frame, 15_000);
      assert.equal(refused.ok, false, `${frame.type} must report failed termination`);
      assert.match(refused.error ?? '', /identity cannot be verified/);
      const listed = await ui.request({ type: 'session.list' });
      const row = (listed.value as { processes: Array<{ pid: number; status: string }> }).processes[0]!;
      assert.equal(row.pid, p.pid);
      assert.equal(row.status, 'running');
      assert.equal(pidAlive(p.pid), true);
    }
    db.prepare("update harness_processes set pid_started = ? where name = 'impl'").run(before.pid_started);
    process.kill(p.pid, 'SIGKILL');
    await eventually('retained supervisor records the death', async () => {
      const listed = await ui.request({ type: 'session.list' });
      return (listed.value as { processes: Array<{ status: string }> }).processes[0]?.status === 'exited' ? true : undefined;
    });
    assert.equal((await ui.request({ type: 'session.stop', session: 'impl' }, 15_000)).ok, true);
    assert.equal(pidAlive(p.pid), false);
  });
}

test('a sweep during a slow launch preserves its server before the process row is published', async t => {
  const root = await tempProject(t);
  const fake = await fakeOpenCode(t);
  const entries: Array<Record<string, unknown>> = [];
  const daemon = await serveProject(root, { log: entry => entries.push(entry) });
  t.after(() => daemon.stop());
  await eventually('startup sweep settled', async () => entries.some(entry => entry.event === 'orphan-sweep-completed') ? true : undefined);
  const project = projectSessions({ core: daemon.hub.core, root, db: daemon.layout.db, discoveryFile: daemon.layout.discovery, log: entry => entries.push(entry), env: { ...process.env, ...fake.env, FAKE_OPENCODE_SESSION_DELAY_MS: '2500' } });
  t.after(() => project.close());
  const launching = project.sessions.launch({ name: 'impl', harness: 'opencode' });
  void launching.catch(() => {}); // keep an early harness failure available to the awaited assertion
  // Observe an actual listening server while the create-session response is intentionally delayed.
  const candidate = await eventually('unpublished server is visible to the sweep', async () => (await findOrphans(root))[0], 10_000);
  ownProcess(t, candidate.process.pid);
  assert.equal(project.sessions.lifecyclePending(), true);
  assert.equal(project.sessions.list().length, 0, 'no process row has been published yet');
  const ended = await sweepOrphans(root, entry => entries.push(entry), 'harness', { pending: () => project.sessions.lifecyclePending() });
  assert.deepEqual(ended, []);
  assert.equal(pidAlive(candidate.process.pid), true);
  const p = await launching;
  assert.equal(p.pid, candidate.process.pid);
  assert.equal(project.sessions.lifecyclePending(), false);
  await project.sessions.stop('impl');
  assert.equal(pidAlive(candidate.process.pid), false);
});

test('doctor --fix preserves a live hub’s server while its launch has no process row yet', async t => {
  const root = await tempProject(t);
  const fake = await fakeOpenCode(t);
  const entries: Array<Record<string, unknown>> = [];
  const daemon = await serveProject(root, { log: entry => entries.push(entry) });
  t.after(() => daemon.stop());
  await eventually('startup sweep settled', async () => entries.some(entry => entry.event === 'orphan-sweep-completed') ? true : undefined);
  const project = projectSessions({ core: daemon.hub.core, root, db: daemon.layout.db, discoveryFile: daemon.layout.discovery, log: entry => entries.push(entry), env: { ...process.env, ...fake.env, FAKE_OPENCODE_SESSION_DELAY_MS: '8000' } });
  t.after(() => project.close());
  const launching = project.sessions.launch({ name: 'impl', harness: 'opencode' });
  void launching.catch(() => {});
  const candidate = await eventually('unpublished server is listening', async () => (await findOrphans(root))[0], 10_000);
  ownProcess(t, candidate.process.pid);
  assert.equal(project.sessions.list().length, 0);
  await clandWithEnv(root, fake.env, 'doctor', '--fix', '--json');
  assert.equal(pidAlive(candidate.process.pid), true, 'the doctor cannot see the hub’s in-flight lifecycle reservation');
  const p = await launching;
  assert.equal(p.pid, candidate.process.pid);
  await project.sessions.stop('impl');
});

test('doctor --fix lets a foreground hub for a deleted project stop cleanly without recreating its directory', async t => {
  const scope = await tempProject(t, 'cland-doctor-scope-');
  const root = await tempProject(t, 'live-', scope), removed = await tempProject(t, 'removed-', scope);
  const cli = fileURLToPath(new URL('../bin/cland.ts', import.meta.url));
  const child = spawn(process.execPath, [cli, 'hub', 'serve'], { cwd: removed, stdio: ['ignore', 'pipe', 'pipe'] });
  ownProcess(t, child.pid);
  const exited = Promise.withResolvers<{ code: number | null; signal: NodeJS.Signals | null }>();
  child.once('error', exited.reject);
  child.once('exit', (code, signal) => exited.resolve({ code, signal }));
  let stderr = '';
  child.stderr.setEncoding('utf8'); child.stderr.on('data', chunk => { stderr += chunk; });
  child.stdout.resume();
  await eventually('foreground hub listening', async () => {
    const discovery = JSON.parse(await readFile(join(removed, '.cland', 'hub.json'), 'utf8')) as { pid: number };
    return discovery.pid === child.pid ? true : undefined;
  });
  await rm(removed, { recursive: true, maxRetries: 10, retryDelay: 50 });
  const fixed = await clandWithEnv(root, { CLAND_TEST_ORPHAN_ROOT: scope }, 'doctor', '--fix', '--json');
  assert.match(fixed.stdout, new RegExp(`ended pid ${child.pid}`));
  const result = await exited.promise;
  assert.deepEqual(result, { code: 0, signal: null }, stderr);
  assert.doesNotMatch(stderr, /ENOENT|unhandledRejection/);
  await assert.rejects(readFile(join(removed, '.cland', 'hub.lock')), { code: 'ENOENT' });
});
