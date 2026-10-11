import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { connectUi, eventually, fakeCodex, NO_PS, pidAlive, startDaemon, tempProject } from './harness.ts';

test('Codex: forced stop succeeds when a captured descendant exits before its final identity probe', { skip: NO_PS }, async t => {
  const root = await tempProject(t);
  const fake = await fakeCodex(t, { env: { FAKE_CODEX_TERM_DELAY_MS: '60000', CLAND_STOP_GRACE_MS: '100' } });
  const bin = join(root, 'bin');
  await mkdir(bin);
  const leaderFile = join(root, 'leader');
  const evidence = join(root, 'probe.json');
  // Schedule a real descendant exit in the snapshot-to-probe gap after its parent is killed.
  // The OS still supplies every identity; only the exit timing is controlled.
  await writeFile(join(bin, 'ps'), `#!${process.execPath}
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
const args = process.argv.slice(2);
const leaderFile = ${JSON.stringify(leaderFile)};
const evidence = ${JSON.stringify(evidence)};
const ps = args => spawnSync('/bin/ps', args, { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
if (args[0] === '-o' && existsSync(leaderFile) && !existsSync(evidence)) {
  const leader = Number(readFileSync(leaderFile, 'utf8'));
  const pid = Number(args[args.indexOf('-p') + 1]);
  const state = ps(['-o', 'stat=', '-p', String(pid)]).stdout.trim();
  const parentState = ps(['-o', 'stat=', '-p', String(leader)]).stdout.trim();
  if (pid !== leader && state.startsWith('T') && (!parentState || parentState.startsWith('Z'))) {
    const before = ps(args);
    process.kill(pid, 'SIGKILL');
    let after;
    for (let i = 0; i < 100; i++) {
      after = ps(args);
      if (!after.stdout.trim()) break;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 5);
    }
    writeFileSync(evidence, JSON.stringify({ pid, leader, before: before.stdout.trim(), after: after.stdout.trim(), code: after.status }));
  }
}
const result = ps(args);
process.stdout.write(result.stdout);
process.stderr.write(result.stderr);
process.exitCode = result.status ?? 1;
`, { mode: 0o755 });
  const { discovery } = await startDaemon(t, root, { ...fake.env, PATH: `${bin}:${fake.env.PATH}` });
  const ui = await connectUi(t, discovery);
  const launched = await ui.request({ type: 'session.launch', name: 'impl', harness: 'codex', role: 'implementer' }, 30_000);
  assert.equal(launched.ok, true, launched.error);
  const pid = (launched.value as { process: { pid: number } }).process.pid;
  await writeFile(leaderFile, String(pid));
  await eventually('Implementer idle', async () => {
    const list = await ui.request({ type: 'session.list' });
    return (list.value as { processes: Array<{ name: string; state: string }> }).processes.some(p => p.name === 'impl' && p.state === 'idle') || undefined;
  });
  const stopped = await ui.request({ type: 'session.stop', session: 'impl' }, 15_000);
  const probe = JSON.parse(await readFile(evidence, 'utf8')) as { before: string; after: string; code: number };
  assert.ok(probe.before, 'the captured descendant had a real start time');
  assert.equal(probe.after, '', 'the descendant exited before its final identity read');
  assert.equal(probe.code, 1, 'ps reports that the captured descendant is gone');
  assert.equal(stopped.ok, true, `${stopped.error}; probe=${JSON.stringify(probe)}`);
  assert.equal(pidAlive(pid), false);
  await ui.request({ type: 'hub.status', flushLogs: true });
  const log = await readFile(join(root, '.cland/log/hub.log'), 'utf8');
  assert.match(log, /"event":"session-stopped","session":"impl"/);
  assert.match(log, /"event":"signal-skipped"[^\n]+"signal":"SIGKILL"/);
  assert.doesNotMatch(log, /"event":"harness-exited"|"kind":"death"/);
});
