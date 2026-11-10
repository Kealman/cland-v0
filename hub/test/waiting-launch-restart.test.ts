import {settledLogin} from './settled-login-fixture.ts';
// T2: projectHub restart on one disposable root; fake adapters, no native children.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { projectHub, tempProject, eventually, inProcessSpoke } from './harness.ts';
import { onCleanup } from './process-cleanup.ts';
import { sessionUi } from './session-credential-fixture.ts';

const observers = new WeakMap<test.TestContext, Array<() => Promise<void>>>();
function observerOwner(t: test.TestContext): Array<() => Promise<void>> {
  let steps = observers.get(t);
  if (!steps) {
    steps = []; observers.set(t,steps);
    const owned = steps;
    onCleanup(t,async()=>{ for (const step of owned.reverse()) await step(); });
  }
  return steps;
}

function observe<T>(t: test.TestContext, what: string, check: () => Promise<T | undefined>): Promise<T> {
  const cancelled = Symbol('cancelled');
  let cancel = false;
  let work: Promise<T> | undefined;
  observerOwner(t).push(async () => { cancel = true; await work?.catch(() => {}); });
  work = eventually<T | typeof cancelled>(what, () => cancel ? cancelled : check()).then(value => {
    if (value === cancelled) throw new Error(`${what}: cancelled during cleanup`);
    return value;
  });
  void work.catch(() => {});
  return work;
}

async function fixture(t: test.TestContext) {
  observerOwner(t); // FIFO resource cleanup: drain observers before any UI/store is registered.
  const root = await tempProject(t);
  await mkdir(join(root, '.cland'), {recursive:true});
  await writeFile(join(root,'.cland/config.toml'),'# managed by cland\n[hosts.agents]\nprovider="fake"\nslots=1\n');
  await writeFile(join(root,'.cland/roles.toml'),'[custom.worker]\nclause="Work."\n[custom.worker.launch]\nharness="codex"\npool="agents"\n');
  const hub = await projectHub(t,root);
  const ui = await sessionUi(t,hub.discovery,'cli');
  const coord = await inProcessSpoke(t,{discover:true,cwd:root,name:'coord',role:'coordinator',sessionId:'restart-coord'});
  await coord.waitForPresence(['coord']);
  await coord.close();
  const reply = await ui.request({type:'session.launch',name:'queued',role:'worker',harness:'codex'});
  assert.equal(reply.ok,true,reply.error);
  const waiting = (reply.value as {waiting:unknown}).waiting;
  assert.ok(waiting);
  return {root,hub,ui,waiting};
}

test('restart restores the original waiting status in session list and inbox', async t => {
  const f = await fixture(t);
  await f.ui.close(); await f.hub.stop();
  const hub = await projectHub(t,f.root);
  const ui = await sessionUi(t,hub.discovery,'cli');
  const list = (await ui.request({type:'session.list'})).value as {waiting:unknown[]};
  assert.deepEqual(list.waiting,[{...f.waiting as object,layer:"now"}]);
  const inbox = (await ui.request({type:'inbox.list'})).value as {waitingLaunches:unknown[]};
  assert.deepEqual(inbox.waitingLaunches,[f.waiting]);
  await ui.close(); await hub.stop();
  const third = await projectHub(t,f.root);
  const next = await sessionUi(t,third.discovery,'cli');
  const history = (await next.request({type:'topic.history',topic:'agents',limit:100})).value as {messages:import('../src/protocol.ts').Message[]};
  assert.equal(history.messages.filter(m=>m.kind==='session-waiting' && m.detail?.session==='queued' && !m.detail?.end).length,1);

});


test('a cancelled wait is absent after restart and its name can launch again', async t => {
  const f = await fixture(t);
  assert.equal((await f.ui.request({type:'session.stop',session:'queued'})).ok,true);
  await f.ui.close(); await f.hub.stop();
  const hub = await projectHub(t,f.root);
  const ui = await sessionUi(t,hub.discovery,'cli');
  assert.deepEqual(((await ui.request({type:'session.list'})).value as {waiting:unknown[]}).waiting,[]);
  const reply = await ui.request({type:'session.launch',name:'queued',role:'worker',harness:'codex'});
  assert.equal(reply.ok,true,reply.error);
  assert.ok((reply.value as {waiting:unknown}).waiting);
});

