// T3: native Git's loose/cruft object expiry and gc.log recovery contract; no hub subprocess.
import test from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { mkdir, mkdtemp, readFile, readdir, realpath, stat, utimes, writeFile } from 'node:fs/promises';
import { hostname, tmpdir } from 'node:os';
import { eventually, pidAlive, projectHub, tempProject } from './harness.ts';
import { fixtureEnvironment } from './fixture-environment.ts';
import { gitMaintenancePath, maintainProjectGit, type GitMaintenance } from '../src/git-maintenance.ts';
import { checkProject } from '../src/doctor/project.ts';
import { createHash } from 'node:crypto';
import { withTerritoryLockAsync } from '../src/territory.ts';
import { beforeDirectories, ownDirectory, ownProcess } from './process-cleanup.ts';
import { FakeClock } from './fake-clock.ts';
import { committedTreeOrThrow } from '../src/verification-tree.ts';
import { FixtureCommandError, fixtureCommand, fixtureCommandOutput } from './git-maintenance-fixture.ts';
import cp from 'node:child_process';
import { syncBuiltinESMExports } from 'node:module';
import { MaintenanceRecoveryRequired, ownedMaintenanceRunner, readMaintenanceOwner } from '../src/git-maintenance-owner.ts';
import { recoverMaintenanceOwner, writeMaintenanceOwner } from '../src/git-maintenance-owner.ts';
import { processStartedAsync } from '../src/hub/lock.ts';

async function heldWriter(root: string) {
  const capture = join(root, 'fixture-writer-pids.json');
  const script = join(root, 'held-fixture-writer.mjs');
  await writeFile(script, `
    import { spawn } from 'node:child_process';
    import { writeFileSync } from 'node:fs';
    import { fixtureEnvironment } from ${JSON.stringify(new URL('./fixture-environment.ts', import.meta.url).href)};
    const child = spawn(process.execPath, ['-e', 'process.send("ready"); setInterval(() => require("node:fs").writeFileSync(process.argv[1], "writing"), 10)', ${JSON.stringify(join(root, 'writer-output'))}], {
      env: fixtureEnvironment(${JSON.stringify(root)}, process.env), stdio: ['ignore', 'ignore', 'ignore', 'ipc']
    });
    child.once('message', () => writeFileSync(${JSON.stringify(capture)}, JSON.stringify([process.pid, child.pid])));
  `);
  return { script, capture };
}

test('scratch Git helper drains a held descendant writer before rejecting cancellation', async t => {
  const root = await tempProject(t);
  const { script, capture } = await heldWriter(root);
  const ready = eventually('held fixture publishes both writer identities', async () => {
    try { return JSON.parse(await readFile(capture, 'utf8')) as number[]; } catch { return undefined; }
  }, 3000);
  const abort = new AbortController();
  const outcome = fixtureCommand(t, root, process.execPath, [script], undefined, { signal: abort.signal });
  const rejected = assert.rejects(outcome, /cancel|abort/i);
  const pids = await ready;
  for (const pid of pids) ownProcess(t, pid);
  abort.abort();
  await rejected;
  for (const pid of pids) assert.equal(pidAlive(pid), false, `writer ${pid} is gone before the command rejects`);
});

