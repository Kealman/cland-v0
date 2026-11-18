// T2: persisted mixed-harness rows recover through recording Hosts; no native children.
import { testWaitMs } from './until.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { Sessions } from '../src/adapters/sessions.ts';
import { ProcessTable } from '../src/adapters/processes.ts';
import { HubCore } from '../src/hub/core.ts';
import { recordingHost } from './recording-host.ts';
import { testHost } from '../src/host/test-host.ts';
import { fakeHarness, FAKE_FLAVOURS } from './fakes/harness.ts';
import { tempProject, eventually } from './harness.ts';
import { FakeClock } from './fake-clock.ts';
import type { HarnessProcess } from '../src/adapters/contract.ts';
import { LaunchRecoveryPending } from '../src/adapters/launch-files.ts';
import { caseDeadlines, drainFixtureWork } from './case-deadlines.ts';
import { beforeDirectories, guardDirectoryRemoval, afterCleanup, onCleanup } from './process-cleanup.ts';
import { fakeNativeGuard } from './fake-native-guard.ts';

type RecoveryStep = <T>(name: string, run: () => Promise<T>) => Promise<T>;
type RecoveryFixture = Awaited<ReturnType<typeof recoveryFixture>>;

/** Own setup, body, pending resumes, teardown and guard restoration as one case. */
function recoveryControl(t: import('node:test').TestContext, body: (f: RecoveryFixture) => Promise<void>) {
  const releases: Array<() => void> = [];
  const scope = caseDeadlines(t, {timeoutMs:testWaitMs(5000), ownership:{beforeDirectories, guardDirectoryRemoval}, releaseOnClose:() => releases.forEach(release => release())});
  let guard: Awaited<ReturnType<typeof fakeNativeGuard>> | undefined, restore: (() => void) | undefined;
  afterCleanup(t, async () => {
    await drainFixtureWork();
    try { guard?.verify(); } finally { restore?.(); }
  });
  return scope.run(async (admit, signal) => {
    const step: RecoveryStep = (name, run) => scope.wait(name, () => admit(async () => {
      signal.throwIfAborted(); const value = await run(); signal.throwIfAborted(); return value;
    }));
    await step('native guard setup', async () => { guard = await fakeNativeGuard(value => { restore = value; }); });
    const root = await scope.wait('recovery root setup', () => admit(async () => {
      const root = await tempProject(scope.fixtures); scope.adoptRoot(root); return root;
    }));
    signal.throwIfAborted();
    const fixture = await step('recovery fixture setup', () => recoveryFixture(root, scope.fixtures, step, release => releases.push(release)));
    await body(fixture);
  });
}

async function recoveryFixture(root: string, t: import('node:test').TestContext, step: RecoveryStep, releaseOnClose: (release: () => void) => void) {
  let core: HubCore | undefined, table: ProcessTable | undefined, sessions: Sessions | undefined;
  onCleanup(t, async () => {
    try { await sessions?.close(); }
    finally { try { table?.close(); } finally { core?.close(); core?.store.close(); } }
  });
  const clock = new FakeClock(); core = new HubCore({clock}); table = new ProcessTable(':memory:', clock);
  const logs: Record<string, unknown>[] = [], attempts: string[] = [];
  const remote = {...recordingHost(root), name:'remote',
    statDirectory:async () => ({refusal:null, identity:null})};
  const local = {...remote, name:'local'};
  sessions = new Sessions({root, core, table, hosts:[remote, {...remote, name:'elsewhere'}, local], recoveryClock:clock, transportClock:clock, log:e => logs.push(e)});
  const adapter = fakeHarness('codex', {clock}); sessions.register(adapter);
  return {root, clock, core, table, sessions, adapter, remote, local, logs, attempts, step, releaseOnClose};
}

