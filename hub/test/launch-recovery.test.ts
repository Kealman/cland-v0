import test from 'node:test';
import assert from 'node:assert/strict';
import { chmod, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { clandWithEnv, connectUi, eventually, fakeCodex, NO_PS, pidAlive, startDaemon, tempProject } from './harness.ts';
import type { HarnessProcessView } from '../src/protocol.ts';
import { ownProcess } from './process-cleanup.ts';

async function identityFence(root: string, originalEnv: Record<string, string>, unknown = false) {
  const bin = join(root, 'bin');
  const blocked = join(root, 'blocked-pid');
  const unknownFile = join(root, 'unknown-identity');
  await mkdir(bin);
  if (unknown) await writeFile(unknownFile, 'block capture');
  // Keep OS discovery real; refuse only the failed child's immediate identity probes.
  await writeFile(join(bin, 'ps'), `#!${process.execPath}
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
const args = process.argv.slice(2);
const pid = args[args.indexOf('-p') + 1];
if (args[0] === '-o') {
  if (existsSync(${JSON.stringify(blocked)}) && pid === readFileSync(${JSON.stringify(blocked)}, 'utf8')) process.exit(1);
  if (existsSync(${JSON.stringify(unknownFile)}) && spawnSync('/bin/ps', ['-o', 'command=', '-p', pid], { encoding: 'utf8' }).stdout.includes('app-server')) process.exit(1);
}
const result = spawnSync('/bin/ps', args, { encoding: 'utf8' });
process.stdout.write(result.stdout); process.stderr.write(result.stderr); process.exitCode = result.status ?? 1;
`, { mode: 0o755 });
  return { blocked, unknownFile, env: { ...originalEnv, PATH: `${bin}:${originalEnv.PATH}` } };
}

for (const unknown of [false, true])
test(`a failed spawn keeps its files and launch fence across restart until its child is confirmed dead (${unknown ? 'unknown' : 'captured'} start identity)`, { skip: NO_PS }, async t => {
  const root = await tempProject(t);
  const fake = await fakeCodex(t, { env: { FAKE_CODEX_FAIL_FIRST_TURN: '1', CLAND_STOP_GRACE_MS: '50' } });
  const { blocked, unknownFile, env } = await identityFence(root, fake.env, unknown);
  await writeFile(join(fake.home, 'hold-thread-start'), 'hold');
  const first = await startDaemon(t, root, env);
  const ui = await connectUi(t, first.discovery);
  const log = join(root, '.cland/log/codex-impl.log');
  await writeFile(log, 'prior log\n');
  const launch = ui.request({ type: 'session.launch', name: 'impl', role: 'implementer', harness: 'codex' }, 30_000);
  await eventually('thread start held after child identity capture', async () => await stat(join(fake.home, 'thread-start-running')).then(() => true, () => undefined));
  const [child] = await fake.servers();
  assert.ok(child);
  await writeFile(blocked, String(child.pid));
  await writeFile(log, 'prior log\nfailed child output\n');
  await writeFile(join(fake.home, 'release-thread-start'), 'release');
  const failure = await launch;
  assert.equal(failure.ok, false);
  assert.match(failure.error!, /cleanup is pending/);
  const pending = (await ui.request({ type: 'session.list' })).value as { pendingStops: Array<{ process: { pid: number; pidStarted: string | null } }> };
  assert.equal(pending.pendingStops[0]?.process.pid, child.pid);
  if (unknown) assert.equal(pending.pendingStops[0]?.process.pidStarted, null);
  else assert.ok(pending.pendingStops[0]?.process.pidStarted, 'the original start identity was captured before probes were refused');
  const ownedLog = await readFile(log, 'utf8');
  assert.notEqual(ownedLog, 'prior log\n');
  assert.equal(pidAlive(child.pid), true);
  assert.equal((await clandWithEnv(root, env, 'hub', 'stop')).code, 0);
  const second = await startDaemon(t, root, env);
  const ui2 = await connectUi(t, second.discovery);
  const refused = await ui2.request({ type: 'session.launch', name: 'impl', role: 'implementer', harness: 'codex' }, 30_000);
  assert.equal(refused.ok, false);
  assert.match(refused.error!, /cleanup is pending|pending launch/);
  assert.equal((await fake.servers()).length, 1, 'restart must not spawn another child on owned resources');
  assert.equal(await readFile(log, 'utf8'), ownedLog);
  assert.equal(await stat(child.socket).then(() => true, () => false), true);

  process.kill(child.pid, 'SIGKILL');
  await eventually('dead child releases file ownership', async () => {
    const listed = await ui2.request({ type: 'session.list' });
    return (listed.value as { pendingStops: unknown[] }).pendingStops.length === 0 && (await readFile(log, 'utf8')) === 'prior log\n' || undefined;
  }, 15_000);
  assert.equal(await stat(child.socket).then(() => true, () => false), false);
  await rm(blocked);
  await rm(unknownFile, { force: true });
  // A clean attempt reaches the fake model again, rather than the old recovery fence.
  const retry = await ui2.request({ type: 'session.launch', name: 'impl', role: 'implementer', harness: 'codex' }, 30_000);
  assert.equal(retry.ok, false);
  assert.match(retry.error!, /model refused the first turn/);
  assert.doesNotMatch(retry.error!, /cleanup is pending|still supervised/);
});

test('a failed relaunch retains its conversation and refuses resume across restart until file cleanup settles', { skip: NO_PS }, async t => {
  const root = await tempProject(t);
  const fake = await fakeCodex(t, { env: { CLAND_STOP_GRACE_MS: '50' } });
  const { blocked, env } = await identityFence(root, fake.env);
  const first = await startDaemon(t, root, env);
  const ui = await connectUi(t, first.discovery);
  const launched = await ui.request({ type: 'session.launch', name: 'impl', role: 'implementer', harness: 'codex' }, 30_000);
  assert.equal(launched.ok, true, launched.error);
  const prior = (launched.value as { process: HarnessProcessView }).process;
  // Launch returns on turn acceptance; the fake saves a resumable rollout only after completion.
  // Persist the conversation before this recovery scenario kills the original child.
  await eventually('first clause turn persisted for relaunch', async () => {
    const thread = JSON.parse(await readFile(join(fake.home, 'threads', `${prior.harnessSessionId}.json`), 'utf8')) as { turns: number };
    return thread.turns > 0 || undefined;
  });
  const log = join(root, '.cland/log/codex-impl.log');
  await writeFile(log, 'committed conversation log\n');
  for (const flag of ['hold-thread-resume', 'fail-thread-resume']) await writeFile(join(fake.home, flag), 'hold');
  const relaunch = ui.request({ type: 'session.resume', session: 'impl', relaunch: true }, 30_000);
  await eventually('new child held at thread resume', async () => await stat(join(fake.home, 'thread-resume-running')).then(() => true, () => undefined));
  const child = (await fake.servers()).find(p => p.pid !== prior.pid);
  assert.ok(child);
  await writeFile(blocked, String(child.pid));
  await writeFile(log, 'committed conversation log\nfailed relaunch output\n');
  await writeFile(join(fake.home, 'release-thread-resume'), 'release');
  const failure = await relaunch;
  assert.equal(failure.ok, false); assert.match(failure.error!, /cleanup is pending/);
  assert.equal((await clandWithEnv(root, env, 'hub', 'stop')).code, 0);
  const second = await startDaemon(t, root, env);
  const ui2 = await connectUi(t, second.discovery);
  for (const relaunch of [false, true]) {
    const refused = await ui2.request({ type: 'session.resume', session: 'impl', relaunch }, 30_000);
    assert.equal(refused.ok, false); assert.match(refused.error!, /cleanup is pending/);
  }
  assert.equal(await readFile(log, 'utf8'), 'committed conversation log\nfailed relaunch output\n');
  assert.equal((await fake.servers()).length, 1);
  process.kill(child.pid, 'SIGKILL');
  await eventually('relaunch rollback restores its prior log', async () => {
    const listed = await ui2.request({ type: 'session.list' });
    return (listed.value as { pendingStops: unknown[] }).pendingStops.length === 0 && (await readFile(log, 'utf8')) === 'committed conversation log\n' || undefined;
  }, 15_000);
  await rm(blocked);
  await rm(join(fake.home, 'fail-thread-resume'));
  const retried = await ui2.request({ type: 'session.resume', session: 'impl', relaunch: true }, 30_000);
  assert.equal(retried.ok, true, retried.error);
  const resumed = (retried.value as { process: HarnessProcessView }).process;
  assert.equal(resumed.sessionId, prior.sessionId);
  assert.equal(resumed.harnessSessionId, prior.harnessSessionId);
  assert.equal(resumed.role, 'implementer');
});

test('OpenCode restart recovery restores owned configuration, password and log without removing shared files', { skip: NO_PS }, async t => {
  const root = await tempProject(t);
  const home = await tempProject(t, 'fake-opencode-');
  const { blocked, env } = await identityFence(root, {
    PATH: process.env.PATH ?? '', FAKE_OPENCODE_HOME: home,
    CLAND_OPENCODE_BIN: fileURLToPath(new URL('./fakes/opencode/opencode', import.meta.url)),
    CLAND_STOP_GRACE_MS: '50', CLAND_ADAPTER_POLL_MS: '200',
  });
  const dir = join(root, '.cland/opencode/impl');
  await mkdir(dir, { recursive: true });
  const originals = [['opencode.json', 'prior configuration\n'], ['password', 'prior password\n'], ['serve.log', 'prior server log\n']];
  for (const [name, content] of originals) {
    await writeFile(join(dir, name!), content!); await chmod(join(dir, name!), 0o640);
  }
  const shared = join(root, '.cland/opencode/sibling');
  await writeFile(shared, 'shared data\n');
  for (const flag of ['hold-session', 'fail-session']) await writeFile(join(home, flag), 'hold');
  const first = await startDaemon(t, root, env);
  const ui = await connectUi(t, first.discovery);
  const launching = ui.request({ type: 'session.launch', name: 'impl', harness: 'opencode', role: 'implementer', model: 'opencode/fake-free' }, 30_000);
  await eventually('session creation held', async () => await stat(join(home, 'session-running')).then(() => true, () => undefined));
  const [server] = await readdir(join(home, 'servers'));
  assert.ok(server);
  const child = JSON.parse(await readFile(join(home, 'servers', server), 'utf8')) as { pid: number };
  ownProcess(t, child.pid);
  await writeFile(blocked, String(child.pid));
  await writeFile(join(home, 'release-session'), 'release');
  const failure = await launching;
  assert.equal(failure.ok, false); assert.match(failure.error!, /cleanup is pending/);
  const pendingConfig = await readFile(join(dir, 'opencode.json'), 'utf8');
  assert.notEqual(pendingConfig, 'prior configuration\n');
  assert.equal((await clandWithEnv(root, env, 'hub', 'stop')).code, 0);
  const second = await startDaemon(t, root, env);
  const ui2 = await connectUi(t, second.discovery);
  const refused = await ui2.request({ type: 'session.launch', name: 'impl', harness: 'opencode', role: 'implementer' });
  assert.equal(refused.ok, false); assert.match(refused.error!, /cleanup is pending/);
  assert.equal(await readFile(join(dir, 'opencode.json'), 'utf8'), pendingConfig);
  assert.equal((await readdir(join(home, 'servers'))).length, 1);
  process.kill(child.pid, 'SIGKILL');
  await eventually('OpenCode recovery settled', async () => {
    const list = await ui2.request({ type: 'session.list' });
    return (list.value as { pendingStops: unknown[] }).pendingStops.length === 0 || undefined;
  }, 15_000);
  for (const [name, content] of originals) {
    assert.equal(await readFile(join(dir, name!), 'utf8'), content);
    assert.equal((await stat(join(dir, name!))).mode & 0o777, 0o640);
  }
  assert.equal(await readFile(shared, 'utf8'), 'shared data\n');
  await rm(blocked); await rm(join(home, 'fail-session'));
  const retry = await ui2.request({ type: 'session.launch', name: 'impl', harness: 'opencode', role: 'implementer', model: 'opencode/fake-free' }, 30_000);
  assert.equal(retry.ok, true, retry.error);
});
