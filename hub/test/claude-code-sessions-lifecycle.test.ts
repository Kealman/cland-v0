// T3: real delayed hook-process ordering, early bridge confirmation, PID resume identity, TERM escalation and held-hook reaping.
import { accountFixtureEnvironment } from './account-fixture-env.ts';
import { fixtureEnvironment, runnerFixtureEnvironment } from './fixture-environment.ts';
import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { execFile, spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { afterCleanup, beforeDirectories, ownProcess, recordedProcess } from './process-cleanup.ts';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { withDiscoveredPid, CLI_ENTRY, FAKE_CLAUDE_DIR, connectUi, eventually, fakeClaude, inProcessSpoke, killDaemon, pidAlive, nativeProjectHub as projectHub, projectHub as scriptedProjectHub, tempProject, type FrameClient } from './harness.ts';
import { FakeClock } from './fake-clock.ts';
import { NO_PS } from './native-process.ts';
import { processIdentities, processIdentityAsync } from '../src/process-identity.ts';
import { systemProcessProbe } from './system-process-probe.ts';

type Presence = { name: string; sessionId: string; state: string };
type Harness = { name: string; pid: number | null; harnessId: string | null; sessionId: string; harnessSessionId: string | null; status: string; state: string };
type Status = { sessions: Presence[]; harnesses: Harness[] };

async function status(ui: FrameClient): Promise<Status> {
  const r = await ui.request({ type: 'hub.status', history: true });
  assert.equal(r.ok, true, r.error);
  return r.value as Status;
}

const harness = async (ui: FrameClient, name: string): Promise<Harness> => {
  const h = (await status(ui)).harnesses.find((x) => x.name === name);
  assert.ok(h, `no harness row ${name}`);
  return h;
};

async function launch(ui: FrameClient, name: string, extra: Record<string, unknown> = {}): Promise<Harness> {
  const r = await ui.request({ type: 'session.launch', name, ...extra }, 30_000);
  assert.equal(r.ok, true, r.error);
  return (r.value as { process: Harness }).process;
}

const presentAs = (ui: FrameClient, name: string, state: string) =>
  eventually(`${name} present as ${state}`, async () => ((await status(ui)).sessions.find((s) => s.name === name)?.state === state ? true : undefined));

const hubLog = (root: string) => readFile(join(root, '.cland', 'log', 'hub.log'), 'utf8');

for (const errno of ['ENOENT', 'ESRCH']) for (const outcome of ['absent', 'present', 'surviving branch']) {
  test(`Linux ${errno} after ownership snapshot ${outcome === 'absent' ? 'settles a confirmed-gone descendant branch' : `refuses ${outcome}`}`, async () => {
    await systemProcessProbe(`
rows = [row(420100, 1, 420100), row(420101, 420100, 420101), row(420102, 420101, 420102), row(420103, 420100, 420103)];
let reads = 0;
onStat = async pid => {
 if (pid === 420101 && ++reads === 2) {
  ${outcome === 'absent' ? 'rows = rows.filter(r => r.pid !== 420101 && r.pid !== 420102);' : outcome === 'surviving branch' ? 'rows = rows.filter(r => r.pid !== 420101);' : ''}
  return ${JSON.stringify(errno)};
 }
};
const events = [];
const result = await endProcess({ pid: 420100, pidStarted: start }, event => events.push(event), 0);
assert.equal(reads >= 2, true, 'failure occurs at the after-snapshot native read');
assert.equal(result, ${outcome === 'absent'});
${outcome === 'absent' ? `assert.deepEqual(rows, [], 'the original and unchanged managed child still terminate');
assert.ok(liveness.includes(420101) && liveness.includes(420102), 'both stale branch PIDs have native absence receipts');
assert.ok(signals.every(s => s.pid !== 420101 && s.pid !== 420102), 'exited branch receives no signal');
assert.ok(signals.some(s => s.pid === 420103 && s.signal === 'SIGKILL'));` : `assert.deepEqual(signals, [], 'a present or unverified surviving branch receives no signal');
assert.ok(events.some(event => String(event.reason).includes(${JSON.stringify(`stat read: ${errno}`)}) && String(event.reason).includes('process still present')), 'refusal retains the native read and liveness outcomes');`}
`, 'linux');
  });
}

for (const errno of ['ENOENT', 'ESRCH']) for (const livenessError of ['EPERM', 'EIO']) {
  test(`Linux ${errno} after ownership snapshot refuses ${livenessError} from kill(0)`, async () => {
    await systemProcessProbe(`
rows = [row(420100, 1, 420100), row(420101, 420100, 420101)];
let reads = 0;
onStat = async pid => {
 if (pid === 420101 && ++reads === 2) { rows = rows.filter(r => r.pid !== 420101); return ${JSON.stringify(errno)}; }
};
const kill = process.kill;
process.kill = (pid, signal) => {
 if (pid === 420101 && signal === 0) throw Object.assign(new Error('liveness unavailable'), { code: ${JSON.stringify(livenessError)} });
 return kill(pid, signal);
};
const events = [];
assert.equal(await endProcess({ pid: 420100, pidStarted: start }, event => events.push(event), 0), false);
assert.deepEqual(signals, [], 'only native ESRCH, not the stat error, can settle a descendant');
assert.ok(events.some(event => String(event.reason).includes(${JSON.stringify(`kill(0) pid 420101: ${livenessError}`)})));
`, 'linux');
  });
}

async function nativeBirthDiagnostic(root: string, pid: number) {
  const errors: string[] = [];
  const sync = processIdentities([pid], (_pid, error) => errors.push(error)).get(pid) ?? null;
  const async = await processIdentityAsync(pid, process.env, (_pid, error) => errors.push(error));
  const db = new DatabaseSync(join(root, '.cland', 'hub.db'), { readOnly: true });
  try {
    return { sync, async, errors, captured: recordedProcess(pid) ?? null,
      saved: db.prepare('select pid, pid_started, pid_identity from harness_processes where pid = ?').get(pid) ?? null };
  } finally { db.close(); }
}

test('Linux native read diagnostics identify boot-id and stat failures in both readers', async t => {
  const root = await tempProject(t);
  const source = `
import assert from 'node:assert/strict';
import fs from 'node:fs'; import promises from 'node:fs/promises';
import { syncBuiltinESMExports } from 'node:module';
Object.defineProperty(process, 'platform', { value: 'linux' });
const sync = fs.readFileSync, async = promises.readFile;
let bootFails = true;
const read = path => {
 if (path === '/proc/sys/kernel/random/boot_id') {
  if (bootFails) throw Object.assign(new Error('denied'), { code: 'EACCES' });
  return '11111111-2222-3333-4444-555555555555';
 }
 if (path === '/proc/123/stat') throw Object.assign(new Error('gone'), { code: 'ENOENT' });
};
fs.readFileSync = (path, ...args) => read(path) ?? sync(path, ...args);
promises.readFile = async (path, ...args) => read(path) ?? async(path, ...args);
syncBuiltinESMExports();
const { processIdentities, processIdentitiesAsync } = await import(${JSON.stringify(new URL('../src/process-identity.ts', import.meta.url).href)});
for (const boot of [true, false]) {
 bootFails = boot;
 const failures = [];
 const report = (pid, error) => failures.push({ pid, error });
 assert.equal(processIdentities([123], report).size, 0);
 assert.equal((await processIdentitiesAsync([123], {}, 3000, report)).size, 0);
 const error = boot ? 'Linux boot-id read: EACCES' : 'Linux /proc/123/stat read: ENOENT';
 assert.deepEqual(failures, [{ pid: 123, error }, { pid: 123, error }]);
}
`;
  await new Promise<void>((resolve, reject) => {
    execFile(process.execPath, ['--input-type=module', '-e', source], { cwd: root, env: fixtureEnvironment(root, process.env), timeout: 5000 }, (error, _stdout, stderr) => error ? reject(new Error(stderr || String(error))) : resolve());
  });
});

test('Linux background Claude publishes a verifiable native birth and stops through the recorded PID', { skip: process.platform !== 'linux' ? 'requires Linux native process identity' : false }, async t => {
  const root = await tempProject(t);
  const fake = await fakeClaude(t, { stopCrash: true, ignoreTerm: true, stopGraceMs: 500 });
  const { discovery } = await projectHub(t, root, fake.env);
  const ui = await connectUi(t, discovery);
  const launched = await launch(ui, 'coord', { role: 'coordinator' });
  await presentAs(ui, 'coord', 'idle');
  const { pid } = await withDiscoveredPid(ui, launched);
  const proof = await nativeBirthDiagnostic(root, pid);
  const detail = JSON.stringify(proof);
  assert.match(proof.sync ?? '', /^linux:[a-f0-9-]{36}:\d+$/, detail);
  assert.equal(proof.async, proof.sync, detail);
  assert.equal((proof.saved as { pid_identity?: string } | null)?.pid_identity, proof.sync, detail);
  assert.equal(proof.captured?.identity, proof.sync, detail);
  const stopped = await ui.request({ type: 'session.stop', session: 'coord' }, 15_000);
  assert.equal(stopped.ok, true, stopped.error);
  await eventually('verified Linux Claude PID is gone', () => !pidAlive(pid) || undefined);
  assert.equal(pidAlive(pid), false);
});

const sendGeneral = async (ui: FrameClient, text: string): Promise<string> => {
  const sent = await ui.request({ type: 'topic.send', topic: 'general', text });
  assert.equal(sent.ok, true, sent.error);
  return (sent.value as { message: { id: string } }).message.id;
};

const injected = (ui: FrameClient, id: string, timeoutMs = 15_000) => ui.waitFor((f) => f.type === 'delivery' && f.message === id && f.stage === 'injected', timeoutMs);

/**
 * One `cland hook <event>` as a harness runs it, the payload on stdin; `done` resolves when it exited (it waits for
 * the hub's answer). `held` gates the process before `cland` runs on fd 3; `started`
 * resolves once the process is running (its start time, the signal's time, is behind it), whatever the machine's load.
 */
function hook(t: TestContext, root: string, event: string, o: { session: string; launch?: string; payload?: Record<string, unknown>; held?: boolean }): { started: Promise<void>; done: Promise<void>; release: () => void; pid: number } {
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) if (v !== undefined && !k.startsWith('CLAND_')) env[k] = v;
  const MARK = 'cland-test-hook-started';
  env.NODE_OPTIONS = `--import=data:text/javascript,${encodeURIComponent(`process.stderr.write(${JSON.stringify(`${MARK}\n`)}); ${o.held ? "const { createReadStream } = await import('node:fs'); await new Promise(resolve => createReadStream(null, { fd: 3 }).once('data', resolve));" : ''}`)}`;
  const args = [CLI_ENTRY, 'hook', event, '--session', o.session, ...(o.launch ? ['--launch', o.launch] : []), '--hub-file', join(root, '.cland', 'hub.json')];
  let markStarted!: () => void;
  const started = new Promise<void>((resolve) => (markStarted = resolve));
  let release = () => {};
  let pid!: number;
  const done = new Promise<void>((resolve, reject) => {
    const child = spawn(process.execPath, args, { cwd: root, env: runnerFixtureEnvironment(root, env), stdio: ['pipe', 'ignore', 'pipe', 'pipe'], timeout: 15_000, killSignal: 'SIGKILL' });
    pid = child.pid!;
    ownProcess(t, child.pid); // Resource cleanup and signal cleanup both own this exact child identity.
    let released = false;
    release = () => {
      if (released) return;
      released = true;
      const gate = child.stdio[3] as import('node:stream').Writable;
      if (!gate.destroyed && !gate.writableEnded && child.exitCode === null && child.signalCode === null) gate.end('release');
    };
    let err = '';
    child.stderr!.on('data', (c: Buffer) => {
      err += String(c);
      if (err.includes(MARK)) markStarted();
      const rest = String(c).replace(`${MARK}\n`, '');
      if (rest) process.stderr.write(rest);
    });
    child.on('error', reject);
    child.on('close', () => {
      markStarted();
      resolve();
    });
    child.stdin!.end(JSON.stringify(o.payload ?? {}));
  });
  // ownProcess runs before this step in normal teardown; it also owns signal cleanup.
  // Observe close before directory removal, even if an assertion failed while fd 3 was held.
  beforeDirectories(t, async () => { await done; });
  return { started, done, release: () => release(), pid };
}

