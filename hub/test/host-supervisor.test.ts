// T3: supervisor session detachment, native death/restart and persisted process identity require real processes.
// Lifecycle: fake hosts only; captured supervisors, agents and harnesses drained before scratch removal.
import { removeFixtureSockets } from '../../test-support/socket-path.ts';
import test, { after, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, writeFile, rm, access, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fixtureEnvironment } from './fixture-environment.ts';
import { createFakeHost, hostControl } from './fakes/fake-host.ts';
import { ownProcess, fixtureProcessCensus, cleanupOwnedProcesses } from './process-cleanup.ts';
import { eventually } from './harness.ts';
import { AgentClient } from '../src/host/agent-client.ts';
const roots: string[] = [];
const controls = new Set<{close: () => Promise<void>}>();
// Enrol before acquisition. Node test cancellation does not await a test body;
// both its hook and file/root cleanup must join the same admitted work.
function ownControl(t: TestContext) {
  const cancellation = new AbortController();
  let work: Promise<void> | undefined;
  const owner = {
    run(body: (signal: AbortSignal) => Promise<void>) {
      assert.equal(work, undefined);
      work = Promise.resolve().then(() => body(cancellation.signal));
      void work.catch(() => {});
      return work;
    },
    async close() {
      cancellation.abort();
      try { await work; }
      catch (error) { t.diagnostic(JSON.stringify({incomplete:'supervisor control', error:String(error)})); }
      finally { controls.delete(owner); }
    },
  };
  controls.add(owner);
  t.signal.addEventListener('abort', () => cancellation.abort(), {once:true});
  t.after(() => owner.close());
  return owner;
}
async function joinControls() {
  await Promise.all([...controls].map(owner => owner.close()));
}
async function removeRoot(root: string, afterControlJoin?: () => Promise<void>) {
  await cleanupRoot(root, afterControlJoin);
  await assert.rejects(access(root));
}
async function cleanupRoot(root: string, afterControlJoin?: () => Promise<void>) {
  await joinControls();
  await afterControlJoin?.();
  await closeSupervisors(root);
  await removeFixtureSockets(root);
  await rm(root, {recursive:true, force:true});
  roots.splice(roots.indexOf(root), 1);
}
const restartOwners = new Map<string, Array<{stop: () => Promise<void>; agents: Array<() => Promise<void>>}>>();
async function closeSupervisors(root: string, beforeStop?: () => Promise<void>, afterStop?: () => Promise<void>) {
  await beforeStop?.();
  const owners = restartOwners.get(root) ?? [];
  // Retain native births while ancestry/cwd still identify the writers. Owner
  // shutdown may reparent them or lose their cwd from the final discovery.
  const captured = fixtureProcessCensus(root);
  // Shared roots can have several supervisors. Join every restart owner before
  // capturing the final writers, including agents born during owner shutdown.
  for (const owner of owners) await owner.stop();
  await afterStop?.();
  const remaining = fixtureProcessCensus(root);
  for (const owner of owners) for (const cleanup of owner.agents) await cleanup();
  await cleanupOwnedProcesses([...captured, ...remaining]);
}

async function fixtureRoot(prefix: string) {
  const root = await mkdtemp(join(tmpdir(), prefix));
  roots.push(root);
  return root;
}
// Keep roots until the file census so cwd evidence survives teardown.
after(async () => {
  await joinControls();
  const survivors = roots.flatMap(root => fixtureProcessCensus(root));
  // Safety net also runs when a selected local invocation omits the final case.
  for (const root of roots) await closeSupervisors(root);
  await cleanupOwnedProcesses(survivors);
  for (const root of [...roots]) await cleanupRoot(root);
});
const script = new URL('../src/host/agent/supervisor.sh', import.meta.url).pathname;
const cli = new URL('../bin/cland.ts', import.meta.url).pathname;