for (const change of ['rename', 'replacement', 'host', 'status', 'pending-stop'] as const) {
  for (const replacementHost of change === 'rename' || change === 'replacement' ? ['remote', 'elsewhere'] : ['remote']) {
    test(`host recovery skips a snapshot row after ${change} with replacement host ${replacementHost}`, t => recoveryControl(t, async f => {
      const {root, table, sessions, adapter, logs, attempts, step} = f;
      const release = Promise.withResolvers<void>(), entered = Promise.withResolvers<void>();
      f.releaseOnClose(() => release.resolve());
      const first = {...await step('first fake row setup', () => adapter.spawn({name:'first', cwd:root, role:null, model:null})), host:'remote'};
      const later = {...await step('later fake row setup', () => adapter.spawn({name:'later', cwd:root, role:null, model:null})), host:'remote'};
      table.put(first); table.put(later);
      adapter.resume = async row => {
        attempts.push(row.sessionId);
        if (row.sessionId === first.sessionId) { entered.resolve(); await release.promise; }
        if (row.sessionId === later.sessionId && change === 'pending-stop') {
          throw new LaunchRecoveryPending(row.sessionId, {undo:[], children:[]}, () => { throw new Error('fixture settlement held'); }, 'fixture pending cleanup');
        }
        return {found:true, process:row, state:'idle'};
      };
      const recovery = step('host recovery completion', () => sessions.resumeHost('remote'));
      void recovery.catch(() => {});
      await step('first adapter resume receipt', () => entered.promise);
      if (change === 'rename' || change === 'replacement') {
        if (change === 'rename') assert.equal(table.rename(later.sessionId, 'renamed'), true);
        else table.removeBatch([later]);
        table.put({...later, sessionId:'replacement', host:replacementHost});
      } else if (change === 'host') table.put({...later, host:'elsewhere'});
      else if (change === 'status') table.update(later.name, {status:'stopped'});
      else {
        await assert.rejects(step('pending cleanup admission', () => sessions.resume(later.name)), /cleanup is pending/);
        assert.equal(table.pendingStops().length, 1, 'pending cleanup was persisted before recovery continues');
        attempts.length = 1; // Exclude the explicit resume that installed pending cleanup.
      }
      release.resolve(); await recovery;
      assert.deepEqual(attempts, [first.sessionId]);
      assert.ok(logs.some(e => e.event === 'resume-skipped' && e.sessionId === later.sessionId && e.reason === change));
    }));
  }
}

for (const boundary of ['adapter', 'identity'] as const) for (const change of ['rename', 'replacement', 'host', 'status'] as const) {
  test(`host recovery preserves a row changed during ${boundary} settlement: ${change}`, t => recoveryControl(t, async f => {
    const {root, table, sessions, adapter, logs, step} = f;
    const release = Promise.withResolvers<void>(), entered = Promise.withResolvers<void>();
    f.releaseOnClose(() => release.resolve());
    const row = {...await step('settlement fake row setup', () => adapter.spawn({name:'held', cwd:root, role:null, model:null})), host:'remote'};
    table.put(row);
    let watches = 0;
    adapter.watch = () => { watches++; };
    adapter.resume = async current => {
      if (boundary === 'adapter') { entered.resolve(); await release.promise; }
      return {found:true, process:{...current, pid:boundary === 'identity' ? 123 : null, model:'stale-result'}, state:'idle'};
    };
    if (boundary === 'identity') f.remote.identity = async pid => { entered.resolve(); await release.promise; return {pid, pidStarted:'fake-birth', pidIdentity:'fake-birth'}; };
    const recovery = step('settlement recovery completion', () => sessions.resumeHost('remote'));
    void recovery.catch(() => {});
    await step(`${boundary} held receipt`, () => entered.promise);
    if (change === 'rename') assert.equal(table.rename(row.sessionId, 'renamed'), true);
    else if (change === 'replacement') { table.removeBatch([row]); table.put({...row, sessionId:'replacement'}); }
    else if (change === 'host') table.put({...row, host:'elsewhere'});
    else table.update(row.name, {status:'stopped'});
    const changed = table.all();
    release.resolve(); await recovery;
    assert.deepEqual(table.all(), changed, 'stale result never overwrites the committed row');
    assert.equal(watches, 0, 'stale recovery never restarts supervision');
    assert.ok(logs.some(e => e.event === 'resume-skipped' && e.sessionId === row.sessionId && e.reason === change));
    assert.equal(logs.some(e => e.event === 'session-resumed'), false);
  }));
}

