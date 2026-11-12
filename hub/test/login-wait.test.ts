// T2: login waits and hub cards through session/inbox frames and the test messenger; no children.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { projectHub, tempProject, connectUi, eventually, type ProjectHubOptions } from './harness.ts';
import { testHost } from '../src/host/test-host.ts';
import { localHost } from '../src/host/local.ts';
import { fixtureEnvironment } from './fixture-environment.ts';
import { HostSecretStore } from '../src/host/records.ts';
import { readHostPools } from '../src/host/pools.ts';
import { onCleanup } from './process-cleanup.ts';
import { FakeClock } from './fake-clock.ts';
import { fakeLockProcesses } from './fakes/lock-processes.ts';
import { testMessenger } from './fakes/messenger.ts';
import type { Inbox } from '../src/protocol.ts';
import type { Login } from '../src/host/logins.ts';
import { reserveDiskLogin } from '../src/host/login-signin.ts';
import { Store } from '../src/hub/store.ts';
import { HubCore } from '../src/hub/core.ts';
import { LoginCards } from '../src/host/login-cards.ts';

async function fixture(t: test.TestContext, growth = false, cardSignIn = false) {
  let cancelled = false;
  const observers: Promise<unknown>[] = [];
  onCleanup(t, async () => { cancelled = true; await Promise.allSettled(observers); });
  const observe = <T>(what: string, check: () => Promise<T | undefined>) => {
    const stopped = Symbol('observer cancelled');
    const work = eventually<T | typeof stopped>(what, () => cancelled ? stopped : check()).then(value => {
      if (value === stopped) throw new Error(`${what}: observer cancelled`);
      return value;
    });
    observers.push(work); void work.catch(()=>{}); return work;
  };
  const root = await tempProject(t);
  await mkdir(join(root, ".cland"), {recursive:true});
  await writeFile(join(root, '.cland/config.toml'), '# managed by cland\n[hosts.agents]\nprovider="fake"\nslots=1\nmin_hosts=0\n[hosts.other]\nprovider="fake"\nslots=1\nmin_hosts=0\n');
  await writeFile(join(root, '.cland/roles.toml'), '[custom.worker]\nclause="Work."\n[custom.worker.launch]\nharness="codex"\npool="agents"\n[custom.second]\nclause="Work."\n[custom.second.launch]\nharness="codex"\npool="other"\n');
  const remote = testMessenger();
  const effects={preparations:0,native:0};
  const raised:Array<{id:string;kind:string;payload:unknown}>=[];
  const options = { clock: new FakeClock(), processes: fakeLockProcesses().processes, droplet: { processes: fakeLockProcesses().processes }, gatewayRemotes: [remote],
    registerHubCards:(cards:import('../src/hub/hub-cards.ts').HubCards)=>{
      const raise=cards.raise.bind(cards);
      t.mock.method(cards,'raise',(...args:Parameters<typeof raise>)=>{const id=raise(...args);raised.push({id,kind:args[0],payload:args[5]});return id;});
    },
    ...(cardSignIn?{
      prepareLogin:async(o:Parameters<NonNullable<ProjectHubOptions['prepareLogin']>>[0],input:Parameters<NonNullable<ProjectHubOptions['prepareLogin']>>[1])=>{
        effects.preparations++;
        const login=reserveDiskLogin({logins:o.records.logins,...input,providerName:'fake',region:'lon1'});
        o.records.logins.markSignedOut(login.name,{reason:'sign-in failed',host:null});
        throw Error('injected preparation refused before native admission');
      },
      runLoginSignIn:async()=>{effects.native++;throw Error('native sign-in must not be admitted');},
    }:{}) };
  const boot = Promise.withResolvers<void>();
  onCleanup(t, () => boot.resolve());
  const local = localHost(fixtureEnvironment(root, process.env));
  const host = {...testHost('a', () => {}), realpath:local.realpath, statDirectory:async()=>({refusal:null,identity:null})};
  const creates: string[] = [];
  const hub = await projectHub(t, root, growth ? {CLAND_FAKE_HOST_ROOT:root} : {}, {...options, ...(growth ? {hosts:[host],
    prepareLogin:async o => {
      o.records.logins.insert({name:'work',harness:'codex',account:'work',kind:'disk',provider:'fake',region:'lon1',volumeId:'volume-work',snapshotIds:[],lastSignIn:null});
      return {plan:{name:'work',host:'sign-in',command:'ssh',args:[]},pending:{name:'work',path:'/cland/auth/codex-work',complete:async code=>{if(code===0)return o.records.logins.transition('work','ready');o.records.logins.markSignedOut('work',{reason:'sign-in failed',host:null});return o.records.logins.get('work')!;}}};
    },
    createHost:async o => {
      o.admit?.('agents', readHostPools({agents:{provider:'fake',slots:1,min_hosts:0}}).pools.agents!);
      const row = {id:'a',pool:'agents',provider:'fake',region:'lon1',size:'fake',created:options.clock.now().toISOString(),state:'booting' as const,machine:{id:'a',address:'a',architecture:'x86_64' as const,created:options.clock.now().toISOString()}};
      o.records.provisions.save(row);
      creates.push(row.id);
      await boot.promise;
      new HostSecretStore(root,o.records,()=>{}).register({id:'a',address:'a',user:'fixture',clientKeyPath:'',knownHosts:''});
      // Injected creation settles binding; native binding is covered in login-provision-bind.
      o.records.logins.bind('work',{host:'a',role:'writer',volumeId:'volume-work'});
      const ready = {...row,state:'ready' as const};o.records.provisions.ready(ready);return ready;
    }} : {})});
  await writeFile(join(root, '.cland/config.toml'), '# managed by cland\n' + await readFile(join(root, '.cland/config.toml'), 'utf8'));
  const ui = await connectUi(t, hub.discovery, 'cli');
  const launch = async (name: string) => {
    const reply = await ui.request({ type: 'session.launch', name, role: 'worker', harness: 'codex' });
    assert.equal(reply.ok, true, reply.error);
    return reply;
  };
  const inbox = async () => (await ui.request({ type: 'inbox.list' })).value as Inbox;
  return { root, hub, ui, launch, inbox, options, remote, boot, observe, creates, effects, raised };
}

