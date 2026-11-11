// T2: host status frame over in-process hub and a fake clock; no native hosts.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { projectHub, tempProject, connectUi, cland } from './harness.ts';
import { FakeClock } from './fake-clock.ts';
import {fakeLockProcesses} from './fakes/lock-processes.ts';
import { settledLogin } from './settled-login-fixture.ts';

test('C1 status includes configured empty pools and zero settled spend',async t=>{
 const root=await tempProject(t);
 await mkdir(join(root,'.cland'),{recursive:true});
 await writeFile(join(root,'.cland/config.toml'),'[hosts.agents]\nprovider="fake"\nslots=4\nmin_hosts=0\n');
 const hub=await projectHub(t,root,{}, {clock:new FakeClock(Date.now())});
 const ui=await connectUi(t,hub.discovery,'cli');
 const reply=await ui.request({type:'host.status'});
 assert.equal(reply.ok,true,reply.error);
 const cli=await cland(root,'host','status','--json');assert.equal(cli.code,0,cli.stderr);assert.deepEqual(JSON.parse(cli.stdout),reply.value);
 const text=await cland(root,'host','status');assert.match(text.stdout,/agents: 0 hosts.*slots 0\/0/);
 assert.deepEqual(reply.value,{pools:[{name:'agents',capacity:{},storage:0,hosts:[],hostCount:0,slotsUsed:0,slotsTotal:0,spend:{today:0,month:0}}]});
});

test('C1/C2 status weights sessions and clips live accrual to UTC day/month, excluding reservations',async t=>{
 const { HostSecretStore }=await import('../src/host/records.ts');
 const { testHost }=await import('../src/host/test-host.ts');
 const { localHost }=await import('../src/host/local.ts');
 const { fixtureEnvironment }=await import('./fixture-environment.ts');
 const { reserveHostSpend,settleHostSpend }=await import('../src/executor/droplet/spend.ts');
 const root=await tempProject(t),clock=new FakeClock(Date.parse('2026-11-02T01:00:00Z'));
 await mkdir(join(root,'.cland'),{recursive:true});
 await writeFile(join(root,'.cland/config.toml'),'[hosts.agents]\nprovider="fake"\nsize="fake"\nslots=4\nmin_hosts=0\n');
 const local=localHost(fixtureEnvironment(root,process.env));
 const hosts=['z-host','a-host'].map(id=>({...testHost(id,()=>{}),realpath:local.realpath,statDirectory:async()=>({refusal:null,identity:null})}));
 let records!:import('../src/host/records.ts').HostRecords;
 const hub=await projectHub(t,root,{CLAND_FAKE_HOST_ROOT:root},{clock,hosts,createHost:async o=>{records=o.records;return {id:'seed',pool:'agents',provider:'fake',size:'fake',region:'fake',created:clock.now().toISOString(),state:'creating'};}});
 const ui=await connectUi(t,hub.discovery,'cli');await ui.request({type:'host.create'});
 const created='2026-10-31T23:00:00Z';
 for(const id of ['z-host','a-host']){
  new HostSecretStore(root,records,()=>{}).register({id,address:id,user:'fixture',clientKeyPath:'',knownHosts:''});
  settledLogin(records.logins,id,'codex',{provider:id==='a-host'?'digitalocean':'fake',region:'fake-1'});
  records.provisions.ready({id,pool:'agents',provider:id==='a-host'?'digitalocean':'fake',size:'fake',region:'fake-1',created,state:'ready',machine:{id,address:id,architecture:'arm64',created}});
 }
 const gate=Promise.withResolvers<void>();let entered=false;
 const {eventually}=await import('./harness.ts');const {onCleanup}=await import('./process-cleanup.ts');
 const stat=hosts[0]!.statDirectory;hosts[0]!.statDirectory=async()=>{entered=true;await gate.promise;return stat();};
 const launching=ui.request({type:'session.launch',name:'worker',harness:'codex',host:'z-host',cwd:root});
 onCleanup(t,async()=>{gate.resolve();await launching;});
 await eventually('placement promise admitted before native setup',()=>entered?true:undefined);
 const promised=await ui.request({type:'host.status'});
 const waitingPool=(promised.value as {pools:Array<{slotsUsed:number;slotsPromised:number;hosts:Array<{sessions:string[]}>}>}).pools[0]!;
 assert.equal(waitingPool.slotsUsed,0.5);assert.equal(waitingPool.slotsPromised,0.5);assert.deepEqual(waitingPool.hosts.flatMap(h=>h.sessions),[]);
 gate.resolve();const launch=await launching;assert.equal(launch.ok,true,launch.error);
 const lease={project:root,lease:'settled',pool:'agents',size:'fake',priceHourly:2,billingMinimumMs:0,created:'2026-11-02T00:00:00Z',deadline:'2026-11-02T01:00:00Z'};
 await reserveHostSpend(lease,{shared:1000,hosts:1000},hub.hostEnvironment,{clock});
 await settleHostSpend(root,'settled',lease.deadline,hub.hostEnvironment,{clock});
 await reserveHostSpend({...lease,lease:'reservation-only'},{shared:1000,hosts:1000},hub.hostEnvironment,{clock});
 for(const id of ['z-host','a-host'])await reserveHostSpend({...lease,lease:id,created,deadline:'2026-11-03T00:00:00Z'},{shared:1000,hosts:1000},hub.hostEnvironment,{clock});
 const result=await ui.request({type:'host.status'});assert.equal(result.ok,true,result.error);
 const pool=(result.value as {pools:Array<{hostCount:number;slotsUsed:number;slotsTotal:number;spend:unknown;hosts:Array<{id:string;sessions:string[];uptime:number;priceHourly:number;state:string;size:string;region:string}>}>}).pools[0]!;
 assert.equal(pool.hostCount,2);assert.equal(pool.slotsUsed,0.5);assert.equal(pool.slotsTotal,8);
 assert.deepEqual(pool.spend,{today:6,month:102});
 records.provisions.save({...records.provisions.get('a-host')!,state:'unreachable' as import('../src/host/provision-records.ts').ProvisionState});
 const unreachable=await ui.request({type:'host.status'});assert.match(JSON.stringify(unreachable.value),/unreachable/);
 records.provisions.save({id:'legacy-unknown',pool:'agents',provider:'digitalocean',size:'fake',region:'fake',created,state:'failed',machine:{id:'legacy-unknown',address:'legacy-unknown',architecture:'arm64',created}});
 const unknown=await ui.request({type:'host.status'});
 assert.deepEqual((unknown.value as {pools:Array<{spend:unknown}>}).pools[0]!.spend,{today:null,month:null});
 const boundText=await cland(root,'host','status');assert.equal(boundText.code,0,boundText.stderr);assert.match(boundText.stdout,/logins codex\/codex-z-host/);
 assert.deepEqual(pool.hosts[1],{logins:[{harness:'codex',name:'codex-z-host'}],id:'z-host',size:'fake',region:'fake-1',state:'ready',uptime:93600,sessions:['worker'],priceHourly:2,slotsUsed:0.5,slotsTotal:4});
});

