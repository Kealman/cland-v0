// T2: the suite queue hands policy to in-process executor fakes. Git is fixture
// infrastructure; the host typecheck subprocess is faked and no worker is spawned.
import test from 'node:test';
import assert from 'node:assert/strict';
import childProcess, { execFile, type ChildProcess } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { syncBuiltinESMExports } from 'node:module';
import { promisify } from 'node:util';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tempProject, eventually } from './harness.ts';
import { beforeDirectories } from './process-cleanup.ts';
import { FakeClock } from './fake-clock.ts';
import { Store } from '../src/hub/store.ts';
import { Suites } from '../src/hub/suites.ts';
import { parseConfig } from '../src/init/config.ts';
import { LocalExecutor } from '../src/executor/local.ts';
import { DropletExecutor } from '../src/executor/droplet/droplet.ts';
import type { DropletLease } from '../src/executor/droplet/lease.ts';
import type { Lease, RunRef } from '../src/executor/executor.ts';

const candidateConfig = '[verification]\nworkers=4\nload_gate_workers=4\ntest_timeout="11s"\nstall_timeout="12s"\n[verification.droplet]\nworkers=4\n';
const hubConfig = '[verification]\nworkers=1\nload_gate_workers=2\ntest_timeout="31s"\nstall_timeout="32s"\n[verification.droplet]\nworkers=2\n';

test('task queue executes the hub policy with explicit worker overrides', async t => {
  const root = await tempProject(t, 'cland-queue-policy-');
  const cwd = join(root, 'candidate');
  await mkdir(join(root, '.cland'));
  await writeFile(join(root, '.cland/config.toml'), candidateConfig);
  await writeFile(join(root, '.gitignore'), 'candidate/\n');
  const git = (...args: string[]) => promisify(execFile)('git', args, { cwd: root });
  await git('init', '-qb', 'dev');
  await git('config', 'user.name', 'Queue policy fixture');
  await git('config', 'user.email', 'fixture@example.invalid');
  await git('add', '.'); await git('commit', '-qm', 'candidate policy');
  await git('worktree', 'add', '-qb', 't/policy', cwd);
  await writeFile(join(root, '.cland/config.toml'), hubConfig);
  let config = parseConfig(await readFile(join(root, '.cland/config.toml'), 'utf8'), 'queue-policy', {});
  const delivered = new Map<string, RunRef>();
  // The executor boundary records exactly what the scheduler would deliver.
  t.mock.method(LocalExecutor.prototype, 'reap', async () => {});
  t.mock.method(LocalExecutor.prototype, 'holder', async () => null);
  let beforeAdmission = () => {};
  t.mock.method(LocalExecutor.prototype, 'occupied', async () => { beforeAdmission(); return false; });
  t.mock.method(LocalExecutor.prototype, 'start', async (_lease: Lease, run: RunRef) => { delivered.set(run.id, run); });
  t.mock.method(LocalExecutor.prototype, 'status', async () => ({ state: 'running' }));
  t.mock.method(DropletExecutor.prototype, 'checkSpend', async () => {});
  t.mock.method(DropletExecutor.prototype, 'acquire', async (run: RunRef, deadline: string): Promise<DropletLease> => ({
    kind: 'droplet', provider: 'digitalocean', run: run.id, lease: run.id, name: run.id,
    created: new Date().toISOString(), deadline, tags: ['cland'], size: 'c-8', region: 'lon1',
    priceHourly: 0, keyName: 'fake', keyId: null, resource: null, state: 'active',
  }));
  t.mock.method(DropletExecutor.prototype, 'deliver', async (_lease: DropletLease, run: RunRef) => { delivered.set(run.id, run); });
  t.mock.method(DropletExecutor.prototype, 'start', async (lease: DropletLease) => { lease.execution = { head: 'fixture', started: true }; });
  t.mock.method(DropletExecutor.prototype, 'status', async () => ({ state: 'running' }));
  t.mock.method(DropletExecutor.prototype, 'log', async () => ({ text: '', next: 0 }));
  t.mock.method(childProcess, 'spawn', ((command: string) => {
    assert.equal(command, 'npm', 'only the host typecheck boundary may spawn');
    const child = new EventEmitter();
    queueMicrotask(() => child.emit('close', 0));
    return child as ChildProcess;
  }) as typeof childProcess.spawn);
  syncBuiltinESMExports();
  const store = new Store(join(root, 'hub.db'));
  const suites = new Suites(store, root, async () => assert.fail('fake executor stays running'), {
    projectConfig: () => config, waitClock: new FakeClock(),
    env: { ...process.env, DIGITALOCEAN_TOKEN: 'fixture' }, locks: [join(root, 'lock')],
  });
  beforeDirectories(t, async () => { await suites.close(); store.close(); t.mock.restoreAll(); syncBuiltinESMExports(); });
  for (const [index, row] of [
    { executor: 'droplet', expected: 2 },
    { executor: 'droplet', workers: 3, expected: 3 },
    { executor: 'local', expected: 1, admittedWorkers: 5 },
  ].entries()) {
    const request = { mode: 'auto', cwd, topic: 'fixture', to: [], actor: { name: `impl-${index}`, sessionId: `caller-${index}`, shell: true as const }, executor: row.executor as 'local' | 'droplet', ...('workers' in row ? { workers: row.workers } : {}) };
    const preview = await suites.start({ ...request, dryRun: true }, () => {});
    assert.ok('dryRun' in preview);
    assert.equal(preview.workers, row.expected);
    // Reload after submission's snapshot but before the queued local admission.
    if ('admittedWorkers' in row) beforeAdmission = () => {
      config = parseConfig('[verification]\nworkers=5\nload_gate_workers=3\ntest_timeout="41s"\nstall_timeout="42s"\n', 'queue-policy', {});
    };
    const submitted = await suites.start(request, () => {});
    assert.ok('id' in submitted);
    const run = await eventually('executor receives task policy', () => delivered.get(submitted.id));
    const reloaded = 'admittedWorkers' in row;
    assert.equal(run.workers, reloaded ? 5 : row.expected);
    assert.deepEqual(run.limits, reloaded
      ? { workers: 5, loadGateWorkers: 3, testTimeoutMs: 41000, stallTimeoutMs: 42000 }
      : { workers: row.expected, loadGateWorkers: 2, testTimeoutMs: 31000, stallTimeoutMs: 32000 });
    const log = await readFile(run.log, 'utf8');
    assert.match(log, new RegExp(`Workers ${reloaded ? 5 : row.expected} · source ${'workers' in row ? 'explicit --workers' : 'hub config'} · admitted`));
  }
  // Admission still rejects invalid candidate policy even though it cannot set execution policy.
  await writeFile(join(cwd, '.cland/config.toml'), '[verification]\nworkers=0\n');
  await assert.rejects(suites.start({ mode: 'auto', cwd, topic: 'fixture', to: [], actor: null, dryRun: true }, () => {}), /workers.*positive/);

});