for (const sameBirth of [true, false]) test(`first territory mutation ${sameBirth ? 'reaps a surviving owned group' : 'preserves an unrelated reused PID'}`, async t => {
  const root = await tempProject(t);
  await mkdir(join(root, '.git'));
  const { script, capture } = await heldWriter(root);
  const ready = eventually('the recovery candidate publishes its live process group', async () => {
    try { return JSON.parse(await readFile(capture, 'utf8')) as number[]; } catch { return undefined; }
  }, 3000);
  const abort = new AbortController();
  const command = fixtureCommand(t, root, process.execPath, [script], undefined, { signal: abort.signal });
  const stopped = assert.rejects(command, /cancel|kill|exit/i);
  const pids = await ready;
  for (const pid of pids) ownProcess(t, pid);
  const started = await processStartedAsync(pids[0]!, 500, work => work(), 'UTC', fixtureEnvironment(root, process.env));
  assert.ok(started);
  const owner = { token: `recovery-${sameBirth}`, root, cwd: root, gitDirectory: join(root, '.git'), host: hostname(), pid: pids[0]!, group: pids[0]!, started: sameBirth ? started : 'different precise birth' };
  await writeMaintenanceOwner(root, owner);
  await writeFile(join(root, '.git/gc.pid'), `${owner.pid} ${owner.host}\n`);
  await withTerritoryLockAsync(root, async () => {
    assert.equal(await readMaintenanceOwner(root), null, 'recovery precedes the mutation');
    for (const pid of pids) assert.equal(pidAlive(pid), !sameBirth, 'only the matching captured identity may be signalled');
  });
  if (!sameBirth) {
    assert.match(await readFile(join(root, '.git/gc.pid'), 'utf8'), new RegExp(`^${owner.pid} `));
    abort.abort(); // This fixture owns the unrelated process; recovery did not signal it.
  }
  await stopped;
});

test('cancelled background collection reaps its group and the next pass recovers gc.pid without deleting foreign temporary packs', async t => {
  const f = await repository(t);
  const capture = join(f.root, 'collector-pids.json');
  const collector = join(f.root, 'held-collector.mjs');
  const ownedPack = join(f.root, '.git/objects/pack/tmp_pack_owned');
  const foreignPack = join(f.root, '.git/objects/pack/tmp_pack_foreign');
  await writeFile(foreignPack, 'another writer owns these bytes');
  await writeFile(collector, `
    import { spawn } from 'node:child_process';
    import { writeFileSync } from 'node:fs';
    import { fixtureEnvironment } from ${JSON.stringify(new URL('./fixture-environment.ts', import.meta.url).href)};
    const child = spawn(process.execPath, ['-e', 'process.send("ready"); setInterval(() => {}, 1000)'], {
      env: fixtureEnvironment(${JSON.stringify(f.root)}, process.env), stdio: ['ignore', 'inherit', 'inherit', 'ipc']
    });
    child.once('message', () => {
      writeFileSync(${JSON.stringify(join(f.root, '.git/gc.pid'))}, process.pid + ' ' + ${JSON.stringify(hostname())} + '\\n');
      writeFileSync(${JSON.stringify(ownedPack)}, 'interrupted collector bytes');
      writeFileSync(${JSON.stringify(capture)}, JSON.stringify([process.pid, child.pid]));
    });
  `);
  // Arm the exact native readiness observation before launching maintenance.
  const entered = eventually('collector and descendant publish their owned PIDs', async () => {
    try { return JSON.parse(await readFile(capture, 'utf8')) as number[]; } catch { return undefined; }
  }, 3000);
  let pids: number[] = [];
  const abort = new AbortController();
  const native = ownedMaintenanceRunner(f.root, f.root, join(f.root, '.git'));
  const spawn = cp.spawn;
  let releaseClose = () => {};
  t.mock.method(cp, 'spawn', (bin: string, args: readonly string[], options: cp.SpawnOptions) => {
    // cland-allow-child-env: transparent observer forwards the sealed fixture/production runner environment unchanged
    const child = spawn(bin, args, options);
    if (args?.includes(collector)) {
      const emit = child.emit;
      t.mock.method(child, 'emit', (event: string | symbol, ...values: unknown[]) => {
        if (event === 'close') { releaseClose = () => { Reflect.apply(emit, child, [event, ...values]); }; return true; }
        return Reflect.apply(emit, child, [event, ...values]) as boolean;
      });
    }
    return child;
  });
  syncBuiltinESMExports();
  t.after(() => { releaseClose(); t.mock.restoreAll(); syncBuiltinESMExports(); });
  const pending = maintainProjectGit(f.root, () => null, f.env, {
    signal: abort.signal,
    run: (bin, args, env, timeout, stdin, signal) => args.includes('gc') ? native(process.execPath, [collector], env, timeout, stdin, signal) : native(bin, args, env, timeout, stdin, signal),
    lock: (root, operation) => withTerritoryLockAsync(root, async () => {
      try { return await operation(); }
      finally {
        if (pids.length !== 2) {
          const receipt = await readFile(gitMaintenancePath(f.root), 'utf8').catch(error => String(error));
          assert.fail(`incomplete native setup before its deadline; producer receipt: ${receipt.slice(-2000)}`);
        }
        for (const pid of pids) assert.equal(pidAlive(pid), false, `collector PID ${pid} is reaped before lock release`);
      }
    }),
  });
  beforeDirectories(t, async () => { abort.abort(); await pending.catch(() => {}); });
  const refused = assert.rejects(pending, MaintenanceRecoveryRequired);
  pids = await entered;
  for (const pid of pids) ownProcess(t, pid);
  const durableOwner = await readMaintenanceOwner(f.root);
  assert.equal(durableOwner?.pid, pids[0], 'PID/birth/group are durable before the gated command publishes readiness');
  abort.abort();
  await refused;
  const receipt = JSON.parse(await readFile(gitMaintenancePath(f.root), 'utf8')) as GitMaintenance;
  assert.match(receipt.repositories[0]!.error!, /unresolved ownership/);
  for (const pid of pids) assert.equal(pidAlive(pid), false);
  assert.match(await readFile(join(f.root, '.git/gc.pid'), 'utf8'), new RegExp(`^${pids[0]} `), 'the aborted collector left its native lock');
  assert.equal((await readMaintenanceOwner(f.root))?.pid, pids[0], 'incomplete close retains the durable owner');
  releaseClose();
  await maintainProjectGit(f.root, () => null, f.env);
  const recovered = JSON.parse(await readFile(gitMaintenancePath(f.root), 'utf8')) as GitMaintenance;
  assert.equal(recovered.repositories[0]!.error, undefined, 'Git recovers a same-host dead gc.pid on the next pass');
  await assert.rejects(readFile(join(f.root, '.git/gc.pid')), { code: 'ENOENT' });
  assert.equal(await readFile(foreignPack, 'utf8'), 'another writer owns these bytes');
  assert.equal(await readFile(ownedPack, 'utf8'), 'interrupted collector bytes', 'recent temporary packs retain the same grace');
});