for(const failSetup of [false,true])test(`status ledger read drains before storage closes; setup failure=${failSetup}`,async t=>{
 const fs=(await import('node:fs/promises')).default;
 const {syncBuiltinESMExports}=await import('node:module');
 const {spendPath}=await import('../src/executor/droplet/spend.ts');
 const {eventually}=await import('./harness.ts');
 const {onCleanup}=await import('./process-cleanup.ts');
 const {createHubBase}=await import('../src/hub/server.ts');
 const {defaultConfig}=await import('../src/init/config.ts');
 const {fixtureEnvironment}=await import('./fixture-environment.ts');
 const root=await tempProject(t),env=fixtureEnvironment(root,process.env);
 const hub=createHubBase({secret:'fixture',env,clock:new FakeClock(Date.now()),projectConfig:()=>defaultConfig('fixture')});
 const gate=Promise.withResolvers<void>(),reply=Promise.withResolvers<import('../src/protocol.ts').HubFrame>(),refused=Promise.withResolvers<import('../src/protocol.ts').HubFrame>();
 const events:string[]=[];let entered=false,pending:Promise<import('../src/protocol.ts').HubFrame>|undefined,stopping:Promise<void>|undefined,cleaning:Promise<void>|undefined;
 const stop=()=>stopping??=hub.close().then(()=>{events.push('closed');});
 const cleanup=()=>cleaning??=(async()=>{gate.resolve();try{await pending;await stop();}finally{t.mock.restoreAll();syncBuiltinESMExports();}})();
 // Arm one release/join/close owner before installing mocks or admitting status.
 onCleanup(t,cleanup);
 const {ProvisionRecords}=await import('../src/host/provision-records.ts');
 const inventory=ProvisionRecords.prototype.currentInventory;
 t.mock.method(ProvisionRecords.prototype,'currentInventory',function*(this:import('../src/host/provision-records.ts').ProvisionRecords){events.push('inventory');yield* inventory.call(this);});
 const read=fs.readFile;
 t.mock.method(fs,'readFile',async(...args:Parameters<typeof fs.readFile>)=>{if(args[0]===spendPath(env)){entered=true;await gate.promise;}return read(...args);});
 syncBuiltinESMExports();
 const conversation=hub.dispatcher.open({send:frame=>{if('id' in frame&&frame.id==='status')reply.resolve(frame);if('id' in frame&&frame.id==='status2')refused.resolve(frame);},close:()=>{},isOpen:()=>true},{edge:'socket',authenticated:true});
 const body=async()=>{
  try {
   conversation.receive(JSON.stringify({type:'hello',protocol:2,client:'cli'}));
   pending=reply.promise;
   conversation.receive(JSON.stringify({type:'host.status',id:'status'}));
   if(failSetup)throw Error('forced setup boundary failure');
   await eventually('status entered ledger read',()=>entered?true:undefined);
   const close=stop();
   conversation.receive(JSON.stringify({type:'host.status',id:'status2'}));
   const refusal=await refused.promise;assert.equal(refusal.type,'result');
   if(refusal.type==='result'){assert.equal(refusal.ok,false);assert.match(refusal.error!,/host status stopped/);}
   gate.resolve();await pending;await close;
  } finally {await cleanup();}
 };
 if(failSetup)await assert.rejects(body(),/forced setup boundary failure/);else await body();
 assert.deepEqual(events,['inventory','closed']);
});

 test('login storage accrues in its recorded pool month only without reserving spend',async t=>{
 const {Store}=await import('../src/hub/store.ts');const {layout}=await import('../src/project.ts');
 const root=await tempProject(t),clock=new FakeClock(Date.parse('2026-11-16T00:00:00Z'));
 await mkdir(join(root,'.cland'),{recursive:true});
 await writeFile(join(root,'.cland/config.toml'),'[hosts.agents]\nprovider="fake"\nslots=4\nmin_hosts=0\n');
 const hub=await projectHub(t,root,{}, {clock,processes:fakeLockProcesses().processes,droplet:{processes:fakeLockProcesses().processes}});
 const store=new Store(layout(root).db);store.hosts.logins.useClock(clock);
 try{
 store.hosts.logins.insert({name:'cost',harness:'codex',account:'cost',kind:'disk',provider:'digitalocean',region:'lon1',volumeId:'v',snapshotIds:[],lastSignIn:null});
 store.hosts.logins.recordStorage('cost','agents',{kind:'volume',id:'v',sizeGiB:1,created:'2026-10-01T00:00:00Z',deleted:null});
 store.hosts.logins.recordStorage('cost','agents',{kind:'snapshot',id:'s',sizeGiB:1,created:'2026-11-01T00:00:00Z',deleted:null});
 store.hosts.logins.deleteStorage('cost','snapshot','s');
 store.hosts.logins.insert({name:'retired-live',harness:'codex',account:'retired',kind:'disk',provider:'fake',region:'fake-1',volumeId:'r',snapshotIds:[],lastSignIn:null});
 store.hosts.logins.recordStorage('retired-live','removed-pool',{kind:'volume',id:'r',sizeGiB:1,created:clock.now().toISOString(),deleted:null});
 }finally{store.close();}
 const ui=await connectUi(t,hub.discovery,'cli');const result=await ui.request({type:'host.status'});assert.equal(result.ok,true,result.error);
 const pool=(result.value as {pools:{storage:number;spend:{today:number;month:number}}[]}).pools[0]!;
 assert.equal(pool.storage,0.08);assert.deepEqual(pool.spend,{today:0,month:0.08});
 assert.deepEqual((result.value as {pools:{name:string}[]}).pools.map(pool=>pool.name),['agents','removed-pool']);
 assert.doesNotMatch(JSON.stringify(result.value),/storage_through|storage_pool|9999-12-31/);
 });
