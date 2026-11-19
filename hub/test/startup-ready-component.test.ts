// T2: embedded startup publishes timed phases and serves before held ready-check
// storage or provider recovery finishes. No hub child is launched.
import test from 'node:test';
import assert from 'node:assert/strict';
import files from 'node:fs/promises';
import childProcess, { type ChildProcess } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { syncBuiltinESMExports } from 'node:module';
import { runFixtureHub as runHub } from './fixture-hub-cli.ts';
import { Tracker, type ItemView, type AnnouncementBatchReceipt } from '../src/tracker/tracker.ts';
import { join } from 'node:path';
import { connectUi, eventually, fixtureLockIdentity, projectHub, tempProject, until } from './harness.ts';
import { fixtureWork } from './fixture-work.ts';
import { fixtureEnvironment } from './fixture-environment.ts';
import { FakeClock } from './fake-clock.ts';
import { fakeDigitalOcean } from './fakes/digitalocean/fake-api.ts';
import { readLeaseHistory, writeLease } from '../src/executor/droplet/lease.ts';
import { onCleanup } from './process-cleanup.ts';
import type { HubStatus } from '../src/protocol.ts';
import { within } from '../src/executor/droplet/deadline.ts';
import { stageCase } from './stage-case-fixture.ts';
import { Server, createServer } from 'node:net';
import { ExplorerFieldsIndex } from '../src/tracker/explorer-fields.ts';
import { serializeItem } from '../src/tracker/item.ts';

