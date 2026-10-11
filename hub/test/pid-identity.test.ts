import { ownDirectory, ownProcess } from './process-cleanup.ts';
// A pid is never signalled on a guess (Codex review of #26): the process table records each harness process's
// start time, and every adapter (Codex, OpenCode, Claude Code) verifies it before a SIGTERM or SIGKILL. A pid that
// now belongs to an unrelated process (reused after a crash or a restart) is left alone. The reuse is staged by
// pointing the process table's row at an unrelated live process, as the hub would find it after the pid was reused.
// Against a real daemon in a temporary project with the fake harnesses.
import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, readdir, readFile, realpath } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { clandWithEnv, connectUi, eventually, fakeClaude, fakeCodex, killDaemon, pidAlive, sleep, startDaemon, tempProject, type FrameClient } from './harness.ts';

type Harness = { name: string; pid: number | null; status: string; state: string };

/** Wait into the next wall-clock second: `ps -o lstart=` (the start time identity is checked by) has whole seconds. */
const nextSecond = () => sleep(1000 - (Date.now() % 1000) + 50);

/** An unrelated process: what a reused pid belongs to. Killed when the test ends. It starts in a second of its own,
 *  so its start time differs from every harness process's, before it or after it, as a reused pid's does. */
async function bystander(t: TestContext): Promise<number> {
  await nextSecond();
  const child = spawn('sleep', ['120'], { stdio: 'ignore', detached: true });
  ownProcess(t, child.pid);
  child.unref();
  const pid = child.pid as number;
  t.after(() => killDaemon(pid));
  await nextSecond();
  return pid;
}

/** The pid was reused: the process table's row now names the bystander (its recorded start time is the old one's). */
function reusePid(root: string, name: string, pid: number): void {
  const db = new DatabaseSync(join(root, '.cland', 'hub.db'));
  try {
    db.exec('pragma busy_timeout = 2000');
    assert.equal(db.prepare('update harness_processes set pid = ? where name = ?').run(pid, name).changes, 1);
  } finally {
    db.close();
  }
}

async function harness(ui: FrameClient, name: string): Promise<Harness | undefined> {
  const r = await ui.request({ type: 'session.list' });
  return (r.value as { processes: Harness[] }).processes.find((p) => p.name === name);
}

test('Codex: after a crash and a hub restart, neither resume, relaunch nor stop signals a pid that another process reuses', async (t) => {
  const root = await tempProject(t);
  const fake = await fakeCodex(t);
  const first = await startDaemon(t, root, fake.env);
  const ui = await connectUi(t, first.discovery);
  const launched = await ui.request({ type: 'session.launch', name: 'impl-1', harness: 'codex', role: 'implementer' }, 30_000);
  assert.equal(launched.ok, true, launched.error);
  const old = (launched.value as { process: Harness }).process.pid as number;
  await eventually('idle', async () => ((await harness(ui, 'impl-1'))?.state === 'idle' ? true : undefined));
  ui.close();
  assert.equal((await clandWithEnv(root, fake.env, 'hub', 'stop')).code, 0);
  // the app-server crashes (its socket file stays behind) and its pid goes to an unrelated process
  await killDaemon(old);
  const other = await bystander(t);
  reusePid(root, 'impl-1', other);

  const second = await startDaemon(t, root, fake.env);
  const ui2 = await connectUi(t, second.discovery);
  await eventually('not re-found', async () => ((await harness(ui2, 'impl-1'))?.status === 'exited' ? true : undefined));
  assert.equal(pidAlive(other), true, 'resume at start left the bystander alone');
  const relaunched = await ui2.request({ type: 'session.resume', session: 'impl-1', relaunch: true }, 30_000);
  assert.equal(relaunched.ok, true, relaunched.error);
  await eventually('relaunched session idle', async () => ((await harness(ui2, 'impl-1'))?.state === 'idle' ? true : undefined));
  assert.equal(pidAlive(other), true, 'the relaunch left the bystander alone');

  // the relaunched app-server's pid goes to the bystander too: stop refuses to signal it
  const fresh = (relaunched.value as { process: Harness }).process.pid as number;
  t.after(() => killDaemon(fresh));
  reusePid(root, 'impl-1', other);
  // Wait for the refusal itself; OS inspection and lifecycle settlement are not a 15s latency contract.
  const stopped = ui2.request({ type: 'session.stop', session: 'impl-1' }, 30_000);
  const [result] = await Promise.all([stopped, eventually('stop refused the reused PID', async () => {
    await ui2.request({ type: 'hub.status', flushLogs: true });
    const records = (await readFile(join(root, '.cland', 'log', 'hub.log'), 'utf8')).split('\n').filter(line => line.startsWith('{')).map(line => JSON.parse(line) as { event: string; pid?: number; session?: string });
    return records.some(record => record.event === 'signal-refused' && record.pid === other && record.session === 'impl-1') ? true : undefined;
  }, 30_000)]);
  assert.equal(result.ok, false, 'a running row with a reused PID refuses stop');

  assert.equal(pidAlive(other), true, 'stop left the bystander alone');
  assert.match(await readFile(join(root, '.cland', 'log', 'hub.log'), 'utf8'), /"event":"signal-refused","pid":\d+/);
});