test('supervisor C1-C4: singleton, detached lifetime, HUP, kill-agent restart and retained harness identity', {timeout:20000}, async t => {
  const root = await fixtureRoot('hs-');
  const host = await createFakeHost(root, 'one');
  const env = fixtureEnvironment(root, process.env, { CLAND_FAKE_HOST_ROOT:root, CLAND_FAKE_HOSTS:'one', CLAND_HOST_BOOT_ID_FILE:host.bootId, CLAND_HOST_RUN_DIR:host.run, CLAND_HOST_SECRET:'synthetic' });
  let client: AgentClient | undefined;
  let cleanSupervisor = async () => {}; let cleanHarness = async () => {}; let cleanSecond = async () => {};
  let tail = '';
  const args = [script, host.run, process.execPath, cli, 'host', 'serve'];
  try {
    const launch = await startSupervisor(root, host.run, env, args);
    cleanSupervisor = launch.close;
    await launch.release();
    const supervisor = await launch.ready();
    await launch.depart();
    client = await eventually('authenticated agent hello', ()=>AgentClient.connect(join(host.run,'agent.sock'),'synthetic').catch(()=>undefined));
    launch.recordAgent(client.hello.pid);
    process.kill(supervisor, 0);
    const firstPid = client.hello.pid;
    const second = spawn('sh', args, {cwd:root, env:fixtureEnvironment(root,process.env,env), stdio:'ignore'});
    let secondExit: {code:number|null;signal:string|null}|undefined;
    second.once('close',(code,signal)=>{secondExit={code,signal};});
    cleanSecond=ownProcess(undefined,second.pid);
    assert.equal((await eventually('second supervisor native close',()=>secondExit,3000)).code,1);
    assert.equal(client.hello.pid, firstPid);
    const harness = await client.request('spawn',{command:process.execPath,args:['-e','setInterval(()=>{},1000)'],cwd:root,env}) as {pid:number;identity:string};
    cleanHarness = ownProcess(undefined,harness.pid);
    process.kill(supervisor,0); process.kill(supervisor,'SIGHUP'); process.kill(firstPid,'SIGHUP');
    assert.equal(await client.request('alive',harness),true);
    await writeFile(join(host.run,'agent.pid'), JSON.stringify({pid:firstPid,identity:'linux:wrong:0'}));
    await assert.rejects(hostControl('kill-agent','one',env),/identity mismatch/);
    assert.equal(await client.request('alive',harness),true);
    // Restore the durable receipt from the live identity operation, then inject the fault.
    await writeFile(join(host.run,'agent.pid'),JSON.stringify({pid:firstPid,identity:await client.request('identity',{pid:firstPid})}));
    process.kill(supervisor,0);
    const start = performance.now();
    await hostControl('kill-agent','one',env); await client.close(); client=undefined;
    client=await eventually('replacement authenticated hello within 3 seconds',async()=>{
      const next=await AgentClient.connect(join(host.run,'agent.sock'),'synthetic').catch(()=>undefined);
      if(next?.hello.pid===firstPid){await next.close();return undefined;}return next;
    },3000);
    launch.recordAgent(client.hello.pid);
    assert.ok(performance.now()-start<3000); // lint-allow-wall-clock: C2 measures SIGKILL-to-authenticated replacement hello within 3s
    assert.notEqual(client.hello.pid,firstPid);
    assert.equal(await client.request('alive',harness),true);
    const rows=await client.request('processes',{}) as Array<{pid:number;identity:string}>;
    assert.equal(rows.find(row=>row.pid===harness.pid)?.identity,harness.identity);
    process.kill(supervisor,0);
    assert.equal(await client.request('stop',harness),true);
    for(const path of [script,new URL('../src/cli/host.ts',import.meta.url)]) assert.doesNotMatch(await readFile(path,'utf8'),/systemctl|systemd-run/);
  } catch(error) { try{tail=(await readFile(join(host.run,'supervisor.log'),'utf8')).slice(-4096);}catch{} t.diagnostic(JSON.stringify({incomplete:'supervisor lifecycle',tail})); throw error;
  } finally { await client?.close(); await cleanHarness(); await cleanSecond(); await cleanSupervisor(); }
});