for (const stopping of [false, true]) test(`yielded freshness batches ${stopping ? 'are joined and fenced by stop' : 'finish before the next producer publishes'}`, async t => {
  const owner = stageCase(t);
  await owner.run(async step => {
    const root = await owner.wait('root setup', () => step(async () => {
      const root = await tempProject(owner.fixtures); owner.adoptRoot(root); return root;
    }));
    const head = 'a'.repeat(40), clock = new FakeClock(), at = clock.now().toISOString();
    await owner.wait('tracker seed setup', () => step(async () => {
      await step(() => files.mkdir(join(root, '.cland/tasks'), { recursive: true }));
      for (let n = 1; n <= 65; n++) await step(() => files.writeFile(join(root, `.cland/tasks/${n === 1 ? 'E' : 'T'}-${n}-fixture.md`), serializeItem({
        fm: { id: `${n === 1 ? 'E' : 'T'}-${n}`, kind: n === 1 ? 'epic' : 'task', title: `Row ${n}`, state: 'closed',
          ...(n === 1 ? {} : { status: 'done', size: 'S' }), parent: n === 1 ? null : 'E-1', branch: n === 1 ? null : 't/shared',
          labels: [], assignee: null, blocked_by: [], topic: null, created: at, updated: at }, body: '',
        comments: n === 1 ? [] : [{ author: 'reviewer', at, text: '', verdict: { verdict: 'review', result: 'clear', by: 'reviewer', run: `r${n}`, commit: 'b'.repeat(40) } }],
      })));
    }));
    const settled = Promise.withResolvers<void>(), paused = Promise.withResolvers<void>(), published = Promise.withResolvers<void>();
    const tracker = new Tracker({ root, db: ':memory:', clock, stageTree: async () => null,
      git: async args => args[0] === 'for-each-ref' ? `${head} refs/heads/t/shared` : args[0] === 'rev-parse' ? head : null,
      readBase: async () => null, scheduleTips: () => ({ poke() {}, stop() {} }), watch: () => ({ close() {} }),
      log: entry => { if (entry.event === 'task-freshness-settled') settled.resolve(); },
    });
    owner.requireClose(() => tracker.stop());
    await owner.wait('tracker setup', () => step(() => tracker.start({ deferFreshness: true, deferReadyChecks: true })));
    const updates: Array<{ id: string; completed: number }> = [], notifications: string[][] = [];
    let completed = 0, holdNext = false, resume = () => {}, stopSettled = false, yieldedContinuationRan = false;
    let stopCalled = false, chunkPublications = 0, refreshesAfterStop = 0, publicationsAfterStop = 0, notificationsAfterStop = 0;
    const producers = new Map<Promise<AnnouncementBatchReceipt>, string[]>(), producerWork: Promise<void>[] = [];
    let activeProducer: Promise<AnnouncementBatchReceipt> | undefined;
    owner.requireClose(async () => { await Promise.allSettled(producerWork); });
    const immediate = globalThis.setImmediate, update = ExplorerFieldsIndex.prototype.update;
    owner.patch(globalThis, 'setImmediate', (callback: (...args: unknown[]) => void, ...args: unknown[]) => {
      if (!holdNext) return immediate(callback, ...args);
      holdNext = false; resume = () => { yieldedContinuationRan = true; callback(...args); }; paused.resolve();
      return immediate(() => {});
    });
    owner.releaseOnClose(() => resume());
    owner.patch(ExplorerFieldsIndex.prototype, 'update', function(this: ExplorerFieldsIndex, ...args: Parameters<ExplorerFieldsIndex['update']>) {
      updates.push({ id: args[0], completed });
      if (stopCalled) refreshesAfterStop++;
      if (updates.length === 16) holdNext = true;
      return update.apply(this, args);
    });
    let current: string[] = [];
    tracker.onChange(change => {
      if (stopCalled) notificationsAfterStop++;
      current.push(change.id);
    }, (publish, completion) => {
      if (completion !== activeProducer) {
        assert.equal(producers.has(completion), false, 'publication never returns to an older producer');
        assert.equal(completed, producers.size, 'every earlier producer finishes before the next producer publishes');
        activeProducer = completion;
        const rows: string[] = []; producers.set(completion, rows);
        const observation = owner.wait('whole announcement producer completion', () => step(async () => {
          const receipt = await completion;
          if (receipt.completed) {
            notifications.push(rows); completed++;
            if (completed === 2) published.resolve();
          }
        }));
        producerWork.push(observation); void observation.catch(() => {});
      }
      chunkPublications++;
      if (stopCalled) publicationsAfterStop++;
      current = []; publish(); producers.get(completion)!.push(...current);
    });
    const closeOrder: string[] = [];
    const refreshing = step(() => tracker.refreshFreshness()).then(() => { closeOrder.push('freshness completed'); });
    void refreshing.catch(() => {});
    try {
      await owner.wait('first batch yielded', () => paused.promise);
      await owner.wait('settled producer queued during first batch', () => settled.promise);
      if (stopping) {
        const beforeStop = chunkPublications;
        stopCalled = true;
        const stopped = tracker.stop().then(() => {
          assert.equal(yieldedContinuationRan, true, 'stop follows the owned continuation receipt');
          closeOrder.push('stop completed'); stopSettled = true;
        });
        // A positive stop-close receipt follows the captured continuation, not
        // merely a timeout or a snapshot saying the worker is no longer running.
        resume();
        await owner.wait('owned batch and stop close receipts', () => Promise.all([refreshing, stopped]));
        assert.equal(stopSettled, true);
        assert.deepEqual(closeOrder, ['freshness completed', 'stop completed'], 'stop closes after the full freshness owner settles');
        assert.equal(completed, 0, 'stop fences the in-flight and queued publications');
        assert.equal(chunkPublications - beforeStop, 0, 'no chunk publication starts after stop');
        assert.equal(publicationsAfterStop, 0);
        assert.equal(refreshesAfterStop, 0, 'no source refresh starts after stop');
        assert.equal(notificationsAfterStop, 0, 'no item notification follows stop');
        assert.equal(updates.length, 16, 'no row refresh follows stop');
        assert.deepEqual(notifications, []);
      } else {
        resume();
        await owner.wait('both announcement batches completed', () => Promise.all([refreshing, published.promise]));
        assert.equal(completed, 2);
        const boundary = updates.findIndex(update => update.completed === 1);
        assert.equal(boundary, 65, 'the first 65-row batch completes before any settled-batch source refresh');
        for (const batch of [0, 1]) {
          const ids = updates.filter(update => update.completed === batch).map(update => update.id);
          assert.ok(ids.length >= 2 && ids.length <= 65);
          assert.equal(new Set(ids).size, ids.length, 'each ancestor and source refreshes once per batch');
          assert.ok(notifications[batch]!.filter(id => id === 'E-1').length <= 1, 'a changed ancestor is announced once');
        }
        assert.equal(notifications.flat().filter(id=>id==='E-1').length,1,'the changed ancestor retains its notification');
        assert.equal(tracker.list().find(item => item.id === 'T-65')!.verdicts[0]!.current, true, 'settled batch retains the final child answer');
      }
      await owner.wait('all original producer observations joined', () => Promise.all(producerWork));
    } finally { resume(); await refreshing; }
  });
});

