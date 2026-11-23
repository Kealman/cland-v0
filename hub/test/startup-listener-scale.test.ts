// T3: production-scale retained state at the embedded hub listener boundary;
// Git facts are injected and no native hub child or provider is launched.
import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tempProject, projectHub, connectUi } from './harness.ts';
import { FakeClock } from './fake-clock.ts';
import { Store } from '../src/hub/store.ts';
import { serializeItem } from '../src/tracker/item.ts';
import { withPlan } from '../src/tracker/plan.ts';
import { seedPlanStageCover } from './plan-stage-fixture.ts';
import { within } from '../src/executor/droplet/deadline.ts';
import { stageCase } from './stage-case-fixture.ts';
import { sqliteProbe } from './sqlite-probe.ts';
import { Tracker } from '../src/tracker/tracker.ts';
import { testSetupWaitMs } from './until.ts';
import { ownedDatabases } from './owned-tracker.ts';

const branchCount = 1500;
// One base setup unit plus one per 500 retained answers. Sample load at acquisition.
const retainedHubSetupUnits = 1 + Math.ceil(branchCount / 500);

function waitForHubSetup<T>(owner: ReturnType<typeof stageCase>, start: () => Promise<T>, setupBoundMs: number) {
  return owner.wait('hub setup', start, setupBoundMs);
}

test('listener binds report each await while retained verdict freshness drains', { timeout: 120000 }, t => startupDrain(t, true));
test('1500 startup freshness answers keep summary hydration and dependent work linear', { timeout: 120000 }, t => startupDrain(t, false));

function censusDatabase(owner: ReturnType<typeof stageCase>, database: ReturnType<typeof sqliteProbe>, measure: boolean, stop?: () => Promise<void> | undefined) {
  const owned = ownedDatabases(owner, stop);
  return (path: string) => {
    const db = owned(path, database.open);
    // This case counts query work, not crash durability. Keep every SQL operation.
    if (!measure) db.exec('pragma synchronous = off');
    return db;
  };
}

function censusResources(owner: ReturnType<typeof stageCase>, database: ReturnType<typeof sqliteProbe>, measure: boolean) {
  let stopHub: (() => Promise<void>) | undefined;
  return {
    openDatabase: censusDatabase(owner, database, measure, () => stopHub?.()),
    acquire: async <T extends { dispose: () => Promise<void> }>(start: () => Promise<T>) => {
      const hub = await start();
      stopHub = () => hub.dispose();
      return hub;
    },
  };
}

test('work census closes its database when synchronization setup rejects', async t => {
  const owner = stageCase(t);
  let connection: ReturnType<ReturnType<typeof sqliteProbe>['open']> | undefined;
  t.after(() => { if (connection?.isOpen) connection.close(); });
  await owner.run(async step => {
    const root = await owner.wait('rejected pragma root setup', () => step(async () => {
      const root = await tempProject(owner.fixtures); owner.adoptRoot(root); return root;
    }));
    const database = sqliteProbe();
    const open = database.open;
    database.open = path => {
      const db = connection = open(path);
      owner.patch(db, 'exec', () => { throw new Error('injected synchronization setup failure'); });
      return db;
    };
    assert.throws(() => censusDatabase(owner, database, false)(join(root, 'census.db')), /injected synchronization setup failure/);
    assert.equal(connection?.isOpen, true, 'fault happened after acquisition');
  });
  await owner.close();
  assert.equal(connection?.isOpen, false, 'rejected setup connection has a positive close receipt');
});

