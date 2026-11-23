// T2: merge rule failures, verdict permissions and request accounting with injected Git and FakeClock.
import { beforeDirectories, onCleanup, ownDirectory, guardDirectoryRemoval, drainFixtureCleanup } from './process-cleanup.ts';
import { mergeTest as test, mergeOwner } from './merge-case.ts';
import { FakeClock } from './fake-clock.ts';
import type { TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile, realpath, stat, chmod } from 'node:fs/promises';
import { hostname, userInfo } from 'node:os';
import files from 'node:fs/promises';
import { until, startHub, projectHub, tempProject } from './harness.ts';
import { componentProject, human } from './merge-component-support.ts';
import { lifecycleNotice } from '../src/hub/agents-topic.ts';
import { RequestGuard } from '../src/hub/budget.ts';
import type { ItemView } from '../src/tracker/tracker.ts';
import { review } from './merge-support.ts';
import { MERGE_CLEANUP_STOP_MS, TaskMerges, MergeCleanupIncomplete, settleRetainedMergeStop, joinMergeCleanup } from '../src/hub/merge.ts';
import { pruneCommand } from '../src/host/agent/prune-command.ts';
import { PruneProcesses } from '../src/prune-processes.ts';
import { stageCase } from './stage-case-fixture.ts';
import { territoryGitAsync, TerritoryGitError, landedTask, hasTerritory } from '../src/territory.ts';
import { run as hostCommand, boundedCommandResult, nativeCommandFailure, nativeCommandIncomplete } from '../src/host/agent/command.ts';
import { MAX_LINE_BYTES } from '../src/host/agent/protocol.ts';
import { pruneCase, fakePrune, exactProcessObservation, withCleanupAsync } from './prune-case.ts';
import { prepareGitCommand, recoverGitCommands, GitCommandRecoveryRequired, type GitCommandRecord, type GitCommandLease } from '../src/git-command-owner.ts';
import { territoryHub } from './territory-hub-fixture.ts';
import { territoryLockContext } from '../src/territory-lock-context.ts';
import { durableJson } from '../src/executor/droplet/lease.ts';
import { fixtureEnvironment } from './fixture-environment.ts';
import fs from 'node:fs';
import { publishOwnerTrace, readOwnerTrace } from './prune-owner-trace.ts';

for (const trigger of ['startup timeout', 'observation cancellation', 'rejected resource close'] as const) {
  test(`merge owner retains original work, root and seam on ${trigger}`, t => pruneCase(t, async (scope, step) => {
    const abort = new AbortController();
    const hooks: Array<() => unknown> = [];
    const context = { name: `controlled merge ${trigger}`, signal: abort.signal,
      after: (hook: () => unknown) => hooks.push(hook) } as unknown as TestContext;
    const owner = mergeOwner(context);
    const clock = new FakeClock();
    const entered = Promise.withResolvers<void>(), release = Promise.withResolvers<void>();
    let root = '', finished = false, closed = false, restored = false, refuse = trigger === 'rejected resource close';
    let directRemoval: (() => Promise<void>) | undefined;
    scope.releaseOnClose(() => { refuse = false; release.resolve(); });
    scope.requireClose(async () => { refuse = false; release.resolve(); await drainFixtureCleanup(context); });
    owner.release(() => { restored = true; });
    const running = owner.run(async () => {
      root = await tempProject(context, 'cland-merge-owner-');
      // This independently invokes ownDirectory's real positive writer guard.
      directRemoval = ownDirectory(context, root);
      onCleanup(context, async () => {
        assert.equal(finished, true, 'resource closure follows the original producer');
        if (refuse) throw new Error('controlled merge resource close rejected');
        closed = true;
      });
      await owner.step(trigger, async () => {
        entered.resolve();
        await release.promise;
        await writeFile(join(root, 'late-writer'), 'completed');
        finished = true;
      }, { clock, timeoutMs: 10 });
    });
    void running.catch(() => {});
    await step('original producer entered', () => entered.promise);
    assert.equal(hooks.length, 1, 'actual cleanup hook registered before acquisition');
    if (trigger === 'startup timeout') {
      await clock.advance(10);
      await assert.rejects(running, /startup timeout incomplete/);
    } else if (trigger === 'observation cancellation') abort.abort();
    else { release.resolve(); await running; }
    let removed = false;
    const removal = directRemoval!().then(() => { removed = true; });
    void removal.catch(() => {});
    const disposal = Promise.resolve(hooks[0]!());
    void disposal.catch(() => {});
    if (trigger === 'rejected resource close') {
      await assert.rejects(removal, /controlled merge resource close rejected/);
      await assert.rejects(disposal, /controlled merge resource close rejected/);
    }
    assert.equal((await stat(root)).isDirectory(), true, 'actual guarded removal retains the root');
    assert.equal(removed, false);
    assert.equal(restored, false, 'seam release needs positive resource closure');
    assert.equal(closed, false);
    refuse = false;
    release.resolve();
    if (trigger === 'observation cancellation') await assert.rejects(running, /fixture work admission closed/);
    if (trigger !== 'rejected resource close') { await removal; await disposal; }
    else await drainFixtureCleanup(context);
    assert.equal(finished, true);
    assert.equal(closed, true);
    assert.equal(restored, true);
    await assert.rejects(stat(root), { code: 'ENOENT' });
  }));
}

test('ownership trace readers see a complete publication during a native-close rewrite', t => pruneCase(t, async (scope, step) => {
  const root = await step('trace fixture root', () => tempProject(scope.fixtures)); scope.adoptRoot(root);
  const path = join(root, 'trace.json');
  const before = { record: 'writer', parent: 41000 }, after = { ...before, nativeClose: { code: 0, signal: null } };
  publishOwnerTrace(path, before);
  const initial = Promise.withResolvers<void>();
  const reading = step('published native close receipt', () => readOwnerTrace(path, trace => {
    if (!trace.nativeClose) initial.resolve();
    return !!trace.nativeClose;
  }));
  await step('reader armed on prior receipt', () => initial.promise);
  const write = fs.writeFileSync;
  let observed: unknown, observations = 0;
  scope.patch(fs, 'writeFileSync', ((target, data, options) => {
    // Expose the truncate-before-bytes interval at the real publication writer.
    write(target, '', options);
    observations++;
    try { observed = JSON.parse(fs.readFileSync(path, 'utf8')); } catch { observed = 'partial JSON'; }
    return write(target, data, typeof options === 'object' ? { ...options, flag: 'w' } : options);
  }) as typeof fs.writeFileSync);
  publishOwnerTrace(path, after);
  assert.equal(observations, 1, 'the read observer positively entered the write interval');
  assert.deepEqual(observed, before, 'the public path retains its last complete receipt until replacement');
  assert.deepEqual(await reading, after);
}));

test('exact writer observations retain captured birth and never turn unknown native errors into absence', async () => {
  const owner = { pid: 41001, pidStarted: 'captured-start', pidIdentity: 'captured-birth' };
  for (const code of ['EPERM', 'EACCES', 'EIO', 'unknown']) {
    const result = await exactProcessObservation(owner, { probe: () => code, birth: async () => { throw new Error('unknown native observation must not probe a new birth'); } });
    assert.equal(result.state, 'unknown'); assert.deepEqual(result.owner, owner); assert.equal(result.native.before, code);
  }
  assert.deepEqual(await exactProcessObservation(owner, { probe: () => 'ESRCH', birth: async () => null }), { state: 'absent', cause: 'native-ESRCH', owner, native: { before: 'ESRCH', after: 'ESRCH' } });
  assert.equal((await exactProcessObservation(owner, { probe: () => 'present', birth: async () => null })).state, 'unknown');
  assert.equal((await exactProcessObservation(owner, { probe: () => 'present', birth: async () => owner.pidIdentity })).state, 'alive');
  assert.deepEqual(await exactProcessObservation(owner, { probe: () => 'present', birth: async () => 'replacement-birth' }), { state: 'absent', cause: 'birth-replaced', owner, native: { before: 'present', birth: 'replacement-birth', after: 'present' } });
  let later = 0;
  assert.equal((await exactProcessObservation(owner, { probe: () => ++later === 1 ? 'present' : 'EIO', birth: async () => owner.pidIdentity })).state, 'unknown', 'a later observation failure cannot become absence');
  let count = 0;
  assert.equal((await exactProcessObservation(owner, { probe: () => ++count === 1 ? 'ESRCH' : 'present', birth: async () => null })).state, 'unknown', 'a PID replacement between absence probes is not an absence receipt');
});