for (const failedBind of [false, true]) test(`listener timing sink failure preserves ${failedBind ? 'the original bind failure and closes earlier edges' : 'acquired listeners through normal cleanup'}`, async t => {
  const owner = stageCase(t);
  await owner.run(async step => {
    const root = await owner.wait('root setup', () => step(async () => {
      const root = await tempProject(owner.fixtures); owner.adoptRoot(root); return root;
    }));
    const bindFailure = new Error('controlled socket bind failure');
    const sinkFailure = new Error('controlled listener diagnostic failure');
    const listen = Server.prototype.listen;
    let attempts = 0, sinkThrows = 0;
    const ports: number[] = [], paths: string[] = [];
    const servers = new Set<Server>();
    // Register this fallback before projectHub's checks: a regression must not
    // let a failed resource census strand the captured native listeners.
    owner.requireClose(async () => {
      for (const server of servers) if (server.listening) await new Promise<void>(resolve => server.close(() => resolve()));
    });
    owner.patch(Server.prototype, 'listen', function(this: Server, ...args: Parameters<Server['listen']>) {
      servers.add(this);
      if (++attempts === 3 && failedBind) throw bindFailure;
      return listen.apply(this, args);
    });
    const starting = owner.wait('hub setup', () => step(() => projectHub(owner.resources, root, {}, {
      stageTree: async () => null,
      log: entry => {
        if (entry.event === 'listening' && typeof entry.url === 'string') {
          if (entry.url.startsWith('ws://')) ports.push(Number(new URL(entry.url).port));
          const unix = /^ws\+unix:(.*):\/$/.exec(entry.url); if (unix) paths.push(unix[1]!);
        }
        if (entry.event === 'listening' && typeof entry.socket === 'string') paths.push(entry.socket);
        if ((entry.event === 'hub-startup-listener-completed' && (!failedBind || entry.outcome === 'failed')) || entry.event === 'hub-startup-listener-log-failed') {
          sinkThrows++; throw sinkFailure;
        }
      },
    })));
    if (failedBind) await assert.rejects(starting, error => error === bindFailure);
    else {
      const hub = await starting;
      await owner.wait('listener owner stopped', () => step(() => hub.stop()));
    }
    assert.ok(sinkThrows > 0, 'the diagnostic fault was exercised');
    assert.equal(ports.length, 1, 'the actual TCP listener was acquired');
    for (const path of paths) await owner.wait('Unix listener removal receipt', () => step(() => assert.rejects(files.lstat(path), { code: 'ENOENT' })));
    const probe = createServer();
    owner.requireClose(() => new Promise<void>(resolve => probe.close(() => resolve())));
    await owner.wait('TCP listener release receipt', () => step(() => new Promise<void>((resolve, reject) => {
      probe.once('error', reject); probe.listen(ports[0]!, '127.0.0.1', resolve);
    })));
    await owner.wait('TCP probe stopped', () => step(() => new Promise<void>(resolve => probe.close(() => resolve()))));
  });
});

test('one freshness announcement batch refreshes the hub topic context once', async t => {
  const owner = stageCase(t);
  await owner.run(async step => {
  const root = await owner.wait('root setup', () => step(async () => {
    const root = await tempProject(owner.fixtures); owner.adoptRoot(root); return root;
  }));
  const clock = new FakeClock(), head = 'a'.repeat(40);
  const { serializeItem } = await import('../src/tracker/item.ts');
  const { Store } = await import('../src/hub/store.ts');
  const at = clock.now().toISOString();
  await owner.wait('tracker seed setup', () => step(async () => {
  await step(() => files.mkdir(join(root, '.cland/tasks'), { recursive: true }));
  for (let n = 1; n <= 4; n++) await step(() => files.writeFile(join(root, `.cland/tasks/T-${n}-fixture.md`), serializeItem({
    fm: { id: `T-${n}`, kind: 'task', title: `Retained ${n}`, state: 'closed', status: 'done', size: 'S', labels: [], assignee: null, parent: null,
      blocked_by: [], topic: null, branch: `t/${n}`, created: at, updated: at }, body: '',
    comments: [{ author: 'reviewer', at, text: '', verdict: { verdict: 'review', result: 'clear', by: 'reviewer', run: `r${n}`, commit: head } }],
  })));
  }));
  let refresh: (() => Promise<void>) | undefined;
  const hub = await owner.wait('hub setup', () => step(() => projectHub(owner.resources, root, {}, { clock, stageTree: async () => 'f'.repeat(40),
    git: async args => args[0] === 'for-each-ref' ? Array.from({ length: 4 }, (_, n) => `${head} refs/heads/t/${n + 1}`).join('\n') : null,
    readBase: async () => null, scheduleTips: read => { refresh = read; return { poke() {}, stop() {} }; },
  })));
  let topicReads = 0;
  const topics = Store.prototype.topics;
  owner.patch(Store.prototype, 'topics', function(this: InstanceType<typeof Store>) { topicReads++; return topics.call(this); });
  await owner.wait('freshness batch receipt', () => step(() => refresh!()));
  assert.equal(topicReads, 1, 'one full topic-context read for four freshness announcements');
  const ui = await owner.wait('transport setup', () => step(() => connectUi(owner.fixtures, hub.discovery)));
  const reply = await owner.wait('last item reply', () => step(() => ui.request({ type: 'task.view', item: 'T-4' })));
  assert.equal(reply.ok, true, reply.error);
  assert.equal((reply.value as { item: ItemView }).item.verdicts[0]?.current, true, 'the last announced item retains its freshness');
  });
});

