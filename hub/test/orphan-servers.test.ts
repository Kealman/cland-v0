// T-70: real hub/CLI boundaries, with disposable projects and fake harness servers.
import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { join } from 'node:path';
import { clandWithEnv, connectUi, fakeCodex, pidAlive, startDaemon, tempProject, eventually, fakeClaude, sleep } from './harness.ts';

import { serveProject } from '../src/hub/daemon.ts';
import { projectSessions } from '../src/adapters/index.ts';
import { findOrphans, sweepOrphans } from '../src/orphans.ts';
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, open, readFile, realpath, rm, writeFile, chmod } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { ownDirectory, ownProcess } from './process-cleanup.ts';

type Harness = { pid: number; name: string };
test('doctor reports a stopped row’s leftover app-server; hub start sweeps it and says which PID ended', async t => {
  const root = await tempProject(t);
  const fake = await fakeCodex(t);
  const first = await startDaemon(t, root, fake.env);
  const ui = await connectUi(t, first.discovery);
  const launched = await ui.request({ type: 'session.launch', name: 'impl', harness: 'codex' }, 30_000);
  assert.equal(launched.ok, true, launched.error);
  const p = (launched.value as { process: Harness }).process;
  ui.close();
  assert.equal((await clandWithEnv(root, fake.env, 'hub', 'stop')).code, 0);
  const db = new DatabaseSync(join(root, '.cland', 'hub.db'));
  db.prepare("update harness_processes set status = 'stopped' where name = 'impl'").run();
  db.close();
  assert.equal(pidAlive(p.pid), true);
  const report = await clandWithEnv(root, fake.env, 'doctor', '--json');
  const checks = (JSON.parse(report.stdout) as { checks: Array<{ name: string; detail: string; fix?: string }> }).checks;
  assert.ok(checks.some(check => check.name === 'orphan harness' && check.detail.includes(String(p.pid)) && check.fix?.includes('cland hub start')), report.stdout);
  assert.equal(pidAlive(p.pid), true, 'doctor is read-only by default');
  const second = await startDaemon(t, root, fake.env);
  await eventually('background sweep ends stopped server', async () => !pidAlive(p.pid) ? true : undefined, 15_000);
  assert.match(second.result.stdout, /orphan cleanup runs in the background/);
  const swept = await clandWithEnv(root, fake.env, 'doctor', '--json');
  assert.match(swept.stdout, new RegExp(`ended pid ${p.pid}`));
  assert.match(await readFile(join(root, '.cland', 'journal.jsonl'), 'utf8'), /"event":"orphan-ended"/);
});

const OPENCODE_FAKE = fileURLToPath(new URL('./fakes/opencode/opencode', import.meta.url));
async function fakeOpenCode(t: import('node:test').TestContext) {
  const home = await realpath(await mkdtemp(join(tmpdir(), 'fake-opencode-')));
  ownDirectory(t, home);
  return { env: { CLAND_OPENCODE_BIN: OPENCODE_FAKE, FAKE_OPENCODE_HOME: home, FAKE_OPENCODE_TURN_MS: '100', CLAND_ADAPTER_POLL_MS: '200' } };
}
for (const harness of ['codex', 'opencode', 'claude-code']) {
  test(`${harness}: stop waits for the server’s death, relaunch replaces it, and journal names what ended`, async t => {
    const root = await tempProject(t);
    const fake = harness === 'codex' ? await fakeCodex(t) : harness === 'opencode' ? await fakeOpenCode(t) : await fakeClaude(t);
    const { discovery } = await startDaemon(t, root, { ...fake.env, CLAND_STOP_GRACE_MS: '200', FAKE_CODEX_TERM_DELAY_MS: '10000', FAKE_OPENCODE_IGNORE_TERM: '1', FAKE_OPENCODE_CHILD: '1', FAKE_CLAUDE_IGNORE_TERM: '1' });
    const ui = await connectUi(t, discovery);
    const launch = await ui.request({ type: 'session.launch', name: 'impl', harness }, 30_000);
    assert.equal(launch.ok, true, launch.error);
    const first = (launch.value as { process: Harness }).process;
    const resume = await ui.request({ type: 'session.resume', session: 'impl', relaunch: true }, 30_000);
    assert.equal(resume.ok, true, resume.error);
    const second = (resume.value as { process: Harness }).process;
    const child = harness === 'opencode' ? (JSON.parse(await readFile(join((fake as { env: { FAKE_OPENCODE_HOME: string } }).env.FAKE_OPENCODE_HOME, 'servers', `${second.pid}.json`), 'utf8')) as { childPid: number }).childPid : null;
    assert.notEqual(first.pid, second.pid);
    assert.equal(pidAlive(first.pid), false, 'relaunch awaits the old server');
    assert.equal(pidAlive(second.pid), true);
    const stop = await ui.request({ type: 'session.stop', session: 'impl' }, 15_000);
    assert.equal(stop.ok, true, stop.error);
    assert.equal(pidAlive(second.pid), false, 'stop awaits the replacement server');
    if (child !== null) assert.equal(pidAlive(child), false, 'stop also ends a descendant that ignores SIGTERM');
    const journal = (await readFile(join(root, '.cland', 'journal.jsonl'), 'utf8')).split('\n').filter(Boolean).map(line => JSON.parse(line) as { event: string; pid?: number; forced?: boolean });
    assert.ok(journal.some(entry => entry.event === 'harness-ended' && entry.pid === first.pid && entry.forced));
    assert.ok(journal.some(entry => entry.event === 'harness-ended' && entry.pid === second.pid && entry.forced));
    assert.equal(journal.some(entry => entry.event === 'harness-exited'), false, 'an intentional stop/relaunch is not a crash');
  });
}