test('signal order is the order the harness fired them: a Stop whose hook process started slowly does not outrank the next turn start', async (t) => {
  const root = await tempProject(t);
  // Only the hooks need real processes here. A scripted harness has no automatic clause
  // turn or fallback poll that could overwrite the staged busy state on a loaded machine.
  const clock = new FakeClock();
  const { discovery, fakes } = await scriptedProjectHub(t, root, {}, { clock });
  const ui = await connectUi(t, discovery);
  assert.equal((await ui.request({ type: 'subscribe' })).ok, true);
  const launched = await launch(ui, 'coord', { role: 'coordinator', harness: 'claude-code' });
  const fake = fakes['claude-code']!;
  const peer = await inProcessSpoke(t, { cwd: root, discover: true, name: 'coord', assignRole: false,
    sessionId: launched.sessionId, launchToken: fake.spawns[0]!.launchToken! });
  await peer.waitForPresence(['coord']);
  fake.idle('coord');
  await presentAs(ui, 'coord', 'idle');

  // Stop's process starts first but is gated before cland loads. The next hook's completed
  // busy report is the positive ordering barrier; releasing Stop makes it arrive last.
  const stop = hook(t, root, 'turn-end', { session: 'coord', launch: launched.sessionId, held: true });
  await stop.started;
  await hook(t, root, 'turn-start', { session: 'coord', launch: launched.sessionId }).done;
  await ui.waitFor(f => f.type === 'session.state' && f.session === 'coord' && f.state === 'busy' && f.source === 'hook');
  assert.equal((await status(ui)).sessions.find(s => s.name === 'coord')?.state, 'busy');
  stop.release();
  await stop.done;
  assert.equal((await status(ui)).sessions.find(s => s.name === 'coord')?.state, 'busy');
  assert.equal((await harness(ui, 'coord')).state, 'busy', 'the older Stop arrived last and was dropped');
  assert.equal((await ui.request({ type: 'hub.status', history: true, flushLogs: true })).ok, true);
  assert.match(await hubLog(root), /"event":"signal-stale","session":"coord","state":"idle","source":"hook"/);
});