for (const removed of ['role','pool'] as const) test(`restart drops a wait whose ${removed} was removed with one Coordinator notice`, async t => {
  const f = await fixture(t);
  await f.ui.close(); await f.hub.stop();
  await writeFile(join(f.root,'.cland',removed === 'role' ? 'roles.toml' : 'config.toml'), removed === 'role' ? '[reviewer.launch]\npool="local"\n' : '# no pools\n');
  for (let restart = 0; restart < 2; restart++) {
    const hub = await projectHub(t,f.root);
    const ui = await sessionUi(t,hub.discovery,'cli');
    assert.deepEqual(((await ui.request({type:'session.list'})).value as {waiting:unknown[]}).waiting,[]);
    const history = (await ui.request({type:'topic.history',topic:'agents',limit:100})).value as {messages:import('../src/protocol.ts').Message[]};
    const notices = history.messages.filter(m => m.kind === 'session-waiting' && m.detail?.session === 'queued' && /removed/.test(m.text));
    assert.equal(notices.length,1);
    assert.match(notices[0]!.text,new RegExp(`queued.*${removed} .*removed`));
    assert.deepEqual(notices[0]!.to,['coord']);
    await ui.close(); await hub.stop();
  }
});

test('restored wait places once on capacity commit and placed launches never restore', async t => {
  const f = await fixture(t);
  await f.ui.close(); await f.hub.stop();
  const { Store } = await import('../src/hub/store.ts');
  const { HostSecretStore } = await import('../src/host/records.ts');
  const { testHost } = await import('../src/host/test-host.ts');
  const { localHost } = await import('../src/host/local.ts');
  const { fixtureEnvironment } = await import('./fixture-environment.ts');
  const { onCleanup } = await import('./process-cleanup.ts');
  const store = new Store(join(f.root,'.cland/hub.db'));
  onCleanup(t,()=>store.close());
  const {FakeHostProvider}=await import('../src/host/provider/fake.ts');
  const env=fixtureEnvironment(f.root,process.env,{CLAND_FAKE_HOST_ROOT:f.root});
  const provider=new FakeHostProvider({env});
  const acquired=await provider.acquire({project:f.root,pool:'agents',architecture:'x86_64'});
  assert.equal(acquired.state,'created');if(acquired.state!=='created')throw Error('fixture acquisition failed');
  onCleanup(t,()=>provider.release(acquired.machine));
  new HostSecretStore(f.root,store.hosts,()=>{}).register({id:'a',address:acquired.machine.address,user:'fixture',clientKeyPath:'',knownHosts:''});
  const now = new Date().toISOString();
  settledLogin(store.hosts.logins,'a','codex',{provider:'fake',region:'fake'});
  store.hosts.provisions.save({id:'a',pool:'agents',provider:'fake',size:'fake',region:'fake',created:now,state:'cloning',machine:acquired.machine});
  const local = localHost(fixtureEnvironment(f.root,process.env));
  const hosts = [{...testHost('a',()=>{}),realpath:local.realpath,statDirectory:async()=>({refusal:null,identity:null})}];
  let records: import('../src/host/records.ts').HostRecords | undefined;
  const hub = await projectHub(t,f.root,{CLAND_FAKE_HOST_ROOT:f.root}, {hosts,createHost:async options=>{
    records=options.records;
    const creating={...records.provisions.get('a')!,state:'cloning' as const};
    records.provisions.save(creating);return creating;
  }});
  const ui = await sessionUi(t,hub.discovery,'cli');
  assert.equal(((await ui.request({type:'session.list'})).value as {waiting:unknown[]}).waiting.length,1);
  // A new role default does not migrate an admitted wait.
  await writeFile(join(f.root,'.cland/roles.toml'),'[custom.worker]\nclause="Work."\n[custom.worker.launch]\nharness="codex"\npool="local"\n');
  assert.equal((await ui.request({type:'hub.reload'})).ok,true);
  assert.equal((await ui.request({type:'host.create',pool:'agents'})).ok,true);
  const placed = observe(t,'restored process publication',async()=>{
    const list = (await ui.request({type:'session.list'})).value as {waiting:unknown[];processes:Array<{name:string;host:string}>};
    return list.processes.some(p=>p.name==='queued') ? list : undefined;
  });
  records!.provisions.ready({...records!.provisions.get('a')!,state:'ready'});
  const list = await placed;
  assert.deepEqual(list.waiting,[]);
  assert.equal(list.processes.find(p=>p.name==='queued')!.host,'a');
  assert.equal(hub.fakes.codex!.spawns.filter(p=>p.name==='queued').length,1);
  assert.equal((await ui.request({type:'session.stop',session:'queued'})).ok,true);
  await ui.close(); await hub.stop();
  const restarted = await projectHub(t,f.root,{CLAND_FAKE_HOST_ROOT:f.root}, {hosts});
  const next = await sessionUi(t,restarted.discovery,'cli');
  assert.deepEqual(((await next.request({type:'session.list'})).value as {waiting:unknown[]}).waiting,[]);
  assert.equal(restarted.fakes.codex!.spawns.length,0);
});