test('login waits share one create card and the final cancellation withdraws it', async t => {
  const f = await fixture(t);
  await f.launch('one'); await f.launch('two');
  const inbox = await f.inbox();
  assert.deepEqual(inbox.waitingLaunches?.map(w => w.reason), ['waiting for a login codex', 'waiting for a login codex']);
  assert.equal(inbox.asks.length, 1);
  assert.equal(inbox.asks[0]!.question, 'Not enough codex logins. Create one?');
  assert.deepEqual(inbox.asks[0]!.options, ['Create one', 'Not now']);
  const listed = (await f.ui.request({ type: 'session.list' })).value as { waiting: Array<{reason:string}> };
  assert.deepEqual(listed.waiting.map(w => w.reason), ['waiting for a login codex', 'waiting for a login codex']);
  const history = (await f.ui.request({ type: 'topic.history', topic: 'agents', limit: 100 })).value as {messages:Array<{kind?:string;detail?:{session?:string}}>};
  assert.equal(history.messages.filter(m => m.kind === 'session-waiting' && m.detail?.session === 'one').length, 1);
  assert.equal((await f.ui.request({type:'session.stop',session:'one'})).ok, true);
  assert.equal((await f.inbox()).asks.length, 1);
  assert.equal((await f.ui.request({type:'session.stop',session:'two'})).ok, true);
  assert.equal((await f.inbox()).asks.length, 0);
});

