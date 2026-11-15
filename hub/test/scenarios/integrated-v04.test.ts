// T3: two native fake SSH hosts, login subprocesses and busy-host restart in one project.
// Lifecycle: host-create-fixture joins hubs, watchdogs, agents and native workers before roots.
import test from 'node:test';
import assert from 'node:assert/strict';
import {join} from 'node:path';
import {readFile,writeFile,readdir,unlink,open} from 'node:fs/promises';
import {fixture} from '../host-create-fixture.ts';
import {testMessenger} from '../fakes/messenger.ts';
import {fakeDigitalOcean} from '../fakes/digitalocean/fake-api.ts';
import {connectUi,dispatcherUi,inProcessSpoke,eventually,testWaitMs} from '../harness.ts';
import {authenticatedWeb} from '../web-frame-client.ts';
import {Store} from '../../src/hub/store.ts';
import {ProcessTable} from '../../src/adapters/processes.ts';
import {hostDirectory} from '../../../shared/fake-host-directory.ts';
import {nativeLoginEnvironment} from '../login-native-environment.ts';
import {FakeHostProvider} from '../../src/host/provider/fake.ts';
import {createHost} from '../../src/host/provision-host.ts';
import {realClock} from '../../src/hub/clock.ts';
import type {Inbox,TopicMessage,HubFrame} from '../../src/protocol.ts';
import {ClaudeCodeAdapter} from '../../src/adapters/claude-code.ts';
import type {Host} from '../../src/host/host.ts';
import {fixtureEnvironment} from '../fixture-environment.ts';
import {remoteRedactor} from '../../src/remote/redact.ts';
import {scenarioReplyOwner} from '../scenario-reply-owner.ts';
import {onCleanup} from '../process-cleanup.ts';

// Faults affect only the named boundary after setup/admission has completed.
const fault=process.env.INTEGRATED_FAULT;
if(fault&&!['login','signin','users','restart','cap'].includes(fault))throw Error('unknown integrated fault');

async function retainedMatches(root:string,secret:string):Promise<string[]>{
 let files=0,bytes=0;
 const scan=async(directory:string):Promise<string[]>=>{
  const matches:string[]=[];
  for(const entry of await readdir(directory,{withFileTypes:true})){
   const path=join(directory,entry.name);
   if(entry.isDirectory())matches.push(...await scan(path));
   else if(entry.isFile()){
    const data=await readFile(path);bytes+=data.length;
    assert.ok(++files<=10000&&bytes<=128*1024*1024,'retention scan budget');
    if(data.includes(Buffer.from(secret)))matches.push(path);
   }
  }
  return matches;
 };
 return scan(root);
}

