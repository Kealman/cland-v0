// T1: in-memory Host receipts and a fake deadline; no native processes.
import test from 'node:test';
import assert from 'node:assert/strict';
import { settleHostBeforeCut, hostRevocationLines } from '../src/host/settle.ts';
import { localHost } from '../src/host/local.ts';
import { FakeClock } from './fake-clock.ts';

const generation = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const directory = '/owned/run/sessions/' + 'a'.repeat(64) + '/' + generation;

test('pre-cut stops Claude, Codex and OpenCode then releases retained generation files and forgets', async () => {
  let cut = false;
  const calls: string[] = [], files = new Set(['receipt', 'mcp.json', 'settings.json', 'directory']);
  const record = (name: string) => { assert.equal(cut, false); calls.push(name); };
  const host = { ...localHost(), name: 'fake',
    listFolder: async () => { record('inventory'); return [generation+'.json']; },
    readFile: async () => { record('receipt'); return Buffer.from(JSON.stringify({privateDirectory:directory})); },
    adopt: async () => { record('adopt'); return { process:{pid:123,pidIdentity:'linux:boot:1'}, job:'job',session:'native',released:true,
      release:async()=>{record('release');}, forget:async()=>{record('forget');assert.equal(files.size,1);files.delete('receipt');} }; },
    fileType: async () => 'directory' as const, realpath:async (path:string)=>path,
    removePath: async (path:string) => { record('remove'); files.delete(path===directory?'directory':path.split('/').at(-1)!); },
  };
  const result = await settleHostBeforeCut({host,runDirectory:'/owned/run',
    steps:['claude-code','codex','opencode'].map(session=>({session,generation:session,settle:async()=>{record('stop '+session);}})),cut:()=>{cut=true;}});
  assert.deepEqual(result,{inventoryComplete:true,timedOut:false,leftovers:[]});
  assert.equal(files.size,0); assert.equal(cut,true);
  assert.deepEqual(calls.slice(0,3),['stop claude-code','stop codex','stop opencode']);
});

test('unreachable cleanup cuts at deadline and names every generation; late receipt starts no more Host calls', async () => {
  const clock = new FakeClock();
  const held = Promise.withResolvers<void>();
  let cuts = 0, inventories = 0;
  const run = settleHostBeforeCut({clock,timeoutMs:50,
    host:{...localHost(),listFolder:async()=>{inventories++;return [];}},runDirectory:'/owned/run',
    steps:['claude','codex','opencode'].map(session=>({session,generation:session+'-generation',settle:()=>held.promise})),cut:()=>{cuts++;}});
  await clock.advance(50);
  const result = await run;
  assert.equal(cuts,1);assert.equal(result.timedOut,true);assert.equal(result.inventoryComplete,false);
  assert.deepEqual(result.leftovers.map(row=>row.generation),['claude-generation','codex-generation','opencode-generation']);
  assert.equal(result.leftovers.every(row=>row.remaining.length===3),true);
  held.resolve(); await held.promise; await Promise.resolve();
  assert.equal(inventories,0);assert.equal(cuts,1);
});

test('held adoption crossing the cut never releases or deletes private files', async () => {
  const clock = new FakeClock();
  const held = Promise.withResolvers<void>(), entered = Promise.withResolvers<void>();
  let mutations = 0;
  const host = {...localHost(),listFolder:async()=>[generation+'.json'],readFile:async()=>Buffer.from(JSON.stringify({privateDirectory:directory})),
    adopt:async()=>{entered.resolve();await held.promise;return {process:{pid:1},job:'job',session:'s',released:true,release:async()=>{mutations++;},forget:async()=>{mutations++;}};},removePath:async()=>{mutations++;}};
  const run = settleHostBeforeCut({host,runDirectory:'/owned/run',steps:[],clock,timeoutMs:50,cut:()=>{}});
  let observed=false;void entered.promise.then(()=>{observed=true;});
  await clock.advance(49);assert.equal(observed,true,'adoption did not enter');
  await clock.advance(50);const report=await run;
  assert.equal(report.leftovers[0]?.generation,generation);
  held.resolve();await held.promise;await Promise.resolve();
  assert.equal(mutations,0);
});

test('revocation renderer accepts previous hub reply and labels unknown inventory and leftovers', () => {
  assert.deepEqual(hostRevocationLines({}), []);
  assert.deepEqual(hostRevocationLines({cleanup:{inventoryComplete:false,timedOut:true,leftovers:[{generation:'g',session:'s',remaining:['receipt'],reason:'incomplete'}]}}),[
    'agent generation inventory unknown','left generation g (s): receipt; incomplete',
  ]);
});