test('login cards are scoped by pool and harness across repeated scheduler passes', async t => {
  const f = await fixture(t);
  await f.launch('codex-one');
  for (const frame of [
    {type:'session.launch',name:'opencode-one',role:'worker',harness:'opencode'},
    {type:'session.launch',name:'other-codex',role:'second',harness:'codex'},
  ]) {
    const result = await f.ui.request(frame); assert.equal(result.ok, true, result.error);
  }
  const before = await f.inbox();
  assert.equal(before.asks.length, 3);
  for (const spread of [true, false, true]) {
    const changed = await f.ui.request({type:'config.set',key:'hosts.agents.spread',value:spread});
    assert.equal(changed.ok, true, changed.error);
    assert.deepEqual((await f.inbox()).asks.map(a=>a.id), before.asks.map(a=>a.id));
  }
});

test('login add ready receipt wakes host growth, changes the reason and places the launch', async t => {
  const f = await fixture(t, true);
  await f.launch('one');
  assert.equal((await f.inbox()).asks.length, 1);
  assert.deepEqual(f.creates, [], 'login shortage admits no demand creation');
  assert.deepEqual((await f.ui.request({type:'host.list'})).value, []);
  assert.equal((await f.ui.request({type:'login.add',harness:'codex'})).ok, true);
  assert.equal((await f.inbox()).waitingLaunches?.[0]?.reason, 'waiting for a login codex');
  assert.deepEqual(f.creates, [], 'creating login admits no demand creation');
  assert.deepEqual((await f.ui.request({type:'host.list'})).value, []);
  const booting = f.observe('durable boot wait', async () => {
    const inbox = await f.inbox();
    return inbox.waitingLaunches?.[0]?.reason === 'waiting for host a to boot' ? inbox : undefined;
  });
  void booting.catch(()=>{});
  const signedIn=await f.ui.request({type:'login.signed-in',name:'work',code:0});
  assert.equal(signedIn.ok,true,JSON.stringify(signedIn));
  assert.equal((await booting).asks.length, 0);
  assert.deepEqual(f.creates, ['a'], 'ready login admits exactly one persisted boot row');
  const listedHosts = await f.ui.request({type:'host.list'});
  assert.equal(listedHosts.ok, true, listedHosts.error);
  const inventory = listedHosts.value as Array<{id:string;state:string}>;
  assert.deepEqual(inventory.map(row=>[row.id,row.state]), [['a','booting']]);
  const placed = f.observe('published process on ready host', async () => {
    const listed = (await f.ui.request({type:'session.list'})).value as {processes:Array<{name:string;host?:string}>;waiting:unknown[]};
    return listed.processes.some(p=>p.name==='one') ? listed : undefined;
  });
  void placed.catch(()=>{});
  f.boot.resolve();
  const listed = await placed;
  assert.equal(listed.processes.find(p=>p.name==='one')?.host, 'a');
  assert.deepEqual(listed.waiting, []);
  assert.equal((await f.inbox()).asks.length, 0);
});