test('read-only owned Git has in-memory stop ownership without durable writer records', t => pruneCase(t, async (scope, step) => {
  const root = await step('read-only fixture root', async () => {
    const root = await realpath(await tempProject(scope.fixtures)); scope.adoptRoot(root); return root;
  });
  const f = fakePrune(scope);
  const services = { reserve: async <T>(work: () => Promise<T>) => work(), parentState: async () => 'gone' as const, end: async () => { throw new Error('no native recovery signal allowed'); } };
  scope.patch(f.owner.native, 'prepare', (cwd: string, env: NodeJS.ProcessEnv, _parent: unknown, requester?: object, _services?: unknown, readOnly?: boolean) => prepareGitCommand(cwd, env,
    async () => ({ pid: process.pid, pidStarted: 'fixture-parent', pidIdentity: 'fixture-birth' }), requester, services, readOnly));
  const command = f.owner.git(root, ['status', '--porcelain'], {});
  void command.catch(() => {});
  await step('read-only native admission', () => f.started);
  const records = await files.readdir(join(root, '.cland/run/git-command-owners')).catch(error => {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []; throw error;
  });
  assert.deepEqual(records, [], 'read-only Git creates no durable owner receipt');
  const ended = Promise.withResolvers<void>(), end = f.owner.native.end;
  scope.patch(f.owner.native, 'end', async (...args: Parameters<typeof end>) => {
    const result = await end(...args); ended.resolve(); return result;
  });
  const cancelled = f.owner.cancel();
  await step('in-memory cancellation target receipt', () => ended.promise);
  f.close(0, 'SIGTERM');
  assert.equal(await step('read-only native cancellation', () => cancelled), true);
  await step('read-only cancellation result', () => assert.rejects(command, error => Reflect.get(error as object, 'nativeCleanup') === 'complete'));
  await step('read-only original close settlement', () => f.owner.settled);
  assert.ok(f.signals.some(row => row.pid === f.identity.pid), 'the in-memory native birth still authorizes cancellation');
}));

test('public territory read retains its nested probe incomplete outcome and retry owner', t => pruneCase(t, async (scope, step) => {
  const f = fakePrune(scope);
  scope.patch(f.owner.native, 'readCapability', async (_bin: string, probe: Parameters<PruneProcesses['native']['readCapability']>[1]) => { await probe(); return true; });
  const command = f.owner.run(() => territoryGitAsync('/fake/root', ['status', '--porcelain'], false, undefined, {}));
  const failed = command.catch(error => error as TerritoryGitError & { recovery: { retry(): Promise<boolean>; settled: Promise<void> } });
  await step('nested capability child admitted', () => f.started);
  f.child.stdout.emit('data', 'retained probe output');
  f.child.stderr.emit('data', 'retained probe diagnostic');
  f.confirm(false);
  const cancellation = f.owner.cancel('controlled nested probe timeout');
  const error = await step('outer facade incomplete receipt', () => failed);
  assert.ok(error instanceof TerritoryGitError);
  assert.equal(error.nativeCleanup, 'incomplete');
  assert.equal(error.nativeAdmission, undefined, 'the admitted probe is not a no-process outcome');
  assert.equal(error.stdout, 'retained probe output');
  assert.equal(error.stderr, 'retained probe diagnostic');
  assert.equal(await step('unconfirmed nested cancellation', () => cancellation), false);
  assert.equal(typeof error.recovery.retry, 'function');
  f.confirm(true); f.close(0, 'SIGKILL');
  await step('retained nested retry', () => error.recovery.retry());
  await step('retained nested settlement', () => error.recovery.settled);
  assert.equal(f.launches(), 1, 'the actual read is never admitted after the probe fails');
}));

for (const repairFails of [false, true]) test(`migrated prune cleanup preserves a selected failure and retains rejected resource cleanup (repair rejects: ${repairFails})`, t => pruneCase(t, async (scope, step) => {
  const nested = stageCase(scope.fixtures);
  const primary = Object.assign(new Error('selected original assertion'), { code: 'SELECTED_RESULT', stdout: 'selected output' });
  const secondary = new Error('controlled native disposal refusal');
  const seam = { state: 'original' };
  let refuse = true, root = '', attempts = 0, repairs = 0;
  const dispose = async () => { attempts++; if (refuse) throw secondary; };
  scope.releaseOnClose(() => { refuse = false; });
  scope.requireClose(async () => { refuse = false; await nested.close(); await nested.restore(); });
  const outcome = await step('original callback and rejected disposal', () => nested.run(async admit => {
    await nested.wait('complete original failure fixture setup', () => admit(async () => {
      root = await tempProject(nested.fixtures); nested.adoptRoot(root);
      nested.patch(seam, 'state', 'held'); nested.requireClose(dispose);
    }));
    return withCleanupAsync(async () => { throw primary; }, () => withCleanupAsync(async () => {
      repairs++; if (repairFails) throw new Error('controlled fixture repair refusal');
    }, dispose));
  }).catch(error => error));
  assert.equal(outcome, primary, 'the migrated callback policy preserves the selected error object');
  assert.equal(outcome.code, 'SELECTED_RESULT'); assert.equal(outcome.stdout, 'selected output');
  assert.match(outcome.message, /cleanup failed: controlled native disposal refusal/);
  if (repairFails) assert.match(outcome.message, /controlled fixture repair refusal/);
  assert.equal(repairs, 1);
  assert.equal(attempts, 1, 'cleanup positively rejected after the original failure');
  await step('same resource cleanup remains rejected', () => assert.rejects(nested.close(), error => error === secondary));
  await step('manual seam remains fenced', () => assert.rejects(nested.restore(), /seams and native guard retained/));
  await step('actual guarded root removal remains fenced', () => assert.rejects(ownDirectory(undefined, root)(), /root retained/));
  assert.equal(seam.state, 'held'); assert.ok(existsSync(root));
  refuse = false;
  await step('same resource disposal repaired', () => nested.close());
  await step('same manual seam released', () => nested.restore());
  assert.equal(seam.state, 'original'); assert.equal(attempts, 3);
}));

test('an incomplete Git result retains its lock report when a later close settles the same owner', t => pruneCase(t, async (scope, step) => {
  const { root, lock } = await step('complete uncertain writer setup', async () => {
    const root = await tempProject(scope.fixtures); scope.adoptRoot(root);
    await mkdir(join(root, '.git'));
    const lock = join(root, '.git/index.lock'); await writeFile(lock, 'retained through uncertainty');
    return { root, lock };
  });
  const f = fakePrune(scope);
  const command = f.owner.run(() => territoryGitAsync(root, ['status', '--porcelain'], false, undefined, {}));
  const failed = command.catch(error => error as TerritoryGitError);
  await step('uncertain native child admitted', () => f.started);
  f.confirm(false);
  assert.equal(await step('unconfirmed first cancellation', () => f.owner.cancel()), false);
  const error = await step('original incomplete result', () => failed);
  assert.ok(error instanceof TerritoryGitError);
  assert.equal(error.nativeCleanup, 'incomplete');
  f.confirm(true); f.close(0, 'SIGKILL');
  await step('same retained owner confirmed', () => f.owner.cancel());
  await step('later original native close joined', () => f.owner.settled);
  assert.ok(error.message.includes(lock), 'the already-selected incomplete outcome reports retained Git locks');
  assert.equal(await step('retained lock bytes after repaired close', () => readFile(lock, 'utf8')), 'retained through uncertainty');
}));

test('unsupported read capability keeps the durable writer gate and original argv', t => pruneCase(t, async (scope, step) => {
  const root = await step('older Git fixture root', async () => {
    const root = await realpath(await tempProject(scope.fixtures)); scope.adoptRoot(root); return root;
  });
  const f = fakePrune(scope);
  const services = { reserve: async <T>(work: () => Promise<T>) => work(), parentState: async () => 'gone' as const, end: async () => false };
  scope.patch(f.owner.native, 'readCapability', async () => false);
  scope.patch(f.owner.native, 'prepare', (cwd: string, env: NodeJS.ProcessEnv, _parent: unknown, requester?: object, _services?: unknown, readOnly?: boolean) => prepareGitCommand(cwd, env,
    async () => ({ pid: 41000, pidStarted: 'fixture-parent', pidIdentity: 'fixture-birth' }), requester, services, readOnly));
  const command = f.owner.git(root, ['status', '--porcelain'], {});
  void command.catch(() => {});
  await step('fallback writer gate release', () => f.started);
  assert.deepEqual(f.calls(), [{ args: ['status', '--porcelain'], gated: true }]);
  const directory = join(root, '.cland/run/git-command-owners');
  const names = (await files.readdir(directory)).filter(name => name.endsWith('.json'));
  assert.equal(names.length, 1, 'an older Git read retains durable ownership');
  const record = JSON.parse(await readFile(join(directory, names[0]!), 'utf8')) as GitCommandRecord;
  assert.equal(record.released, true); assert.deepEqual(record.child, f.identity);
  f.close();
  await step('fallback original native close', () => command);
  await step('fallback original settlement', () => f.owner.settled);
  assert.deepEqual((await files.readdir(directory)).filter(name => name.endsWith('.json')), []);
}));

