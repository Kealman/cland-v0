// T3: supervisor session detachment, native death/restart and persisted process identity require real processes.
// Lifecycle: fake hosts only; captured supervisor group and harness drained before scratch removal.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, writeFile, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fixtureEnvironment } from './fixture-environment.ts';
import { createFakeHost, hostControl } from './fakes/fake-host.ts';
import { ownProcess } from './process-cleanup.ts';
import { eventually } from './harness.ts';
import { AgentClient } from '../src/host/agent-client.ts';
const script = new URL('../src/host/agent/supervisor.sh', import.meta.url).pathname;
const cli = new URL('../bin/cland.ts', import.meta.url).pathname;

test('supervisor C1-C4: singleton, detached lifetime, HUP, kill-agent restart and retained harness identity', {timeout:20000}, async t => {
  const root = await mkdtemp(join(tmpdir(), 'hs-'));
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
    assert.ok(performance.now()-start<3000); // lint-allow-wall-clock: C2 measures SIGKILL-to-authenticated replacement hello within 3s
    assert.notEqual(client.hello.pid,firstPid);
    assert.equal(await client.request('alive',harness),true);
    const rows=await client.request('processes',{}) as Array<{pid:number;identity:string}>;
    assert.equal(rows.find(row=>row.pid===harness.pid)?.identity,harness.identity);
    process.kill(supervisor,0);
    assert.equal(await client.request('stop',harness),true);
    for(const path of [script,new URL('../src/cli/host.ts',import.meta.url)]) assert.doesNotMatch(await readFile(path,'utf8'),/systemctl|systemd-run/);
  } catch(error) { try{tail=(await readFile(join(host.run,'supervisor.log'),'utf8')).slice(-4096);}catch{} t.diagnostic(JSON.stringify({incomplete:'supervisor lifecycle',tail})); throw error;
  } finally { await client?.close(); await cleanHarness(); await cleanSecond(); await cleanSupervisor(); await rm(root,{recursive:true,force:true}); }
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
  return {
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
    close:async()=>{
      await cleanNative(); await cleanStarter();
      await eventually('starter native close after cleanup',()=>closed,3000);
    },
  };
}

test('supervisor setup failure before its expected receipt drains the detached writer before root removal', {timeout:10000}, async()=>{
  const root=await mkdtemp(join(tmpdir(),'hs-fail-'));
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
    await rm(root,{recursive:true,force:true});
    await assert.rejects(access(root));
  } finally { await independent(); await launch.close(); await rm(root,{recursive:true,force:true}); }
});


test('kill-agent refuses another live fake host receipt and preserves both agents and harnesses', {timeout:15000}, async()=>{
  const root=await mkdtemp(join(tmpdir(),'hs-owner-'));
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
      const client=await eventually('named agent hello',()=>AgentClient.connect(join(host.run,'agent.sock'),'synthetic').catch(()=>undefined),3000);clients.push(client);
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
  } finally {for(const client of clients)await client.close();for(const cleanup of clean)await cleanup();for(const owner of owners)await owner.close();await rm(root,{recursive:true,force:true});}
});