async function repository(t: Parameters<typeof tempProject>[0]) {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'cland-git-maintenance-')));
  const env = fixtureEnvironment(root, process.env);
  ownDirectory(t, root, { beforeRemove: () => recoverMaintenanceOwner(root, env) });
  const git = (args: string[], input?: string) => fixtureCommand(t, root, 'git', ['-c', 'gc.auto=0', '-c', 'maintenance.auto=false', ...args], input);
  await git(['init', '-q', '-b', 'dev']);
  await git(['config', 'gc.autoDetach', 'false']);
  await writeFile(join(root, 'source'), 'reachable');
  await git(['add', 'source']);
  await git(['commit', '-qm', 'Initial']);
  const orphan = async (label: string, aged: boolean) => {
    const blob = await git(['hash-object', '-w', '--stdin'], label);
    const tree = await git(['mktree'], `100644 blob ${blob}\tsource\n`);
    const commit = await git(['commit-tree', tree, '-m', label]);
    if (aged) for (const oid of [blob, tree, commit]) {
      const old = new Date('2001-01-01T00:00:00Z');
      await utimes(join(root, '.git/objects', oid.slice(0, 2), oid.slice(2)), old, old);
    }
    return { blob, tree, commit };
  };
  const exists = async (oid: string) => {
    try { await git(['cat-file', '-e', oid]); return true; }
    catch (error) {
      if (error instanceof FixtureCommandError && error.nativeFailure && error.code === 128 && /Not a valid object name/i.test(error.message)) return false;
      if (error instanceof FixtureCommandError && error.nativeFailure && error.code === 1 && error.stderr.trim() === '') return false;
      throw error;
    }
  };
  return { root, env, git, orphan, exists };
}