test('ordinary repository proof lets old Git read directly without an unsupported option', t => pruneCase(t, async (scope, step) => {
  const f = fakePrune(scope);
  scope.patch(f.owner.native, 'readCapability', async () => false);
  scope.patch(f.owner.native, 'ordinaryRepository', async () => true);
  const command = f.owner.git('/fake/root', ['status', '--porcelain'], {});
  void command.catch(() => {});
  await step('ordinary older Git admission', () => f.started);
  assert.equal(f.calls()[0]?.gated, false);
  assert.ok(!f.calls()[0]!.args.includes('--no-lazy-fetch'));
  f.close(); await step('ordinary older Git close', () => command); await step('ordinary older Git settlement', () => f.owner.settled);
}));

for (const query of ['ordinary', 'promisor', 'failed'] as const) test(`old Git current config query is in-memory owned and admits ${query} reads conservatively`, t => pruneCase(t, async (scope, step) => {
  const actual = fakePrune(scope), config = fakePrune(scope);
  const launch = actual.owner.native.launch;
  const native = new PruneProcesses().native;
  const readOnly: boolean[] = [];
  const prepare = actual.owner.native.prepare;
  scope.patch(actual.owner.native, 'prepare', async (...args: Parameters<typeof prepare>) => { readOnly.push(args[5] === true); return prepare(...args); });
  scope.patch(actual.owner.native, 'readCapability', async () => false);
  scope.patch(actual.owner.native, 'ordinaryRepository', native.ordinaryRepository);
  scope.patch(actual.owner.native, 'launch', (...args: Parameters<typeof launch>) => args[1].includes('--get-regexp') ? config.owner.native.launch(...args) : launch(...args));
  const command = actual.owner.run(() => territoryGitAsync('/fake/root', ['status', '--porcelain'], false, undefined, {}));
  void command.catch(() => {});
  await step('current config native admission', () => config.started);
  assert.equal(config.calls()[0]?.gated, false, 'the config-only query never waits on a durable gate');
  assert.ok(config.calls()[0]?.args.includes('--no-optional-locks'));
  if (query === 'promisor') config.child.stdout.emit('data', 'REMOTE.inherited.PARTIALCLONEFILTER\0');
  if (query === 'failed') config.child.stderr.emit('data', 'invalid effective config');
  config.close(query === 'ordinary' ? 1 : query === 'promisor' ? 0 : 128);
  await step('actual read native admission', () => actual.started);
  assert.deepEqual(readOnly, [true, query === 'ordinary'], 'only a positively ordinary read avoids durable ownership');
  assert.equal(actual.calls()[0]?.gated, query !== 'ordinary');
  actual.close();
  await step('current config read result', () => command);
  await step('current config owner joined', () => actual.owner.settled);
}));

test('old Git checks effective configuration on every read including a newly created global config', t => pruneCase(t, async (scope, step) => {
  const root = await step('repository config root', () => tempProject(scope.fixtures)); scope.adoptRoot(root);
  await mkdir(join(root, '.git')); const config = join(root, '.git/config'); await writeFile(config, '[core]\n bare=false\n');
  const env = fixtureEnvironment(root, {}), native = new PruneProcesses().native;
  let probes = 0;
  const global = join(root, 'new-global-config');
  const noKeys = async () => {
    probes++;
    const present = await readFile(global, 'utf8').then(() => true, error => { if (error.code !== 'ENOENT') throw error; return false; });
    const code = present ? 0 : 1;
    return { code, stdout: present ? 'remote.inherited.partialclonefilter\0' : '', stderr: '', nativeClose: { code, signal: null }, nativeCleanup: 'complete' as const };
  };
  assert.equal(await step('first ordinary repository receipt', () => native.ordinaryRepository(root, env, '/fake/git', noKeys)), true);
  assert.equal(await step('next ordinary repository receipt', () => native.ordinaryRepository(root, env, '/fake/git', noKeys)), true); assert.equal(probes, 2);
  await writeFile(global, '[remote "inherited"]\n partialclonefilter=blob:none\n');
  assert.equal(await step('new inherited configuration on next read', () => native.ordinaryRepository(root, env, '/fake/git', noKeys)), false);
  assert.equal(probes, 3);
  assert.equal(await step('failed effective query stays owned', () => native.ordinaryRepository(root, env, '/fake/git', async () => ({ code: 128, stdout: '', stderr: 'invalid config', nativeClose: { code: 128, signal: null }, nativeCleanup: 'complete' }))), false);
  assert.equal(await step('config-only redirection cannot prove object read config', () => native.ordinaryRepository(root, { ...env, GIT_CONFIG: global }, '/fake/git', async () => { throw new Error('redirected config query cannot prove effective object config'); })), false);
}));

test('cancellation during shared read capability never starts new territory preparation', t => pruneCase(t, async (scope, step) => {
  const f = fakePrune(scope), entered = Promise.withResolvers<void>(), held = Promise.withResolvers<boolean>();
  scope.releaseOnClose(() => held.resolve(true));
  let preparations = 0;
  const prepare = f.owner.native.prepare;
  scope.patch(f.owner.native, 'prepare', (...args: Parameters<typeof prepare>) => { preparations++; return prepare(...args); });
  scope.patch(f.owner.native, 'readCapability', async () => { entered.resolve(); return held.promise; });
  const command = f.owner.git('/fake/root', ['status', '--porcelain'], {});
  void command.catch(() => {});
  await step('held capability admission', () => entered.promise);
  const cancelled = f.owner.cancel();
  held.resolve(true);
  assert.equal(await step('cancelled capability joins', () => cancelled), true);
  await step('cancelled read result', () => assert.rejects(command, error => Reflect.get(error as object, 'nativeAdmission') === 'no-process'));
  await step('cancelled read settlement', () => f.owner.settled);
  assert.equal(preparations, 0); assert.equal(f.launches(), 0);
}));

test('writer gate publishes one complete native ownership record before release', t => pruneCase(t, async (scope, step) => {
  let lease: GitCommandLease | undefined;
  scope.requireClose(async () => { await lease?.clear(); });
  const root = await step('writer publication root', async () => {
    const root = await realpath(await tempProject(scope.fixtures)); scope.adoptRoot(root); return root;
  });
  let publications = 0;
  const rename = files.rename;
  scope.patch(files, 'rename', async (...args: Parameters<typeof rename>) => {
    await rename(...args); if (lease && args[1] === lease.path) publications++;
  });
  const services = { reserve: async <T>(work: () => Promise<T>) => work(), parentState: async () => 'gone' as const, end: async () => false };
  lease = await step('prepare unreleased writer', () => prepareGitCommand(root, {}, async () => ({ pid: 41000, pidStarted: 'parent-start', pidIdentity: 'parent-birth' }), {}, services));
  await step('bind original native birth', () => lease!.bind({ pid: 41001, pidStarted: 'child-start', pidIdentity: 'child-birth' }));
  await assert.rejects(readFile(lease.path), { code: 'ENOENT' }, 'an unreleased private gate cannot write Git and needs no partial durable checkpoint');
  await step('durable gate publication', () => lease!.releaseGate());
  const row = JSON.parse(await readFile(lease.path, 'utf8')) as GitCommandRecord;
  assert.equal(publications, 1);
  assert.equal(row.released, true);
  assert.equal(row.phase, 'running');
  assert.deepEqual(row.child, { pid: 41001, pidStarted: 'child-start', pidIdentity: 'child-birth' });
  assert.equal((await stat(lease.path)).mode & 0o777, 0o600);
}));

test('atomic owner checkpoint replacement does not make its opened private receipt foreign', t => pruneCase(t, async (scope, step) => {
  let lease: GitCommandLease | undefined;
  scope.requireClose(async () => { await lease?.clear(); });
  const root = await step('checkpoint fixture root', async () => {
    const root = await realpath(await tempProject(scope.fixtures)); scope.adoptRoot(root); return root;
  });
  let native = 0;
  const services = { reserve: async <T>(work: () => Promise<T>) => work(), parentState: async () => { native++; return 'gone' as const; }, end: async () => { native++; return false; } };
  lease = await step('current in-process record', () => prepareGitCommand(root, {}, async () => ({ pid: 41000, pidStarted: 'parent-start', pidIdentity: 'parent-birth' }), {}, services));
  await lease.bind({ pid: 41001, pidStarted: 'child-start', pidIdentity: 'child-birth' });
  await lease.releaseGate();
  const row = JSON.parse(await readFile(lease.path, 'utf8')) as GitCommandRecord;
  const open = files.open;
  let reads = 0, replaced = false;
  scope.patch(files, 'open', async (...args: Parameters<typeof files.open>) => {
    const file = await Reflect.apply(open, files, args);
    if (String(args[0]) === lease!.path && ++reads === 2) {
      await durableJson(lease!.path, row);
      const old = await file.stat(), current = await stat(lease!.path);
      assert.equal(old.nlink, 0, 'the opened native descriptor has been positively replaced');
      assert.notEqual(old.ino, current.ino);
      assert.equal(current.nlink, 1);
      replaced = true;
    }
    return file;
  });
  await step('recovery reads the current private receipt after replacement', () => recoverGitCommands(root, {}, services));
  assert.equal(replaced, true);
  assert.equal(native, 0, 'atomic replacement never grants native signal or probe authority');
  assert.equal((JSON.parse(await readFile(lease.path, 'utf8')) as GitCommandRecord).id, row.id);
}));