test('restart retains the admitted actor identity and refuses its revoked grant', async t => {
  const f = await fixture(t);
  const actor = await inProcessSpoke(t,{discover:true,cwd:f.root,name:'coord',role:'coordinator',sessionId:'restart-coord'});
  await actor.waitForPresence(['coord']);
  const reply = await actor.call<{ok:boolean;error?:string;waiting?:unknown}>('session.launch',{name:'actor-wait',role:'worker',harness:'codex'});
  assert.equal(reply.ok,true,reply.error); assert.ok(reply.waiting);
  await actor.close();
  assert.equal((await f.ui.request({type:'role.clear',session:'coord'})).ok,true);
  await f.ui.close(); await f.hub.stop();
  const events: Record<string,unknown>[] = [];
  const hub = await projectHub(t,f.root,{}, {log:entry=>events.push(entry)});
  const ui = await sessionUi(t,hub.discovery,'cli');
  await eventually('restored actor refusal',()=>events.find(e=>e.event==='waiting-launch-refused' && e.session==='actor-wait'));
  const list = (await ui.request({type:'session.list'})).value as {waiting:Array<{name:string}>};
  assert.deepEqual(list.waiting.map(row=>row.name),['queued']);
  assert.equal(hub.fakes.codex!.spawns.length,0);
});


test('a missing drop-notice receipt retains the wait for a later restart', async t => {
  const f = await fixture(t);
  await f.ui.close(); await f.hub.stop();
  await writeFile(join(f.root,'.cland/config.toml'),'# removed pool\n');
  const { HubCore } = await import('../src/hub/core.ts');
  const original = HubCore.prototype.noticeTo;
  const mock = t.mock.method(HubCore.prototype,'noticeTo',function(this: InstanceType<typeof HubCore>,topic: string,notice: Parameters<typeof original>[1]) {
    if (notice.kind==='session-waiting') return null;
    return original.call(this,topic,notice);
  });
  try { await assert.rejects(projectHub(t,f.root),/notice.*retain|retain.*notice/); }
  finally { mock.mock.restore(); }
  const hub = await projectHub(t,f.root);
  const ui = await sessionUi(t,hub.discovery,'cli');
  const history = (await ui.request({type:'topic.history',topic:'agents',limit:100})).value as {messages:import('../src/protocol.ts').Message[]};
  assert.equal(history.messages.filter(m=>m.kind==='session-waiting' && m.detail?.session==='queued' && /removed/.test(m.text)).length,1);
});

test('restart rechecks a human launch target against newly added user names', async t => {
  const f = await fixture(t);
  const { Store } = await import('../src/hub/store.ts');
  await f.ui.close(); await f.hub.stop();
  const store = new Store(join(f.root,'.cland/hub.db'));
  try { store.users.add('queued','Queued',[],Date.now()); } finally { store.close(); }
  const events: Record<string,unknown>[] = [];
  const hub = await projectHub(t,f.root,{}, {log:entry=>events.push(entry)});
  const ui = await sessionUi(t,hub.discovery,'cli');
  await eventually('user-name collision refused',()=>events.find(e=>e.event==='waiting-launch-refused' && e.session==='queued'));
  assert.deepEqual(((await ui.request({type:'session.list'})).value as {waiting:unknown[]}).waiting,[]);
});

