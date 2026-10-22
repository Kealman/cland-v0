// T2: embedded startup must publish discovery and answer CLI probes before a held
// ready-check read completes. The CLI is the subject; no hub child is launched.
import test from 'node:test';
import assert from 'node:assert/strict';
import files from 'node:fs/promises';
import childProcess, { type ChildProcess } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { syncBuiltinESMExports } from 'node:module';
import { runHub } from '../src/cli/hub.ts';
import { Tracker, type ItemView } from '../src/tracker/tracker.ts';
import { join } from 'node:path';
import { connectUi, eventually, projectHub, tempProject } from './harness.ts';
import { onCleanup } from './process-cleanup.ts';
import type { HubStatus } from '../src/protocol.ts';

test('hub start reports the serving hub while its startup ready check holds tracker storage', async t => {
  const root = await tempProject(t);
  const task = join(root, '.cland/tasks/T-1-ready.md');
  await files.mkdir(join(root, '.cland/tasks'), { recursive: true });
  await files.writeFile(task, '---\nid: T-1\nkind: task\ntitle: Ready\nstate: open\nstatus: ready\nsize: S\nbranch: t/ready\n---\n');
  const entered = Promise.withResolvers<void>(), release = Promise.withResolvers<void>();
  const completed = Promise.withResolvers<void>();
  const readFile = files.readFile;
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
  onCleanup(t, () => { files.readFile = readFile; release.resolve(); });
  let starting: ReturnType<typeof projectHub> | undefined;
  // Exercise the initial start/probe loop. Only child creation is replaced: the
  // daemon, discovery, socket transport and ready-check storage are real.
  t.mock.method(childProcess, 'spawn', () => {
    starting = projectHub(t, root);
    return Object.assign(new EventEmitter(), { pid: process.pid, unref() {}, kill() { assert.fail('a serving startup must not be killed'); } }) as unknown as ChildProcess;
  });
  syncBuiltinESMExports();
  onCleanup(t, () => { t.mock.restoreAll(); syncBuiltinESMExports(); });
  onCleanup(t, async () => { release.resolve(); if (starting) { const hub = await starting; await result; await hub.stop(); } });
  let stdout = '', stderr = '';
  const result = runHub(['start'], root, { out: line => { stdout += line; }, err: line => { stderr += line; } });
  await entered.promise;
  await eventually('discovery is published before ready-check completion', async () => {
    await files.stat(join(root, '.cland/hub.json')); return true;
  }, 500);
  const hub = await starting!;
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