test("a message the spoke accepted during the launch is injected once the launch's early bridge and SessionStart are in", async (t) => {
  const root = await tempProject(t);
  // `--bg` returns only after the SessionStart hook ran and the mod's bridge was answered: both wait for the row
  const fake = await fakeClaude(t, { lateBg: 'bridged' });
  const { discovery } = await projectHub(t, root, fake.env);
  const ui = await connectUi(t, discovery);
  assert.equal((await ui.request({ type: 'subscribe' })).ok, true);
  // no coordinator yet: the message waits for the role, and the launching session's spoke takes it
  const id = await sendGeneral(ui, 'waiting for you');
  await launch(ui, 'coord', { role: 'coordinator' });
  assert.equal((await ui.request({ type: 'hub.status', history: true, flushLogs: true })).ok, true);
  assert.match(await hubLog(root), /"event":"session-launched".*"early":1/, 'the early SessionStart was replayed');
  await injected(ui, id);
  await ui.waitFor((f) => f.type === 'message' && (f.message as { text: string }).text === 'pong: waiting for you', 15_000);
});

test('Claude process resume never adopts another session that reuses the pid: no identity match, no resume', async (t) => {
  const root = await tempProject(t);
  const fake = await fakeClaude(t);
  const first = await projectHub(t, root, fake.env);
  const { discovery } = first;
  const ui = await connectUi(t, discovery);
  const launched = await launch(ui, 'coord', { role: 'coordinator' });
  await presentAs(ui, 'coord', 'idle');
  const discovered = await withDiscoveredPid(ui, launched);
  ui.close();
  await first.stop();

  // the session dies while no hub runs, and its pid is taken by another session (the table is made to say so)
  await killDaemon(discovered.pid);
  const otherEnv = await accountFixtureEnvironment(fake.env);
  await new Promise<void>((resolve) =>
    execFile(join(FAKE_CLAUDE_DIR, 'claude'), ['--bg', '--name', 'other'], { cwd: root, env: otherEnv }, () => resolve()),
  );
  const other = (await fake.sessions()).find((s) => s.name === 'other');
  assert.ok(other && pidAlive(other.pid));
  const db = new DatabaseSync(join(root, '.cland', 'hub.db'));
  db.prepare('update harness_processes set pid = ? where name = ?').run(other.pid, 'coord');
  db.close();

  const second = await projectHub(t, root, fake.env);
  const ui2 = await connectUi(t, second.discovery);
  const row = await eventually('coord not resumed', async () => {
    const h = (await status(ui2)).harnesses.find((x) => x.name === 'coord');
    return h?.status === 'exited' ? h : undefined;
  });
  assert.equal(row.state, 'unknown');
  assert.equal((await ui2.request({ type: 'hub.status', history: true, flushLogs: true })).ok, true);
  assert.doesNotMatch(await hubLog(root), /"event":"session-resumed","session":"coord"/);
  assert.ok(pidAlive(other.pid), 'the other session is left alone');
});