async function leftoverOpenCode(t: import('node:test').TestContext, root: string, bin: string, env: Record<string, string>, cwd = root, name = 'leftover') {
  const dir = join(root, '.cland', 'opencode', name);
  await mkdir(dir, { recursive: true });
  const log = join(dir, 'serve.log');
  const fd = await open(log, 'a');
  const child = spawn(bin, ['serve', '--hostname', '127.0.0.1', '--port', '0'], { cwd, detached: true, stdio: ['ignore', fd.fd, fd.fd], env: { ...process.env, ...env } });
  ownProcess(t, child.pid);
  await fd.close();
  await eventually('OpenCode listening', async () => /listening on/.test(await readFile(log, 'utf8')) ? true : undefined, 20_000);
  return child.pid!;
}

test('hub start sweeps an OpenCode server without a process-table row and preserves a live session’s server', async t => {
  const root = await tempProject(t);
  const fake = await fakeOpenCode(t);
  const orphan = await leftoverOpenCode(t, root, OPENCODE_FAKE, fake.env);
  const { discovery } = await startDaemon(t, root, fake.env);
  await eventually('background sweep ends untracked server', async () => !pidAlive(orphan) ? true : undefined, 15_000);
  const ui = await connectUi(t, discovery);
  const launch = await ui.request({ type: 'session.launch', name: 'impl', harness: 'opencode' }, 30_000);
  assert.equal(launch.ok, true, launch.error);
  const p = (launch.value as { process: Harness }).process;
  ui.close();
  await clandWithEnv(root, fake.env, 'hub', 'stop');
  await startDaemon(t, root, fake.env);
  assert.equal(pidAlive(p.pid), true, 'a running row is resumed, never swept');
});

test('real OpenCode serve left behind is swept by hub start', async t => {
  const version = await new Promise<boolean>(done => {
    const child = spawn('opencode', ['--version'], { stdio: 'ignore' });
    child.on('error', () => done(false)); child.on('exit', code => done(code === 0));
  });
  if (!version) { t.skip('OpenCode is absent or cannot run on this machine'); return; }
  const root = await tempProject(t);
  const pid = await leftoverOpenCode(t, root, 'opencode', {});
  const { result } = await startDaemon(t, root);
  await eventually('background sweep ends real OpenCode', async () => !pidAlive(pid) ? true : undefined, 15_000);
  assert.match(result.stdout, /orphan cleanup runs in the background/);
});

test('doctor reports a hub whose project was deleted; --fix ends it while preserving a hub with a live project', async t => {
  const root = await tempProject(t);
  const removed = await tempProject(t);
  const { discovery } = await startDaemon(t, removed);
  const live = await startDaemon(t, root);
  await rm(removed, { recursive: true, force: true });
  await sleep(100);
  const readOnly = await clandWithEnv(root, {}, 'doctor', '--json');
  const check = (JSON.parse(readOnly.stdout) as { checks: Array<{ name: string; detail: string; fix?: string }> }).checks.find(c => c.name === 'orphan hub' && c.detail.includes(String(discovery.pid)));
  assert.ok(check, readOnly.stdout);
  assert.equal(pidAlive(discovery.pid), true);
  assert.equal(check.fix, 'cland doctor --fix');
  const fixed = await clandWithEnv(root, {}, 'doctor', '--fix', '--json');
  assert.match(fixed.stdout, new RegExp(`ended pid ${discovery.pid}`));
  assert.equal(pidAlive(discovery.pid), false);
  assert.equal(pidAlive(live.discovery.pid), true);
});