test('live admission proof expires with the original child without fresh native probes', t => pruneCase(t, async (scope, step) => {
  const root = await step('proof fixture root', async () => {
    const root = await realpath(await tempProject(scope.fixtures)); scope.adoptRoot(root); return root;
  });
  const f = fakePrune(scope);
  let reserved = 0, probes = 0, identities = 0;
  const services = {
    reserve: async <T>(_work: () => Promise<T>): Promise<T> => { reserved++; throw new Error('controlled occupied recovery reservation'); },
    parentState: async () => { probes++; return 'gone' as const; },
    end: async () => { throw new Error('no native signal permitted in this proof case'); },
  };
  scope.patch(f.owner.native, 'prepare', (cwd: string, env: NodeJS.ProcessEnv, _parent: unknown, requester?: object) => prepareGitCommand(cwd, env,
    async () => ({ pid: process.pid, pidStarted: 'captured-parent-start', pidIdentity: 'captured-parent-birth' }), requester, services));
  f.observe(async () => { identities++; return f.identity; });
  const reservation = { root, active: true };
  const command = territoryLockContext.run(reservation, () => f.owner.git(root, ['write-tree'], {}));
  void command.catch(() => {});
  await step('captured fake child gate', () => f.started);
  await step('healthy proof avoids re-acquisition', () => recoverGitCommands(root, {}, services));
  assert.equal(reserved, 0);
  assert.equal(identities, 1);
  f.child.exitCode = 0;
  f.child.emit('exit', 0, null);
  await step('original exit revokes admission before delayed close', () => assert.rejects(recoverGitCommands(root, {}, services), /controlled occupied recovery reservation/));
  assert.equal(reserved, 1);
  assert.equal(probes, 0, 'admission never probes a fresh pid to replace the captured proof');
  assert.equal(identities, 1);
  assert.deepEqual(f.signals, []);
  f.close();
  await step('original native close result', () => command);
  await step('original writer settlement', () => f.owner.settled);
  reservation.active = false;
}));

test('territory hub constructor rejection retains its database, root and seams until positive close', t => pruneCase(t, async (scope, step) => {
  const nested = stageCase(scope.fixtures);
  let connection: DatabaseSync | undefined, root = '', closed = false, refuse = true;
  const selected = new Error('controlled territory tracker constructor failure');
  const seam = { state: 'original' };
  scope.releaseOnClose(() => { refuse = false; });
  scope.requireClose(async () => {
    refuse = false;
    if (connection?.isOpen) DatabaseSync.prototype.close.call(connection);
    await nested.close(); await nested.restore();
  });
  const outerBoundary = scope.nativeBoundary();
  await step('original partial territory setup', () => assert.rejects(nested.run(async admit => {
    nested.patch(seam, 'state', 'retained');
    await admit(() => territoryHub(nested.fixtures, undefined, undefined, nested, {
      prepare: async directory => {
        root = directory;
        await mkdir(join(root, '.cland'), { recursive: true });
        // Independent positive-close guard protects the red control itself.
        guardDirectoryRemoval(root, () => {
          if (connection?.isOpen) throw new Error('controlled database still open; root retained');
        });
      },
      openDatabase: path => {
        const db = connection = new DatabaseSync(path);
        const close = db.close.bind(db), exec = db.exec.bind(db);
        db.close = () => {
          if (refuse) throw new Error('controlled territory database close refusal');
          assert.ok(existsSync(root), 'native close precedes root removal');
          close(); closed = true;
        };
        db.exec = sql => { if (sql.includes('tracker_items')) throw selected; exec(sql); };
        return db;
      },
    }));
  }), error => error === selected));
  assert.ok(connection?.isOpen);
  await step('partial-construction native close refusal', () => assert.rejects(nested.close(), /controlled territory database close refusal/));
  await step('manual seams remain retained', () => assert.rejects(nested.restore(), /seams and native guard retained/));
  assert.equal(seam.state, 'retained');
  assert.notEqual(nested.nativeBoundary(), outerBoundary);
  await step('actual guarded root removal refusal', () => assert.rejects(ownDirectory(undefined, root)(), error => {
    assert.ok(error instanceof AggregateError);
    assert.ok(error.errors.some(cause => cause instanceof Error && /root retained/.test(cause.message)));
    return true;
  }));
  assert.ok(connection.isOpen);
  assert.ok(existsSync(root));
  assert.equal(selected.message, 'controlled territory tracker constructor failure');
  refuse = false;
  await step('same owner confirms native close', () => nested.close());
  await step('same owner releases seams', () => nested.restore());
  assert.equal(connection.isOpen, false);
  assert.equal(closed, true);
  assert.equal(seam.state, 'original');
  assert.equal(nested.nativeBoundary(), outerBoundary);
  await assert.rejects(stat(root), { code: 'ENOENT' });
}));

test('Git probes propagate structured cancellation instead of reporting repository absence', t => pruneCase(t, async (scope, step) => {
  const root = await step('present territory setup', async () => {
    const root = await tempProject(scope.fixtures); scope.adoptRoot(root);
    await mkdir(join(root, '.cland/territory.git'), { recursive: true }); return root;
  });
  let calls = 0;
  await step('incomplete probe outcome', () => pruneCommand.run({ run: async () => {
    calls++;
    throw Object.assign(new Error('native stop unconfirmed'), { code: 'CLAND_GIT_INCOMPLETE', nativeCleanup: 'incomplete' });
  } }, () => assert.rejects(hasTerritory(root, {}), error => error instanceof TerritoryGitError && error.code === 'CLAND_GIT_INCOMPLETE')));
  assert.equal(calls, 1, 'the fixture reaches the Git inspection boundary');
}));

test('live command admission retains and retries its exact in-memory owner without a preparation cycle', t => pruneCase(t, async (scope, step) => {
  let lease: GitCommandLease | undefined;
  scope.requireClose(async () => { await lease?.clear(); });
  const root = await step('root setup', async () => { const root = await tempProject(scope.fixtures); scope.adoptRoot(root); return root; });
  const parent = async () => ({ pid: 41000, pidStarted: 'parent-start', pidIdentity: 'parent-birth' });
  const services = { reserve: async <T>(work: () => Promise<T>) => work(), parentState: async () => 'gone' as const, end: async () => true };
  const actor = {};
  lease = await step('durable owner setup', () => prepareGitCommand(root, {}, parent, actor, services));
  await lease.bind({ pid: 41001, pidStarted: 'child-start', pidIdentity: 'child-birth' });
  await lease.releaseGate();
  let confirmed = false, attempts = 0;
  lease.onRecovery!(async () => { attempts++; if (confirmed) await lease!.clear(); return confirmed; }, actor);
  await lease.incomplete();
  await step('same-owner preparation refuses without joining itself', () => assert.rejects(prepareGitCommand(root, {}, parent, actor, services), GitCommandRecoveryRequired));
  assert.equal(attempts, 0);
  await step('another admission retries the retained owner', () => assert.rejects(recoverGitCommands(root, {}, services), GitCommandRecoveryRequired));
  assert.equal(attempts, 1);
  assert.ok(await readFile(lease.path));
  confirmed = true;
  await step('positive retry retires the same owner', () => recoverGitCommands(root, {}, services));
  assert.equal(attempts, 2);
  await assert.rejects(readFile(lease.path), { code: 'ENOENT' });
}));

test('bounded command results retain native facts and accept older result shapes', t => pruneCase(t, async () => {
  const old = { code: 0, stdout: 'old output\n', stderr: '' };
  assert.deepEqual(boundedCommandResult(old), { code: 0, stdout: 'old output\n', stderr: '' });
  const bounded = boundedCommandResult({ code: 7, stdout: 'x'.repeat(MAX_LINE_BYTES), stderr: 'diagnostic', nativeClose: { code: 7, signal: null }, nativeCleanup: 'complete' });
  assert.equal(bounded.code, 7);
  assert.deepEqual(bounded.nativeClose, { code: 7, signal: null });
  assert.equal(bounded.nativeCleanup, 'complete');
  assert.ok(bounded.stdout.length <= 4096);
  assert.equal(nativeCommandIncomplete({ error: 'a path named cleanup incomplete', nativeCleanup: 'complete' }), false);
  const failure = nativeCommandFailure({ code: 0, stdout: 'completed', stderr: '', error: 'lease close rejected', nativeClose: { code: 0, signal: null }, nativeCleanup: 'incomplete' }, 'unused');
  assert.equal(Reflect.get(failure, 'code'), 'CLAND_NATIVE_INCOMPLETE');
  assert.deepEqual(Reflect.get(failure, 'nativeClose'), { code: 0, signal: null });
  assert.equal(Reflect.get(failure, 'nativeCleanup'), 'incomplete');
}));

