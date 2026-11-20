// T3: gated native birth-authorized prune cancellation and ChildProcess close
// require real processes. All Git executables and roots are disposable fakes.
import test from 'node:test';
import assert from 'node:assert/strict';
import cp, { type ChildProcess } from 'node:child_process';
import { mkdir, writeFile, readFile, readdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { componentProject } from './merge-component-support.ts';
import { review } from './merge-support.ts';
import { eventually } from './until.ts';
import { ownProcess } from './process-cleanup.ts';
import { fixtureEnvironment, scratchGitEnvironment } from './fixture-environment.ts';
import { territoryGitAsync } from '../src/territory.ts';
import { worktreeOperations } from '../src/host/agent/worktrees.ts';
import { pruneCase } from './prune-case.ts';
import type { GitCommandRecord } from '../src/git-command-owner.ts';
import { PruneProcesses } from '../src/prune-processes.ts';
import { pruneCrashCase } from './prune-crash-case.ts';
import { gitCommandPolicy } from '../src/git-command-policy.ts';
import { pruneInspectionTrace, inspectionReceipt, type InspectionTrace } from './prune-inspection-trace.ts';

test('hub crash after durable writer release is reconciled by restart before territory admission', pruneCrashCase);

for (const route of ['territory', 'local-host', 'read-only', 'legacy-read', 'legacy-ordinary']) test(`hub stop closes its hung prune Git and leaves matching unowned Git alive (${route})`, t => pruneCase(t, async (scope, step) => {
  const children: Array<{ child: ChildProcess; closed: Promise<void>; cleanup?: () => Promise<void>; close?: { code: number | null; signal: string | null; at: number } }> = [];
  const inspection = pruneInspectionTrace(scope);
  const terminations: Array<{ started: number; completed?: number; budgetMs?: number; graceMs: number | undefined; state: 'running' | 'returned' | 'threw'; result?: boolean; error?: string; inspection: InspectionTrace; events: Array<{ at: number; event: unknown; pid: unknown; signal: unknown; reason: string; forced: unknown }> }> = [];
  const births: Array<{ pid: number; pidStarted: string; pidIdentity: string }> = [];
  let ownedExecutable = '';
  const run = PruneProcesses.prototype.run;
  scope.patch(PruneProcesses.prototype, 'run', function (this: PruneProcesses, work: () => Promise<unknown>) {
    const native = this.native;
    scope.patch(this, 'native', { ...native, identity: async (...args: Parameters<typeof native.identity>) => {
      const receipt = await native.identity(...args);
      if (receipt) { if (births.length === 16) births.shift(); births.push(receipt); }
      return receipt;
    }, end: async (...args: Parameters<typeof native.end>) => {
      const [target, log, grace, checkpoint, options] = args;
      const receipt: typeof terminations[number] = { started: performance.now(), ...(options?.deadline === undefined ? {} : { budgetMs: options.deadline - Date.now() }), graceMs: grace, state: 'running', events: [], inspection: inspectionReceipt() };
      if (terminations.length === 8) terminations.shift();
      terminations.push(receipt);
      try {
        receipt.result = await inspection.run(receipt.inspection, () => native.end(target, entry => {
          if (receipt.events.length === 12) receipt.events.shift();
          receipt.events.push({ at: performance.now(), event: entry.event, pid: entry.pid, signal: entry.signal, reason: String(entry.reason ?? '').slice(-2048), forced: entry.forced });
          log?.(entry);
        }, grace, checkpoint ? tree => inspection.checkpoint(receipt.inspection, () => checkpoint(tree)) : undefined, options));
        receipt.state = 'returned';
        return receipt.result;
      } catch (error) {
        receipt.state = 'threw'; receipt.error = String(error).slice(-2048); throw error;
      } finally { receipt.completed = performance.now(); }
    } });
    return Reflect.apply(run, this, [work]);
  });
  // Enroll the registry before root acquisition and every native launch. The
  // whole original body joins before this required close or seam restoration.
  scope.requireClose(async () => {
    for (const row of children) { await row.cleanup?.(); await row.closed; }
  });
  const nativeSpawn = cp.spawn;
  scope.patch(cp, 'spawn', (...args: Parameters<typeof cp.spawn>) => {
    // cland-allow-child-env: transparent observed-launch wrapper; the caller seals the final fixture environment below.
    const child = Reflect.apply(nativeSpawn, cp, args);
    if (args[0] === 'git' || args[0] === ownedExecutable || args[0] === process.execPath && Array.isArray(args[1]) && /\/owned-exec\.(?:ts|mjs)$/.test(String(args[1][0]))) {
      let resolveClose!: () => void;
      const row: typeof children[number] = { child, closed: new Promise(resolve => { resolveClose = resolve; }) };
      child.once('close', (code, signal) => { row.close = { code, signal, at: performance.now() }; resolveClose(); });
      children.push(row); // Capture before the identity helper can yield or fail.
      row.cleanup = ownProcess(undefined, child.pid);
    }
    return child;
  });
  const f = await step('component setup', () => componentProject(scope.fixtures, { ownStop: scope.requireClose }));
  const root = f.root;
  scope.adoptRoot(root);
  const retainedLock = join(root, '.git/index.lock');
  const bin = join(root, 'fake-prune-bin'), ready = join(root, 'prune-ready'), otherReady = join(root, 'unowned-ready');
  ownedExecutable = join(bin, 'git');
  await step('fake Git setup', async () => {
    await mkdir(join(root, '.git')); await writeFile(retainedLock, 'held before cancellation'); await mkdir(bin);
    await writeFile(join(bin, 'git'), `#!${process.execPath}\nimport { writeFileSync } from 'node:fs';\nif (process.argv.includes('version')) { const supported = process.env.FAKE_OLD_GIT !== '1'; writeFileSync(process.env.FAKE_CAPABILITY_RECEIPT, JSON.stringify({ supported })); process.exit(supported ? 0 : 129); }\nif (process.argv.includes('config') && process.argv.includes('--get-regexp')) { const ordinary = process.env.FAKE_PROMISOR !== '1'; writeFileSync(process.env.FAKE_CONFIG_RECEIPT, JSON.stringify({ ordinary })); if (!ordinary) process.stdout.write('remote.origin.promisor\\0'); process.exit(ordinary ? 1 : 0); }\nprocess.on('SIGTERM', () => {});\nwriteFileSync(process.env.FAKE_PRUNE_READY, String(process.pid));\nsetInterval(() => {}, 1000);\n`, { mode: 0o755 });
  });
  const environment = (path: string) => scratchGitEnvironment(root, fixtureEnvironment(root, process.env, {
    PATH: `${bin}:${dirname(process.execPath)}:/usr/bin:/bin`, FAKE_PRUNE_READY: path,
    FAKE_OLD_GIT: route.startsWith('legacy-') ? '1' : '', FAKE_CAPABILITY_RECEIPT: join(root, 'capability-probed'),
    FAKE_PROMISOR: route === 'legacy-read' ? '1' : '', FAKE_CONFIG_RECEIPT: join(root, 'config-probed'),
  }), { excludesFile: join(root, 'excludes') });
  const env = environment(ready);
  const args = route === 'read-only' || route.startsWith('legacy-') ? ['status', '--porcelain'] : route === 'territory' ? ['worktree', 'remove', 'same-command'] : ['-c', 'gc.auto=0', 'worktree', 'remove', '--', root];
  const other = await step('unowned Git launch', async () => {
    // cland-allow-child-env: environment() uses shared sealed builders after explicit scratch extras.
    return cp.spawn('git', route === 'legacy-read' ? args : gitCommandPolicy(args, route !== 'legacy-ordinary').args, { cwd: root, env: environment(otherReady), stdio: 'ignore' });
  });
  await step('unowned readiness receipt', () => eventually('unowned Git ready', async () => (await readFile(otherReady, 'utf8').catch(() => '')) || undefined, 3000));
  const work = await step('ticket setup', () => f.ticket());
  await step('ticket verdict setup', () => review(f.rev, work.id));
  let calls = 0, pruneSettled = false;
  scope.patch(f.merges.worktrees, 'pruneMerged', async () => {
    if (++calls === 1) return { removed: [], failed: [{ item: work.id, error: 'implementer stands inside its worktree' }] };
    try {
      if (route !== 'local-host') await territoryGitAsync(root, args, false, undefined, env);
      else await worktreeOperations(env).worktreeRemove({ root, path: root });
    } finally { pruneSettled = true; }
    await territoryGitAsync(root, [join(root, 'forbidden-write')], false, undefined, env);
    return { removed: [], failed: [] };
  });
  await step('merge and retry admission', () => f.merge(work));
  const pid = await step('owned Git readiness receipt', () => eventually('owned prune Git ready', async () => Number(await readFile(ready, 'utf8').catch(() => '0')) || undefined, 3000));
  if (route === 'read-only' || route.startsWith('legacy-')) assert.deepEqual(JSON.parse(await readFile(join(root, 'capability-probed'), 'utf8')), { supported: route === 'read-only' }, 'the fake executable positively answered the owned capability probe');
  if (route.startsWith('legacy-')) assert.deepEqual(JSON.parse(await readFile(join(root, 'config-probed'), 'utf8')), { ordinary: route === 'legacy-ordinary' }, 'the older fake Git positively classified the repository');
  const records = join(root, '.cland/run/git-command-owners');
  const recordNames = () => readdir(records).catch(error => { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []; throw error; });
  const rows = await step('writer record or in-memory reader receipt', async () => Promise.all((await recordNames()).filter(p => p.endsWith('.json')).map(async name => JSON.parse(await readFile(join(records, name), 'utf8')) as GitCommandRecord)));
  if (route === 'read-only' || route === 'legacy-ordinary') {
    assert.deepEqual(rows, [], 'a read-only command never creates a durable writer record');
    await step('in-memory original native birth', () => eventually('captured read birth', () => births.find(row => row.pid === pid && row.pidIdentity) || undefined, 3000));
  } else assert.ok(rows.some(row => row.released && row.child?.pid === pid && row.child.pidIdentity), 'durable native birth precedes Git execution');
  const signals: Array<{ pid: number; signal: NodeJS.Signals | number | undefined }> = [];
  const kill = process.kill.bind(process);
  scope.patch(process, 'kill', (pid: number, signal?: NodeJS.Signals | number) => {
    if (signal !== 0) signals.push({ pid, signal });
    return kill(pid, signal);
  });
  const stopStarted = performance.now();
  const result = await step('bounded merge stop receipt', () => f.merges.stop());
  const diagnostic = () => JSON.stringify({ boundary: 'owned-prune-stop', route, status: result.status, stopStarted, stopCompleted: performance.now(), pruneSettled,
    children: children.slice(-16).map(row => ({ pid: row.child.pid, close: row.close ?? 'pending' })), omittedChildren: Math.max(0, children.length - 16), terminations,
    reports: f.records.filter(row => ['merge-cleanup-failed', 'merge-cleanup-stop-incomplete'].includes(String(row.event))).slice(-8).map(row => ({ event: row.event, error: String(row.error ?? '').slice(-4096) })) });
  t.diagnostic(diagnostic());
  assert.equal(result.status, 'complete', `native close and prune settlement must fit the stop budget; ${diagnostic()}`);
  assert.equal(pruneSettled, true);
  assert.ok(terminations.some(row => row.inspection.steps.some(step => step.kind === 'ps' && step.completed !== undefined)), 'the native inspection close observer positively engaged');
  assert.ok(terminations.every(row => row.inspection.omitted === 0), `the work-count receipt is complete; ${diagnostic()}`);
  const probeSpawns = terminations.flatMap(row => row.inspection.steps).filter(step => ['ps', 'pgrep', 'perl'].includes(step.kind));
  assert.ok(probeSpawns.filter(step => step.kind === 'ps').length <= 18 && probeSpawns.filter(step => step.kind === 'pgrep').length <= 8 && probeSpawns.filter(step => step.kind === 'perl').length <= 24 && probeSpawns.length <= 48, `single-Git cancellation batches native probes: at most 18 ps, 8 pgrep, 24 perl and 48 total probe spawns; actual ps=${probeSpawns.filter(step => step.kind === 'ps').length}, pgrep=${probeSpawns.filter(step => step.kind === 'pgrep').length}, perl=${probeSpawns.filter(step => step.kind === 'perl').length}, total=${probeSpawns.length}; ${diagnostic()}`);
  const snapshots = probeSpawns.filter(step => step.parsedRows !== undefined);
  assert.ok(snapshots.length > 0 && snapshots.every(step => step.selector === 'pids' && step.parsedRows! > 0 && step.parsedRows! <= 65 && step.selectedPids! <= 65 && !step.rowOutputTruncated), `each authoritative ps round parses at most 65 owned-tree/caller rows (64 caller links plus one Git); old Linux203–204 was aggregate stdout lines across repeated probes, not a per-round bound; native pgrep still enumerates the table; ${diagnostic()}`);
  assert.ok(f.records.some(row => row.event === 'merge-cleanup-failed' && String(row.error).includes(retainedLock)), `leftover Git lock is reported; ${diagnostic()}`);
  assert.equal(await readFile(retainedLock, 'utf8'), 'held before cancellation');
  assert.ok(signals.some(row => row.pid === pid && row.signal === 'SIGKILL'), 'TERM-ignoring owned Git is killed');
  assert.ok(!signals.some(row => row.pid === other.pid), 'matching unowned executable is never signalled');
  assert.equal(kill(other.pid!, 0), true, 'unowned Git remains alive');
  assert.deepEqual((await recordNames()).filter(p => p.endsWith('.json')), [], 'native settlement leaves no durable writer owner');
  await assert.rejects(readFile(join(root, 'forbidden-write')), { code: 'ENOENT' });
}, true));