test('startup logs named durations for every step from listener binding through serving', async t => {
  const root = await tempProject(t);
  const entries: Record<string, unknown>[] = [];
  await projectHub(t, root, {}, { log: entry => { entries.push(entry); } });
  const binding = entries.findIndex(entry => entry.event === 'hub-startup-step' && entry.step === 'binding listeners');
  const serving = entries.findIndex(entry => entry.event === 'serving');
  const window = entries.slice(binding, serving);
  assert.deepEqual(window.filter(entry => entry.event === 'hub-startup-listener-completed').map(entry => entry.listener), ['websocket', 'spoke', 'socket']);
  const starts = window.filter(entry => entry.event === 'hub-startup-step');
  assert.deepEqual(starts.map(entry => entry.step), ['binding listeners', 'binding web listener', 'restoring sessions', 'publishing discovery']);
  for (const start of starts) {
    const completion = window.find(entry => entry.event === 'hub-startup-step-completed' && entry.step === start.step);
    assert.ok(completion, `${start.step} logs its completion`);
    assert.ok(window.indexOf(completion) > window.indexOf(start), `${start.step} completes after it starts`);
    assert.ok(typeof completion.durationMs === 'number' && Number.isFinite(completion.durationMs) && completion.durationMs >= 0, `${start.step} logs a monotonic duration`);
  }
});

test('startup restores sessions and serves before recovering a lease with a hanging provider', async t => {
  const root = await tempProject(t);
  const clock = new FakeClock();
  const token = 'cland-test-startup-recovery';
  const api = await fakeDigitalOcean(token, { machine: 'scripted', clock });
  const release = Promise.withResolvers<void>();
  let entered = false, providerBeforeServing = false;
  let listening: number | undefined, restoring: number | undefined, serving: number | undefined;
  const entries: Record<string, unknown>[] = [];
  api.beforeDropletList(async () => {
    entered = true;
    providerBeforeServing ||= serving === undefined;
    await release.promise;
  });
  await files.mkdir(join(root, '.cland/run'), { recursive: true });
  await writeLease(root, {
    kind: 'droplet', provider: 'digitalocean', lease: 'orphan', run: 'orphan-run',
    name: 'cland-startup-orphan', tags: ['cland'], size: 'c-8', region: 'lon1', priceHourly: 0.25,
    keyName: 'cland-startup-orphan', keyId: null, resource: null, state: 'releasing',
    created: clock.now().toISOString(), deadline: clock.now().toISOString(),
  });
  let starting: ReturnType<typeof projectHub> | undefined;
  onCleanup(t, async () => {
    release.resolve();
    try { if (starting) await (await starting).stop(); }
    finally { await api.close(); }
  });
  starting = projectHub(t, root, {}, {
    clock, droplet: { api: api.provider, processes: { alive: pid => pid === process.pid, started: () => null } },
    syntheticProvider: { token, api: api.provider },
    log: entry => {
      entries.push(entry);
      if (entry.event === 'listening') listening ??= performance.now();
      if (entry.event === 'hub-startup-step' && entry.step === 'restoring sessions') restoring = performance.now();
      if (entry.event === 'serving') serving = performance.now();
    },
  });
  await until(() => listening !== undefined, { what: 'startup listener receipt', timeoutMs: 15000 });
  await until(() => serving !== undefined, { what: 'serving receipt with provider held', timeoutMs: 2000, loadFactor: 1 });
  const hub = await starting;
  assert.ok(restoring !== undefined && restoring - listening! < 2000, 'sessions restore within two seconds of listening');
  const gap = serving! - listening!;
  assert.ok(gap < 2000, `listening to serving took ${gap.toFixed(3)} ms; bound 2000 ms`);
  await until(() => entered, { what: 'lease recovery provider call entered', timeoutMs: 15000 });
  assert.equal(providerBeforeServing, false, 'provider recovery starts only after serving');
  const ui = await connectUi(t, hub.discovery);
  assert.equal((await ui.request({ type: 'hub.status' })).ok, true, 'status replies while provider is held');
  assert.equal((await readLeaseHistory(root))[0]!.state, 'releasing');
  release.resolve();
  await until(() => entries.some(entry => entry.event === 'executor-sweep'), { what: 'recovery completion receipt', timeoutMs: 15000 });
  assert.equal((await readLeaseHistory(root))[0]!.state, 'released');
  const recovery = entries.findIndex(entry => entry.event === 'executor-recovery-started');
  assert.ok(recovery > entries.findIndex(entry => entry.event === 'serving'), 'recovery admission is logged after serving');
  assert.ok(entries.findIndex(entry => entry.event === 'executor-sweep') > entries.findIndex(entry => entry.event === 'serving'));
  t.diagnostic(`${process.platform}/${process.arch}; local projectHub; listening to serving ${gap.toFixed(3)} ms; bound 2000 ms`);
});