for (const native of [false, true]) test(`prune case cleanup refusal retains its root and manual seams (native=${native})`, t => pruneCase(t, async (scope, step) => {
  const nested = stageCase(scope.fixtures, { native });
  let refuse = true, root = '';
  const seam = { state: 'original' };
  scope.releaseOnClose(() => { refuse = false; });
  scope.requireClose(async () => { refuse = false; await nested.close(); await nested.restore(); });
  await step('nested original setup/body', () => nested.run(async admit => {
    root = await nested.wait('root setup', () => admit(async () => {
      const root = await tempProject(nested.fixtures); nested.adoptRoot(root); return root;
    }));
    nested.patch(seam, 'state', 'held');
    nested.requireClose(async () => { if (refuse) throw new Error('controlled prune resource close refusal'); });
  }));
  await step('resource close refusal', () => assert.rejects(nested.close(), /controlled prune resource close refusal/));
  await step('manual seam retention', () => assert.rejects(nested.restore(), /seams and native guard retained/));
  assert.equal(seam.state, 'held');
  const remove = ownDirectory(undefined, root);
  await step('real guarded removal refusal', () => assert.rejects(remove(), /root retained/));
  assert.ok(existsSync(root));
  refuse = false;
  await step('same fixture close repaired', () => nested.close());
  await step('same fixture seams released', () => nested.restore());
  assert.equal(seam.state, 'original');
}));

test('a launch failure survives rejected lease cleanup with its cause and retry owner', t => pruneCase(t, async (scope, step) => {
  const f = fakePrune(scope);
  const cause = new Error('controlled executable lookup failure');
  const launch = Object.assign(new Error('controlled Git launch failure', { cause }), { code: 'ENOENT' });
  f.failLaunch(launch);
  f.rejectClear(true);
  const receipt = await step('launch and cleanup rejection receipt', () => f.owner.git('/fake-prune', ['status'], {}).catch(error => error));
  assert.equal(receipt.code, 'ENOENT');
  assert.match(receipt.message, /^controlled Git launch failure; cleanup incomplete/);
  assert.equal(receipt.cause, launch, 'the selected launch failure remains the primary cause');
  assert.equal(receipt.cause.cause, cause);
  assert.equal(launch.message, 'controlled Git launch failure');
  assert.match(receipt.message, /secondary cleanup diagnostic: Error: controlled lease clear rejection/);
  assert.equal(receipt.nativeAdmission, 'no-process');
  assert.equal(receipt.nativeCleanup, 'incomplete');
  assert.equal(receipt.nativeClose, undefined);
  assert.equal(f.launches(), 1);
  assert.deepEqual(f.signals, []);
  assert.equal(await step('same no-child owner retains cleanup', () => receipt.recovery.retry()), false);
  f.rejectClear(false);
  assert.equal(await step('same no-child owner repairs cleanup', () => receipt.recovery.retry()), true);
  await step('no-child writer settlement', () => receipt.recovery.settled);
}));

test('a rejected lease cleanup preserves native exit facts and the same recovery owner', t => pruneCase(t, async (scope, step) => {
  const f = fakePrune(scope);
  f.rejectClear(true);
  const command = f.owner.command('/fake-prune', ['status'], {});
  await step('native gate receipt', () => f.started);
  f.child.stdout.emit('data', 'completed output\n');
  f.close(0);
  const receipt = await step('incomplete cleanup result', () => command);
  assert.equal(receipt.code, 0, 'cleanup rejection never overwrites the observed native exit');
  assert.equal(receipt.stdout, 'completed output\n');
  assert.deepEqual(receipt.nativeClose, { code: 0, signal: null });
  assert.equal(receipt.nativeCleanup, 'incomplete');
  assert.match(receipt.error!, /cleanup incomplete/);
  assert.equal(await step('same owner still refuses cleanup', () => f.owner.cancel()), false);
  f.rejectClear(false);
  assert.equal(await step('same owner repaired cleanup', () => f.owner.cancel()), true);
  await step('writer settlement', () => f.owner.settled);
}));

test('strict landed inspection recognizes ordinary scoped Git absence failures', t => pruneCase(t, async (_scope, step) => {
  const failure = Object.assign(new Error('not an ancestor'), { code: 1, stdout: '', stderr: 'not an ancestor\n' });
  const result = await step('strict landed consumer', () => pruneCommand.run({ run: async (_cwd, args) => {
    if (args[0] === 'show') return 'Item: T-1\n';
    throw failure;
  } }, () => landedTask('/fake-prune', 'T-1', { commit: 'a'.repeat(40), base: 'dev', branch: 't/fixture', tip: 'b'.repeat(40) }, work => work(), { strict: true }, {}, territoryGitAsync)));
  assert.equal(result, null);
}));

for (const code of [0, 7]) test(`scoped native Host Git keeps exact output and numeric exit (code=${code})`, t => pruneCase(t, async (scope, step) => {
  const f = fakePrune(scope);
  const result = f.owner.run(() => hostCommand('git', ['status'], {}, undefined, false, undefined, 'utf8', '/fake-prune'));
  await step('native launch gate', () => f.started);
  f.child.stdout.emit('data', 'visible output\n');
  f.child.stderr.emit('data', 'visible diagnostic\n');
  f.close(code);
  const receipt = await step('native result', () => result);
  assert.equal(receipt.code, code);
  assert.equal(receipt.stdout, 'visible output\n');
  assert.equal(receipt.stderr, 'visible diagnostic\n');
  assert.deepEqual(receipt.nativeClose, { code, signal: null });
  assert.equal(receipt.nativeCleanup, 'complete');
  assert.equal(receipt.error, undefined);
}));

test('replacement startup fences retained Git writers and refuses copied ownership', t => pruneCase(t, async (scope, step) => {
  const root = await step('replacement root setup', async () => {
    const root = await tempProject(scope.fixtures); scope.adoptRoot(root); return realpath(root);
  });
  const info = await stat(root, { bigint: true });
  const id = '00000000-0000-0000-0000-000000000001';
  const folder = join(root, '.cland/run/git-command-owners');
  const path = join(folder, `${id}.json`);
  const child = { pid: 41001, pidStarted: 'owned-start', pidIdentity: 'owned-birth' };
  const descendant = { pid: 41003, pidStarted: 'descendant-start', pidIdentity: 'descendant-birth' };
  const row: GitCommandRecord = { version: 1, id, root, rootDev: info.dev.toString(), rootIno: info.ino.toString(), host: hostname(), uid: userInfo().uid,
    parent: { pid: 41000, pidStarted: 'old-hub-start', pidIdentity: 'old-hub-birth' }, child, captured: [descendant], phase: 'cleanup', released: true, closed: { code: 0, signal: null } };
  await step('durable retained writer setup', async () => {
    await mkdir(folder, { recursive: true }); await writeFile(path, JSON.stringify(row), { mode: 0o600 });
    await mkdir(join(root, '.cland/territory.git/hooks'), { recursive: true });
    await writeFile(join(root, '.cland/territory.git/hooks/update'), 'original hook');
  });
  let confirmed = false, parentReads = 0;
  const signalled: number[] = [];
  let reserved = false, holdRoot = false;
  const entered = Promise.withResolvers<void>(), releaseRoot = Promise.withResolvers<void>();
  scope.releaseOnClose(() => releaseRoot.resolve());
  const services = {
    reserve: async <T>(work: () => Promise<T>): Promise<T> => {
      if (reserved) throw new Error('concurrent recovery reservation');
      reserved = true; try { return await work(); } finally { reserved = false; }
    },
    parentState: async () => { parentReads++; return 'gone' as const; },
    end: async (...args: Parameters<typeof import('../src/system-processes.ts').endProcess>) => {
      const [target, , , beforeSignal, options] = args;
      signalled.push(target.pid!);
      if (target.pid === child.pid && holdRoot) {
        holdRoot = false; entered.resolve(); await releaseRoot.promise;
        options?.onCaptured?.([child, descendant]); await beforeSignal?.([child, descendant]);
      }
      return target.pid === child.pid || confirmed;
    },
  };
  const recover: typeof recoverGitCommands = (root, env) => recoverGitCommands(root, env, services);
  const unsupported = JSON.stringify({ ...row, child: null, released: false });
  await writeFile(path, unsupported);
  await step('unbound captured descendants fence replacement startup', () => assert.rejects(projectHub(scope.resources, root, {}, { gitCommandRecovery: recover }), /invalid or copied/));
  assert.equal(await readFile(path, 'utf8'), unsupported, 'unsupported retained evidence is never discarded');
  assert.equal(await readFile(join(root, '.cland/territory.git/hooks/update'), 'utf8'), 'original hook');
  assert.equal(parentReads, 0, 'unsupported ownership is refused before native classification');
  assert.deepEqual(signalled, []);
  await writeFile(path, JSON.stringify(row));
  await chmod(path, 0o644);
  await step('non-private ownership refuses before native classification', () => assert.rejects(recoverGitCommands(root, {}, services), /private.*receipt/));
  assert.deepEqual(signalled, []);
  await chmod(path, 0o600);
  let foreignOwner = true;
  const open = files.open;
  scope.patch(files, 'open', async (...args: Parameters<typeof files.open>) => {
    const file = await Reflect.apply(open, files, args);
    if (String(args[0]) === path && foreignOwner) {
      const stat = file.stat.bind(file);
      Object.defineProperty(file, 'stat', { value: async () => Object.assign(await stat(), { uid: userInfo().uid + 1 }) });
    }
    return file;
  });
  await step('native file owner refuses despite matching JSON uid', () => assert.rejects(recoverGitCommands(root, {}, services), /private.*receipt/));
  assert.deepEqual(signalled, []);
  foreignOwner = false;
  await writeFile(path, JSON.stringify({ ...row, captured: [] }));
  holdRoot = true;
  const first = scope.wait('first recovery remains owned', () => recoverGitCommands(root, {}, services).catch(error => error));
  await step('first native recovery entered', () => entered.promise);
  await step('overlapping recovery refuses its reservation', () => assert.rejects(recoverGitCommands(root, {}, services), /concurrent recovery reservation/));
  releaseRoot.resolve();
  assert.ok(await step('first recovery incomplete receipt', () => first) instanceof GitCommandRecoveryRequired);
  assert.ok((JSON.parse(await readFile(path, 'utf8')) as GitCommandRecord).captured.some(row => row.pid === descendant.pid));
  signalled.length = 0;
  await step('replacement startup refuses unconfirmed writer', () => assert.rejects(projectHub(scope.resources, root, {}, { gitCommandRecovery: recover }), error => error instanceof GitCommandRecoveryRequired));
  assert.equal(await readFile(join(root, '.cland/territory.git/hooks/update'), 'utf8'), 'original hook', 'no territory hook write precedes recovery');
  assert.equal((JSON.parse(await readFile(path, 'utf8')) as GitCommandRecord).id, id, 'native incompleteness keeps the durable owner');
  assert.deepEqual(signalled, [child.pid, descendant.pid], 'root close does not discharge a captured descendant; both identities are checked');
  const copy = await step('copied root setup', async () => {
    const copy = await tempProject(scope.fixtures); scope.adoptRoot(copy); return copy;
  });
  await mkdir(join(copy, '.cland/run/git-command-owners'), { recursive: true });
  const copiedPath = join(copy, '.cland/run/git-command-owners', `${id}.json`);
  await writeFile(copiedPath, JSON.stringify(row), { mode: 0o600 });
  signalled.length = 0;
  await step('copied receipt refusal', () => assert.rejects(recoverGitCommands(copy, {}, services), /invalid or copied/));
  assert.deepEqual(signalled, [], 'copied native ownership grants no signal authority');
  assert.ok(await readFile(copiedPath, 'utf8'), 'copied metadata stays available for diagnosis');
  confirmed = true;
  const hub = await step('replacement startup after confirmed cleanup', () => projectHub(scope.resources, root, {}, { gitCommandRecovery: recover }));
  assert.notEqual(await readFile(join(root, '.cland/territory.git/hooks/update'), 'utf8'), 'original hook', 'positive control: territory effect follows native confirmation');
  await assert.rejects(readFile(path), { code: 'ENOENT' });
  await step('replacement hub stop', () => hub.stop());
}));

