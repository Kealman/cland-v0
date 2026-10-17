// T1: Suites owns policy; candidate facts and local worker receipts are in-memory.
// The remote backend retains its real provider/lease accounting on scripted I/O.
import assert from 'node:assert/strict';
import type { TestContext } from 'node:test';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Store } from '../src/hub/store.ts';
import { Suites, type SuiteJob, type SuiteSchedulerOptions } from '../src/hub/suites.ts';
import { DropletExecutor } from '../src/executor/droplet/droplet.ts';
import { writeLease, type DropletLease } from '../src/executor/droplet/lease.ts';
import { LocalExecutor } from '../src/executor/local.ts';
import type { Lease, RunRef, RunStatus } from '../src/executor/executor.ts';
import { parseConfig } from '../src/init/config.ts';
import type { SuiteSelection } from '../src/suite-selection.ts';
import { keyHash } from '../src/executor/droplet/prepare.ts';
import { FakeClock } from './fake-clock.ts';
import { fakeDigitalOcean } from './fakes/digitalocean/fake-api.ts';
import { scriptedMachine } from './fakes/digitalocean/scripted-machine.ts';

export async function suiteUnit(t: TestContext, options: SuiteSchedulerOptions & { machineReceiptsOnly?: boolean } = {}, source = '', accounting = false) {
  const root = await mkdtemp(join(tmpdir(), 'suite-unit-'));
  const clock = new FakeClock();
  const token = 'suite-unit-token';
  const api = await fakeDigitalOcean(token, { machine: 'scripted', clock });
  api.faults.activeAfter = 0;
  const key = { node: process.version, nvim: { tag: 'v0.12.5', digest: 'a'.repeat(64) }, lock: 'b'.repeat(64), base: 'c'.repeat(40) };
  const machine = scriptedMachine(root, clock, key, { outcome: 'slow' });
  const configSource = `[verification]\n${source}`;
  let config = parseConfig(configSource, 'suite-unit', {});
  config.verification.executor = options.executor ?? 'local';
  config.verification.remoteBudget = options.remoteBudget ?? 2;
  const image = { id: 900, name: 'unit-snapshot', regions: ['lon1'], size_gigabytes: 1, min_disk_size: 10, created_at: clock.now().toISOString() };
  await api.seedSnapshot(image, key);
  await mkdir(join(root, '.cland/run/executor'), { recursive: true });
  await writeFile(join(root, '.cland/config.toml'), configSource);
  await writeFile(join(root, '.cland/run/executor/snapshot.json'), JSON.stringify({ image: image.id, name: image.name, key, keyHash: keyHash(key), regions: image.regions, sizeGb: 1, minDiskSize: 10, created: image.created_at }));
  const candidate = { head: 'a'.repeat(40), branch: 'candidate', tree: 'd'.repeat(40) as string | null,
    selection: { mode: 'hub-only', files: ['hub/src/example.ts'], reason: 'fixture' } as SuiteSelection };
  let changed = Promise.withResolvers<void>();
  const publish = () => { const old = changed; changed = Promise.withResolvers<void>(); old.resolve(); };
  const logs: Record<string, unknown>[] = [], notices: string[] = [], shardingNotices: string[] = [], reports: SuiteJob[] = [];
  const acquisitions: string[] = [];
  const delivered = new Map<string, RunRef>(), receipts = new Map<string, RunStatus>();
  let held = false;
  let holder: Awaited<ReturnType<LocalExecutor['holder']>> = null;
  const lease = (run: RunRef, deadline: string): Lease => ({ kind: 'local', run: run.id, created: clock.now().toISOString(), deadline, resource: null });
  t.mock.method(LocalExecutor.prototype, 'reap', async () => {});
  t.mock.method(LocalExecutor.prototype, 'holder', async () => holder);
  t.mock.method(LocalExecutor.prototype, 'occupied', async () => held);
  t.mock.method(LocalExecutor.prototype, 'restore', (run: RunRef) => lease(run, clock.now().toISOString()));
  t.mock.method(LocalExecutor.prototype, 'acquire', async (run: RunRef, deadline: string) => lease(run, deadline));
  t.mock.method(LocalExecutor.prototype, 'prepare', async () => {});
  t.mock.method(LocalExecutor.prototype, 'deliver', async () => {});
  t.mock.method(LocalExecutor.prototype, 'start', async (_lease: Lease, run: RunRef) => { delivered.set(run.id, structuredClone(run)); publish(); });
  t.mock.method(LocalExecutor.prototype, 'status', async (lease: Lease) => receipts.get(lease.run) ?? { state: 'running' });
  t.mock.method(LocalExecutor.prototype, 'release', async () => ({ lifetimeMs: null, costUsd: null }));
  t.mock.method(LocalExecutor.prototype, 'cancel', async () => {});
  if (!accounting) {
    // Suites policy gets semantic executor receipts. OS lock/spend integration
    // uses the real backend only in suite-accounting.test.ts (T2).
    t.mock.method(DropletExecutor.prototype, 'checkSpend', async () => {});
    t.mock.method(DropletExecutor.prototype, 'acquire', async (run: RunRef, deadline: string): Promise<DropletLease> => {
      const created = clock.now().toISOString(), size = run.size ?? 'c-8';
      acquisitions.push(run.id);
      // Pure scheduler rules consume executor receipts without creating provider resources.
      const machine = options.machineReceiptsOnly ? { id: acquisitions.length, name: `cland-${run.id}`, tags: ['cland'] } : await api.provider.create({ name: `cland-${run.id}`, tags: ['cland'], size, region: 'lon1', image: 900, ssh_keys: [] });
      const lease: DropletLease = { kind: 'droplet', provider: 'digitalocean', run: run.id, lease: run.id, name: machine.name, tags: machine.tags, size, region: 'lon1', priceHourly: 0.25, keyName: run.id, created, deadline, state: 'active', resource: machine.id, keyId: null };
      await writeLease(root, lease); return lease;
    });
    t.mock.method(DropletExecutor.prototype, 'release', async (lease: DropletLease) => {
      if (!options.machineReceiptsOnly && lease.resource !== null) { await api.provider.deleteDroplet(lease.resource); await api.provider.droplet(lease.resource).catch(() => {}); }
      lease.state = 'released'; await writeLease(root, lease); return { lifetimeMs: 0, costUsd: 0 };
    });
  }
  const database = join(root, 'hub.db');
  let store = new Store(database);
  const watchStore = () => {
    const save = store.setMeta.bind(store);
    t.mock.method(store, 'setMeta', (key: string, value: string) => { save(key, value); publish(); });
  };
  watchStore();
  let inspectBarrier = async () => {};
  let beforeReport = async (_job: Readonly<SuiteJob>) => {};
  const make = () => new Suites(store, root, async (job, checkpoint) => {
    await beforeReport(job);
    const artifact = store.registerArtifact(id => ({ id, title: job.id, kind: 'file', path: job.log, creator: 'hub', time: clock.now().toISOString(), topic: job.topic, status: 'shared' }), () => {});
    checkpoint(artifact.id); reports.push(structuredClone(job)); publish();
  }, { clock, candidate: {
    head: async () => candidate.head,
    tree: async () => candidate.tree,
    inspect: async () => { await inspectBarrier(); return { ...structuredClone(candidate), tierPlan: [], budgetBase: undefined }; },
  }, projectConfig: () => config, env: { DIGITALOCEAN_TOKEN: token, CLAND_EXECUTOR_STATE: join(root, '.cland/executor-state'), CLAND_TEST_DROPLET_POLL_MS: '20', CLAND_TEST_DROPLET_RUN_POLL_MS: '1', CLAND_TEST_DROPLET_MACHINE_MS: '20', CLAND_TEST_DROPLET_RELEASE_MS: '20' },
  dropletServices: { ...machine.dependencies, api: api.provider, hostGate: async run => ({ tree: run.tree ?? null, command: ['run', 'typecheck'], code: 0 }) },
  log: entry => { logs.push(entry); publish(); }, onFallback: job => { notices.push(job.id); publish(); }, onShardingSkipped: (_job, cause) => { shardingNotices.push(cause); publish(); }, onJob: publish, onQueue: publish, ...options });
  let suites = make();
  const releases = new Set<() => void>();
  const submissions = new Set<Promise<unknown>>();
  let closing: Promise<void> | undefined;
  const close = () => closing ??= (async () => {
    // Gates can outlive a failed pre-release assertion. Release them before
    // draining admission; closing the store/root must follow that completion.
    for (const release of releases) release();
    releases.clear();
    await Promise.allSettled(submissions);
    await suites.settled();
    await suites.close();
    store.close();
    if (process.env.CLAND_TEST_REMOTE_CENSUS) t.diagnostic(`remote census: ${api.requests.filter(r => r.method === 'POST' && r.path === '/v2/droplets').length} droplets; 0 initial daemon starts`);
    await api.close();
    await rm(root, { recursive: true, force: true });
  })();
  t.after(close);
  async function when<T>(read: () => T | undefined): Promise<T> {
    for (;;) { const notification = changed.promise; const value = read(); if (value !== undefined) return value; await notification; }
  }
  let sequence = 0;
  const launch = (input: Partial<Parameters<Suites['start']>[0]> = {}) => {
    const name = `caller-${++sequence}`;
    const work = machine.waits.run(suites.start({ mode: 'auto', cwd: root, topic: 'unit-topic', to: ['reviewer'], actor: { name, sessionId: name, shell: true }, ...input }, () => {})).then(result => {
      assert.ok('id' in result);
      return result;
    });
    submissions.add(work);
    void work.finally(() => submissions.delete(work)).catch(() => {});
    return work;
  };
  async function tick(ms = 1000) { await clock.advance(ms); }
  const status = (id: string) => suites.status().find(job => job.id === id)!;
  const result = (id: string) => when(() => status(id)?.reported ? status(id) : undefined);
  async function finish(id: string, code = 0, log = '# tests 1\n# pass 1\n', report = true) {
    await suites.settled();
    if (status(id).executor === 'droplet') machine.finish(id, code, log);
    else {
      const run = delivered.get(id); assert.ok(run, 'observe worker admission before completion');
      await writeFile(run.log, log);
      receipts.set(id, { state: 'done', code, finished: clock.now().toISOString(), platform: { os: 'darwin', arch: 'arm64', release: 'fixture', node: process.version, nvim: 'v0.12.5' } });
    }
    await tick();
    if (report) return machine.waits.run(result(id));
    await machine.waits.run(when(() => status(id).outcome ?? undefined));
    await suites.settled();
    return status(id);
  }
  async function reopen(jobs?: SuiteJob[]) { await suites.close(); store.close(); store = new Store(database); watchStore(); if (jobs) store.setMeta('suite-jobs', JSON.stringify(jobs)); suites = make(); }
  return { root, clock, api, machine, acquisitions, candidate, logs, notices, shardingNotices, reports, delivered, receipts, when, launch, tick, result, status, finish, reopen, close,
    ownIO(release: () => void) { releases.add(release); },
    get suites() { return suites; }, get store() { return store; }, get config() { return config; },
    beforeReport(barrier: typeof beforeReport) { beforeReport = barrier; },
    beforeInspect(barrier: () => Promise<void>) { inspectBarrier = barrier; },
    configure(source: string) { config = parseConfig(source, 'suite-unit', {}); suites.configure(config); },
    hold(value: boolean, valueHolder: typeof holder = null) { held = value; holder = valueHolder; },
    async jobs() { return JSON.parse(store.meta('suite-jobs')!) as SuiteJob[]; },
    async log(id: string) { return readFile(join(root, '.cland/run/suites', id, 'suite.log'), 'utf8'); },
  };
}
