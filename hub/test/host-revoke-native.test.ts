// T3: production adapters stop native fake-host workers and settle generation files before revocation.
// Detached Claude workers, the Codex child, OpenCode server and SSH forwards require native lifecycle receipts.
import { testWaitMs } from './until.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { symlink, writeFile, readFile, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { sshHostFixture } from './ssh-host-fixture.ts';
import { projectHub, connectUi, fakeClaude, eventually } from './harness.ts';
import { ClaudeCodeAdapter } from '../src/adapters/claude-code.ts';
import { CodexAdapter } from '../src/adapters/codex.ts';
import { OpenCodeAdapter } from '../src/adapters/opencode.ts';
import { ScriptedCodex } from './fakes/scripted-codex.ts';
import { sshHost } from '../src/host/ssh-host.ts';
import { AgentClient } from '../src/host/agent-client.ts';
import { SshTransport } from '../src/transport/ssh.ts';
import { Store } from '../src/hub/store.ts';
import { ProcessTable } from '../src/adapters/processes.ts';
import { launchGenerationKey } from '../src/adapters/launch-generation.ts';
import { fixtureEnvironment } from './fixture-environment.ts';
import { layout } from '../src/project.ts';
import { remoteDiscovery } from '../src/host/discovery.ts';
import { setRoleKey } from '../src/roles/editor.ts';
import { systemProcesses } from '../src/system-processes.ts';
import { observeProcesses } from '../src/host/agent/native.ts';
import { FakeClock } from './fake-clock.ts';
import { remoteRedactor } from '../src/host/agent/redact.ts';
import { HOST_SETTLEMENT_MS, type HostSettlement } from '../src/host/settle.ts';

const SETUP_BUDGET_MS = testWaitMs(45000);
const REVOKE_FRAME_MS = HOST_SETTLEMENT_MS + 3000;

