// A pid is never signalled on a guess (Codex review of #26): the process table records each harness process's
// start time, and every adapter (Codex, OpenCode, Claude Code) verifies it before a SIGTERM or SIGKILL. A pid that
// now belongs to an unrelated process (reused after a crash or a restart) is left alone. The reuse is staged by
// pointing the process table's row at an unrelated live process, as the hub would find it after the pid was reused.
// Against a real daemon in a temporary project with the fake harnesses.
import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, readdir, readFile, realpath, rm } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { clandWithEnv, connectUi, eventually, fakeClaude, fakeCodex, killDaemon, pidAlive, sleep, startDaemon, tempProject, type FrameClient } from './harness.ts';

type Harness = { name: string; pid: number | null; status: string; state: string };

/** An unrelated process: what a reused pid belongs to. Killed when the test ends. */
function bystander(t: TestContext): number {
  const child = spawn('sleep', ['120'], { stdio: 'ignore', detached: true });
  child.unref();
  const pid = child.pid as number;
  t.after(() => killDaemon(pid));
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
  const other = bystander(t);
  reusePid(root, 'impl-1', other);

  const second = await startDaemon(t, root, fake.env);
  const ui2 = await connectUi(t, second.discovery);
  await eventually('not re-found', async () => ((await harness(ui2, 'impl-1'))?.status === 'exited' ? true : undefined));
  assert.equal(pidAlive(other), true, 'resume at start left the bystander alone');
  const relaunched = await ui2.request({ type: 'session.resume', session: 'impl-1', relaunch: true }, 30_000);
  assert.equal(relaunched.ok, true, relaunched.error);
  await sleep(200);
  assert.equal(pidAlive(other), true, 'the relaunch left the bystander alone');

  // the relaunched app-server's pid goes to the bystander too: stop refuses to signal it
  const fresh = (await harness(ui2, 'impl-1'))?.pid as number;
  t.after(() => killDaemon(fresh));
  reusePid(root, 'impl-1', other);
  await ui2.request({ type: 'session.stop', session: 'impl-1' }, 15_000);
  await sleep(200);
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
  const other = bystander(t);
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
  const env = { PATH: `${FAKE_OPENCODE_DIR}:${process.env.PATH ?? ''}`, FAKE_OPENCODE_HOME: home, FAKE_OPENCODE_TURN_MS: '100', CLAND_ADAPTER_POLL_MS: '200' };
  t.after(async () => {
    for (const f of await readdir(join(home, 'servers')).catch(() => [] as string[])) {
      const s = JSON.parse(await readFile(join(home, 'servers', f), 'utf8').catch(() => 'null')) as { pid: number } | null;
      if (s) await killDaemon(s.pid);
    }
    await rm(home, { recursive: true, force: true });
  });
  const { discovery } = await startDaemon(t, root, env);
  const ui = await connectUi(t, discovery);
  const launched = await ui.request({ type: 'session.launch', name: 'impl', role: 'implementer', harness: 'opencode' }, 30_000);
  assert.equal(launched.ok, true, launched.error);
  const other = bystander(t);
  reusePid(root, 'impl', other);
  await ui.request({ type: 'session.stop', session: 'impl' }, 15_000);
  await sleep(200);
  assert.equal(pidAlive(other), true, 'the bystander was not signalled');
});