// Keep the initiating shell alive behind gates until the caller captures its
// supervisor. Failed receipt setup retains that live ancestry for cleanup.
async function startSupervisor(root: string, run: string, env: NodeJS.ProcessEnv, args: string[]) {
  const starter = spawn('sh', ['-c',
    'while [ ! -f "$CLAND_HOST_RUN_DIR/launch" ]; do sleep 0.01; done; nohup sh "$@" >"$CLAND_HOST_RUN_DIR/supervisor.log" 2>&1 </dev/null & while [ ! -f "$CLAND_HOST_RUN_DIR/depart" ]; do sleep 0.01; done',
    'starter', ...args], {cwd:root, env:fixtureEnvironment(root,process.env,env), stdio:'ignore', detached:true});
  let closed: {code:number|null;signal:string|null}|undefined;
  starter.once('close',(code,signal)=>{closed={code,signal};});
  const cleanStarter=ownProcess(undefined,starter.pid);
  let cleanNative=async()=>{};
  const agents: Array<() => Promise<void>> = [];
  const owners = restartOwners.get(root) ?? [];
  restartOwners.set(root, owners);
  owners.push({agents, stop: async () => {
    await cleanNative(); await cleanStarter();
    await eventually('starter native close after cleanup',()=>closed,3000);
  }});
  return {
    recordAgent:(pid: number)=>{ agents.push(ownProcess(undefined,pid)); },
    release:()=>writeFile(join(run,'launch'),'launch'),
    ready:async()=>{
      const pid=await eventually('supervisor pid receipt',async()=>{try{return Number(await readFile(join(run,'supervisor.lock/pid'),'utf8'))||undefined;}catch{return undefined;}},3000);
      cleanNative=ownProcess(undefined,pid);
      return pid;
    },
    depart:async()=>{
      await writeFile(join(run,'depart'),'depart');
      const receipt=await eventually('initiating shell native close',()=>closed,3000);
      assert.equal(receipt.code,0);
    },
    close:(beforeStop?: () => Promise<void>, afterStop?: () => Promise<void>)=>closeSupervisors(root, beforeStop, afterStop),
  };
}

test('supervisor setup failure before its expected receipt drains the detached writer before root removal', {timeout:10000}, async()=>{
  const root=await fixtureRoot('hs-fail-');
  const host=await createFakeHost(root,'one');
  const env=fixtureEnvironment(root,process.env,{CLAND_FAKE_HOSTS:'one',CLAND_HOST_RUN_DIR:host.run});
  const launch=await startSupervisor(root,host.run,env,[script,host.run,process.execPath,'-e','setInterval(()=>{},1000)']);
  let independent=async()=>{};
  try {
    await launch.release();
    // Independent red-control ownership: actual PID receipt is visible, but
    // the failing setup below observes an intentionally missing receipt.
    const pid=await eventually('independent supervisor receipt',async()=>{try{return Number(await readFile(join(host.run,'supervisor.lock/pid'),'utf8'))||undefined;}catch{return undefined;}},3000);
    independent=ownProcess(undefined,pid);
    await assert.rejects(eventually('synthetic missing setup receipt',async()=>{try{await access(join(host.run,'missing'));return true;}catch{return undefined;}},100),/synthetic missing setup receipt/);
    await launch.close();
    await eventually('failed setup supervisor native absence',async()=>{
      const {observeProcesses}=await import('../src/host/agent/native.ts');
      return (await observeProcesses([pid],fixtureEnvironment(root,process.env,{CLAND_FAKE_HOSTS:'one',CLAND_HOST_BOOT_ID_FILE:host.bootId}))).get(pid)?.ended||undefined;
    },3000);

    assert.deepEqual(fixtureProcessCensus(root), [], 'setup failure leaves no writer');
  } finally { await independent(); await launch.close(); }
});


