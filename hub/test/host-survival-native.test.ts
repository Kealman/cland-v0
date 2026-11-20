// T3: hub/carrier restart with native fake harnesses on two authenticated fake SSH hosts.
// Lifecycle: detached workers, production spokes and Unix forwards survive the hub; all owners join before removal.
import { testWaitMs } from './until.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { open, readFile, writeFile, symlink, mkdir, rmdir, unlink } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { sshHostFixture } from './ssh-host-fixture.ts';
import { createFakeHost, hostControl } from './fakes/fake-host.ts';
import { serveAgent } from '../src/host/agent/server.ts';
import { ProcessTable } from '../src/adapters/processes.ts';
import { setRoleKey } from '../src/roles/editor.ts';
import { hostPaths } from '../src/host/records.ts';
import { Store } from '../src/hub/store.ts';
import { projectHub, connectUi, eventually, fakeClaude, fakeCodex } from './harness.ts';
import { fixtureEnvironment } from './fixture-environment.ts';
import { testHost } from '../src/host/test-host.ts';
import { ClaudeCodeAdapter } from '../src/adapters/claude-code.ts';
import { CodexAdapter } from '../src/adapters/codex.ts';
import { OpenCodeAdapter } from '../src/adapters/opencode.ts';
import type { AdapterHost } from '../src/adapters/contract.ts';
import type { HarnessProcessView } from '../src/protocol.ts';
import { caseDeadlines } from './case-deadlines.ts';
import { beforeDirectories, guardDirectoryRemoval } from './process-cleanup.ts';
import { within } from '../src/executor/droplet/deadline.ts';
import { assertClaudeHookProcessed, claudeHookReceiptPath, type ClaudeHookClose } from './claude-hook-receipt.ts';
import { completedModInput, type ModClose, type ModInterpretation } from './claude-mod-receipt.ts';