test('idle maintenance prunes aged unreachable objects and retains young and reachable objects', async t => {
  const f = await repository(t);
  const head = await f.git(['rev-parse', 'HEAD']);
  const old = await f.orphan('abandoned batch', true);
  const young = await f.orphan('recent snapshot', false);
  assert.equal(await f.exists(old.commit), true, 'positive control: the orphan exists before maintenance');
  await maintainProjectGit(f.root, () => null, f.env);
  for (const oid of Object.values(old)) assert.equal(await f.exists(oid), false, `expired unreachable object ${oid}`);
  for (const oid of [head, ...Object.values(young)]) assert.equal(await f.exists(oid), true);
});

test('cruft repacking applies the same grace to old and fresh packed unreachable objects', async t => {
  const f = await repository(t);
  const old = await f.orphan('old packed candidate', true);
  const young = await f.orphan('fresh packed snapshot', false);
  await f.git(['gc', '--cruft', '--prune=never']);
  assert.equal(await f.exists(old.commit), true);
  await assert.rejects(stat(join(f.root, '.git/objects', old.commit.slice(0, 2), old.commit.slice(2))), { code: 'ENOENT' });
  await f.git(['config', 'gc.cruftPacks', 'false']);
  await f.git(['config', 'gc.pruneExpire', 'now']);
  await maintainProjectGit(f.root, () => null, f.env);
  for (const oid of Object.values(old)) assert.equal(await f.exists(oid), false);
  for (const oid of Object.values(young)) assert.equal(await f.exists(oid), true);
  assert.ok((await readdir(join(f.root, '.git/objects/pack'))).some(name => name.endsWith('.mtimes')), 'explicit cruft collection preserves per-object ages despite inherited config');
});

test('verification admission freshens a reused unreachable snapshot before the background grace can expire it', async t => {
  const f = await repository(t);
  await mkdir(join(f.root, '.cland/tasks'), { recursive: true });
  await writeFile(join(f.root, '.cland/tasks/metadata'), 'tracker bytes');
  await writeFile(join(f.root, 'source'), 'changed committed source');
  await f.git(['add', 'source', '.cland/tasks/metadata']);
  await f.git(['commit', '-qm', 'Source and tracker']);
  const head = await f.git(['rev-parse', 'HEAD']);
  const snapshot = await committedTreeOrThrow(f.root, head, f.env);
  assert.ok(!(await f.git(['rev-list', '--objects', '--all'])).split('\n').some(line => line.split(' ')[0] === snapshot), 'positive control: this snapshot has no ref');
  const loose = join(f.root, '.git/objects', snapshot.slice(0, 2), snapshot.slice(2));
  const old = new Date('2001-01-01T00:00:00Z');
  await utimes(loose, old, old);
  assert.equal(await committedTreeOrThrow(f.root, head, f.env), snapshot);
  assert.ok((await stat(loose)).mtimeMs > old.getTime(), 'native write-tree freshens the reused identity');
  await maintainProjectGit(f.root, () => null, f.env);
  assert.equal(await f.exists(snapshot), true);
});

test('maintenance preserves an aged candidate used by a retained batch', async t => {
  const f = await repository(t);
  const old = await f.orphan('live batch and snapshot', true);
  assert.equal(await f.exists(old.commit), true, 'positive control: live candidate exists');
  await maintainProjectGit(f.root, name => name === 'merge-batch' ? JSON.stringify({ candidate: { head: old.commit, tree: old.tree } }) : null, f.env);
  for (const oid of Object.values(old)) assert.equal(await f.exists(oid), true, `retained batch protects ${oid}`);
});