test('kill-agent refuses another live fake host receipt and preserves both agents and harnesses', {timeout:15000}, async()=>{
  const root=await fixtureRoot('hs-owner-');
  const owners:Array<{close:()=>Promise<void>}>=[];
  const clients:AgentClient[]=[];
  const clean:Array<()=>Promise<void>>=[];
  try {
    const hosts=await Promise.all(['one','two'].map(name=>createFakeHost(root,name)));
    const envs=hosts.map(host=>fixtureEnvironment(root,process.env,{CLAND_FAKE_HOST_ROOT:root,CLAND_FAKE_HOSTS:'one,two',CLAND_HOST_BOOT_ID_FILE:host.bootId,CLAND_HOST_RUN_DIR:host.run,CLAND_HOST_SECRET:'synthetic'}));
    const harnesses:Array<{pid:number;identity:string}>=[];
    for(let i=0;i<2;i++){
      const host=hosts[i]!,env=envs[i]!;
      const owner=await startSupervisor(root,host.run,env,[script,host.run,process.execPath,cli,'host','serve']);owners.push(owner);
      await owner.release();const pid=await owner.ready();await owner.depart();process.kill(pid,0);
      const client=await eventually('named agent hello',()=>AgentClient.connect(join(host.run,'agent.sock'),'synthetic').catch(()=>undefined),3000);clients.push(client);owner.recordAgent(client.hello.pid);
      const harness=await client.request('spawn',{command:process.execPath,args:['-e','setInterval(()=>{},1000)'],cwd:root,env}) as {pid:number;identity:string};
      harnesses.push(harness);clean.push(ownProcess(undefined,harness.pid));
    }
    const original=await readFile(join(hosts[0]!.run,'agent.pid'));
    await writeFile(join(hosts[0]!.run,'agent.pid'),await readFile(join(hosts[1]!.run,'agent.pid')));
    await assert.rejects(hostControl('kill-agent','one',envs[0]!),/owner mismatch/);
    for(let i=0;i<2;i++){
      assert.equal(await clients[i]!.request('identity',{pid:clients[i]!.hello.pid}),JSON.parse(i===0?original.toString():await readFile(join(hosts[i]!.run,'agent.pid'),'utf8')).identity);
      assert.equal(await clients[i]!.request('alive',harnesses[i]!),true);
    }
  } finally {for(const client of clients)await client.close();for(const cleanup of clean)await cleanup();for(const owner of owners)await owner.close();}
});


test('teardown joins a replacement started while restart-owner shutdown is held', {timeout:10000}, async t => {
  const control = ownControl(t);
  await control.run(signal => replacementControl(t, signal));
});