test('three remote harnesses retain births, forwards and welcomed spokes across 20s hub downtime and master loss', {timeout:8 * testWaitMs() + 120000}, async t => {
  const scope = caseDeadlines(t,{timeoutMs:4*testWaitMs()+20000,ownership:{beforeDirectories,guardDirectoryRemoval}});
  await scope.run(async admit=>{
  const setupDeadline=performance.now()+4*testWaitMs()+20000;
  const f = await scope.wait('survival base fixture setup',()=>admit(()=>sshHostFixture(scope.fixtures,{startTransport:false})));
  scope.adoptRoot(f.root);
  await f.runOwned(async hostStep=>{
  let setup=true;
  const op=<T>(run:()=>Promise<T>):Promise<T>=>{
    const retained=scope.wait(setup?'survival initial setup step':'survival behavior step',()=>admit(()=>hostStep(run)));
    return setup?within(retained,Math.max(1,setupDeadline-performance.now()),undefined,()=>new Error('survival initial setup deadline exceeded')):retained;
  };
  await op(async()=>f.host.close());
  const second = await op(async()=>createFakeHost(f.root, 'f2'));
  const claude = await op(async()=>fakeClaude(scope.fixtures)), codex = await op(async()=>fakeCodex(scope.fixtures));
  const hookHold = join(claude.home,'start-hook-hold');
  const modHold=join(claude.home,'start-mod-hold');
  await op(()=>writeFile(modHold,'restart-cc'));
  f.addCleanup(async()=>{await unlink(modHold).catch(error=>{if(error.code!=='ENOENT')throw error;});});
  await op(async()=>writeFile(hookHold,'restart-cc'));
  f.addCleanup(async()=>{await unlink(hookHold).catch(error=>{if(error.code!=='ENOENT')throw error;});});
  const fakeHosts = [f.fake, second];
  const env = fixtureEnvironment(f.root, process.env, {...f.env, CLAND_FAKE_HOSTS:'f1,f2'});
  const rec = f.secrets.register({id:'f2',address:'f2',user:'agent',clientKeyPath:join(second.directory,'client-key'),knownHosts:`f2 ${second.key}\n`});
  await op(async()=>{
  const agent = await serveAgent({runDir:second.run,secret:f.secrets.readSecret('f2'),version:'test',env:fixtureEnvironment(f.root, process.env, {...env, CLAND_HOST_BOOT_ID_FILE:second.bootId})});
  f.addCleanup(async()=>{
    await agent.close();
    const paths = hostPaths(f.root,'f2');
    // Hub/carrier and agent owners are joined before removing their leftover socket inodes.
    for (const path of [paths.agentSocket,paths.gitSocket,paths.controlSocket]) await unlink(path).catch(error=>{if(error.code!=='ENOENT')throw error;});
    const directory = paths.socketDirectory;
    if (!directory.startsWith(f.root+'/')) await rmdir(directory).catch(error=>{if(error.code!=='ENOENT')throw error;});
  });
  });
  const configurations: Record<string, import('../src/host/registry.ts').HostConfiguration> = {};
  for (const [i, machine] of fakeHosts.entries()) {
    const code = join(machine.home, 'code');
    await op(async()=>symlink(new URL('../../', import.meta.url).pathname, code));
    await op(async()=>mkdir(join(machine.home,'.git')));
    await op(async()=>writeFile(join(machine.directory,'ports.json'), JSON.stringify({'12345':join(machine.home,'session.sock')})));
    configurations[`f${i+1}`] = {home:machine.home,supervisor:f.supervisor,layout:{node:process.execPath,cli:join(code,'hub/bin/cland.ts'),spoke:join(code,'hub/bin/cland-spoke.ts'),modDir:join(code,'hub/mod/cland')}};
  }
  const localCalls: string[] = [], stops: number[] = [];
  const modCompletions = new Set<string>();
  const modInputs = new Map<string,string[]>();
  const modInterpretations: ModInterpretation[]=[];
  const sentIds = new Map<string,string>();
  const processedHooks = new Set<string>();
  const observedInterpretations: Array<Record<string,unknown>> = [];
  let interpretationSequence = 0;
  const wrap = (machine: import('../src/host/host.ts').Host) => ({...machine,freePort:async()=>12345,stop:async(...args: Parameters<typeof machine.stop>)=>{stops.push(args[0].pid!);return machine.stop(...args);}});
  const boundary = (host: AdapterHost): AdapterHost => ({...host,hostForProcess: p => wrap(host.hostForProcess!(p)),hostForLaunch:p=>wrap(host.hostForLaunch!(p))});
  const start = () => projectHub(scope.fixtures,f.root,env,{hostConfigurations:configurations,hosts:[testHost('local',e=>localCalls.push(String(e.operation)))],adapters:[
    host=>{
      const adapter = new ClaudeCodeAdapter(boundary(host),{bin:new URL('./fakes/claude-code/claude',import.meta.url).pathname,pollMs:100});
      const interpret = adapter.interpret.bind(adapter);
      adapter.interpret = (...args) => {
        const meaning = interpret(...args);
        const process = args[2];
        if(process&&args[0].startsWith('mod-turn-')) {
          modInterpretations.push({sessionId:process.sessionId,event:args[0],at:args[3]!,turnId:typeof args[1].turnId==='string'?args[1].turnId:undefined,confirms:meaning.confirms});
          if(modInterpretations.length>256)modInterpretations.shift();
        }
        if(process&&['turn-start','turn-end','mod-turn-start','mod-turn-complete'].includes(args[0])) {
          observedInterpretations.push({sequence:++interpretationSequence,event:args[0],sessionId:process.sessionId,promptId:args[1].prompt_id??null,turnId:args[1].turnId??null,at:args[3]??null,stateCurrent:args[4]??true,confirms:meaning.confirms??[],state:meaning.state??null});
          if(observedInterpretations.length>256)observedInterpretations.shift();
        }
        if(process&&typeof args[1].prompt_id==='string'&&(args[0]==='turn-start'||args[0]==='turn-end')) processedHooks.add(args[0]+':'+args[1].prompt_id);
        if(process&&args[0]==='mod-turn-start') modInputs.set(process.sessionId,meaning.confirms??[]);
        return meaning;
      };
      const spawn = adapter.spawn.bind(adapter);
      adapter.spawn = request=>spawn({...request,accountEnv:fixtureEnvironment(f.root,process.env,{...env,...claude.env,CLAUDE_CONFIG_DIR:claude.home,FAKE_CLAUDE_START_HOLD:hookHold,FAKE_CLAUDE_MOD_START_HOLD:modHold})});
      return adapter;
    },
    host=>{
      const adapter = new CodexAdapter(boundary(host),{bin:new URL('./fakes/codex/codex',import.meta.url).pathname,env:fixtureEnvironment(f.root,process.env,{...env,...codex.env})});
      const spawn = adapter.spawn.bind(adapter);adapter.spawn=request=>spawn({...request,accountEnv:fixtureEnvironment(f.root,process.env,{...env,...codex.env})});return adapter;
    },
    host=>{
      const adapter = new OpenCodeAdapter(boundary(host),{bin:new URL('./fakes/opencode/opencode',import.meta.url).pathname,env:fixtureEnvironment(f.root,process.env,env)});
      const spawn = adapter.spawn.bind(adapter);adapter.spawn=request=>spawn({...request,accountEnv:fixtureEnvironment(f.root,process.env,{...env,FAKE_OPENCODE_HOME:join(second.home,'native'),FAKE_OPENCODE_SOCKET:join(second.home,'session.sock'),FAKE_OPENCODE_TURN_MS:'30'})});return adapter;
    },
  ]});
  const store = new Store(join(f.root,'.cland/hub.db'));
  for (const record of [f.records.get('f1')!,rec]) store.hosts.insert({...record,clientKeyPath:'/fake',knownHosts:'fake'},f.secrets.readSecret(record.id));
  store.close();
  let hub = await op(async()=>start()); f.addCleanup(()=>hub.stop());
  const rolesFile = join(f.root,'.cland/roles.toml');
  await op(async()=>writeFile(rolesFile,setRoleKey(await op(async()=>readFile(rolesFile,'utf8')),'implementer','launch','writable_roots',['.'])));
  let ui = await op(async()=>connectUi(scope.fixtures,hub.discovery)); await op(async()=>ui.request({type:'subscribe'}));
  const specs = [
    {name:'cc',harness:'claude-code',host:'f1',cwd:f.fake.home},
    {name:'cx',harness:'codex',host:'f2',cwd:second.home},
    {name:'oc',harness:'opencode',host:'f2',cwd:second.home,model:'opencode/fake-paid'},
  ];
  await op(async()=>eventually('both carriers ready', async () => {
    const status = (await op(async()=>ui.request({type:'hub.status'}))).value as {hosts:Array<{state:string}>};
    return status.hosts.length === 2 && status.hosts.every(host=>host.state==='up') || undefined;
  },testWaitMs()));
  const expected = new Map<string,string>();
  for (const spec of specs) {
    const launch = await op(async()=>ui.request({type:'session.launch',role:'implementer',...spec},20000));
    assert.equal(launch.ok,true,launch.error); // lint-allow-wall-clock: launch success is asserted; op's setup deadline does not enter the returned result.
    expected.set(spec.name,(launch.value as {process:{sessionId:string}}).process.sessionId);
  }
  const rows = async () => ((await op(async()=>ui.request({type:'session.list'}))).value as {processes:HarnessProcessView[]}).processes;
  const welcome = (budgetMs:number) => eventually('all exact spokes welcomed',async()=>{
    const status = (await op(async()=>ui.request({type:'hub.status'}))).value as {sessions:Array<{name:string;sessionId:string}>};
    return specs.every(spec=>status.sessions.some(p=>p.name===spec.name&&p.sessionId===expected.get(spec.name)))||undefined;
  },budgetMs);
  await op(async()=>welcome(testWaitMs()).catch(async error=>{
    t.diagnostic(JSON.stringify(((await op(async()=>ui.request({type:'hub.status'}))).value as {sessions:unknown}).sessions));
    t.diagnostic((await op(async()=>readFile(join(f.root,'.cland/log/hub.log'),'utf8'))).split('\n').filter(line=>/refus|hello|connect|spoke|auth|failed/.test(line)).slice(-35).join('\n'));
    for(const server of await op(async()=>codex.servers())) t.diagnostic((await op(async()=>codex.log(server.pid))).slice(-4000));
    for(const job of await op(async()=>claude.sessions())) t.diagnostic((await op(async()=>claude.log(job.id))).slice(-4000));
    t.diagnostic((await op(async()=>readFile(join(second.home,'opencode/oc/serve.log'),'utf8').catch(()=>'' ))).slice(-4000));
    throw error;
  }));
  const persisted = new ProcessTable(join(f.root,'.cland/hub.db')); f.addCleanup(async()=>persisted.close());
  const before = persisted.all(); assert.equal(before.length,3);
  for (const row of before) assert.ok(row.pidIdentity);
  const deliver = async (tag:string) => {
    for (const spec of specs) {
      let cancelReceipt=false;
      const receipt = op(()=>eventually('persisted spoke response '+spec.name+' '+tag,()=>cancelReceipt?{cancelled:true}:ui.frames.find(frame=>frame.type==='message'&&JSON.stringify(frame).includes('pong: '+tag+'-'+spec.name)),{ timeoutMs: 15000, behaviour: "post-signal receipt deadline" }));
      void receipt.catch(()=>{});
      try {
      const sent = await op(async()=>ui.request({type:'topic.send',topic:'general',to:[spec.name],text:tag+'-'+spec.name}));
      assert.equal(sent.ok,true,sent.error); // lint-allow-wall-clock: send success is asserted; op's setup deadline is not message data.
      sentIds.set(tag+'-'+spec.name,(sent.value as {message:{id:string}}).message.id);
      try { await receipt; } catch(error) {
        try {
        await op(async()=>{
          await ui.request({type:'hub.status',flushLogs:true});
          t.diagnostic(JSON.stringify({tag, session:spec.name, processes:await rows(), delivery:sent.value}));
          const log = await open(join(f.root,'.cland/log/hub.log'),'r');
          try {
          const size = (await log.stat()).size;
          const bytes = Buffer.alloc(Math.min(size,32768));
          const result = await log.read(bytes,0,bytes.length,Math.max(0,size-bytes.length));
          t.diagnostic(bytes.subarray(0,result.bytesRead).toString('utf8'));
          } finally { await log.close(); }
        });
        } catch(secondary) {
          try { t.diagnostic('secondary response diagnostic failure: '+String(secondary).slice(-1024)); } catch { /* primary remains selected */ }
        }
        throw error;
      }
      } finally { cancelReceipt=true; await receipt.catch(()=>{}); }
    }
  };
  setup=false;
  await op(async()=>deliver('before'));
  await op(async()=>hub.stop());
  assert.deepEqual(stops,[],'hub shutdown sends no native stop');
  await op(async()=>delay(20000,undefined,{signal:t.signal})); // lint-allow-wall-clock: acceptance explicitly requires a real 20s stopped hub interval.
  hub = await op(async()=>start()); ui = await op(async()=>connectUi(scope.fixtures,hub.discovery)); await op(async()=>ui.request({type:'subscribe'}));
  await op(async()=>welcome(/* behaviour: post-restart welcome deadline */ 15000));
  modCompletions.clear();
  await op(async()=>deliver('restart'));
  const held = JSON.parse(await op(async()=>readFile(hookHold+'.started','utf8'))) as {promptId:string;job:string};
  const cc = before.find(row=>row.name==='cc')!;
  assert.equal(held.job,cc.harnessId,'hold belongs to the captured native job'); // lint-allow-wall-clock: compares native job identities, not op's setup deadline.
  const requireHook = async(event:string, signalEvent:string) => {
    const closed=await op(()=>eventually('native close for '+event+' '+held.promptId,async()=>{
      try { return JSON.parse(await op(()=>readFile(claudeHookReceiptPath(hookHold,event,held.promptId),'utf8'))) as ClaudeHookClose; }
      catch(error) { if((error as NodeJS.ErrnoException).code==='ENOENT')return undefined;throw error; }
    },testWaitMs())).catch(cause=>{throw new Error('incomplete Claude hook: native close missing; producer exit/signal unknown',{cause});});
    assertClaudeHookProcessed(closed,{job:cc.harnessId!,promptId:held.promptId,event},processedHooks.has(signalEvent+':'+held.promptId));
    t.diagnostic(JSON.stringify({event:'held-hook-confirmed',sessionId:cc.sessionId,input:sentIds.get('restart-cc'),native:closed,processed:{event:signalEvent,promptId:held.promptId}}));
  };
  await requireHook('Stop','turn-end');
  const modClose=await op(()=>eventually('exact held mod completion native close',async()=>{
    try{return JSON.parse(await readFile(`${modHold}.complete.${held.promptId}.json`,'utf8')) as ModClose;}
    catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return undefined;throw error;}
  },testWaitMs())).catch(cause=>{throw new Error('incomplete mod completion: native close missing; producer exit/signal unknown',{cause});});
  await op(()=>eventually('exact held mod completion interpreted before releasing start',()=>modInterpretations.some(row=>row.sessionId===cc.sessionId&&row.event==='mod-turn-complete'&&row.at===modClose.payload.at)||undefined,testWaitMs()));
  const modStart=JSON.parse(await op(()=>readFile(modHold+'.started','utf8'))) as {turnId:string;at:number};
  await op(()=>unlink(modHold));
  await op(async()=>eventually('held input mod completion and persisted idle',async()=>{
    if(completedModInput(modClose,{job:cc.harnessId!,turnId:held.promptId,start:modStart,sessionId:cc.sessionId,input:sentIds.get('restart-cc')!},modInterpretations))modCompletions.add(sentIds.get('restart-cc')!);
    return modCompletions.has(sentIds.get('restart-cc')!)
      && (await op(async()=>rows())).some(row=>row.sessionId===cc.sessionId&&row.state==='idle') || undefined;
  },testWaitMs())).catch(async primary=>{
    // Capture before the SSH owner removes its independent fixture root.
    const expectedInput=sentIds.get('restart-cc');
    t.diagnostic(JSON.stringify({event:'held-predicate-failure',sessionId:cc.sessionId,expectedInput,completionPresent:expectedInput!==undefined&&modCompletions.has(expectedInput),modInputIds:modInputs.get(cc.sessionId)??[],modClose,modStart,observedInterpretations}));
    try {
      const state=await op(()=>rows());
      t.diagnostic(JSON.stringify({event:'held-predicate-persisted-state',rows:state.map(({sessionId,name,state,status})=>({sessionId,name,state,status})),idlePresent:state.some(row=>row.sessionId===cc.sessionId&&row.state==='idle')}));
    } catch(secondary) { t.diagnostic('held-predicate-state-incomplete: '+String(secondary).slice(-1024)); }
    try {
      await op(async()=>{
        await ui.request({type:'hub.status',flushLogs:true});
        const log=await open(join(f.root,'.cland/log/hub.log'),'r');
        try {
          const size=(await log.stat()).size;
          const bytes=Buffer.alloc(Math.min(size,32768));
          const result=await log.read(bytes,0,bytes.length,Math.max(0,size-bytes.length));
          t.diagnostic(JSON.stringify({event:'held-predicate-hub-log-tail',sourceBytes:size,keptBytes:result.bytesRead,limitBytes:32768,text:bytes.subarray(0,result.bytesRead).toString('utf8')}));
        } finally { await log.close(); }
      });
    } catch(secondary) { t.diagnostic('held-predicate-log-incomplete: '+String(secondary).slice(-1024)); }
    throw primary;
  });
  await op(async()=>unlink(hookHold));
  await requireHook('UserPromptSubmit','turn-start');
  for (const old of before) {
    const row = persisted.all().find(p=>p.sessionId===old.sessionId)!;
    assert.equal(row.status,'running');assert.equal(row.pid,old.pid);assert.equal(row.pidIdentity,old.pidIdentity);
  }
  const master = JSON.parse(await op(async()=>readFile(join(second.directory,'master-control'),'utf8'))) as {token:string};
  let cancelReplacement=false;
  const replacement = op(()=>eventually('replacement master durable receipt',async()=>{
    if(cancelReplacement)return true;
    try { return (JSON.parse(await op(async()=>readFile(join(second.directory,'master-control'),'utf8'))) as {token:string}).token !== master.token || undefined; } catch { return undefined; }
  },{ timeoutMs: 15000, behaviour: "post-signal receipt deadline" }));
  void replacement.catch(()=>{});
  try {
  await op(async()=>hostControl('kill-master','f2',env));
  assert.ok((await op(async()=>rows())).every(p=>p.status==='running')); // lint-allow-wall-clock: asserts persisted process statuses, not op's setup deadline.
  await op(async()=>replacement);
  } finally { cancelReplacement=true;await replacement.catch(()=>{}); }
  await op(async()=>welcome(/* behaviour: post-restart welcome deadline */ 15000)); await op(async()=>deliver('tunnel'));
  assert.deepEqual(stops,[]);
  assert.equal(localCalls.some(operation=>operation!=='limitPolls'),false,JSON.stringify(localCalls));
  for (const old of before) {
    const row = persisted.all().find(p=>p.sessionId===old.sessionId)!;
    assert.equal(row.status,'running');assert.equal(row.pidIdentity,old.pidIdentity);
  }
  // T-1678 owns the post-turn Claude stop refusal; preserve its failed variant in A-16593.
  // Survival ends without an explicit stop; the fixture joins every native writer before root removal.
  await op(async()=>hub.stop());
  assert.deepEqual(stops,[], 'final hub shutdown also preserves native workers for fixture-owned cleanup');
  });
  });
});