test('Claude Code: a stop whose `claude stop` fails never SIGTERMs a pid that another process reuses', async (t) => {
  const root = await tempProject(t);
  const fake = await fakeClaude(t, { stopGraceMs: 300 });
  const { discovery } = await startDaemon(t, root, fake.env);
  const ui = await connectUi(t, discovery);
  const launched = await ui.request({ type: 'session.launch', name: 'cc', role: 'implementer', harness: 'claude-code' }, 30_000);
  assert.equal(launched.ok, true, launched.error);
  await eventually('pid known', async () => ((await harness(ui, 'cc'))?.pid ? true : undefined));
  const other = await bystander(t);
  reusePid(root, 'cc', other);
  // `claude stop` cannot find the session either
  const db = new DatabaseSync(join(root, '.cland', 'hub.db'));
  db.prepare("update harness_processes set harness_id = 'gone0000' where name = 'cc'").run();
  db.close();
  const stopped = await ui.request({ type: 'session.stop', session: 'cc' }, 15_000);
  assert.equal(stopped.ok, false);
  assert.match(stopped.error ?? '', /could not stop "cc"/);
  assert.equal(pidAlive(other), true, 'the bystander was not signalled');
});

const FAKE_OPENCODE_DIR = fileURLToPath(new URL('./fakes/opencode', import.meta.url));

test('OpenCode: stop never signals a pid that another process reuses', async (t) => {
  const root = await tempProject(t);
  const home = await realpath(await mkdtemp(join(tmpdir(), 'fake-opencode-')));
  const cleanupHome = ownDirectory(undefined, home);
  const env = { PATH: `${FAKE_OPENCODE_DIR}:${process.env.PATH ?? ''}`, FAKE_OPENCODE_HOME: home, FAKE_OPENCODE_TURN_MS: '100', CLAND_ADAPTER_POLL_MS: '200' };
  t.after(async () => {
    for (const f of await readdir(join(home, 'servers')).catch(() => [] as string[])) {
      const s = JSON.parse(await readFile(join(home, 'servers', f), 'utf8').catch(() => 'null')) as { pid: number } | null;
      if (s) await killDaemon(s.pid);
    }
    await cleanupHome();
  });
  const { discovery } = await startDaemon(t, root, env);
  const ui = await connectUi(t, discovery);
  const launched = await ui.request({ type: 'session.launch', name: 'impl', role: 'implementer', harness: 'opencode' }, 30_000);
  assert.equal(launched.ok, true, launched.error);
  const other = await bystander(t);
  reusePid(root, 'impl', other);
  await ui.request({ type: 'session.stop', session: 'impl' }, 15_000);
  await sleep(200);
  assert.equal(pidAlive(other), true, 'the bystander was not signalled');
});