test('SSH acquisition crossing revocation sends no agent request', async () => {
  const { sshHost } = await import('../src/host/ssh-host.ts');
  const { EventEmitter } = await import('node:events');
  const acquired = Promise.withResolvers<import('../src/host/agent-client.ts').AgentClient>();
  let available = true, requests = 0;
  const fake = Object.assign(new EventEmitter(), {
    hello:{capabilities:['host-prepared-v1']},
    request:async()=>{requests++;return null;},close:async()=>{},
  }) as unknown as import('../src/host/agent-client.ts').AgentClient;
  const host = sshHost({name:'f1',available:()=>available,connect:()=>acquired.promise,
    transport:{status:()=>({name:'f1',state:'up',since:null,lastProbe:null,reconnects:0}),forward:async()=>({socket:'/fake/socket'}),unforward:async()=>{}},
    layout:{runDirectory:'/fake/run',logDirectory:'/fake/log',node:'',cli:'',spoke:'',discoveryFile:''}});
  const pending = host.readFile('/fake/private');
  available = false;acquired.resolve(fake);
  await assert.rejects(pending,/revoked/);
  assert.equal(requests,0);
  await host.close();
});

test('a pending private-file inventory stays unknown at the cut and drains its late result',async()=>{
  const clock=new FakeClock(),held=Promise.withResolvers<import('../src/host/settle.ts').HostLeftover[]>();
  let entered=false,owned:Promise<void>|undefined;
  const run=settleHostBeforeCut({clock,timeoutMs:50,host:{...localHost(),listFolder:async()=>[]},runDirectory:'/owned/run',steps:[],cut:()=>{},ownWork:work=>{owned=work.catch(()=>{});},retainedFiles:(async function*(){entered=true;yield {generation:'known-file',session:'known',remaining:['private files'],reason:'untracked'};for(const row of await held.promise)yield row;})()});
  await clock.advance(49);assert.equal(entered,true,'private inventory entered before deadline');
  await clock.advance(1);const result=await run;
  assert.equal(result.timedOut,true);assert.equal(result.inventoryComplete,false);
  assert.equal(result.leftovers.some(row=>row.generation==='known-file'),true,'observed partial inventory stays named');
  held.resolve([{generation:'late-file',session:'late',remaining:['private files'],reason:'untracked'}]);await owned;
  assert.equal(result.leftovers.some(row=>row.generation==='late-file'),false);
  assert.equal(result.inventoryComplete,false,'late response cannot upgrade the cut receipt');
});

test('SSH warm-up receipt crossing the cut never starts readiness cleanup or the caller request',async()=>{
  const {sshHost}=await import('../src/host/ssh-host.ts');const {EventEmitter}=await import('node:events');
  const held=Promise.withResolvers<unknown[]>(),clock=new FakeClock();let available=true,entered=false,ready=0,writes=0;
  const fake=Object.assign(new EventEmitter(),{hello:{capabilities:['host-prepared-v1']},request:async(op:string)=>{
    if(op==='native-receipts'){entered=true;return held.promise;}
    if(op==='writeFile')writes++;return [];
  },close:async()=>{}}) as unknown as import('../src/host/agent-client.ts').AgentClient;
  const host=sshHost({name:'f1',available:()=>available,agentReady:async()=>{ready++;},connect:async()=>fake,
    transport:{status:()=>({name:'f1',state:'up',since:null,lastProbe:null,reconnects:0}),forward:async()=>({socket:'/fake/socket'}),unforward:async()=>{}},
    layout:{runDirectory:'/fake/run',logDirectory:'/fake/log',node:'',cli:'',spoke:'',discoveryFile:''}});
  const pending=host.writeFile('/fake/private',Buffer.alloc(0));
  await clock.advance(1);assert.equal(entered,true,'warm-up native receipt is held');
  available=false;held.resolve([]);await assert.rejects(pending,/revoked/);
  assert.equal(ready,0);assert.equal(writes,0);await host.close();
});

test('changed boot requires two different canonical Linux boot identities',async()=>{
  const {hostBootChanged}=await import('../src/host/process-host.ts');
  const old='11111111-1111-1111-1111-111111111111',next='22222222-2222-2222-2222-222222222222';
  assert.equal(hostBootChanged(`linux:${old}:123`,next),true);
  for(const identity of [null,undefined,'',`darwin:${old}:123`,`linux:bad:123`,`linux:${old}:bad`,`linux:${old}:123:extra`])assert.equal(hostBootChanged(identity,next),false);
  for(const boot of [null,undefined,'',old,'bad',next+' '])assert.equal(hostBootChanged(`linux:${old}:123`,boot),false);
});