test('restart preserves typed memory evidence until a fresh host memory report', async t => {
  const f = await fixture(t);
  await f.ui.close(); await f.hub.stop();
  const { Store } = await import('../src/hub/store.ts');
  const { HostSecretStore } = await import('../src/host/records.ts');
  const { testHost } = await import('../src/host/test-host.ts');
  const { HostMemoryFloorRefusal } = await import('../src/host/ssh-host.ts');
  const { fakeHarness } = await import('./fakes/harness.ts');
  const store = new Store(join(f.root,'.cland/hub.db'));
  onCleanup(t,()=>store.close());
  const now = new Date().toISOString();
  new HostSecretStore(f.root,store.hosts,()=>{}).register({id:'a',address:'a',user:'fixture',clientKeyPath:'',knownHosts:''});
  settledLogin(store.hosts.logins,'a','codex',{provider:'provided-fixture',region:'fake'});
  store.hosts.provisions.ready({id:'a',pool:'agents',provider:'provided-fixture',size:'fake',region:'fake',created:now,state:'ready',machine:{id:'a',address:'a',architecture:'x86_64',created:now}});
  const listeners = new Set<(bytes:number)=>void>();
  const hosts = [{...testHost('a',()=>{}),realpath:async(path:string)=>path,statDirectory:async()=>({refusal:null,identity:null}),onCapacityChanged:(listener:(bytes:number)=>void)=>{listeners.add(listener);return()=>{listeners.delete(listener);};}}];
  const low = await projectHub(t,f.root,{}, {hosts,adapters:[(host,clock)=>{
    const adapter = fakeHarness('codex',{host,clock});
    adapter.spawn = async()=>{throw new HostMemoryFloorRefusal('a',{code:'memory-floor',availableBytes:1200000000,floorBytes:1300000000});};
    return adapter;
  }]});
  const lowUi = await sessionUi(t,low.discovery,'cli');
  const reason = await eventually('durable memory reason',async()=>{
    const list = (await lowUi.request({type:'session.list'})).value as {waiting:Array<{reason:string;since:string}>};
    return list.waiting[0]?.reason.includes('1200000000') ? list.waiting[0] : undefined;
  });
  await lowUi.close(); await low.stop();
  const configPath = join(f.root,'.cland/config.toml');
  await writeFile(configPath,'# managed by cland\n'+await readFile(configPath,'utf8'));
  const hub = await projectHub(t,f.root,{}, {hosts});
  const ui = await sessionUi(t,hub.discovery,'cli');
  const config = await ui.request({type:'config.set',key:'hosts.agents.spread',value:true});
  assert.equal(config.ok,true,config.error);
  const list = (await ui.request({type:'session.list'})).value as {waiting:Array<{reason:string;since:string}>};
  assert.equal(list.waiting[0]?.reason,reason.reason);
  assert.equal(list.waiting[0]?.since,reason.since);
  assert.equal(hub.fakes.codex!.spawns.length,0);
  const placed = observe(t,'fresh memory places restored wait',async()=>{
    const rows = (await ui.request({type:'session.list'})).value as {processes:Array<{name:string}>};
    return rows.processes.find(p=>p.name==='queued');
  });
  for (const listener of listeners) listener(2000000000);
  assert.equal((await placed).name,'queued');
  assert.equal(hub.fakes.codex!.spawns.length,1);
});

test('restart preserves the captured inferred role check', async t => {
  const f = await fixture(t);
  const item = await f.ui.request({type:'task.create',kind:'task',size:'S',title:'Inferred admission'});
  assert.equal(item.ok,true,item.error);
  const id = (item.value as {item:{id:string}}).item.id;
  assert.equal((await f.ui.request({type:'role.set',session:'inferred-wait',role:'worker'})).ok,true);
  const reply = await f.ui.request({type:'session.launch',name:'inferred-wait',item:id,harness:'codex'});
  assert.equal(reply.ok,true,reply.error); assert.ok((reply.value as {waiting:unknown}).waiting);
  await f.ui.close(); await f.hub.stop();
  const { Store } = await import('../src/hub/store.ts');
  const store = new Store(join(f.root,'.cland/hub.db'));
  try { store.rememberRole('inferred-wait','reviewer'); } finally { store.close(); }
  const events: Record<string,unknown>[] = [];
  const hub = await projectHub(t,f.root,{}, {log:entry=>events.push(entry)});
  const ui = await sessionUi(t,hub.discovery,'cli');
  await eventually('changed inferred role refused',()=>events.find(e=>e.event==='waiting-launch-refused' && e.session==='inferred-wait'));
  const list = (await ui.request({type:'session.list'})).value as {waiting:Array<{name:string}>};
  assert.deepEqual(list.waiting.map(row=>row.name),['queued']);
});