test('ordinary territory timeout exposes recovery and settles after a later native close', t => pruneCase(t, async (scope, step) => {
  const f = fakePrune(scope);
  f.confirm(false);
  const git = PruneProcesses.prototype.git;
  scope.patch(PruneProcesses.prototype, 'git', function (...args: Parameters<typeof git>) { return Reflect.apply(git, f.owner, args); });
  const command = territoryGitAsync('/fake-prune', ['status'], false, undefined, {}).catch(error => error);
  await step('original command gate', () => f.started);
  f.deadline();
  const failure = await step('bounded public timeout result', () => command);
  assert.ok(failure instanceof TerritoryGitError);
  assert.equal(failure.code, 'CLAND_GIT_INCOMPLETE');
  const recovery = failure.recovery;
  assert.ok(recovery);
  assert.equal(typeof recovery.retry, 'function');
  f.confirm(true);
  f.close();
  assert.equal(await step('public recovery retry', () => recovery.retry()), true);
  await step('public writer settlement', () => recovery.settled);
}));

test('a reaped original child never grants identity authority while its pipes remain open', t => pruneCase(t, async (scope, step) => {
  const f = fakePrune(scope);
  const capture = Promise.withResolvers<void>();
  const observed = Promise.withResolvers<typeof f.identity | null>();
  scope.releaseOnClose(() => observed.resolve(null));
  f.observe(async () => { capture.resolve(); return observed.promise; });
  const result = f.owner.git('/fake-prune', ['status'], {}).catch(error => error);
  await step('identity capture entered', () => capture.promise);
  f.child.exitCode = 0;
  f.child.emit('exit', 0, null);
  observed.resolve({ ...f.identity, pidIdentity: 'replacement-birth' });
  f.close();
  await step('refused command receipt', () => result);
  await step('original close settlement', () => f.owner.settled);
  assert.deepEqual(f.bound, [], 'replacement birth never reaches durable admission');
  assert.deepEqual(f.signals, [], 'replacement identity is never signalled');
}));

test('scoped Git preserves territory failure class and Host native output contracts', t => {
  const sequence = stageCase(t);
  return sequence.run(async step => {
    const failure = Object.assign(new Error('ordinary Git failure'), {
      code: 7, stdout: 'visible output\n', stderr: 'visible diagnostic\n', nativeClose: { code: 7, signal: null },
    });
    await step(() => pruneCommand.run({ run: async () => { throw failure; } }, async () => {
      await assert.rejects(territoryGitAsync('/fake-prune', ['status'], false, undefined, {}), error =>
        error instanceof TerritoryGitError && error.code === 7 && error.stdout === 'visible output\n');
      const result = await hostCommand('git', ['status'], {}, undefined, false, undefined, 'utf8', '/fake-prune');
      assert.equal(result.code, 7);
      assert.equal(result.stdout, 'visible output\n');
      assert.equal(result.stderr, 'visible diagnostic\n');
      assert.deepEqual(Reflect.get(result, 'nativeClose'), { code: 7, signal: null });
      assert.equal(result.error, undefined, 'ordinary nonzero exit is not a cancellation');
    }));
  });
});

for (const trigger of ['stop', 'deadline']) for (const confirmed of [true, false]) test(`prune cancellation joins native close and retains unconfirmed ownership (trigger=${trigger}, confirmed=${confirmed})`, t => pruneCase(t, async (scope, step) => {
  const f = fakePrune(scope);
  f.confirm(confirmed);
  let failure: { recovery?: { retry(): Promise<boolean>; settled: Promise<void> } } | undefined;
  const result = f.owner.run(() => f.owner.git('/fake-prune', ['worktree', 'remove'], {})).catch(error => { failure = error; });
  await step('native gate released', () => f.started);
  let settled = false;
  void f.owner.settled.then(() => { settled = true; });
  if (trigger === 'deadline') f.deadline();
  const cancelling = f.owner.cancel();
  if (!confirmed) {
    assert.equal(await step('unconfirmed cancellation receipt', () => cancelling), false);
    await step('bounded ordinary result', () => result);
    assert.ok(failure?.recovery, 'ordinary callers retain a usable recovery owner');
  }
  assert.equal(settled, false, 'a stop acknowledgement is not native close');
  f.close();
  if (confirmed) assert.equal(await step('confirmed cancellation', () => cancelling), true);
  else {
    assert.equal(settled, false, 'native close alone does not discard captured obligations');
    f.confirm(true);
    assert.equal(await step('same owner retry', () => failure!.recovery!.retry()), true);
  }
  await step('writer settlement', () => f.owner.settled);
  await step('command result', () => result);
  await step('later write fenced', () => assert.rejects(f.owner.git('/fake-prune', ['config', 'later-write'], {}), /no further Git command/));
  assert.ok(f.signals.every(row => row === f.identity), 'only the launch-bound identity was signalled');
  assert.equal(f.launches(), 1);
}));

test('merge prune carries an isolated command owner through shutdown', t => pruneCase(t, async (scope, step) => {
  const f = await step('component setup', () => componentProject(scope.fixtures, { ownStop: scope.requireClose }));
  scope.adoptRoot(f.root);
  const work = await f.ticket();
  await review(f.rev, work.id);
  let owner: unknown;
  scope.patch(f.merges.worktrees, 'pruneMerged', async () => {
    owner = pruneCommand.getStore();
    return { removed: [], failed: [] };
  });
  await step('merge prune', () => f.merge(work));
  await step('merge stop', () => f.merges.stop());
  assert.ok(owner, 'the admitted prune carries its cancellation owner');
  assert.equal(pruneCommand.getStore(), undefined, 'unrelated commands inherit no prune authority');
}));