for (const metadata of ['absent', 'present'] as const) test(metadata === 'absent'
  ? 'hub start reports the serving hub while its startup ready check holds tracker storage'
  : 'hub start retains captured runner identity while its startup ready check holds tracker storage', async t => {
  const owner = fixtureWork(t);
  const previous = process.env;
  const readFile = files.readFile;
  const release = Promise.withResolvers<void>();
  owner.release(() => release.resolve());
  owner.restore(() => { files.readFile = readFile; t.mock.restoreAll(); syncBuiltinESMExports(); process.env = previous; });
  await owner.run(async work => {
    const root = await work.root(() => tempProject(t));
    process.env = fixtureEnvironment(root, previous, metadata === 'present' ? {
      CLAND_TEST_LOCK_IDENTITY: JSON.stringify({ hostname: 'runner-fixture-host', bootId: 'runner-fixture-boot', pidNamespace: null }),
    } : {});
    const expectedIdentity = fixtureLockIdentity(process.env);
    const task = join(root, '.cland/tasks/T-1-ready.md');
    await files.mkdir(join(root, '.cland/tasks'), { recursive: true });
    await files.writeFile(task, '---\nid: T-1\nkind: task\ntitle: Ready\nstate: open\nstatus: ready\nsize: S\nbranch: t/ready\n---\n');
    const entered = Promise.withResolvers<void>();
    const completed = Promise.withResolvers<void>();
    let held = false, armed = true;
    let tracker: Tracker | undefined;
    const startTracker = Tracker.prototype.start;
    t.mock.method(Tracker.prototype, 'start', function(this: Tracker, ...args: Parameters<Tracker['start']>) {
      tracker = this;
      return startTracker.apply(this, args);
    });
    files.readFile = (async (...args: Parameters<typeof files.readFile>) => {
      if (String(args[0]) === task && armed && tracker?.storageStatus().active?.operation === 'ready check') {
        armed = false; held = true; entered.resolve();
        await release.promise;
        held = false; completed.resolve();
      }
      return readFile(...args);
    }) as typeof files.readFile;
    let starting: ReturnType<typeof projectHub> | undefined;
    // Exercise the initial start/probe loop. Only child creation is replaced: the
    // daemon, discovery, socket transport and ready-check storage are real.
    t.mock.method(childProcess, 'spawn', () => {
      starting = work.acquire(() => projectHub(t, root), hub => hub.dispose());
      const child = Object.assign(new EventEmitter(), { pid: process.pid, unref() {}, kill() { assert.fail('a serving startup must not be killed'); } });
      void starting.catch(() => child.emit('exit', 1));
      return child as unknown as ChildProcess;
    });
    syncBuiltinESMExports();
    let stdout = '', stderr = '';
    const result = runHub(['start'], root, { out: line => { stdout += line; }, err: line => { stderr += line; } });
    void result.catch(() => {});
    try {
      await work.step(() => within(entered.promise, 15000, undefined, () => new Error('cold startup ready-check receipt missing')));
      await eventually('discovery is published before ready-check completion', async () => {
        await files.stat(join(root, '.cland/hub.json')); return true;
      }, 500);
      const hub = await starting!;
      assert.deepEqual(JSON.parse(await files.readFile(join(root, '.cland/hub.lock'), 'utf8')).hostIdentity, expectedIdentity);
      assert.equal(await result, 0, stderr);
      assert.match(stdout, /hub started for/);
      assert.match(stdout, new RegExp(`pid +${hub.discovery.pid}\\b`));
      assert.equal(held, true, 'CLI reported success before the ready check completed');
      const ui = await connectUi(t, hub.discovery);
      const status = await ui.request({ type: 'hub.status' });
      assert.equal(status.ok, true, status.error);
      assert.equal((status.value as HubStatus).tracker?.storage?.active?.operation, 'ready check');
      release.resolve();
      await completed.promise;
    } finally {
      release.resolve();
      await Promise.allSettled([result, ...(starting ? [starting] : [])]);
    }
  });
});

