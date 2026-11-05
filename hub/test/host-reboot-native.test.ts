// T3: native fake-host reboot kills its fixture writers and restarts supervisor/agent/tunnel.
// Lifecycle: joined carrier/hub/agent owners and native census before disposable root removal.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { join } from 'node:path';
import { mkdir, readFile, writeFile, symlink } from 'node:fs/promises';
import { sshHostFixture } from './ssh-host-fixture.ts';
import { createFakeHost, serveFakeReboots } from './fakes/fake-host.ts';
import { fixtureEnvironment } from './fixture-environment.ts';
import { projectHub, connectUi, eventually } from './harness.ts';
import { fakeHarness, FAKE_FLAVOURS } from './fakes/harness.ts';
import { cleanupOwnedProcesses, fixtureProcessCensus } from './process-cleanup.ts';
import { testHost } from '../src/host/test-host.ts';
import { Store } from '../src/hub/store.ts';
import { setRoleKey } from '../src/roles/editor.ts';
import { ProcessTable } from '../src/adapters/processes.ts';
import { AgentClient } from '../src/host/agent-client.ts';
import { hostPaths } from '../src/host/records.ts';
import type { HarnessProcessView } from '../src/protocol.ts';

test('reboot retires one host without stop or signals and bootstraps a fresh supervisor and agent', {timeout:60000}, async t => {
  const f = await sshHostFixture(t,{startTransport:false});
  await f.host.close(); await f.agent.close();
  const second = await createFakeHost(f.root,'f2');
  const rec = f.secrets.register({id:'f2',address:'f2',user:'agent',clientKeyPath:join(second.directory,'client-key'),knownHosts:`f2 ${second.key}\n`});
  const bin = join(f.root,'bin'); await mkdir(bin);
  await writeFile(join(bin,'setsid'),`#!${process.execPath}\nimport {spawn} from 'node:child_process';import {fixtureEnvironment} from '${new URL('./fixture-environment.ts',import.meta.url).pathname}';const env=fixtureEnvironment(process.cwd(),process.env,{CLAND_FAKE_HOSTS:process.env.CLAND_FAKE_HOSTS,CLAND_FAKE_HOST_ROOT:process.env.CLAND_FAKE_HOST_ROOT,CLAND_HOST_BOOT_ID_FILE:process.env.CLAND_HOST_BOOT_ID_FILE,CLAND_HOST_SECRET:process.env.CLAND_HOST_SECRET,CLAND_HOST_RUN_DIR:process.env.CLAND_HOST_RUN_DIR,CLAND_HOST_NODE:process.env.CLAND_HOST_NODE});const c=spawn(process.argv[2],process.argv.slice(3),{detached:true,stdio:'inherit',env});c.unref();`,{mode:0o700});
  const env = fixtureEnvironment(f.root,process.env,{...f.env,PATH:bin+':'+process.env.PATH,CLAND_FAKE_HOSTS:'f1,f2'});
  f.addCleanup(async()=>{
    await cleanupOwnedProcesses(fixtureProcessCensus(f.root));
    // A supervisor can spawn its final 0.2s sleep between census and kill. Its
    // launcher is joined; observe that short-lived native writer gone as well.
    try {await eventually('all captured fixture writers positively absent',()=>fixtureProcessCensus(f.root).filter(p=>p.pid!==process.pid).length===0||undefined,2000);}
    catch(error) {
      const survivors=fixtureProcessCensus(f.root).filter(p=>p.pid!==process.pid).map(p=>({pid:p.pid,identity:p.identity,group:p.group,started:p.started}));
      throw new Error('fixture writers remain after 2s: '+JSON.stringify(survivors),{cause:error});
    }
  });
  const reboots=await serveFakeReboots('f1',env);f.addCleanup(()=>reboots.close());
  const configurations: Record<string, import('../src/host/registry.ts').HostConfiguration> = {};
  for (const [i,machine] of [f.fake,second].entries()) {
    const code=join(machine.home,'code'); await symlink(new URL('../../',import.meta.url).pathname,code); await mkdir(join(machine.home,'.git'));
    configurations[`f${i+1}`]={home:machine.home,supervisor:new URL('../src/host/agent/supervisor.sh',import.meta.url).pathname,layout:{node:process.execPath,cli:join(code,'hub/bin/cland.ts'),spoke:join(code,'hub/bin/cland-spoke.ts')}};
  }
  const store = new Store(join(f.root,'.cland/hub.db'));
  for (const record of [f.records.get('f1')!,rec]) store.hosts.insert({...record,clientKeyPath:'/fake',knownHosts:'fake'},f.secrets.readSecret(record.id));
  store.close();
  const operations:string[]=[];
  const hub = await projectHub(t,f.root,env,{hostConfigurations:configurations,hosts:[testHost('local',e=>{if(e.operation!=='limitPolls')operations.push('local:'+e.operation);})],adapters:FAKE_FLAVOURS.map(flavour=>host=>{
    const adapter=fakeHarness(flavour,{host}); const spawn=adapter.spawn.bind(adapter);
    const placed=host.hostForLaunch!;
    const recording=(machine:import('../src/host/host.ts').Host)=>({...machine,stop:async(...args:Parameters<typeof machine.stop>)=>{operations.push(machine.name+':stop');return machine.stop(...args);}});
    adapter.spawn=async(request,resumed,authorize)=>{
      const machine=recording(placed(request)), p=await spawn(request,resumed,authorize);
      const child=await machine.spawn({command:process.execPath,args:['-e',"require('fs').writeFileSync(process.argv[1],'ready');setInterval(()=>{},1000)",join(request.cwd,request.name+'.ready')],cwd:request.cwd,env:fixtureEnvironment(f.root,process.env,env)});
      const birth=await machine.identity(child.pid);
      return {...p,host:machine.name,pid:child.pid,pidIdentity:birth!.pidIdentity??null,pidStarted:birth!.pidStarted??null};
    };
    adapter.resume=async p=>({found:false,alive:true,reason:'native fake worker remains alive'});
    adapter.stop=async()=>{operations.push('adapter:stop');throw new Error('stop forbidden');};
    return adapter;
  })}); f.addCleanup(()=>hub.stop());
  const rolesFile=join(f.root,'.cland/roles.toml');
  await writeFile(rolesFile,setRoleKey(await readFile(rolesFile,'utf8'),'implementer','launch','writable_roots',['.']));
  const ui=await connectUi(t,hub.discovery); await ui.request({type:'subscribe'});
  const table=new ProcessTable(join(f.root,'.cland/hub.db')); f.addCleanup(async()=>table.close());
  await eventually('both native agents ready',async()=>{
    const status=(await ui.request({type:'hub.status'})).value as {hosts:Array<{state:string}>};
    return status.hosts.length===2&&status.hosts.every(h=>h.state==='up')||undefined;
  },15000);
  const specs=[...FAKE_FLAVOURS.map(harness=>({name:harness,harness,host:'f1',cwd:f.fake.home})),{name:'other',harness:'codex',host:'f2',cwd:second.home}];
  for (const spec of specs) {
    const launched=await ui.request({type:'session.launch',role:'implementer',...spec},15000);assert.equal(launched.ok,true,launched.error);
    await eventually('native worker ready '+spec.name,()=>readFile(join(spec.cwd,spec.name+'.ready'),'utf8').catch(()=>undefined),5000);
  }
  const old=table.all(); assert.equal(old.length,4);
  const direct=await AgentClient.connect(hostPaths(f.root,'f1').agentSocket,f.secrets.readSecret('f1'));
  const boot=direct.hello.bootId, agentPid=direct.hello.pid;await direct.close();
  const supervisorBefore=await readFile(join(f.fake.run,'supervisor.lock/pid'),'utf8');
  const cliReboot=()=>promisify(execFile)(process.execPath,[new URL('./fakes/fake-host.ts',import.meta.url).pathname,'reboot','f1'],{cwd:f.root,env:fixtureEnvironment(f.root,process.env,env),timeout:20000});
  const controlFile=join(f.fake.directory,'reboot-control');
  const control=await readFile(controlFile,'utf8');
  await writeFile(controlFile,JSON.stringify({...JSON.parse(control),token:'wrong-owner'}));
  await assert.rejects(cliReboot(),/fake reboot owner mismatch/);
  await writeFile(controlFile,control);
  assert.equal(await readFile(f.fake.bootId,'utf8'),boot,'wrong-owner CLI cannot advance boot');
  const unchanged=await AgentClient.connect(hostPaths(f.root,'f1').agentSocket,f.secrets.readSecret('f1'));
  for(const p of old.filter(p=>p.host==='f1'))assert.equal(await unchanged.request('identity',{pid:p.pid}),p.pidIdentity,'wrong-owner CLI never signals an older worker');
  await unchanged.close();
  const retirement=eventually('durable exits for every rebooted native row',()=>old.filter(p=>p.host==='f1').every(p=>table.bySessionId(p.sessionId)?.status==='exited')||undefined,15000); void retirement.catch(()=>{});
  await cliReboot();await retirement;
  const replacement=await eventually('authenticated replacement agent with a changed boot',async()=>{
    const client=await AgentClient.connect(hostPaths(f.root,'f1').agentSocket,f.secrets.readSecret('f1')).catch(()=>undefined);
    if(!client)return;const hello=client.hello;await client.close();return hello.bootId!==boot?hello:undefined;
  },15000);
  assert.notEqual(replacement.pid,agentPid);assert.notEqual(await readFile(join(f.fake.run,'supervisor.lock/pid'),'utf8'),supervisorBefore);
  assert.notEqual(await readFile(f.fake.bootId,'utf8'),boot);
  const rows=((await ui.request({type:'session.list'})).value as {processes:HarnessProcessView[]}).processes;
  assert.equal(rows.find(p=>p.name==='other')?.status,'running');
  const log=(await readFile(join(f.root,'.cland/log/hub.log'),'utf8')).trim().split('\n').map(line=>JSON.parse(line) as {event:string;session:string;reason?:string});
  for(const flavour of FAKE_FLAVOURS)assert.ok(log.some(e=>e.event==='role-cleared'&&e.session===flavour&&e.reason==='its harness exited'));
  const roles=(await ui.request({type:'role.list'})).value as {roles:Array<{holders:Array<{name:string}>}>};
  assert.ok(roles.roles.every(role=>role.holders.every(holder=>!FAKE_FLAVOURS.includes(holder.name as typeof FAKE_FLAVOURS[number]))));
  assert.equal([...table.retainedHostGenerations('f1')].filter(r=>r.nativeClosure==='confirmed').length,3);
  assert.deepEqual(operations,[]);
  const status=(await ui.request({type:'hub.status'})).value as {hosts:Array<{id:string;state:string}>};
  assert.ok(status.hosts.every(h=>h.state==='up'));
  await hub.stop();
});