test('a project-specific log without a verified project cwd is reported and preserved', async t => {
  const root = await tempProject(t);
  const other = await tempProject(t);
  const fake = await fakeOpenCode(t);
  const pid = await leftoverOpenCode(t, root, OPENCODE_FAKE, fake.env, other);
  const { result } = await startDaemon(t, root, fake.env);
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
  const first = await startDaemon(t, root, fake.env);
  const ui = await connectUi(t, first.discovery);
  const launched = await ui.request({ type: 'session.launch', name: 'impl', harness: 'codex' }, 30_000);
  assert.equal(launched.ok, true, launched.error);
  const p = (launched.value as { process: Harness }).process;
  ui.close();
  await clandWithEnv(root, fake.env, 'hub', 'stop');
  const db = new DatabaseSync(join(root, '.cland', 'hub.db'));
  db.exec('delete from harness_processes'); db.close();
  await startDaemon(t, root, fake.env);
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
  const first = await startDaemon(t, root, env);
  const ui = await connectUi(t, first.discovery);
  const launch = await ui.request({ type: 'session.launch', name: 'impl', harness: 'opencode' }, 30_000);
  assert.equal(launch.ok, true, launch.error);
  const p = (launch.value as { process: Harness }).process;
  const files = await import('node:fs/promises').then(fs => fs.readdir(join(fake.env.FAKE_OPENCODE_HOME, 'servers')));
  const child = JSON.parse(await readFile(join(fake.env.FAKE_OPENCODE_HOME, 'servers', files[0]!), 'utf8')) as { pid: number };
  assert.notEqual(p.pid, child.pid);
  ui.close();
  await clandWithEnv(root, env, 'hub', 'stop');
  const second = await startDaemon(t, root, env);
  await sleep(500);
  assert.equal(pidAlive(p.pid), true);
  assert.equal(pidAlive(child.pid), true, 'the verified running wrapper protects its server child');
  const next = await connectUi(t, second.discovery);
  const stop = await next.request({ type: 'session.stop', session: 'impl' }, 15_000);
  assert.equal(stop.ok, true, stop.error);
});

for (const harness of ['codex', 'opencode']) {
  test(`${harness}: an unverifiable live server remains running and supervised after refused stop/relaunch`, async t => {
    const root = await tempProject(t);
    const fake = harness === 'codex' ? await fakeCodex(t) : await fakeOpenCode(t);
    const { discovery } = await startDaemon(t, root, fake.env);
    const ui = await connectUi(t, discovery);
    const launch = await ui.request({ type: 'session.launch', name: 'impl', harness }, 30_000);
    assert.equal(launch.ok, true, launch.error);
    const p = (launch.value as { process: Harness }).process;
    const db = new DatabaseSync(join(root, '.cland', 'hub.db'));
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


test('hub start opens its socket promptly while sixteen TERM-resistant orphans are swept in parallel', async t => {
  const root = await tempProject(t);
  const fake = await fakeOpenCode(t);
  const env = { ...fake.env, FAKE_OPENCODE_IGNORE_TERM: '1' };
  const pids = await Promise.all(Array.from({ length: 16 }, (_, i) => leftoverOpenCode(t, root, OPENCODE_FAKE, env, root, `orphan-${i}`)));
  const started = performance.now();
  const { discovery } = await startDaemon(t, root, env);
  assert.ok(performance.now() - started < 5000, 'cleanup cannot hold socket startup behind sixteen grace periods');
  const ui = await connectUi(t, discovery);
  assert.equal((await ui.request({ type: 'hub.status' })).ok, true);
  await eventually('parallel sweep ends every resistant orphan', async () => pids.every(pid => !pidAlive(pid)) ? true : undefined, 15_000);
});


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

test('the shared sweep deadline preserves remaining servers and prevents later signals', async t => {
  const root = await tempProject(t);
  const fake = await fakeOpenCode(t);
  const pid = await leftoverOpenCode(t, root, OPENCODE_FAKE, { ...fake.env, FAKE_OPENCODE_IGNORE_TERM: '1' });
  const start = performance.now();
  await assert.rejects(sweepOrphans(root, () => {}, 'harness', { deadline: Date.now() + 400 }), /deadline|failed|timed out/);
  assert.ok(performance.now() - start < 1500, 'all workers settle within the shared bound');
  await sleep(1300);
  assert.equal(pidAlive(pid), true, 'no worker keeps signalling after the deadline');
});

test('doctor --fix lets a foreground hub for a deleted project stop cleanly without recreating its directory', async t => {
  const root = await tempProject(t), removed = await tempProject(t);
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
  await rm(removed, { recursive: true });
  const fixed = await clandWithEnv(root, {}, 'doctor', '--fix', '--json');
  assert.match(fixed.stdout, new RegExp(`ended pid ${child.pid}`));
  const result = await exited.promise;
  assert.deepEqual(result, { code: 0, signal: null }, stderr);
  assert.doesNotMatch(stderr, /ENOENT|unhandledRejection/);
  await assert.rejects(readFile(join(removed, '.cland', 'hub.lock')), { code: 'ENOENT' });
});