for (const change of ['rename', 'replacement', 'host', 'status', 'unchanged'] as const) {
  test(`host recovery revalidates a local row during legacy identity proof: ${change}`, t => recoveryControl(t, async f => {
    const {root, table, sessions, adapter, local, logs, step} = f;
    const release = Promise.withResolvers<void>(), entered = Promise.withResolvers<void>();
    f.releaseOnClose(() => release.resolve());
    const row = {...await step('legacy local row setup', () => adapter.spawn({name:'legacy', cwd:root, role:null, model:null})), host:'local', pid:123, pidStarted:'legacy-birth', pidIdentity:null};
    table.put(row);
    let resumes = 0;
    adapter.resume = async current => { resumes++; return {found:true, process:current, state:'idle'}; };
    local.identity = async pid => { entered.resolve(); await release.promise; return {pid, pidStarted:'legacy-birth', pidIdentity:'local-proof'}; };
    const recovery = step('legacy recovery completion', () => sessions.resumeHost('local'));
    void recovery.catch(() => {});
    await step('legacy identity probe entered', () => entered.promise);
    if (change === 'rename') assert.equal(table.rename(row.sessionId, 'renamed'), true);
    else if (change === 'replacement') { table.removeBatch([row]); table.put({...row, sessionId:'replacement'}); }
    else if (change === 'host') table.put({...row, host:'elsewhere'});
    else if (change === 'status') table.update(row.name, {status:'stopped'});
    const changed = table.all();
    release.resolve(); await recovery;
    if (change === 'unchanged') {
      assert.equal(table.get(row.name)?.pidIdentity, 'local-proof', 'matching legacy proof is persisted');
      assert.equal(resumes, 1);
      assert.ok(logs.some(e => e.event === 'process-identity-upgraded'));
      assert.equal(logs.some(e => e.event === 'resume-skipped'), false);
    } else {
      assert.deepEqual(table.all(), changed, 'stale local identity proof never writes the changed row');
      assert.equal(resumes, 0, 'changed legacy row never enters adapter resume');
      assert.ok(logs.some(e => e.event === 'resume-skipped' && e.sessionId === row.sessionId && e.reason === change));
      assert.equal(logs.some(e => e.event === 'process-identity-upgraded'), false);
    }
  }));
}