test('work census joins a late hub disposal after its setup observation expires', async t => {
  const owner = stageCase(t);
  let disposed = false;
  let connection: ReturnType<ReturnType<typeof sqliteProbe>['open']> | undefined;
  const release = Promise.withResolvers<void>();
  owner.releaseOnClose(() => release.resolve());
  await owner.run(async step => {
    const root = await owner.wait('late hub root setup', () => step(async () => {
      const root = await tempProject(owner.fixtures); owner.adoptRoot(root); return root;
    }));
    const resources = censusResources(owner, sqliteProbe(), false);
    connection = resources.openDatabase(join(root, 'late.db'));
    await assert.rejects(waitForHubSetup(owner, () => step(() => resources.acquire(async () => {
      await release.promise;
      return { dispose: async () => {
        assert.equal(connection?.isOpen, true, 'hub disposal precedes database close');
        connection!.close();
        disposed = true;
      } };
    })), 1), /hub setup incomplete/);
  });
  await owner.close();
  assert.equal(disposed, true, 'late returned hub has a disposal receipt');
  assert.equal(connection?.isOpen, false, 'late hub database is closed');
});

async function startupDrain(t: TestContext, measure: boolean) {
  const owner = stageCase(t);
  await owner.run(async step => {
  const root = await owner.wait('root setup', () => step(async () => {
    const root = await tempProject(owner.fixtures); owner.adoptRoot(root); return root;
  }));
  const make = (path: string) => step(() => mkdir(path, { recursive: true }));
  const write = (path: string, content: string) => step(() => writeFile(path, content));
  const clock = new FakeClock();
  const at = clock.now().toISOString(), head = 'a'.repeat(40);
  await owner.wait('tracker seed setup', () => step(async () => {
  await make(join(root, '.cland/tasks'));
  for (let n = 0; n < branchCount; n++) await write(join(root, `.cland/tasks/T-${n + 1}-fixture.md`), serializeItem({
    fm: { id: `T-${n + 1}`, kind: 'task', size: 'S', title: `Retained verdict ${n}`, state: 'closed', status: 'done', labels: [], assignee: null,
      parent: 'E-1501', blocked_by: [], topic: null, branch: `t/${n}`, created: at, updated: at },
    body: '', comments: [{ author: 'reviewer', at, text: '', verdict: { verdict: 'review', result: 'clear', by: 'reviewer', run: `r${n}`, commit: (n + 1).toString(16).padStart(40, '0') } }],
  }));
  await write(join(root, '.cland/tasks/E-1501-fixture.md'), serializeItem({
    fm: { id: 'E-1501', kind: 'epic', title: 'Retained stage', state: 'open', labels: [], assignee: null, parent: null, blocked_by: [], topic: null, branch: null, created: at, updated: at },
    body: withPlan('', { stages: [{ name: 'retained', qa: { scope: 'none', when: 'after-stage' }, lanes: [Array.from({ length: branchCount }, (_, n) => `T-${n + 1}`)] }] }), comments: [],
  }));
  }));
  await owner.wait('suite and artifact seed setup', () => step(async () => {
  await step(() => seedPlanStageCover(root, head));
  const store = new Store(join(root, '.cland/hub.db'));
  try {
  store.createTopic('general', 'General', null, at);
  store.transaction(() => {
    for (let n = 0; n < (measure ? 8163 : 0); n++) store.registerArtifact(id => ({ id, kind: 'note', title: `Retained artifact ${n}`, creator: 'human', creatorKind: 'human',
      time: at, topic: 'general', status: 'shared', path: join(root, `.cland/artifacts/${id}.md`) }), () => {});
    const seeds = JSON.parse(store.meta('suite-jobs')!);
    store.setMeta('suite-jobs', JSON.stringify(Array.from({ length: measure ? 1645 : 2 }, (_, n) => ({ ...seeds[n % 2], id: `retained-${n}`, head: measure && n < 1643 ? 'b'.repeat(40) : head }))));
  });
  } finally { store.close(); }
  }));
  await owner.wait('lease seed setup', () => step(async () => {
  const leases = join(root, '.cland/run/executor/leases');
  await make(leases);
  for (let n = 0; n < (measure ? 4202 : 0); n++) {
    const dir = join(leases, `retained-${n}`);
    await make(dir);
    await write(join(dir, 'lease.json'), JSON.stringify({ kind: 'droplet', provider: 'digitalocean', lease: `retained-${n}`, run: `r${n}`, name: `retained-${n}`, tags: [], size: 'fixture', region: 'fixture', priceHourly: 0,
      keyName: 'fixture', keyId: null, resource: null, state: 'released', created: at, deadline: at, released: at }));
  }
  await write(join(root, '.cland/run/executor/lease-index.json'), JSON.stringify({ version: 1, leases: [] }));
  }));
  const entries: Record<string, unknown>[] = [];
  const database = sqliteProbe();
  const resources = censusResources(owner, database, measure);
  const openDatabase = resources.openDatabase;
  let census = false, summaries = 0, hydrated = 0, dependents = 0;
  const excess = Promise.withResolvers<{ summaries: number; hydrated: number }>();
  database.trace(owner.fixtures, (sql, method, _bindings, result) => {
    if (!census) return;
    if (method === 'all' && sql.startsWith('select b.blocker from tracker_blocked_by')) summaries++;
    const rows = Array.isArray(result) ? result : [result];
    hydrated += rows.filter(row => row && typeof row === 'object' && 'title' in row).length;
    if (summaries > branchCount * 10 || hydrated > branchCount * 40) {
      excess.resolve({ summaries, hydrated });
      census = false;
      throw new Error('fixture freshness work budget exceeded');
    }
  });
  const published = new Set<string>();
  const allPublished = Promise.withResolvers<void>();
  const completed = Promise.withResolvers<void>();
  const onChange = Tracker.prototype.onChange;
  owner.patch(Tracker.prototype, 'onChange', function(this: Tracker, ...args: Parameters<Tracker['onChange']>) {
    const [listener, batch] = args;
    return onChange.call(this, change => {
      if (census && change.id.startsWith('T-') && change.item?.verdicts.some(v => v.current !== undefined)) published.add(change.id);
      listener(change);
      if (published.size === branchCount) allPublished.resolve();
    }, batch ? (publish, completion) => {
      batch(publish, completion);
      void completion.then(receipt => {
        if (receipt.completed && published.size === branchCount) completed.resolve();
      }, error => completed.reject(error));
    } : undefined);
  });
  const entered = Promise.withResolvers<void>();
  let read: (() => Promise<void>) | undefined, binding = 0, bound = 0, answers = 0, computations = 0, serving = false, freshnessBeforeServing = false;
  const hubSetupStarted = performance.now();
  const hubSetupBound = testSetupWaitMs() * retainedHubSetupUnits;
  const hub = await waitForHubSetup(owner, () => step(() => resources.acquire(() => projectHub(owner.resources, root, {}, { clock, openDatabase, readBase: async () => null, stageTree: async () => 'f'.repeat(40),
    git: async args => {
      if (args[0] === 'rev-parse') { computations++; entered.resolve(); }
      return args[0] === 'for-each-ref' ? [`${head} refs/heads/dev`, ...Array.from({ length: branchCount }, (_, n) => `${head} refs/heads/t/${n}`)].join('\n')
        : args[0] === 'rev-parse' ? args.at(-1)!.replace(/\^\{commit\}$/, '') : '';
    },
    scheduleTips: callback => { freshnessBeforeServing ||= !serving; read = callback; return { poke() {}, stop() {} }; },
    log: entry => {
      entries.push(entry);
      if (entry.event === 'hub-startup-step') console.info(JSON.stringify({ startupStep: entry.step }));
      if (entry.event === 'serving') { serving = true; console.info(JSON.stringify({ serving: true, computations, answers })); }
      if (entry.event === 'hub-startup-step' && entry.step === 'binding listeners') binding = performance.now();
      if (entry.event === 'listening' && entry.socket) { bound = performance.now(); console.info(JSON.stringify({ socketBoundMs: bound - binding, answers })); }
      if (entry.event === 'task-freshness-settled') { answers += Number(entry.items); if (census) dependents += Number(entry.stageDependents); }
    },
  }))), hubSetupBound);
  console.info(JSON.stringify({ startupOutcome: 'hub acquired', setupMs: performance.now() - hubSetupStarted, setupBoundMs: hubSetupBound, computations, answers }));
  const ui = await owner.wait('transport setup', () => step(() => connectUi(owner.fixtures, hub.discovery)));
  // Arm the transport and the exact first-computation observer before starting
  // the drain; a polling timer can miss the whole drain and wake after its tail.
  const refreshing = owner.wait('freshness refresh', () => step(() => { census = true; return read!(); }));
  if (measure) {
  await owner.wait('first commit read', () => step(() => within(entered.promise, 2000, undefined, () => new Error('retained verdict drain did not enter a commit read'))));
  const requested = performance.now();
  const reply = await owner.wait('first task view reply', () => step(() => within(ui.request({ type: 'task.view', item: 'T-1' }), 2000, undefined, () => new Error('task.view did not answer during freshness drain within 2000 ms'))));
  const answered = { taskViewMs: performance.now() - requested, computations, answers, ok: reply.ok };
  console.info(JSON.stringify(answered));
  assert.equal(reply.ok, true, reply.error);
  assert.equal((reply.value as { item: { id: string } }).item.id, 'T-1');
  assert.ok(answered.computations < branchCount, `request interleaved after ${answered.computations} commit reads, before all ${branchCount} verdicts`); // lint-allow-wall-clock: counter captured beside latency at the actual reply proves the drain was incomplete, independent of elapsed time
  assert.ok(computations > 0, 'a commit read entered before the request');
  t.diagnostic(`task.view completed during drain in ${answered.taskViewMs} ms; bound 2000 ms; ${answered.computations} commit reads; ${answered.answers} published answers at reply`);
  }
  await refreshing;
  const exceeded = await owner.wait('all resolved freshness answers published or work budget exceeded', () => Promise.race([
    allPublished.promise.then(() => null), excess.promise,
  ]), 60000);
  census = false;
  const work = { branches: branchCount, computations, published: published.size, summaries, hydrated, dependents };
  t.diagnostic(`freshness work census (${exceeded ? 'budget exceeded, incomplete' : 'all answers published'}): ${JSON.stringify(work)}`);
  assert.equal(exceeded, null, `freshness work exceeded budget before completion: ${JSON.stringify(exceeded)}; ${published.size} resolved answers published`);
  assert.equal(published.size, branchCount, 'every branch has a published resolved freshness answer');
  assert.equal(computations, branchCount, 'one commit resolution per branch');
  assert.ok(summaries <= branchCount * 10, `summary budget 10 per answer: ${summaries}`);
  assert.ok(hydrated <= branchCount * 40, `hydration budget 40 per answer: ${hydrated}`);
  assert.equal(dependents, 0, 'unrelated answers announce no stage-cover dependents');
  await owner.wait('freshness producer completion receipt', () => completed.promise);
  assert.equal(serving, true, 'startup reached its serving receipt');
  assert.ok(bound >= binding && binding > 0, 'actual socket bind receipt follows admission');
  assert.equal(freshnessBeforeServing, false, 'freshness scheduling starts after serving');
  const timings = entries.filter(entry => entry.event === 'hub-startup-listener-completed');
  t.diagnostic(`${process.platform}/${process.arch}; embedded projectHub, fake Git, no browser; binding to socket receipt ${bound - binding} ms; report-only budget 2000 ms; ${branchCount} verdicts, ${measure ? 1645 : 2} suites, ${measure ? 8163 : 0} artifacts, ${measure ? 4202 : 0} released leases; listener awaits ${JSON.stringify(timings)}`);
  assert.deepEqual(timings.map(entry => entry.listener), ['websocket', 'spoke', 'socket']);
  assert.ok(timings.every(entry => entry.outcome === 'bound' && typeof entry.durationMs === 'number' && Number.isFinite(entry.durationMs) && entry.durationMs >= 0));
  const batches = entries.filter(entry => entry.event === 'task-freshness-settled');
  assert.ok(batches.length <= 3, `freshness drains ${batches.length}; bound 3`);
  });
}