for(const boundary of ['watch-status','restore-callback','flush'] as const)test(`merged ${boundary} boundary starts no agent request after admission cut`,async()=>{
  const {sshHost}=await import('../src/host/ssh-host.ts'),{EventEmitter}=await import('node:events');
  const {PREPARED_HOST_CAPABILITY}=await import('../src/host/agent/protocol.ts');
  const {REF_WATCH_STATUS_CAPABILITY,REF_FLUSH_CAPABILITY}=await import('../src/host/agent/watch.ts');
  const held=Promise.withResolvers<void>(),clock=new FakeClock(),calls:string[]=[];let available=true,entered=false,ready=0;
  const client=Object.assign(new EventEmitter(),{hello:{capabilities:[PREPARED_HOST_CAPABILITY,REF_WATCH_STATUS_CAPABILITY,REF_FLUSH_CAPABILITY]},request:async(op:string)=>{
    calls.push(op);if(op===boundary){entered=true;await held.promise;}
    if(op==='restore-claude')return {incomplete:[]};return [];
  },close:async()=>{}}) as unknown as import('../src/host/agent-client.ts').AgentClient;
  const host=sshHost({name:'f1',available:()=>available,connect:async()=>client,agentReady:async()=>{ready++;},
    ...(boundary==='flush'?{}:{watchStatus:()=>{},restoreAdoptedWorkers:async(client:import('../src/host/agent-client.ts').AgentClient)=>{if(boundary==='restore-callback'){entered=true;await held.promise;}await client.request('restore-claude',{report:true});}}),
    transport:{status:()=>({name:'f1',state:'up',since:null,lastProbe:null,reconnects:0}),forward:async()=>({socket:'/fake/socket'}),unforward:async()=>{}},layout:{runDirectory:'/fake/run',logDirectory:'/fake/log',node:'',cli:'',spoke:'',discoveryFile:''}});
  const pending=boundary==='flush'?host.flushBranch!('/owned/task','t/task'):host.writeFile('/fake/private',Buffer.alloc(0));
  await clock.advance(1);assert.equal(entered,true,'requested durable/helper boundary entered');
  available=false;held.resolve();await assert.rejects(pending,/revoked/);
  assert.deepEqual(calls,boundary==='flush'?['processes','native-receipts','flush']:['watch-status']);
  assert.equal(ready,boundary==='flush'?1:0);await host.close();
});

test('unknown-authority Claude generation remains a named obligation and is never signalled',async()=>{
  let stops=0,mutations=0;
  const host={...localHost(),listFolder:async()=>[generation+'.json'],readFile:async()=>Buffer.from(JSON.stringify({privateDirectory:directory})),
    adopt:async()=>{throw new Error('process authority unknown; stop requires host reboot or recycling');},stop:async()=>{stops++;return false;},removePath:async()=>{mutations++;}};
  const result=await settleHostBeforeCut({host,runDirectory:'/owned/run',steps:[],cut:()=>{}});
  assert.equal(result.inventoryComplete,true);assert.equal(result.timedOut,false);assert.equal(result.leftovers.length,1);assert.equal(result.leftovers[0]?.generation,generation);
  assert.equal(result.leftovers[0]?.remaining.includes('worker (unconfirmed)'),true);assert.match(result.leftovers[0]!.reason,/incomplete/);assert.equal(stops,0);assert.equal(mutations,0);
});

test('generation stops share one stop/reap and retirement window before inventory',async()=>{
  const {HOST_SETTLEMENT_MS}=await import('../src/host/settle.ts');
  const {LAUNCH_SETTLEMENT_MS}=await import('../src/adapters/launch-settlement.ts');
  assert.equal(HOST_SETTLEMENT_MS,2*LAUNCH_SETTLEMENT_MS+2000);
  const clock=new FakeClock(),entered:string[]=[],finished:string[]=[];
  let inventory=0;
  const run=settleHostBeforeCut({clock,host:{...localHost(),listFolder:async()=>{inventory++;assert.equal(finished.length,3);return [];}},runDirectory:'/owned/run',cut:()=>{},
    steps:['claude','codex','opencode'].map((session,index)=>({session,generation:session,settle:async()=>{
      entered.push(session);
      await new Promise<void>(resolve=>clock.setTimeout(resolve,2*LAUNCH_SETTLEMENT_MS-index*1000));
      finished.push(session);
    }}))});
  assert.equal(entered.length,3,'every generation starts before another must finish');
  await clock.advance(2*LAUNCH_SETTLEMENT_MS);
  assert.deepEqual(await run,{inventoryComplete:true,timedOut:false,leftovers:[]});
  assert.equal(inventory,1);
  assert.deepEqual(finished,['opencode','codex','claude'],'reverse completion preserves generation ownership');
});
