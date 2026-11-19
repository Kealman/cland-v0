// T3: production-scale retained state at the embedded hub listener boundary;
// Git facts are injected and no native hub child or provider is launched.
import test from 'node:test';
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

test('listener binds report each await while retained verdict freshness drains', { timeout: 120000 }, async t => {
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
  for (let n = 0; n < 375; n++) await write(join(root, `.cland/tasks/T-${n + 1}-fixture.md`), serializeItem({
    fm: { id: `T-${n + 1}`, kind: 'task', size: 'S', title: `Retained verdict ${n}`, state: 'closed', status: 'done', labels: [], assignee: null,
      parent: 'E-1501', blocked_by: [], topic: null, branch: `t/${n}`, created: at, updated: at },
    body: '', comments: [{ author: 'reviewer', at, text: '', verdict: { verdict: 'review', result: 'clear', by: 'reviewer', run: `r${n}`, commit: (n + 1).toString(16).padStart(40, '0') } }],
  }));
  await write(join(root, '.cland/tasks/E-1501-fixture.md'), serializeItem({
    fm: { id: 'E-1501', kind: 'epic', title: 'Retained stage', state: 'open', labels: [], assignee: null, parent: null, blocked_by: [], topic: null, branch: null, created: at, updated: at },
    body: withPlan('', { stages: [{ name: 'retained', qa: { scope: 'none', when: 'after-stage' }, lanes: [Array.from({ length: 375 }, (_, n) => `T-${n + 1}`)] }] }), comments: [],
  }));
  }));
  await owner.wait('suite and artifact seed setup', () => step(async () => {
  await step(() => seedPlanStageCover(root, head));
  const store = new Store(join(root, '.cland/hub.db'));
  try {
  store.createTopic('general', 'General', null, at);
  store.transaction(() => {
    for (let n = 0; n < 8163; n++) store.registerArtifact(id => ({ id, kind: 'note', title: `Retained artifact ${n}`, creator: 'human', creatorKind: 'human',
      time: at, topic: 'general', status: 'shared', path: join(root, `.cland/artifacts/${id}.md`) }), () => {});
    const seeds = JSON.parse(store.meta('suite-jobs')!);
    store.setMeta('suite-jobs', JSON.stringify(Array.from({ length: 1645 }, (_, n) => ({ ...seeds[n % 2], id: `retained-${n}`, head: n < 1643 ? 'b'.repeat(40) : head }))));
  });
  } finally { store.close(); }
  }));
  await owner.wait('lease seed setup', () => step(async () => {
  const leases = join(root, '.cland/run/executor/leases');
  for (let n = 0; n < 4202; n++) {
    const dir = join(leases, `retained-${n}`);
    await make(dir);
    await write(join(dir, 'lease.json'), JSON.stringify({ kind: 'droplet', provider: 'digitalocean', lease: `retained-${n}`, run: `r${n}`, name: `retained-${n}`, tags: [], size: 'fixture', region: 'fixture', priceHourly: 0,
      keyName: 'fixture', keyId: null, resource: null, state: 'released', created: at, deadline: at, released: at }));
  }
  await write(join(root, '.cland/run/executor/lease-index.json'), JSON.stringify({ version: 1, leases: [] }));
  }));
  const entries: Record<string, unknown>[] = [];
  const entered = Promise.withResolvers<void>();
  let read: (() => Promise<void>) | undefined, binding = 0, bound = 0, answers = 0, computations = 0, serving = false, freshnessBeforeServing = false;
  const hub = await owner.wait('hub setup', () => step(() => projectHub(owner.resources, root, {}, { clock, readBase: async () => null, stageTree: async () => 'f'.repeat(40),
    git: async args => {
      if (args[0] === 'rev-parse') { computations++; entered.resolve(); }
      return args[0] === 'for-each-ref' ? [`${head} refs/heads/dev`, ...Array.from({ length: 375 }, (_, n) => `${head} refs/heads/t/${n}`)].join('\n')
        : args[0] === 'rev-parse' ? args.at(-1)!.replace(/\^\{commit\}$/, '') : '';
    },
    scheduleTips: callback => { freshnessBeforeServing ||= !serving; read = callback; return { poke() {}, stop() {} }; },
    log: entry => {
      entries.push(entry);
      if (entry.event === 'hub-startup-step') console.info(JSON.stringify({ startupStep: entry.step }));
      if (entry.event === 'serving') { serving = true; console.info(JSON.stringify({ serving: true, computations, answers })); }
      if (entry.event === 'hub-startup-step' && entry.step === 'binding listeners') { binding = performance.now(); void read?.(); }
      if (entry.event === 'listening' && entry.socket) { bound = performance.now(); console.info(JSON.stringify({ socketBoundMs: bound - binding, answers })); }
      if (entry.event === 'task-freshness-settled') answers += Number(entry.items);
    },
  })));
  const ui = await owner.wait('transport setup', () => step(() => connectUi(owner.fixtures, hub.discovery)));
  // Arm the transport and the exact first-computation observer before starting
  // the drain; a polling timer can miss the whole drain and wake after its tail.
  const refreshing = owner.wait('freshness refresh', () => step(() => read!()));
  await owner.wait('first commit read', () => step(() => within(entered.promise, 2000, undefined, () => new Error('retained verdict drain did not enter a commit read'))));
  const requested = performance.now();
  const reply = await owner.wait('first task view reply', () => step(() => within(ui.request({ type: 'task.view', item: 'T-1' }), 2000, undefined, () => new Error('task.view did not answer during freshness drain within 2000 ms'))));
  const answered = { taskViewMs: performance.now() - requested, computations, answers, ok: reply.ok };
  console.info(JSON.stringify(answered));
  assert.equal(reply.ok, true, reply.error);
  assert.equal((reply.value as { item: { id: string } }).item.id, 'T-1');
  assert.ok(computations < 375, `request interleaved after ${computations} commit reads, before all 375 verdicts`);
  assert.ok(computations > 0, 'a commit read entered before the request');
  await refreshing;
  t.diagnostic(`task.view completed during drain in ${answered.taskViewMs} ms; bound 2000 ms; ${answered.computations} commit reads; ${answered.answers} published answers at reply`);
  assert.ok(bound >= binding && binding > 0, 'actual socket bind receipt follows admission');
  assert.equal(freshnessBeforeServing, false, 'freshness scheduling starts after serving');
  const timings = entries.filter(entry => entry.event === 'hub-startup-listener-completed');
  t.diagnostic(`${process.platform}/${process.arch}; local embedded projectHub; binding to socket receipt ${bound - binding} ms; report-only budget 2000 ms; 375 verdicts, 1645 suites, 8163 artifacts, 4202 released leases; listener awaits ${JSON.stringify(timings)}`);
  assert.deepEqual(timings.map(entry => entry.listener), ['websocket', 'spoke', 'socket']);
  assert.ok(timings.every(entry => entry.outcome === 'bound' && typeof entry.durationMs === 'number' && Number.isFinite(entry.durationMs) && entry.durationMs >= 0));
  const batches = entries.filter(entry => entry.event === 'task-freshness-settled');
  assert.ok(batches.length <= 3, `freshness drains ${batches.length}; bound 3`);
  });
});