test('failed collection remains visible in doctor while implicit Git collection stays disabled', async t => {
  const f = await repository(t);
  const old = await f.orphan('retain on failure', true);
  await f.git(['config', 'gc.cruftPacks', 'invalid']);
  await maintainProjectGit(f.root, () => null, f.env);
  assert.equal(await f.exists(old.commit), true);
  assert.equal(await f.git(['config', '--local', '--get', 'gc.auto']), '0');
  const checks = await checkProject(f.root, { started: async () => null, territoryProblems: () => null }, fixtureEnvironment(f.root, process.env));
  const maintenance = checks.filter(check => check.name === 'git maintenance');
  assert.equal(maintenance.length, 1);
  assert.equal(maintenance[0]!.verdict, 'warn');
  assert.match(maintenance[0]!.detail, /bad boolean.*invalid/);
});

test('maintenance recovers stale gc.log and doctor reports it once without repeated Git warnings', async t => {
  const f = await repository(t);
  await f.git(['config', 'gc.auto', '1']);
  // Git estimates loose count from fanout 17. Two valid objects there exceed
  // gc.auto=1 deterministically, without thousands of fixture writes.
  let found = 0;
  for (let n = 0; found < 2; n++) {
    const content = `loose ${n}`;
    if (createHash('sha1').update(`blob ${Buffer.byteLength(content)}\0${content}`).digest('hex').startsWith('17')) {
      await f.git(['hash-object', '-w', '--stdin'], content); found++;
    }
  }
  await writeFile(join(f.root, '.git/gc.log'), 'There are too many unreachable loose objects\n');
  const ordinary = (before = false) => fixtureCommandOutput(t, f.root, 'git', [...(before ? ['-c', 'gc.autoDetach=true'] : []), 'gc', '--auto']);
  assert.match((await ordinary(true)).stderr, /last gc run reported/, 'positive control: stale gc.log repeats the warning');
  await maintainProjectGit(f.root, () => null, f.env);
  assert.equal(await f.git(['config', '--local', '--get', 'gc.auto']), '0');
  assert.equal(await f.git(['config', '--local', '--get', 'maintenance.auto']), 'false');
  for (let n = 0; n < 2; n++) assert.equal((await ordinary()).stderr, '');
  const checks = await checkProject(f.root, { started: async () => null, territoryProblems: () => null }, fixtureEnvironment(f.root, process.env));
  const maintenance = checks.filter(check => check.name === 'git maintenance');
  assert.equal(maintenance.length, 1);
  assert.match(maintenance[0]!.detail, /recovered.*gc.log/);
});

test('delayed background maintenance collects the common repository and local territory after serving', async t => {
  const f = await repository(t);
  const territory = join(f.root, '.cland/territory.git');
  await mkdir(join(f.root, '.cland'), { recursive: true });
  await f.git(['init', '-q', '--bare', territory]);
  await writeFile(join(territory, 'gc.log'), 'old territory failure\n');
  const old = await f.orphan('startup abandoned candidate', true);
  const clock = new FakeClock();
  const hub = await projectHub(t, f.root, {}, { clock, gitMaintenance: maintainProjectGit });
  assert.equal(await f.exists(old.commit), true, 'serving completed before collection started');
  await clock.advance(30_000);
  const receipt = await eventually('background maintenance publishes its completed receipt', async () => {
    try { return JSON.parse(await readFile(gitMaintenancePath(f.root), 'utf8')) as GitMaintenance; } catch { return undefined; }
  }, 5000);
  assert.equal(receipt.expire, '2.weeks.ago');
  assert.equal(receipt.repositories.length, 2);
  assert.equal(receipt.repositories[1]!.recoveredGcLog, true);
  assert.ok(receipt.repositories.every(repository => repository.error === undefined));
  assert.equal(await f.exists(old.commit), false, 'the completed background receipt follows native pruning');
  assert.equal(await f.git(['-C', territory, 'config', '--local', '--get', 'gc.auto']), '0');
  await hub.stop();
  const worktree = join(f.root, 'linked');
  await f.git(['worktree', 'add', '--detach', worktree, 'HEAD']);
  await maintainProjectGit(worktree, () => null, f.env);
  assert.equal(await f.git(['-C', worktree, 'config', '--local', '--get', 'maintenance.auto']), 'false');
});