test('different-name idle reuse consumes the admitted wait at publication and never replays', async t => {
  const f = await fixture(t);
  await f.ui.close(); await f.hub.stop();
  const { Store } = await import('../src/hub/store.ts');
  const { HostSecretStore } = await import('../src/host/records.ts');
  const { ProcessTable } = await import('../src/adapters/processes.ts');
  const { testHost } = await import('../src/host/test-host.ts');
  // Detach the synchronous borrower before FIFO resource cleanup closes either database.
  let observePublication = true;
  onCleanup(t,()=>{observePublication=false;});
  const store = new Store(join(f.root,'.cland/hub.db'));
  onCleanup(t,()=>store.close());
  const table = new ProcessTable(join(f.root,'.cland/hub.db'));
  onCleanup(t,()=>table.close());
  const now = new Date().toISOString();
  new HostSecretStore(f.root,store.hosts,()=>{}).register({id:'a',address:'a',user:'fixture',clientKeyPath:'',knownHosts:''});
  settledLogin(store.hosts.logins,'a','codex',{provider:'provided-fixture',region:'fake'});
  store.hosts.provisions.ready({id:'a',pool:'agents',provider:'provided-fixture',size:'fake',region:'fake',created:now,state:'ready',machine:{id:'a',address:'a',architecture:'x86_64',created:now}});
  await writeFile(join(f.root,'.cland/roles.toml'),await readFile(join(f.root,'.cland/roles.toml'),'utf8')+'\n[reviewer.launch]\npool="agents"\n');
  const hosts = [{...testHost('a',()=>{}),realpath:async(path:string)=>path,statDirectory:async()=>({refusal:null,identity:null})}];
  let publicationWait: unknown = 'unobserved';
  const hub = await projectHub(t,f.root,{}, {hosts,log:entry=>{if(observePublication && entry.event==='session-reused' && entry.requested==='review-new') publicationWait=table.waitingLaunch('review-new');}});
  const ui = await sessionUi(t,hub.discovery,'cli');
  await eventually('original worker restored placement',async()=>{
    const list = (await ui.request({type:'session.list'})).value as {processes:Array<{name:string}>};
    return list.processes.find(p=>p.name==='queued');
  });
  assert.equal((await ui.request({type:'crew.set',key:'reviewer.keep_context',value:true})).ok,true);
  assert.equal((await ui.request({type:'crew.set',key:'reviewer.size',value:2})).ok,true);
  const launched = await ui.request({type:'session.launch',name:'review-old',role:'reviewer',harness:'codex'});
  assert.equal(launched.ok,true,launched.error);
  const process = (launched.value as {process:{sessionId:string}}).process;
  const peer = await inProcessSpoke(t,{discover:true,cwd:f.root,name:'review-old',sessionId:process.sessionId,assignRole:false});
  await peer.waitForPresence(['review-old']);
  const item = await ui.request({type:'task.create',kind:'epic',title:'Review admission'});
  assert.equal(item.ok,true,item.error);
  const id = (item.value as {item:{id:string}}).item.id;
  const waiting = await ui.request({type:'session.launch',name:'review-new',role:'reviewer',harness:'codex',item:id});
  assert.equal(waiting.ok,true,waiting.error); assert.ok((waiting.value as {waiting:unknown}).waiting);
  const reused = observe(t,'idle reuse publication',async()=>{
    const list = (await ui.request({type:'session.list'})).value as {processes:Array<{name:string;item:string;sessionId:string}>};
    return list.processes.find(p=>p.name==='review-old' && p.item===id);
  });
  hub.fakes.codex!.idle('review-old');
  const configPath = join(f.root,'.cland/config.toml');
  await writeFile(configPath,'# managed by cland\n'+await readFile(configPath,'utf8'));
  const wake = await ui.request({type:'config.set',key:'hosts.agents.spread',value:true});
  assert.equal(wake.ok,true,wake.error);
  assert.equal((await reused).sessionId,process.sessionId);
  assert.equal(publicationWait,null);
  await peer.close(); await ui.close(); await hub.stop();
  const restart = await projectHub(t,f.root,{}, {hosts});
  const next = await sessionUi(t,restart.discovery,'cli');
  assert.deepEqual(((await next.request({type:'session.list'})).value as {waiting:unknown[]}).waiting,[]);
  assert.equal(restart.fakes.codex!.spawns.length,0);
});
