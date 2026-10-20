// T3: forced post-merge termination reaps each native harness without a death notification.
// Fake-clock merge-stop classification shares its assertions with the T2 manual-stop file.
// Codex descendant probes exercise real OS identity disappearing between snapshot and final SIGKILL probe.
import { fixtureEnvironment } from './fixture-environment.ts';
import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { watch } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { nativeProjectHub as projectHub, withDiscoveredPid, cland, connectUi, eventually, fakeClaude, fakeCodex, pidAlive, tempProject } from './harness.ts';
import { FakeClock } from './fake-clock.ts';
import { stopClassification, STOP_GRACE_MS } from './stop-classification-fixture.ts';
import { onCleanup } from './process-cleanup.ts';
import { NO_PS } from './native-process.ts';
import { copyPreparedProject, preparedProject } from './prepared-project.ts';
import type { HarnessProcessView, EventsPage } from '../src/protocol.ts';

const git = (cwd: string, ...args: string[]) => execFileSync('git', args, { env: fixtureEnvironment(cwd, process.env), cwd, encoding: 'utf8' }).trim();

async function initGitProject(root: string) {
  await copyPreparedProject(root);
}

// Both Codex lifecycle probes require the same forced-stop boundary.
const forcedCodex = (t: TestContext) => fakeCodex(t, { env: { FAKE_CODEX_TERM_DELAY_MS: '60000', CLAND_STOP_GRACE_MS: '100' } });

async function assertStopped(ui: Awaited<ReturnType<typeof connectUi>>, root: string) {
  const list = await ui.request({ type: 'session.list' });
  assert.equal((list.value as { processes: HarnessProcessView[] }).processes.find(p => p.name === 'impl')?.status, 'stopped');
  await ui.request({ type: 'hub.status', flushLogs: true });
  const log = await readFile(join(root, '.cland/log/hub.log'), 'utf8');
  assert.match(log, /"event":"session-stopped","session":"impl"/);
  assert.doesNotMatch(log, /"event":"harness-exited"|"kind":"death"|its harness exited/);
  const journal = await readFile(join(root, '.cland/journal.jsonl'), 'utf8');
  assert.match(journal, /"event":"session-stopped","session":"impl"/);
  assert.doesNotMatch(journal, /"event":"harness-exited"/);
  const history = await ui.request({ type: 'topic.history', topic: 'agents' });
  const messages = (history.value as { messages: Array<{ kind: string; text: string }> }).messages;
  assert.equal(messages.some(m => m.kind === 'session-death'), false);
  assert.ok(messages.some(m => m.kind === 'role-revoke' && m.text.includes('its session was stopped')));
  const events = await ui.request({ type: 'events.list' });
  assert.equal((events.value as EventsPage).rows.some(r => r.warning && r.session === 'impl'), false);
}

for (const harness of ['codex', 'claude-code', 'opencode'] as const)
test(`${harness}: post-merge forced stop emits stopped without a death or warn notification`, { skip: NO_PS }, async t => {
  const root = await tempProject(t);
  await initGitProject(root);
  const fake = harness === 'codex' ? await forcedCodex(t) : harness === 'claude-code' ? await fakeClaude(t) : {
    env: {
      CLAND_OPENCODE_BIN: fileURLToPath(new URL('./fakes/opencode/opencode', import.meta.url)),
      FAKE_OPENCODE_HOME: await tempProject(t, 'fake-opencode-'),
      FAKE_OPENCODE_TURN_MS: '30',
      CLAND_ADAPTER_POLL_MS: '50',
    },
  };
  const { discovery } = await projectHub(t, root, {
    ...fake.env,
    CLAND_STOP_GRACE_MS: '100',
    FAKE_CLAUDE_IGNORE_TERM: '1',
    FAKE_OPENCODE_IGNORE_TERM: '1',
    FAKE_OPENCODE_CHILD: '1',
  });
  const ui = await connectUi(t, discovery);
  const created = await ui.request({ size: 'M', type: 'task.create', title: 'post-merge stop' });
  assert.equal(created.ok, true, created.error);
  const item = (created.value as { item: { id: string } }).item.id;
  const launched = await ui.request({ type: 'session.launch', name: 'impl', harness, role: 'implementer', item }, 30_000);
  assert.equal(launched.ok, true, launched.error);
  const { process: launchedRow, worktree } = launched.value as { process: HarnessProcessView; worktree: { path: string } };
  const row = await withDiscoveredPid(ui, launchedRow);
  await eventually('Implementer idle', async () => {
    const list = await ui.request({ type: 'session.list' });
    return (list.value as { processes: HarnessProcessView[] }).processes.some(p => p.sessionId === row.sessionId && p.state === 'idle') || undefined;
  });
  await writeFile(join(worktree.path, 'README.md'), 'shipped\n');
  git(worktree.path, 'add', 'README.md');
  git(worktree.path, 'commit', '-qm', 'Ship');
  const merged = await ui.request({ type: 'merge', item, override: 'Exercise post-merge stop classification' }, 30_000);
  assert.equal(merged.ok, true, merged.error);
  assert.equal((merged.value as { followUp?: unknown }).followUp, undefined, JSON.stringify(merged));
  const view = await ui.request({ type: 'task.view', item });
  assert.equal((view.value as { item: { status: string } }).item.status, 'done');
  const list = await ui.request({ type: 'session.list' });
  assert.equal((list.value as { processes: HarnessProcessView[] }).processes.find(p => p.sessionId === row.sessionId)?.status, 'stopped');
  await eventually('stopped harness PID is reaped', () => !pidAlive(row.pid!) || undefined);
  assert.equal(pidAlive(row.pid!), false);
  await assertStopped(ui, root);
});