test('a stop whose `claude stop` fails falls back to SIGTERM and stops the session', { skip: NO_PS }, async (t) => {
  const root = await tempProject(t);
  const fake = await fakeClaude(t, { stopCrash: true, stopGraceMs: 1000 });
  const { discovery } = await projectHub(t, root, fake.env);
  const ui = await connectUi(t, discovery);
  const launched = await launch(ui, 'coord', { role: 'coordinator' });
  await presentAs(ui, 'coord', 'idle');
  const discovered = await withDiscoveredPid(ui, launched);
  const r = await ui.request({ type: 'session.stop', session: 'coord' }, 15_000);
  assert.equal(r.ok, true, r.error);
  assert.equal((r.value as { process: Harness }).process.status, 'stopped');
  await eventually('stopped Claude PID is gone', () => !pidAlive(discovered.pid) || undefined);
  assert.ok(!pidAlive(discovered.pid));
  assert.equal((await ui.request({ type: 'hub.status', history: true, flushLogs: true })).ok, true);
  assert.match(await hubLog(root), /"event":"harness-stop-failed","session":"coord"/);
  assert.doesNotMatch(await hubLog(root), /"event":"harness-exited"/, 'a stop is no crash');
});

test('stop kills a Claude Code process that ignores SIGTERM and waits for its exit', async (t) => {
  const root = await tempProject(t);
  const fake = await fakeClaude(t, { stopCrash: true, ignoreTerm: true, stopGraceMs: 500 });
  const { discovery } = await projectHub(t, root, fake.env);
  const ui = await connectUi(t, discovery);
  const launched = await launch(ui, 'coord', { role: 'coordinator' });
  await presentAs(ui, 'coord', 'idle');
  const discovered = await withDiscoveredPid(ui, launched);
  const r = await ui.request({ type: 'session.stop', session: 'coord' }, 15_000);
  assert.equal(r.ok, true, r.error);
  assert.equal((await harness(ui, 'coord')).status, 'stopped');
  await eventually('TERM-ignoring Claude PID is gone', () => !pidAlive(discovered.pid) || undefined);
  assert.equal(pidAlive(discovered.pid), false, 'stop completes with observed exit');
  assert.equal((await ui.request({ type: 'hub.status', history: true, flushLogs: true })).ok, true);
  assert.match(await readFile(join(root, '.cland', 'journal.jsonl'), 'utf8'), /"event":"harness-ended"/);
});

