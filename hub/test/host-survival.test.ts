// T2: persisted mixed-harness rows recover through recording Hosts; no native children.
import { testWaitMs } from './until.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { Sessions } from '../src/adapters/sessions.ts';
import { ProcessTable } from '../src/adapters/processes.ts';
import { HubCore } from '../src/hub/core.ts';
import { localHost } from '../src/host/local.ts';
import { testHost } from '../src/host/test-host.ts';
import { fakeHarness, FAKE_FLAVOURS } from './fakes/harness.ts';
import { tempProject, eventually } from './harness.ts';
import { fixtureEnvironment } from './fixture-environment.ts';
import { FakeClock } from './fake-clock.ts';
import type { HarnessProcess } from '../src/adapters/contract.ts';

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
  const hosts = ['f1', 'f2'].map(name => ({ ...testHost(name, event => calls.push(`${name}:${event.operation}`)),
    layout: localHost(fixtureEnvironment(root, {})).layout,
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
  const remote = {...testHost('remote',()=>{}), layout:localHost(fixtureEnvironment(root,{})).layout,
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
  await eventually('ready-driven recovery completion',()=>settled||undefined,/* behaviour: post-signal receipt deadline */ 1000);
  await ready;
  assert.deepEqual(attempts,['early','held','early','held']);
  assert.deepEqual([...recovered].sort(),['early','held']);
  assert.equal(table.get('early')?.status,'running');
  assert.equal(table.get('held')?.status,'running');
});