for (const stop of ['manual', 'post-merge'] as const)
test(`Codex: ${stop} forced stop succeeds when a captured descendant exits before its final identity probe`, { skip: NO_PS }, async t => {
  const root = await tempProject(t);
  if (stop === 'post-merge') await initGitProject(root);
  const fake = await forcedCodex(t);
  const bin = join(root, 'bin');
  await mkdir(bin);
  const leaderFile = join(root, 'leader');
  const evidence = join(root, 'probe.json');
  // Schedule a real descendant exit in the snapshot-to-probe gap after its parent is killed.
  // The OS still supplies every identity; only the exit timing is controlled.
  await writeFile(join(bin, 'ps'), `#!${process.execPath}
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
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
    writeFileSync(evidence + '.tmp', JSON.stringify({ pid, leader, before: before.stdout.trim(), after: after.stdout.trim(), code: after.status }));
    renameSync(evidence + '.tmp', evidence);
  }
}
const result = ps(args);
process.stdout.write(result.stdout);
process.stderr.write(result.stderr);
process.exitCode = result.status ?? 1;
`, { mode: 0o755 });
  const { discovery } = await projectHub(t, root, { ...fake.env, PATH: `${bin}:${fake.env.PATH}` });
  const ui = await connectUi(t, discovery);
  const created = await ui.request({ size: 'M', type: 'task.create', title: 'Stop during descendant exit' });
  assert.equal(created.ok, true, created.error);
  const item = (created.value as { item: { id: string } }).item.id;
  const launched = await ui.request({ type: 'session.launch', name: 'impl', harness: 'codex', role: 'implementer', ...(stop === 'post-merge' ? { item } : {}) }, 30_000);
  assert.equal(launched.ok, true, launched.error);
  const pid = (launched.value as { process: { pid: number } }).process.pid;
  await writeFile(leaderFile, String(pid));
  await eventually('Implementer idle', async () => {
    const list = await ui.request({ type: 'session.list' });
    return (list.value as { processes: Array<{ name: string; state: string }> }).processes.some(p => p.name === 'impl' && p.state === 'idle') || undefined;
  });
  if (stop === 'post-merge') {
    const { worktree } = launched.value as { worktree: { path: string } };
    await writeFile(join(worktree.path, 'README.md'), 'shipped\n');
    git(worktree.path, 'add', 'README.md');
    git(worktree.path, 'commit', '-qm', 'Ship');
  }
  // Arm before stopping so even an immediate probe publication cannot be missed.
  // Atomic rename publishes complete JSON; the suite's per-test timeout bounds the wait.
  const probeWritten = Promise.withResolvers<void>();
  const watcher = watch(root, { signal: t.signal }, (_event, filename) => {
    if (filename === 'probe.json') probeWritten.resolve();
  });
  watcher.on('error', probeWritten.reject);
  onCleanup(t, () => watcher.close());
  const stopping = stop === 'manual'
    ? cland(root, 'session', 'stop', 'impl', '--json').then(result => {
      assert.equal(result.code, 0, result.stderr || result.stdout);
      return { ok: true, error: result.stderr, value: JSON.parse(result.stdout) as unknown };
    })
    : ui.request({ type: 'merge', item, override: 'Exercise descendant exit during post-merge stop' }, 30_000);
  const [stopped] = await Promise.all([stopping, probeWritten.promise]);
  const probe = JSON.parse(await readFile(evidence, 'utf8')) as { before: string; after: string; code: number };
  assert.ok(probe.before, 'the captured descendant had a real start time');
  assert.equal(probe.after, '', 'the descendant exited before its final identity read');
  assert.equal(probe.code, 1, 'ps reports that the captured descendant is gone');
  assert.equal(stopped.ok, true, `${stopped.error}; probe=${JSON.stringify(probe)}`);
  assert.equal((stopped.value as { followUp?: unknown }).followUp, undefined, JSON.stringify(stopped));
  await eventually('stopped Codex PID is reaped', () => !pidAlive(pid) || undefined);
  assert.equal(pidAlive(pid), false);
  await assertStopped(ui, root);
  const log = await readFile(join(root, '.cland/log/hub.log'), 'utf8');
  assert.match(log, /"event":"signal-skipped"[^\n]+"signal":"SIGKILL"/);
});

test('post-merge stops remain stopped across graceful and forced completion', async t => {
  const root = await preparedProject(t);
  const clock = new FakeClock();
  const hub = await projectHub(t, root, { CLAND_STOP_GRACE_MS: String(STOP_GRACE_MS) }, { clock, harnesses: 'fake' });
  await stopClassification(t, 'post-merge', { root, clock, ...hub, commit: async (path, name) => {
    await writeFile(join(path, 'README.md'), `${name}\n`);
    git(path, 'add', 'README.md');
    git(path, 'commit', '-qm', 'Ship');
  } });
});