for (const option of [1, 2, 'decline'] as const) test(`login card option ${option} folds once across retries and restart`, async t => {
  const f = await fixture(t,false,option===1);
  await f.launch('one');
  const id = (await f.inbox()).asks[0]!.id;
  const signedOut=option===1?f.observe('persisted signed-out login and distinct episode card',async()=>{
    const rows=(await f.ui.request({type:'login.list'})).value as Login[];
    const login=rows.find(row=>row.state==='signed-out');
    const card=(await f.inbox()).asks.find(ask=>ask.id!==id);
    return login?.signedOut&&card?{login,card}:undefined;
  }):undefined;
  const result = await f.remote.client.request({type:'topic.answer',ask:id,...(option === 'decline' ? {declined:true,reason:'No login wanted'} : {option})});
  assert.equal(result.ok, true, result.error);
  const created=await signedOut;
  if(created){
    assert.deepEqual(f.raised.map(card=>[card.id,card.kind]),[[id,'login-create'],[created.card.id,'login-signin']]);
    assert.deepEqual(f.raised[1]!.payload,{login:created.login.name,episode:created.login.signedOut!.id});
    assert.equal((await f.remote.client.request({type:'topic.answer',ask:id,option:1})).ok,false,'answered wait card cannot start a second preparation');
  }
  await f.launch('two');
  assert.deepEqual((await f.inbox()).asks.map(ask=>ask.id),created?[created.card.id]:[],'the original wait card never reopens');
  assert.equal((await f.inbox()).waitingLaunches?.length, 2);
  const history = (await f.ui.request({type:'topic.history',topic:'general'})).value as {messages:Array<{id:string;answerTo?:string;ask?:{outcome?:{text?:string;reason?:string;status?:string}}}>};
  const outcome = history.messages.find(m => m.id === id)?.ask?.outcome;
  if (option === 'decline') assert.equal(outcome?.status, 'declined');
  assert.equal(option === 'decline' ? outcome?.reason : outcome?.text, option === 1 ? 'Signing in' : 'Not now');
  assert.equal(history.messages.filter(message=>message.answerTo===id).length,1,'one durable answer folds the wait card');
  await f.ui.close(); await f.hub.stop();
  const hub = await projectHub(t, f.root, {}, {...f.options, gatewayRemotes:[testMessenger()]});
  const ui = await connectUi(t, hub.discovery, 'cli');
  const inbox = (await ui.request({type:'inbox.list'})).value as Inbox;
  assert.deepEqual(inbox.asks.map(ask=>ask.id),created?[created.card.id]:[],'restart preserves the same episode card without another wait card');
  assert.equal(inbox.waitingLaunches?.length, 2);
  if(created){
    const rows=(await ui.request({type:'login.list'})).value as Login[];
    assert.equal(rows.length,1);
    assert.deepEqual(rows[0]!.signedOut,created.login.signedOut);
    assert.deepEqual(f.effects,{preparations:1,native:0});
    assert.deepEqual(f.raised.map(card=>card.kind),['login-create','login-signin']);
    assert.equal((await ui.request({type:'topic.answer',ask:id,option:1})).ok,false);
    assert.deepEqual(f.effects,{preparations:1,native:0});
  }
});

test('login create without a sign-in owner keeps the terminal command hint and one wait card',()=>{
  const store=new Store(':memory:'),clock=new FakeClock(),core=new HubCore({store,clock});
  try{
    const cards=new LoginCards(store,core.cards);
    const waits=[{name:'one',role:'worker',pool:'agents',reason:'waiting for a login codex',since:clock.now().toISOString()}];
    cards.reconcile(waits);
    const before=core.inbox.list().asks[0]!;
    const result=core.cards.answer(store.ask(before.id)!,'Create one',1,'neovim');
    assert.equal(result.message.ask.outcome?.status,'answered');
    assert.equal(result.message.ask.outcome?.status==='answered'?result.message.ask.outcome.text:undefined,'cland login add codex --pool agents');
    cards.reconcile([...waits,{...waits[0]!,name:'two'}]);
    new LoginCards(store,core.cards).reconcile(waits);
    assert.equal(store.ask(before.id)!.state,'answered');
    assert.equal(core.inbox.list().asks.length,0);
    assert.equal(store.hosts.logins.list().length,0,'a missing owner performs no preparation');
  }finally{core.close();store.close();}
});

test('open login card survives restart and a later independent wait gets a new card', async t => {
  const f = await fixture(t);
  await f.launch('one');
  const id = (await f.inbox()).asks[0]!.id;
  await f.ui.close(); await f.hub.stop();
  const hub = await projectHub(t, f.root, {}, {...f.options, gatewayRemotes:[testMessenger()]});
  const ui = await connectUi(t, hub.discovery, 'cli');
  const inbox = async () => (await ui.request({type:'inbox.list'})).value as Inbox;
  assert.deepEqual((await inbox()).asks.map(a => a.id), [id]);
  assert.equal((await ui.request({type:'session.stop',session:'one'})).ok, true);
  assert.equal((await inbox()).asks.length, 0);
  assert.equal((await ui.request({type:'session.launch',name:'new-wait',role:'worker',harness:'codex'})).ok, true);
  assert.equal((await inbox()).asks.length, 1);
  assert.notEqual((await inbox()).asks[0]!.id, id);
});