test('revoke settles live Claude Codex OpenCode and an already released Claude generation on the fake host', {timeout:SETUP_BUDGET_MS + REVOKE_FRAME_MS}, async t=>{
  const f=await sshHostFixture(t,{startTransport:false}), fake=await fakeClaude(t,{awaitSignals:true});
  const code=join(f.fake.home,'code');await symlink(new URL('../../',import.meta.url).pathname,code);
  const remote={...f.layout,node:process.execPath,cli:join(code,'hub/bin/cland.ts'),spoke:join(code,'hub/bin/cland-spoke.ts'),modDir:join(code,'hub/mod/cland')};
  let carrier:SshTransport, store:Store|undefined;
  const postCut:string[]=[], stopResults:unknown[]=[],retirementFailures:Array<{session:string;error:string}>=[];
  const redact=remoteRedactor([f.secrets.readSecret('f1')]);
  const machine=sshHost({name:'f1',layout:remote,available:()=>!store||store.hosts.get('f1')?.state==='registered',
    transport:{status:()=>carrier.status(),forward:(...args)=>carrier.forward(...args),unforward:(...args)=>carrier.unforward(...args)},
    connect:async()=>{const client=await AgentClient.connect(f.paths.agentSocket,f.secrets.readSecret('f1'));const request=client.request.bind(client);client.request=(op,...args)=>{if(store?.hosts.get('f1')?.state==='revoked')postCut.push(op);return request(op,...args).then(result=>{if(op==='prepare-stop')stopResults.push({op,prepared:!!(result as {token?:string}).token,targets:(result as {targets?:unknown[]}).targets});else if(op==='commit-prepared'&&typeof result==='boolean')stopResults.push({op,result});return result;});};return client;}});
  f.addCleanup(()=>machine.close());
  const spawn=machine.spawn.bind(machine), ports:Record<string,string>={};let nextPort=12345;
  machine.spawn=async(command,options)=>{
    const socket=join(f.fake.home,'s'+command.args[command.args.indexOf('--port')+1]+'.sock');
    if(command.args.includes('--port')){ports[String(command.args[command.args.indexOf('--port')+1])]=socket;await writeFile(join(f.fake.directory,'ports.json'),JSON.stringify(ports));}
    return spawn({...command,env:fixtureEnvironment(f.root,command.env,{...command.env,
      FAKE_OPENCODE_HOME:join(f.fake.home,'native'),FAKE_OPENCODE_SOCKET:socket,FAKE_OPENCODE_TURN_MS:'30'})},options);
  };
  machine.freePort=async()=>nextPort++;
  let blockedDirectory='';
  const remove=machine.removePath.bind(machine);
  machine.removePath=async(path,options)=>{if(blockedDirectory&&path.startsWith(blockedDirectory+'/'))throw new Error('held released generation private deletion');await remove(path,options);};
  const codexBin=join(f.fake.home,'codex-worker'),codexReady=join(f.fake.home,'codex-ready');
  await writeFile(codexBin,`#!${process.execPath}\nimport {writeFileSync} from 'node:fs';if(process.argv.includes('--version'))console.log('codex 0.160.0');else{writeFileSync(${JSON.stringify(codexReady)},'ready');setInterval(()=>{},1000);}\n`,{mode:0o700});
  const native=new ScriptedCodex();native.thread='revoke-thread';native.handlers.set('thread/start',()=>({thread:{id:native.thread,status:{type:'idle'}}}));
  const timers=new FakeClock(Date.now());
  const clock={now:()=>new Date(),setTimeout:timers.setTimeout.bind(timers),clearTimeout:timers.clearTimeout.bind(timers),setInterval:timers.setInterval.bind(timers),clearInterval:timers.clearInterval.bind(timers)};
  const claudeEnv=fixtureEnvironment(f.root,f.env,{...fake.env,HOME:f.fake.home,CLAUDE_CONFIG_DIR:fake.home});
  const hub=await projectHub(t,f.root,{}, {hosts:[machine],adapters:[
    boundary=>{const adapter=new ClaudeCodeAdapter(boundary,{clock,bin:new URL('./fakes/claude-code/claude',import.meta.url).pathname,stopGraceMs:50});const launch=adapter.spawn.bind(adapter);adapter.spawn=request=>launch({...request,accountEnv:claudeEnv});return adapter;},
    boundary=>new CodexAdapter(boundary,{clock,bin:codexBin,stopGraceMs:50,env:fixtureEnvironment(f.root,f.env),connect:async()=>{await eventually('Codex native readiness file',async()=>{try{return await readFile(codexReady,'utf8')==='ready'||undefined;}catch{return undefined;}},testWaitMs());return native;}}),
    boundary=>{const adapter=new OpenCodeAdapter(boundary,{clock,bin:new URL('./fakes/opencode/opencode',import.meta.url).pathname,stopGraceMs:50,env:fixtureEnvironment(f.root,f.env)});const release=adapter.releaseHostGeneration.bind(adapter);adapter.releaseHostGeneration=async(p,authorize)=>{try{await release(p,authorize);}catch(error){retirementFailures.push({session:p.name,error:redact(String(error))});throw error;}};return adapter;},
  ]});
  f.addCleanup(()=>hub.stop());
  store=new Store(join(f.root,'.cland/hub.db'));const table=new ProcessTable(join(f.root,'.cland/hub.db'));
  f.addCleanup(async()=>{
    const failures:unknown[]=[];
    for(const close of [()=>hub.stop(),()=>machine.close(),()=>carrier?.stop(),async()=>{table.close();store?.close();}])try{await close();}catch(error){failures.push(error);}
    if(failures.length)throw new AggregateError(failures,'host revocation fixture cleanup incomplete');
  });

  store.hosts.insert({...f.records.get('f1')!,clientKeyPath:'/fake',knownHosts:'fake'},f.secrets.readSecret('f1'));
  const roles=join(f.root,'.cland/roles.toml');await writeFile(roles,setRoleKey(await readFile(roles,'utf8'),'implementer','launch','writable_roots',['.']));
  await writeFile(remote.discoveryFile,JSON.stringify(remoteDiscovery(remote.runDirectory,f.secrets.readSecret('f1'))),{mode:0o600});
  carrier=new SshTransport({root:f.root,record:f.records.get('f1')!,secrets:f.secrets,hubSocket:layout(f.root).socket,spokeSocket:layout(f.root).spokeSocket,remoteRun:f.fake.run,supervisor:f.supervisor,agentCommand:['stub'],env:f.env});
  await carrier.start();await eventually('carrier up',()=>carrier.status().state==='up'||undefined,testWaitMs());
  const ui=await connectUi(t,hub.discovery,'cli');
  // T-1678: wait for turn-end hook writers in fixture setup before exercising revocation.
  const joinInitialWriters=async(pid:number)=>{
    const processes=await systemProcesses(undefined,undefined,undefined,false,f.env);
    const pids=processes.filter(row=>row.group===pid&&row.command.includes(remote.cli)&&!/\bhook\s+bridge\b/.test(row.command.replaceAll("'",'').replaceAll('"',''))).map(row=>row.pid);
    if(!pids.length)return;
    const pins=await eventually('initial writer native birth or exit',async()=>{const proof=await observeProcesses(pids,f.env);return pids.every(id=>proof.get(id)?.identity||proof.get(id)?.ended)?proof:undefined;},testWaitMs());
    const exits=await eventually('initial writers positively exited',async()=>{const proof=await observeProcesses(pids,f.env);return pids.every(id=>proof.get(id)?.ended||!!pins.get(id)?.identity&&!!proof.get(id)?.identity&&proof.get(id)!.identity!==pins.get(id)!.identity)?proof:undefined;},testWaitMs());
    assert.ok(pids.every(id=>exits.get(id)?.ended||!!pins.get(id)?.identity&&!!exits.get(id)?.identity&&exits.get(id)!.identity!==pins.get(id)!.identity));
  };

  // T-1678: pin a fresh completion count before delivery, then join its hook writers.
  const completeNativeTurn=async(row:NonNullable<ReturnType<typeof table.get>>,text:string)=>{
    await eventually('Claude native readiness receipt',async()=>(await fake.log(row.harnessId!)).includes('session ready')||undefined,testWaitMs());
    const baseline=(await fake.log(row.harnessId!)).match(/session\.measure done/g)?.length??0;
    const completed=eventually('fresh Claude native turn completion',async()=>((await fake.log(row.harnessId!)).match(/session\.measure done/g)?.length??0)>baseline||undefined,testWaitMs());
    try {const delivery=await ui.request({type:'topic.send',topic:'general',to:[row.name],text});assert.equal(delivery.ok,true,delivery.error);}
    finally {await completed;}
    await joinInitialWriters(row.pid!);
  };

  let stoppedOpenCode:ReturnType<typeof table.get>;
  for(const [name,harness] of [['stopped','opencode'],['released','claude-code'],['claude','claude-code'],['codex','codex'],['opencode','opencode']] as const){
    const result=await ui.request({type:'session.launch',name,harness,host:'f1',cwd:f.fake.home,role:'implementer'},15000);assert.equal(result.ok,true,result.error);
    if(name==='stopped'){
      stoppedOpenCode=table.get(name)!;
      const stopped=await ui.request({type:'session.stop',session:name},5000);assert.equal(stopped.ok,true,stopped.error);
      for(const file of ['opencode.json','password'])assert.equal((await stat(join(f.fake.home,'opencode',name,file))).isFile(),true,'normal stop retains resume files');
    }
    if(name==='released'){
      const row=table.get(name)!;
      await completeNativeTurn(row,'settle retained generation');
      const path=join(f.fake.run,'claude',store.meta(launchGenerationKey(row.sessionId))+'.json');
      blockedDirectory=JSON.parse(await readFile(path,'utf8')).privateDirectory;
      const stopped=await ui.request({type:'session.stop',session:name},5000);assert.equal(stopped.ok,false);assert.match(stopped.error!,/held released generation private deletion/,JSON.stringify(stopResults));
      assert.equal(JSON.parse(await readFile(path,'utf8')).released,true,'release checkpoint before private deletion fault');
      assert.equal(await machine.alive(row),false);blockedDirectory='';
    }
  }
  const rows=['claude','codex','opencode','released'].map(name=>table.get(name)!);
  const claudeRows=rows.filter(row=>row.harness==='claude-code');
  const receipts=claudeRows.map(row=>join(f.fake.run,'claude',store!.meta(launchGenerationKey(row.sessionId))+'.json'));
  const records=await Promise.all(receipts.map(async path=>JSON.parse(await readFile(path,'utf8')) as {privateDirectory:string;released?:boolean;job:string}));
  for(const row of rows.filter(row=>row.name!=='released')){assert.ok(row.pidIdentity);assert.equal(await machine.alive(row),true);}
  for(const record of records)for(const file of ['mcp.json','settings.json'])assert.equal((await stat(join(record.privateDirectory,file))).isFile(),true);
  for(const row of claudeRows.filter(row=>row.name!=='released'))await completeNativeTurn(row,'settle before revoke');
  const result=await ui.request({type:'host.revoke',host:'f1'},REVOKE_FRAME_MS);assert.equal(result.ok,true,result.error);
  const outcome=(result.value as {cleanup:HostSettlement}).cleanup;
  assert.deepEqual(outcome,{inventoryComplete:true,timedOut:false,leftovers:[]},JSON.stringify(retirementFailures));
  assert.equal(store.hosts.get('f1')?.state,'revoked');
  // On-disk receipts/native observations use fixture ownership, never the revoked Host.
  for(const path of receipts)await assert.rejects(stat(path),{code:'ENOENT'});
  for(const record of records){await assert.rejects(stat(record.privateDirectory),{code:'ENOENT'});await assert.rejects(stat(join(fake.home,'jobs',record.job+'.json')),{code:'ENOENT'});}
  for(const row of [...rows,stoppedOpenCode!].filter(row=>row.harness!=='claude-code'))await assert.rejects(stat(f.paths.sessionSocket(row.sessionId)),{code:'ENOENT'});
  for(const name of ['opencode','stopped'])for(const file of ['opencode.json','password'])await assert.rejects(stat(join(f.fake.home,'opencode',name,file)),{code:'ENOENT'});
  const launches=await readdir(join(f.fake.run,'launches')).catch(error=>{if(error.code==='ENOENT')return [];throw error;});assert.deepEqual(launches,[]);
  const allRows=[...rows,stoppedOpenCode!];
  const observed=await observeProcesses(allRows.map(row=>row.pid!),f.env);
  assert.equal(allRows.every(row=>observed.get(row.pid!)?.ended||!!observed.get(row.pid!)?.identity&&observed.get(row.pid!)?.identity!==row.pidIdentity),true,'every captured worker birth exited');
  await assert.rejects(machine.readFile(remote.discoveryFile),/revoked/);
  assert.deepEqual(postCut,[]);
});