// Run the real registered teardown after a controlled exception without failing the outer test.
// This scope captures only node:test's after registration; the production ownership steps are unchanged.
test('a held Claude hook is reaped before fixture removal after a pre-release failure', async t => {
  const cleanups: Array<() => unknown | Promise<unknown>> = [];
  const scope = { after: (cleanup: () => unknown | Promise<unknown>) => cleanups.push(cleanup) } as unknown as TestContext;
  const root = await tempProject(scope);
  const held = hook(scope, root, 'turn-end', { session: 'unlaunched', held: true });
  const cleanup = async () => { for (const step of cleanups) await step(); };
  t.after(cleanup); // Covers failures in this regression probe itself too; owned disposers are idempotent.
  let closedBeforeRemoval = false;
  beforeDirectories(scope, async () => {
    await held.done;
    assert.equal(pidAlive(held.pid), false, 'the held child has exited');
    assert.equal(existsSync(root), true, 'completion is observed while the fixture still exists');
    closedBeforeRemoval = true;
  });
  afterCleanup(scope, () => {
    assert.equal(closedBeforeRemoval, true);
    assert.equal(existsSync(root), false, 'directory removal follows the completion receipt');
  });
  const failure = new Error('controlled failure before releasing the hook');
  await assert.rejects(async () => {
    try {
      await held.started;
      assert.equal(pidAlive(held.pid), true, 'the child is still held when the body fails');
      throw failure;
    } finally { await cleanup(); }
  }, error => error === failure);
});

test('Claude relaunch stops the previous native job after its PID has exited', { skip: NO_PS }, async t => {
  const root = await tempProject(t);
  const fake = await fakeClaude(t);
  const first = await projectHub(t, root, fake.env);
  const ui = await connectUi(t, first.discovery);
  const launched = await launch(ui, 'coord', { role: 'coordinator' });
  await presentAs(ui, 'coord', 'idle');
  const discovered = await withDiscoveredPid(ui, launched);
  await killDaemon(discovered.pid);
  await eventually('old native PID reaped', () => !pidAlive(discovered.pid) || undefined);
  const result = await ui.request({ type: 'session.resume', session: 'coord', relaunch: true }, 30_000);
  assert.equal(result.ok, true, result.error);
  await presentAs(ui, 'coord', 'idle');
  const replacement = await withDiscoveredPid(ui, await harness(ui, 'coord'));
  assert.notEqual(replacement.pid, discovered.pid);
  const jobs = (await fake.sessions()).filter(s => s.name === 'coord');
  assert.equal(jobs.length, 1, 'native job listing contains exactly one live coordinator');
  const calls = (await readFile(join(fake.home, 'calls.jsonl'), 'utf8')).trim().split('\n').map(line => JSON.parse(line) as { args: string[] });
  assert.ok(calls.some(c => c.args[0] === 'stop' && c.args[1] === discovered.harnessId), 'native stop receipt names the previous job');
});