for (const timeout of [false, true]) for (const throwingLog of [false, true]) test(`merge stop retains every prune writer (timeout=${timeout}, throwingLog=${throwingLog})`, async t => {
  const f = await componentProject(t);
  const work = await f.ticket();
  await review(f.rev, work.id);
  const other = await f.ticket();
  await review(f.rev, other.id);
  let entered = false;
  const release = Promise.withResolvers<void>();
  let calls = 0;
  // Install independent release ownership before admitting the retry, including
  // an assertion failing before stop has begun.
  onCleanup(t, async () => { release.resolve(); await joinMergeCleanup(f.merges); });
  const log = f.merges.log;
  let otherCalls = 0;
  t.mock.method(f.merges.worktrees, 'pruneMerged', async (id: string) => {
    if (id === other.id) {
      if (++otherCalls > 1) throw new Error('planted second writer failure');
      return { removed: [], failed: [{ item: id, error: 'implementer stands inside its worktree' }] };
    }
    if (++calls === 1) return { removed: [], failed: [{ item: work.id, error: 'implementer stands inside its worktree' }] };
    entered = true;
    await release.promise;
    return { removed: [], failed: [] };
  });
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let stopping: ReturnType<TaskMerges['stop']> | undefined;
  try {
    await f.merge(work);
    await f.merge(other);
    if (throwingLog) t.mock.method(f.merges, 'log', (row: Record<string, unknown>) => { log(row); throw new Error('planted diagnostic failure'); });
    t.mock.timers.tick(500);
    await Promise.resolve();
    assert.equal(entered, true, 'the timer entered prune before stop');
    let stopped = false;
    stopping = f.merges.stop().then(result => { stopped = true; return result; });
    await Promise.resolve(); await Promise.resolve();
    assert.equal(stopped, false, 'stop must retain the in-flight prune owner');
    if (timeout) {
      t.mock.timers.tick(MERGE_CLEANUP_STOP_MS);
      const result = await stopping;
      assert.equal(result.status, 'incomplete');
      assert.ok('settled' in result);
      let settled = false;
      void result.settled.then(() => { settled = true; });
      await Promise.resolve();
      assert.equal(settled, false, 'bounded return retains the still-running settlement');
      assert.ok(f.records.some(row => row.event === 'merge-cleanup-stop-incomplete'));
    }
  } finally { release.resolve(); await stopping; }
  assert.equal((await f.merges.stop()).status, 'complete');
  t.mock.timers.tick(500);
  assert.equal(calls, 2, 'stop admits no later retries');
});

for (const earlyFailure of [false, true]) test(`daemon retains storage and lock until a timed-out prune settles (earlyFailure=${earlyFailure})`, async t => {
  const f = await componentProject(t);
  const root = await tempProject(t);
  const databases: DatabaseSync[] = [];
  const hub = await projectHub(t, root, {}, {
    openDatabase: path => { const db = new DatabaseSync(path); databases.push(db); return db; },
    log: row => { if (row.event === 'hub-stop-retained') throw new Error('planted retained diagnostic failure'); },
  });
  assert.ok(databases.length > 0, 'the real daemon opened storage');
  const work = await f.ticket();
  await review(f.rev, work.id);
  const release = Promise.withResolvers<void>();
  let calls = 0, finished = false;
  onCleanup(t, async () => { release.resolve(); await joinMergeCleanup(f.merges); });
  t.mock.method(f.merges.worktrees, 'pruneMerged', async () => {
    if (++calls === 1) return { removed: [], failed: [{ item: work.id, error: 'implementer stands inside its worktree' }] };
    await release.promise;
    finished = true;
    return { removed: [], failed: [] };
  });
  // Exercise the real Dispatcher/daemon stop path with the real held merge owner.
  const stop = TaskMerges.prototype.stop;
  t.mock.method(TaskMerges.prototype, 'stop', () => stop.call(f.merges));
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const scenario = async () => { try {
    await f.merge(work);
    t.mock.timers.tick(500);
    await Promise.resolve();
    assert.equal(calls, 2);
    const stopping = hub.stop();
    const incomplete = assert.rejects(stopping, error => error instanceof MergeCleanupIncomplete);
    t.mock.timers.tick(MERGE_CLEANUP_STOP_MS);
    await incomplete;
    assert.equal(finished, false);
    assert.ok(databases.every(db => db.isOpen), 'storage is retained while the writer is pending');
    assert.ok(existsSync(join(root, '.cland/hub.json')), 'discovery remains');
    assert.ok(existsSync(join(root, '.cland/hub.lock')), 'lock remains');
    if (earlyFailure) assert.fail('planted early assertion');
  } finally {
    release.resolve();
    await settleRetainedMergeStop(hub.stop);
  } };
  if (earlyFailure) await assert.rejects(scenario, /planted early assertion/); else await scenario();
  assert.equal(finished, true);
  assert.ok(databases.every(db => !db.isOpen), 'storage closes only after settlement');
  assert.equal(existsSync(join(root, '.cland/hub.json')), false);
  assert.equal(existsSync(join(root, '.cland/hub.lock')), false);
});

test('dependency-changing landings require a root install and keep the shared tree intact', async t => {
  for (const file of ['package-lock.json', 'package.json', 'hub/package.json', 'README.md']) await t.test(file, async t => {
    const f = await componentProject(t);
    await mkdir(join(f.root, 'node_modules'), { recursive: true });
    await writeFile(join(f.root, 'node_modules/reader'), 'still reading');
    const work = await f.ticket(undefined, file);
    await review(f.rev, work.id);
    await f.ready(work);
    const result = await f.merges.merge(work.id, human, work => work());
    assert.ok('commit' in result);
    const expected = file === 'README.md' ? undefined : { files: [file], command: 'npm install', cwd: f.root };
    assert.deepEqual(result.dependencies, expected);
    const record = f.records.find(record => record.event === 'task-merged')!;
    const notice = lifecycleNotice(record, name => name)!;
    if (expected) {
      assert.match(f.tracker.view(work.id).comments.at(-1)?.text ?? '', /package.*npm install/s);
      assert.ok(notice.text.includes(file));
      assert.match(notice.text, /run npm install in root/);
      assert.ok(notice.text.includes(f.root));
      const resumed = await f.merges.merge(work.id, human, work => work());
      assert.ok('commit' in resumed);
      assert.deepEqual(resumed.dependencies, expected);
      assert.equal(resumed.commit, result.commit);
    } else assert.doesNotMatch(notice.text, /npm install/);
    assert.equal(await readFile(join(f.root, 'node_modules/reader'), 'utf8'), 'still reading');
  });
});

test('injected merge freshness fan-out is measured as a resumed 400 ms stretch', async (t) => {
  const f = await componentProject(t);
  const { tracker, ui, rev, records, facts, clock, merges } = f;
  const work = await f.ticket();
  await review(rev, work.id);
  await f.ready(work);
  const created = await ui.request({ size: 'M', type: 'task.create', title: 'A branch that will appear', branch: 't/later' });
  assert.equal(created.ok, true, created.error);
  const id = (created.value as { item: { id: string } }).item.id;
  const tip = facts.heads.get(work.branch!)!;
  assert.equal((await rev.call<{ ok: boolean }>('task.comment', { id, verdict: 'review', scope: 'full', result: 'clear', run: 'later', commit: tip })).ok, true);
  await until(async () => {
    await tracker.refreshFreshness();
    return tracker.view(id).verdicts[0]?.current === false;
  }, { what: 'missing branch settled stale' });
  // The manual tip scheduler has no background poke to drain.
  await tracker.refreshFreshness();
  facts.heads.set('t/later', tip);
  // A real task-event subscriber is a public boundary; only the guard clock is synthetic.
  tracker.onChange(change => { if (change.id === id) clock.block(400); });
  const guard = new RequestGuard({ now: () => clock.now().getTime(), log: r => records.push(r) });
  const response = await guard.measure('merge', 'human', () => merges.merge(work.id, human, guard.resumer('merge', 'human')));
  assert.ok('commit' in response);
  assert.ok(records.some(r => r.event === 'slow-request' && r.tool === 'merge' && r.phase === 'resumed' && Number(r.ms) >= 400), JSON.stringify(records));
});


test('in-process verdict writes use the role held after injected Git resolves', async (t) => {
  for (const role of ['implementer', 'coordinator']) await t.test(role, async t => {
    let reached = false;
    const release = Promise.withResolvers<void>();
    let paused = false;
    const f = await componentProject(t, { git: real => async (args, input) => {
      if (paused && args[0] === 'rev-parse') { reached = true; await release.promise; }
      return real(args, input);
    } });
    const { tracker, ui, rev, facts, merges } = f;
    const work = await f.ticket();
    paused = true;
    const writing = rev.call<{ ok: boolean; code?: string; error?: string }>('task.comment', { id: work.id, verdict: 'review', scope: 'full', result: 'clear', run: 'role-await' });
    try {
      await until(() => reached, { what: 'verdict commit lookup paused' });
      assert.equal((await ui.request({ type: 'role.set', session: 'rev', role })).ok, true);
    } finally { release.resolve(); }
    const result = await writing;
    if (role === 'implementer') {
      assert.equal(result.ok, false, JSON.stringify(result));
      assert.equal(result.code, 'forbidden');
      const refs = [...facts.heads];
      await assert.rejects(merges.merge(work.id, human, work => work()), /review-missing/);
      assert.deepEqual([...facts.heads], refs, 'a gate refusal moves no ref');
    } else {
      assert.equal(result.ok, true, result.error);
      const verdict = tracker.view(work.id).verdicts[0];
      assert.equal(verdict?.writer?.role, 'coordinator');
      assert.equal(verdict?.by, 'rev [coordinator]');
      const refs = [...facts.heads];
      await assert.rejects(merges.merge(work.id, human, work => work()), /review-role/);
      assert.deepEqual([...facts.heads], refs, 'a gate refusal moves no ref');
    }
  });
});