// Both fake machines deliberately reuse the hub PID. Only the Host birth proves ownership.
test('host ready retries unavailable mixed-harness startup without vacating or signalling rows', async t => {
  const root = await tempProject(t), clock = new FakeClock();
  const file = join(root, 'processes.db');
  let table = new ProcessTable(file, clock);
  const rows: HarnessProcess[] = [];
  for (const [index, flavour] of FAKE_FLAVOURS.entries()) {
    const row = { ...await fakeHarness(flavour, { clock }).spawn({ name: flavour, cwd: root, role: null, model: null }), host: index % 2 ? 'f2' : 'f1', pid: process.pid, pidStarted: null, pidIdentity: `linux:boot:${flavour}` };
    rows.push(row); table.put(row);
  }
  table.close();
  await clock.advance(20_000); // Hub downtime is logical time; no native process lifecycle is claimed here.
  table = new ProcessTable(file, clock);
  const calls: string[] = [], forwards = new Set<string>();
  let available = false, missing: string | null = null;
  const hosts = ['f1', 'f2'].map(name => ({ ...recordingHost(root, {record: operation => calls.push(`${name}:${operation}`)}), name,
    statDirectory: async () => ({ refusal: null, identity: null }),
    alive: async (p: {pid: number | null; pidIdentity?: string | null}) => {
      if (!available) throw new Error('tunnel unavailable');
      return rows.some(row => row.host === name && row.pid === p.pid && row.pidIdentity === p.pidIdentity && row.name !== missing);
    },
    forward: async (id: string) => { forwards.add(id); return {socket: join(root, id + '.sock')}; },
  }));
  const core = new HubCore({ clock });
  const sessions = new Sessions({ root, core, table, transportClock: clock, recoveryClock: clock, hosts: [testHost('local', e => calls.push(`local:${e.operation}`)), ...hosts] });
  const adapters = FAKE_FLAVOURS.map(flavour => {
    const adapter = fakeHarness(flavour, { clock, host: sessions.host({node:'',cli:'',spoke:'',discoveryFile:''}) });
    const resume = adapter.resume.bind(adapter);
    adapter.resume = async (p, options) => {
      const host = hosts.find(host => host.name === p.host)!;
      if (!await host.alive(p)) return {found:false, reason:'native birth absent'};
      await host.forward(p.sessionId);
      adapter.scriptResume(p.name, 'found');
      return resume(p, options);
    };
    sessions.register(adapter); return adapter;
  });
  t.after(async () => { await sessions.close(); table.close(); core.close(); core.store.close(); });
  await sessions.resumeAll();
  assert.deepEqual(table.running().map(p => p.sessionId).sort(), rows.map(p => p.sessionId).sort());
  assert.equal(forwards.size, 0, 'unavailable transport is no exit receipt');
  available = true;
  const flight = sessions.resumeHost('f1');
  assert.equal(sessions.resumeHost('f1'), flight, 'concurrent ready receipts share recovery');
  await Promise.all([flight, sessions.resumeHost('f2')]);
  assert.equal(forwards.size, rows.length);
  for (const row of rows) {
    assert.equal(table.get(row.name)?.pidIdentity, row.pidIdentity);
    assert.equal(table.get(row.name)?.status, 'running');
    assert.equal(adapters[FAKE_FLAVOURS.indexOf(row.harness as typeof FAKE_FLAVOURS[number])]?.resumes.length, 1, 'concurrent ready receipts share recovery');
  }
  missing = rows[0]!.name;
  await sessions.resumeHost(rows[0]!.host!);
  assert.equal(table.get(missing!)?.status, 'exited');
  assert.ok(table.running().every(row => row.name !== missing));
  assert.equal(calls.some(call => call.startsWith('local:') || call.endsWith(':stop')), false, 'no local PID probe or signal operation');
});

test('readiness during a held startup pass retries the earlier failed row before settling', {timeout:8 * testWaitMs() + 5000}, async t => {
  const root = await tempProject(t), core = new HubCore(), table = new ProcessTable();
  const release = Promise.withResolvers<void>();
  let inHeld = false;
  const recovered = new Set<string>(), attempts: string[] = [];
  let available = false;
  const remote = {...recordingHost(root), name:'remote',
    statDirectory:async()=>({refusal:null,identity:null})};
  for (const name of ['early','held']) table.put({...await fakeHarness('codex').spawn({name,cwd:root,role:null,model:null}),host:'remote',pid:123,pidStarted:'start',pidIdentity:'birth-'+name});
  const sessions = new Sessions({root,core,table,hosts:[remote]});
  const adapter = fakeHarness('codex',{host:sessions.host({node:'',cli:'',spoke:'',discoveryFile:''})});
  const resume = adapter.resume.bind(adapter);
  adapter.resume = async (row,options) => {
    attempts.push(row.name);
    if (row.name === 'held' && !available) { inHeld = true; await release.promise; }
    if (!available) throw new Error('host not ready');
    recovered.add(row.name); adapter.scriptResume(row.name,'found');
    return resume(row,options);
  };
  sessions.register(adapter);
  t.after(async()=>{release.resolve();await sessions.close();table.close();core.close();core.store.close();});
  const startup = sessions.resumeHost('remote');
  await eventually('later startup row held',()=>inHeld||undefined,testWaitMs());
  assert.deepEqual(attempts,['early','held']);
  assert.equal(recovered.has('early'),false);
  let settled = false;
  void startup.then(()=>{settled=true;});
  available = true;
  const ready = sessions.resumeHost('remote');
  assert.equal(ready,startup,'the ready edge stays inside the same drain owner');
  release.resolve();
  await eventually('ready-driven recovery completion',()=>settled||undefined,{ timeoutMs: 1000, behaviour: "post-signal receipt deadline" });
  await ready;
  assert.deepEqual(attempts,['early','held','early','held']);
  assert.deepEqual([...recovered].sort(),['early','held']);
  assert.equal(table.get('early')?.status,'running');
  assert.equal(table.get('held')?.status,'running');
});