async function replacementControl(t: TestContext, signal: AbortSignal) {
  signal.throwIfAborted();
  const root = await fixtureRoot('hs-race-');
  const relocated = await realpath(await fixtureRoot('hs-moved-'));
  const receipt = join(root, 'relocated.json');
  const preload = join(root, 'relocate.mjs');
  // A real cwd transition removes discovery evidence only after owner shutdown.
  // Both locations remain disposable and owned until the post-file census.
  await writeFile(preload, `import {writeFile} from 'node:fs/promises';
process.once('SIGUSR2', () => {
  process.chdir(${JSON.stringify(relocated)});
  void writeFile(${JSON.stringify(receipt)}, JSON.stringify({pid:process.pid,cwd:process.cwd()}));
});\n`);
  const host = await createFakeHost(root, 'one');
  const env = fixtureEnvironment(root, process.env, {CLAND_FAKE_HOST_ROOT:root, CLAND_FAKE_HOSTS:'one', CLAND_HOST_BOOT_ID_FILE:host.bootId, CLAND_HOST_RUN_DIR:host.run, CLAND_HOST_SECRET:'synthetic'});
  const owner = await startSupervisor(root, host.run, env, [script, host.run, process.execPath, '--import', preload, cli, 'host', 'serve']);
  let client: AgentClient | undefined;
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  signal.addEventListener('abort', () => release(), {once:true});
  if (signal.aborted) release();
  let entered!: () => void;
  const held = new Promise<void>(resolve => { entered = resolve; });
  let closing: Promise<void> | undefined;
  let replacement: number | undefined;
  let replacementBirth: string | undefined;
  try {
    await owner.release(); await owner.ready(); await owner.depart();
    client = await eventually('race initial hello', () => AgentClient.connect(join(host.run,'agent.sock'),'synthetic').catch(() => undefined), 3000);
    const first = client.hello.pid; owner.recordAgent(first);
    // Arm the hold before teardown starts. The replacement deliberately never
    // enters recordAgent: teardown discovery must capture and join it.
    closing = owner.close(async () => { entered(); await gate; }, async () => {
      signal.throwIfAborted();
      assert.ok(replacement);
      assert.equal(fixtureProcessCensus(root).find(row => row.pid === replacement)?.identity, replacementBirth, 'relocation signal retains captured birth');
      assert.ok(replacementBirth);
      process.kill(replacement, 'SIGUSR2');
      const moved = await eventually('replacement durable cwd relocation receipt', async () => {
        try { return JSON.parse(await readFile(receipt, 'utf8')) as {pid:number;cwd:string}; }
        catch { return undefined; }
      }, 3000);
      assert.equal(moved.pid, replacement);
      assert.equal(moved.cwd, relocated);
      assert.ok(fixtureProcessCensus(relocated).some(row => row.pid === replacement), 'native cwd relocation observed');
    });
    void closing.catch(() => {}); // The body and cleanup owner both join it below.
    await held;
    signal.throwIfAborted();
    await hostControl('kill-agent','one',env); await client.close(); client = undefined;
    client = await eventually('replacement hello during held teardown', async () => {
      const next = await AgentClient.connect(join(host.run,'agent.sock'),'synthetic').catch(() => undefined);
      if (next?.hello.pid === first) { await next.close(); return undefined; }
      return next;
    }, 3000);
    replacement = client.hello.pid;
    const birth = fixtureProcessCensus(root).find(row => row.pid === replacement);
    assert.ok(birth?.identity, 'replacement native birth observed before release');
    replacementBirth = birth.identity;
    signal.throwIfAborted();
    await client.close(); client = undefined;
    release(); await closing;
    const survivors = [root, relocated].flatMap(path => fixtureProcessCensus(path));
    t.diagnostic(JSON.stringify({boundary:'replacement teardown census', survivors}));
    assert.deepEqual(survivors, [], 'replacement started during teardown is joined');
  } catch (error) {
    const native = [root, relocated].flatMap(path => fixtureProcessCensus(path)).find(row => row.pid === replacement);
    const tail = await readFile(join(host.run,'supervisor.log'),'utf8').then(log => log.slice(-2048), () => 'unavailable');
    t.diagnostic(JSON.stringify({incomplete:'replacement teardown control', error:String(error), native:native ?? {outcome:'unknown'}, tail}));
    throw error;
  } finally {
    release(); await client?.close();
    try { await closing; } finally {
      await owner.close();
      await cleanupOwnedProcesses(fixtureProcessCensus(relocated));
    }
  }
}

test('cancelled supervisor control retains its root until a held producer and missing receipt observer drain', {timeout:10000}, async t => {
  const root = await fixtureRoot('hs-control-');
  const receipt = join(root, 'producer-closed');
  const gate = Promise.withResolvers<void>();
  const owner = ownControl(t);
  let entered = false;
  let observed = false;
  const work = owner.run(async signal => {
    entered = true;
    await gate.promise;
    assert.equal(signal.aborted, true);
    await writeFile(receipt, 'producer closed');
    await assert.rejects(eventually('synthetic missing relocation receipt', async () => {
      try { await access(join(root, 'missing')); return true; } catch { return undefined; }
    }, {timeoutMs:100, behaviour:'missing-receipt fault bound'}), /synthetic missing relocation receipt/);
    observed = true;
  });
  try {
    await eventually('control acquisition entered', () => entered || undefined, 3000);
    const draining = owner.close();
    const removing = removeRoot(root, async () => {
      assert.equal(observed, true, 'root removal joins the missing receipt observer');
      assert.equal(await readFile(receipt, 'utf8'), 'producer closed');
    });
    void removing.catch(() => {});
    await access(root);
    assert.equal(observed, false);
    gate.resolve();
    await work;
    await draining;
    assert.equal(observed, true, 'observer settled before root removal');
    await removing;
    await assert.rejects(access(root));
  } finally { gate.resolve(); await owner.close(); }
});

test('post-file fixture process census has no supervised writers after teardown', async () => {
  await joinControls();
  const survivors = roots.flatMap(root => fixtureProcessCensus(root));
  assert.deepEqual(survivors, [], 'post-file fixture process census: supervised writers survived teardown');
  for (const root of [...roots]) await removeRoot(root);
});