test('in-process release and topic closure failures retry only remaining merge steps', async (t) => {
  for (const step of ['release', 'topic close']) {
    await t.test(step, async t => {
      const f = await componentProject(t);
      const { root, tracker, ui, rev, facts, merges } = f;
      const work = await f.ticket();
      await review(rev, work.id);
      await f.ready(work);
      const before = facts.landings.length;
      const topic = await ui.request({ type: 'topic.create', title: 'Follow-ups', item: work.id });
      assert.equal(topic.ok, true, topic.error);
      let repair: () => void | Promise<void> = () => {};
      if (step === 'release') {
        const db = new DatabaseSync(join(root, '.cland', 'hub.db'));
        onCleanup(t, () => db.close());
        db.exec("create trigger fail_release before delete on tracker_claims begin select raise(abort, 'release failure'); end");
        repair = () => db.exec('drop trigger fail_release');
      } else if (step === 'topic close') {
        const db = new DatabaseSync(join(root, '.cland', 'hub.db'));
        onCleanup(t, () => db.close());
        db.exec("create trigger fail_topic before update of status on topics when old.item = 'T-1' begin select raise(abort, 'topic closure failure'); end");
        repair = () => db.exec('drop trigger fail_topic');
      }
      const first = await merges.merge(work.id, human, work => work()) as { commit: string; followUp?: { step: string; error: string } };
      assert.equal(first.followUp?.step, step);
      assert.ok(first.followUp?.error.includes('merged, follow-up failed:'));
      assert.equal(facts.heads.get('dev'), first.commit);
      assert.equal(tracker.view(work.id).state, 'closed');
      await repair();
      const done = await merges.merge(work.id, human, work => work()) as { commit: string; followUp?: unknown };
      assert.equal(done.commit, first.commit);
      assert.equal(done.followUp, undefined);
      assert.equal(facts.landings.length - before, 1);
      assert.equal(tracker.view(work.id).claim, null);
      assert.equal(facts.worktrees.has(work.id), false, 'successful retry removes the worktree');
      assert.equal(facts.heads.has(work.branch!), false, 'successful retry removes the task branch');
      const history = await ui.request({ type: 'topic.history', topic: (topic.value as { topic: { id: string } }).topic.id });
      assert.equal((history.value as { topic: { status: string } }).topic.status, 'closed');
    });
  }
});

test('injected merge logging failures retain the landed commit and retry only follow-ups', async (t) => {
  let failing = true;
  const f = await componentProject(t, { sink: entry => {
    if (failing && ['task-merged', 'merge-follow-up-failed'].includes(String(entry.event))) throw new Error('record sink unavailable');
  } });
  const { rev, facts, merges } = f;
  const work = await f.ticket();
  await review(rev, work.id);
  await f.ready(work);
  const before = facts.landings.length;
  const result = await merges.merge(work.id, human, work => work()) as { commit: string; followUp?: { step: string } };
  assert.equal(result.followUp?.step, 'record');
  assert.equal(facts.heads.get('dev'), result.commit);
  failing = false;
  const retry = await merges.merge(work.id, human, work => work()) as { commit: string };
  assert.equal(retry.commit, result.commit);
  assert.equal(facts.landings.length - before, 1);
});

// Drive the real registered teardown before its owned directory cleanup, including partial acquisition.
test('component fixture drains startup and close failures before removing its root', async t => {
  for (const failure of ['startup', 'close'] as const) await t.test(failure, async t => {
    const hooks: Array<() => Promise<void>> = [];
    const fixtureContext = { signal: t.signal, after: (hook: () => Promise<void>) => hooks.push(hook) } as unknown as TestContext;
    let acquired: Parameters<typeof startHub>[0] | undefined;
    let root = '', closeCalls = 0;
    const starting = componentProject(fixtureContext, { start: async options => {
      assert.ok(options);
      acquired = options;
      root = options.tracker!.root;
      if (failure === 'startup') throw new Error('controlled startup failure');
      const hub = await startHub(options);
      const close = hub.close;
      hub.close = async () => { await close(); if (++closeCalls === 1) throw new Error('controlled close failure'); };
      return hub;
    } });
    let fixture: Awaited<ReturnType<typeof componentProject>> | undefined;
    if (failure === 'startup') await assert.rejects(starting, /controlled startup failure/);
    else {
      fixture = await starting;
      await assert.rejects(fixture.stop(), /controlled close failure/);
    }
    let inspected = false;
    beforeDirectories(fixtureContext, async () => {
      try {
        assert.ok(existsSync(root), 'root remains until writers are observed stopped');
        assert.throws(() => acquired!.tracker!.list(), /not open/, 'tracker database is closed before root removal');
        assert.throws(() => acquired!.store!.mergeQueue(), /not open/, 'hub store is closed before root removal');
        inspected = true;
      } finally {
        // Red runs still stop leaked writers before the directory cleanup runs.
        await acquired!.tracker!.stop();
        try { acquired!.store!.mergeQueue(); acquired!.store!.close(); } catch { /* already closed */ }
      }
    });
    for (const hook of hooks) await hook();
    assert.equal(inspected, true);
    assert.equal(existsSync(root), false);
    if (failure === 'close') assert.equal(closeCalls, 2, 'failed hub close is retried');
  });
});

test('component fixture drains cancelled socket startup before removing its root', async t => {
  const hooks: Array<() => Promise<void>> = [], controller = new AbortController();
  const fixtureContext = { signal: controller.signal, after: (hook: () => Promise<void>) => hooks.push(hook) } as unknown as TestContext;
  const release = Promise.withResolvers<void>();
  let acquired: Parameters<typeof startHub>[0] | undefined, entered = false, inspected = false;
  const starting = componentProject(fixtureContext, { start: async options => {
    assert.ok(options);
    acquired = options;
    const hub = await startHub(options);
    entered = true;
    await release.promise;
    return hub;
  } });
  const cancelled = assert.rejects(starting, /controlled cancellation/);
  onCleanup(t, async () => { release.resolve(); await cancelled; for (const hook of hooks) await hook(); });
  await until(() => entered, { what: 'socket acquired but startup return held' });
  const root = acquired!.tracker!.root;
  beforeDirectories(fixtureContext, () => {
    assert.ok(existsSync(root), 'drain inspection precedes root removal');
    assert.throws(() => acquired!.tracker!.list(), /not open/);
    assert.throws(() => acquired!.store!.mergeQueue(), /not open/);
    inspected = true;
  });
  controller.abort(new Error('controlled cancellation'));
  const cleaning = hooks[0]!();
  // Cleanup must await the pending socket acquisition before touching its lower resources/root.
  await Promise.resolve();
  assert.equal(inspected, false);
  assert.ok(existsSync(root));
  release.resolve();
  await cancelled;
  await cleaning;
  assert.equal(inspected, true);
  assert.equal(existsSync(root), false);
});

for (const change of ['scripts', 'dependencies'] as const) test(`landing: ${change} change reports the correct install requirement`, async t => {
  const f = await componentProject(t);
  const work = await f.ticket(undefined, 'package.json');
  const before = { dependencies: { library: '1' }, scripts: { test: 'old' } };
  const after = change === 'scripts' ? { ...before, scripts: { test: 'new' } } : { ...before, dependencies: { library: '2' } };
  f.facts.manifests.set(`${f.facts.heads.get('dev')}:package.json`, JSON.stringify(before));
  f.facts.manifests.set(`${f.facts.heads.get(work.branch!)}:package.json`, JSON.stringify(after));
  await review(f.rev, work.id);
  await f.ready(work);
  const result = await f.merges.merge(work.id, human, work => work());
  assert.ok('commit' in result);
  assert.deepEqual(result.dependencies, change === 'scripts' ? undefined : { files: ['package.json'], command: 'npm install', cwd: f.root });
  const record = f.records.find(record => record.event === 'task-merged')!;
  assert.ok(record);
  const notice = lifecycleNotice(record, name => name)!;
  const comment = f.tracker.view(work.id).comments.at(-1)?.text ?? '';
  if (change === 'scripts') {
    assert.doesNotMatch(notice.text, /npm install/);
    assert.doesNotMatch(comment, /npm install/);
  } else {
    assert.match(notice.text, /run npm install in root/);
    assert.match(comment, /run npm install in root/);
  }
  const resumed = await f.merges.merge(work.id, human, work => work());
  assert.ok('commit' in resumed);
  assert.equal(resumed.commit, result.commit);
  assert.deepEqual(resumed.dependencies, result.dependencies);
});