test('v0.4 integrated: remote login, live renewal, two users, busy restart and host sub-cap', {timeout:testWaitMs(240000)},async t=>{
 const frames:HubFrame[]=[];
 const replies=scenarioReplyOwner();onCleanup(t,()=>replies.close());
 const messenger=()=>{
  const remote=testMessenger('telegram','telegram'),receive=remote.receive.bind(remote);
  remote.receive=frame=>{frames.push(frame);const received=receive(frame);replies.receive(frame);return received;};return remote;
 };
 let remote=messenger();
 let secretSequence=0;
 const secretAnswer=async(ask:string)=>{
  const id='code-'+(++secretSequence);
  const reply=await replies.exchange(id,()=>remote.upload({type:'topic.answer',id,ask,text:'SENTINEL-integrated-code'},{chatId:'101',messageId:id},[]));
  assert.equal(reply.ok,true,reply.ok?undefined:reply.error);
 };
 let scenarioRoot='',scenarioEnv:NodeJS.ProcessEnv={};
 const wrapped=new WeakMap<Host,Host>();
 const nativeHost=(host:Host):Host=>{
  const cached=wrapped.get(host);if(cached)return cached;
  const row=store.hosts.provisions.get(host.name)!;
  const directory=hostDirectory(scenarioRoot,row.machine!.id),home=join(directory,'home');
  const decorate=(env:NodeJS.ProcessEnv)=>nativeLoginEnvironment(env,{FAKE_CLAUDE_HOME:join(home,'native'),FAKE_CLAUDE_TURN_MS:'20'});
  const result={...host,run:(command:Parameters<Host['run']>[0])=>host.run(Object.assign(command,{env:decorate(command.env)})),spawn:(command:Parameters<Host['spawn']>[0],options:Parameters<Host['spawn']>[1])=>host.spawn({...command,env:decorate(command.env)},options),...(host.launchClaude?{launchClaude:(command:Parameters<NonNullable<Host['launchClaude']>>[0],generation:Parameters<NonNullable<Host['launchClaude']>>[1])=>host.launchClaude!({...command,env:decorate(command.env)},generation)}:{})};
  wrapped.set(host,result);return result;
 };
 const f=await fixture(t,{adapters:[boundary=>new ClaudeCodeAdapter({...boundary,hostForLaunch:request=>nativeHost(boundary.hostForLaunch!(request)),hostForProcess:p=>nativeHost(boundary.hostForProcess!(p))},{bin:new URL('../fakes/claude-code/claude',import.meta.url).pathname,env:fixtureEnvironment(scenarioRoot,scenarioEnv),pollMs:50})],cardSignIn:{gatewayRemotes:[remote]},setup:async(root,env)=>{
  scenarioRoot=root;scenarioEnv=env;
  const config=join(root,'.cland/config.toml');
  await writeFile(config,'# managed by cland\n'+(await readFile(config,'utf8')).replace('slots=8','slots=1'));
  await writeFile(join(root,'.cland/roles.toml'),'[implementer.launch]\npool="agents"\nharness="claude-code"\nsandbox="workspace-write"\nwritable_roots=["."]\n[reviewer.launch]\npool="agents"\nharness="claude-code"\nsandbox="workspace-write"\nwritable_roots=["."]\n');
 }});
 const store=f.own(new Store(join(f.root,'.cland/hub.db'))),table=f.own(new ProcessTable(join(f.root,'.cland/hub.db')));
 let hub=f.hub,local=await connectUi(t,hub.discovery,'nvim');
 const ok=async(client:typeof local,input:{type:string}&Record<string,unknown>)=>{const reply=await client.request(input,testWaitMs(60000));assert.equal(reply.ok,true,reply.error);return reply.value;};
 const inbox=async()=>await ok(local,{type:'inbox.list'}) as Inbox;
 const history=async(client:typeof local)=>await ok(client,{type:'topic.history',topic:'general'}) as {messages:TopicMessage[]};
 const processRow=(name:string)=>eventually(`persisted running ${name}`,()=>{const p=table.get(name);return p?.status==='running'&&p.pid&&p.harnessSessionId?p:undefined;});
 const codeControl=join(f.root,'code-positive-control');await writeFile(codeControl,'SENTINEL-integrated-code');
 assert.deepEqual(await retainedMatches(f.root,'SENTINEL-integrated-code'),[codeControl]);await unlink(codeControl);
 // Path 1: a genuine pool wait and its remote card, then persisted placement.
 await ok(local,{type:'session.launch',name:'worker-a',role:'implementer',harness:'claude-code'});
 assert.equal((await inbox()).waitingLaunches?.[0]?.reason,'waiting for a login claude-code');
 const create=store.openAsks().find(a=>a.hubKind==='login-create')!;assert.ok(create);
 // Create via the Telegram boundary. The login is the real fake-binary sign-in.
 if(fault!=='login')await ok(remote.client,{type:'topic.answer',ask:create.id,option:1});
 if(fault!=='login'){
  const code=await eventually('Claude code card',()=>store.openAsks().find(row=>row.hubKind==='login-signin-code'));
  await secretAnswer(code.id);
 }
 await eventually('card login committed ready or bound',()=>store.hosts.logins.list().some(row=>['ready','in-use'].includes(row.state))?true:undefined);
 await eventually('first fake host durably ready',()=>store.hosts.provisions.list().some(row=>row.state==='ready')?true:undefined);
 const first=await processRow('worker-a');assert.notEqual(first.host,'local');
 assert.deepEqual((await inbox()).waitingLaunches,[]);
 assert.ok(frames.some(frame=>frame.type==='ask'&&frame.ask===create.id&&frame.card.state==='answered'));
 t.diagnostic('path 1: remote card released the waiting launch');

 // Path 2: same disk, binding and native birth through web Hosts sign-in frames.
 const firstHost=hub.hostOwner!.hosts.find(host=>host.name===first.host)!;
 const binding=store.hosts.logins.bindings(first.login!);
 store.hosts.logins.markSignedOut(first.login!,{reason:'fixture signout',host:first.host!});
 const web=await authenticatedWeb(t,local);
 const renewal=await ok(web,{type:'login.signin',name:first.login}) as {card:string};
 await ok(web,{type:'topic.answer',ask:renewal.card,text:'SENTINEL-integrated-code'});
 if(fault==='signin')await firstHost.stop(first);
 await eventually('same login renewed while bound',()=>store.hosts.logins.get(first.login!)?.state==='in-use'?true:undefined);
 assert.equal(await firstHost.alive(first),true,'renewal keeps the captured native process alive');
 assert.equal(table.get('worker-a')!.pid,first.pid);
 assert.deepEqual(store.hosts.logins.bindings(first.login!),binding);
 assert.deepEqual(await ok(web,{type:'login.list'}),await ok(local,{type:'login.list'}));
 assert.ok(renewal.card);await web.close();
 t.diagnostic('path 2: web renewal retained the native session and binding');

 // Fill a second host through a second login card, retaining the first reservation.
 await ok(local,{type:'session.launch',name:'worker-b',role:'reviewer',harness:'claude-code'});
 const next=await eventually('second login wait card',()=>store.openAsks().find(a=>a.hubKind==='login-create'));
 await ok(remote.client,{type:'topic.answer',ask:next.id,option:1});
 const secondCode=await eventually('second Claude code card',()=>store.openAsks().find(row=>row.hubKind==='login-signin-code'));
 await secretAnswer(secondCode.id);
 await eventually('two ready host records',()=>store.hosts.provisions.list().filter(row=>row.state==='ready').length===2?true:undefined);
 const second=await processRow('worker-b');assert.notEqual(second.host,first.host);

 // Path 3: users-mode identity is resolved from native ingress, then projected to the other user.
 const managedConfig=join(f.root,'.cland/config.toml');
 await writeFile(managedConfig,'# managed by cland 0.3.2\n'+await readFile(managedConfig,'utf8'));
 await ok(local,{type:'auth.mode',mode:'users'});
 const alice=store.users.first()!,bob=store.users.add('bob','Bob',[],Date.now());
 const invite=store.users.mintInvite(bob.id,Date.now());
 const control=join(f.root,'invite-positive-control');await writeFile(control,invite);
 assert.deepEqual(await retainedMatches(f.root,invite),[control]);await unlink(control);
 store.users.registerPassword(invite,'fixture-hash',Date.now(),()=>{});
 store.remotes.forMessenger('telegram').setUserPairing(bob.id,{userId:'202',chatId:'202',guildId:null,name:'Bob'});
 const other=await dispatcherUi(t,{open:(peer,transport)=>hub.dispatcher.open({...peer,send:frame=>{
  // Emulate loss of answer attribution only at this user's projection transport.
  if(fault==='users'&&frame.type==='result'&&frame.ok&&frame.value&&typeof frame.value==='object'&&'messages' in frame.value){
   const value=structuredClone(frame.value) as {messages:TopicMessage[]};
   for(const row of value.messages)if(row.ask?.outcome)delete row.ask.outcome;
   peer.send({...frame,value});return;
  }
  peer.send(frame);
 }},{...transport,edge:'web',user:()=>alice})},f.root);
 const coord=await inProcessSpoke(t,{cwd:f.root,discover:true,name:'coord',role:'coordinator',sessionId:'coord'});
 const ask=await coord.call<{ask:string}>('ask',{topic:'general',question:'Integrated release choice',options:['Ship','Wait']});
 const answered=replies.exchange('bob-answer',()=>remote.upload({type:'topic.answer',id:'bob-answer',ask:ask.ask,option:1},{chatId:'202',messageId:'bob-1',messengerUserId:'202'},[]));
 assert.equal((await answered).ok,true);
 const projected=(await history(other)).messages.find(row=>row.id===ask.ask)!;
 assert.ok(projected.ask?.outcome,'other user web projection retains the answered outcome');
 assert.equal(projected.ask!.outcome!.by,'bob');assert.equal(projected.ask!.outcome!.userId,bob.id);
 assert.equal((await history(other)).messages.find(row=>row.answerTo===ask.ask)!.userDisplayName,'Bob');
 assert.ok(frames.some(frame=>frame.type==='ask'&&frame.ask===ask.ask&&frame.card.state==='answered'));
 await other.close();
 t.diagnostic('path 3: the other user sees Bob and the remote answer');

 // Path 4: open ask is pending across restart; both native sessions must answer afterwards.
 const before=[first,second].map(p=>({name:p.name,pid:p.pid,sessionId:p.sessionId,host:p.host,harnessSessionId:p.harnessSessionId}));
 const pending=await coord.call<{ask:string}>('ask',{topic:'general',question:'Pending across restart',options:['Keep']});
 await coord.close();
 await local.close();await hub.stop();
 // Model two deliveries already durably admitted when the old hub went away.
 // Their native consumption, rather than merely loading the rows, is the receipt.
 const queued=before.map(p=>({id:'integrated-pending-'+p.name,from:'human',fromKind:'human' as const,userId:alice.id,via:'hub' as const,to:[p.name,...before.filter(other=>other.name!==p.name).map(other=>other.name)],text:'@worker-a @worker-b integrated-pending-'+p.name,topic:'general',ts:new Date().toISOString()}));
 for(const message of queued)store.record(message,message.to.map(session=>({session,state:'queued',direct:true})),Date.now());
 assert.ok(queued.every(message=>store.deliveriesOf(message.id).length===2&&store.deliveriesOf(message.id).every(row=>row.state==='queued')));
 let observersStopped=false;
 const nativeReceipts=queued.flatMap(message=>message.to.map(receiver=>{
  const work=eventually('native persisted reply '+message.id+' '+receiver,()=>observersStopped?true:store.topicMessages('general',100).some(row=>row.from===receiver&&row.text.startsWith('pong: ')&&row.text.includes(message.text))||undefined);
  void work.catch(()=>{});return {message,receiver,work};
 }));
 f.beforeStop(async()=>{observersStopped=true;await Promise.allSettled(nativeReceipts.map(receipt=>receipt.work));});
 if(fault==='restart')table.removeBatch([table.get('worker-b')!]);
 remote=messenger();hub=await f.start({gatewayRemotes:[remote]});local=await connectUi(t,hub.discovery,'nvim');
 await eventually('both native sessions recovered',async()=>{
  const value=await ok(local,{type:'session.list'}) as {processes:Array<{name:string;status:string}>};
  return before.every(p=>value.processes.some(row=>row.name===p.name&&row.status==='running'))?true:undefined;
 });
 for(const p of before){
  const current=table.get(p.name)!;
  for(const key of ['pid','sessionId','host','harnessSessionId'] as const)assert.equal(current[key],p[key]);
  const host=hub.hostOwner!.hosts.find(host=>host.name===p.host)!;
  await eventually('captured native birth reachable after restart '+p.name,async()=>await host.alive(current)?true:undefined);
  assert.equal(await host.alive(current),true);
 }
 for(const {message,receiver,work} of nativeReceipts){
  await work.catch(async error=>{
   const file=await open(join(f.root,'.cland/log/hub.log'),'r');
   try{const size=(await file.stat()).size,bytes=Buffer.alloc(Math.min(64000,size));await file.read(bytes,0,bytes.length,Math.max(0,size-bytes.length));t.diagnostic(remoteRedactor([invite,'SENTINEL-integrated-code']).text(bytes.toString().split('\n').filter(line=>!line.includes('"event":"audit"')).join('\n')).slice(-6000));}finally{await file.close();}
   t.diagnostic(JSON.stringify({outcome:'native queued delivery incomplete',delivery:store.deliveriesOf(message.id),processes:table.all().map(p=>({name:p.name,status:p.status,pid:p.pid,host:p.host}))}));
   const redact=remoteRedactor([invite,'SENTINEL-integrated-code']);
   t.diagnostic(redact.text(JSON.stringify(store.topicMessages('general',100).map(row=>({from:row.from,replyTo:row.replyTo,text:row.text.slice(0,500)})))));
   for(const p of before){
    const record=store.hosts.provisions.get(p.host!)!,directory=join(hostDirectory(f.root,record.machine!.id),'home/native/jobs');
    for(const entry of (await readdir(directory)).filter(name=>name.endsWith('.log')).slice(0,2)){
     const log=await open(join(directory,entry),'r');try{const size=(await log.stat()).size,bytes=Buffer.alloc(Math.min(3000,size));await log.read(bytes,0,bytes.length,Math.max(0,size-bytes.length));t.diagnostic(redact.text(bytes.toString()));}finally{await log.close();}
    }
   }
   throw error;
  });
  const replies=(await history(local)).messages.filter(row=>row.from===receiver&&row.text.startsWith('pong: ')&&row.text.includes(message.text));
  assert.equal(replies.length,1,'one native reply per retained delivery');
  assert.ok(store.deliveriesOf(message.id).some(row=>row.session===receiver&&['injected','delivered'].includes(row.state)));
 }
 assert.ok((await history(local)).messages.some(row=>row.id===pending.ask));
 assert.ok((await inbox()).asks.some(row=>row.id===pending.ask));
 await ok(local,{type:'topic.answer',ask:pending.ask,option:1});
 const outcome=(await history(local)).messages.find(row=>row.id===pending.ask)!.ask!.outcome!;
 assert.equal(outcome.status,'answered');if(outcome.status==='answered')assert.equal(outcome.text,'Keep');
 t.diagnostic('path 4: both births and the pending ask survived restart');

 // Path 5: priced fake admission through the production createHost boundary.
 // Fake DO supplies declared pricing only; SSH machines remain directory-backed fakes.
 const ocean=await fakeDigitalOcean('SENTINEL-integrated-provider',{testContext:t});
 f.beforeStop(()=>ocean.close());
 const price=(await ocean.provider.sizes())[0]!.price_hourly;assert.ok(price>0);
 const provider=new FakeHostProvider({env:f.env,declarations:{...new FakeHostProvider({env:f.env}).declarations,prices:{fake:{livePerHour:fault==='cap'?0:price,idleComputePerHour:0}}}});
 // In the negative control, observe admission at acquire without booting a
 // third machine. This provider instance is created only at the final boundary.
 if(fault==='cap')t.mock.method(provider,'acquire',async()=>({state:'failed' as const,reason:'fault: new-host admission reached acquire'}));
 await ok(local,{type:'config.set',key:'hosts.daily_spend_usd',value:0});
 const liveIds=store.hosts.provisions.list().filter(row=>row.state==='ready').map(row=>row.id);
 const leases=liveIds.map(id=>store.hosts.leases.get(id));
 await assert.rejects(createHost({root:f.root,env:f.env,clock:realClock,records:store.hosts,provider,owner:hub.hostOwner!}),/hosts daily spend cap/);
 assert.deepEqual(store.hosts.provisions.list().filter(row=>row.state==='ready').map(row=>row.id),liveIds);
 assert.deepEqual(liveIds.map(id=>store.hosts.leases.get(id)),leases);
 for(const p of before)assert.equal(await hub.hostOwner!.hosts.find(h=>h.name===p.host)!.alive(table.get(p.name)!),true);
 t.diagnostic('path 5: sub-cap refused a NEW host and retained both live hosts');
 await local.close();await hub.stop();
 assert.deepEqual(await retainedMatches(f.root,invite),[],'invite credential absent from all retained files');
 assert.equal(JSON.stringify(frames).includes(invite),false,'invite absent from outbound frames');
 assert.deepEqual(await retainedMatches(f.root,'SENTINEL-integrated-code'),[],'pasted code absent from all retained files');
 assert.equal(JSON.stringify(frames).includes('SENTINEL-integrated-code'),false,'pasted code absent from outbound frames');
});