test('startup logs the persisted suite-jobs byte size before restoring suites', async t => {
  const root = await tempProject(t);
  const { Store } = await import('../src/hub/store.ts');
  await files.mkdir(join(root, '.cland'), { recursive: true });
  const store = new Store(join(root, '.cland/hub.db'));
  // A valid JSON blob at the reported incident's scale, without fixture jobs to run.
  store.setMeta('suite-jobs', '[' + ' '.repeat(226302) + ']');
  store.close();
  const entries: Record<string, unknown>[] = [];
  await projectHub(t, root, {}, { log: entry => { entries.push(entry); } });
  const storage = entries.find(entry => entry.event === 'hub-startup-storage');
  assert.equal(storage?.suiteJobsBytes, 226304);
  assert.ok(entries.indexOf(storage!) < entries.findIndex(entry => entry.event === 'serving'));
});

test('unbranched historical verdicts need no ready-check read while a branchless ready row is demoted', async t=>{
  const {serializeItem}=await import('../src/tracker/item.ts');
  const root=await tempProject(t),at='2026-10-21T12:00:00Z';
  await files.mkdir(join(root,'.cland/tasks'),{recursive:true});
  for(const [id,status] of [['T-1','planned'],['T-2','ready']] as const) await files.writeFile(join(root,`.cland/tasks/${id}-fixture.md`),serializeItem({
    fm:{id,kind:'task',title:id,state:'open',status,size:'S',labels:[],assignee:null,parent:null,blocked_by:[],topic:null,branch:null,created:at,updated:at},
    body:'## Summary\n\nHistorical verdict without a task branch.',comments:[{author:'reviewer',at,text:'A historical review.',verdict:{verdict:'review',result:'clear',run:'old',by:'reviewer'}}],
  }));
  let tracker:Tracker|undefined;
  const start=Tracker.prototype.start;
  t.mock.method(Tracker.prototype,'start',function(this:Tracker,...args:Parameters<Tracker['start']>){tracker=this;return start.apply(this,args);});
  const original=files.readFile,reads:string[]=[];
  files.readFile=(async (...args:Parameters<typeof files.readFile>)=>{
    if(tracker?.storageStatus().active?.operation==='ready check') reads.push(String(args[0]));
    return original(...args);
  }) as typeof files.readFile;
  onCleanup(t,()=>{files.readFile=original;});
  const hub=await projectHub(t,root);
  const ui=await connectUi(t,hub.discovery);
  const planned=await ui.request({type:'task.view',item:'T-1'});
  const demoted=await ui.request({type:'task.view',item:'T-2'});
  assert.equal(planned.ok,true,planned.error);assert.equal(demoted.ok,true,demoted.error);
  assert.equal((planned.value as {item:ItemView}).item.status,'planned');
  assert.equal((demoted.value as {item:ItemView}).item.status,'in progress');
  await hub.stop();await hub.stopped;
  assert.ok(reads.some(path=>path.endsWith('T-2-fixture.md')),'ready row still gets its durable readiness check');
  assert.ok(!reads.some(path=>path.endsWith('T-1-fixture.md')),'no read for an unbranched planned row');
});
