// T2: private watch checkpoints with scripted native-owner receipts; no native child or socket.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { RefWatches } from '../src/host/agent/watch.ts';
import type { RefPushOwner, PushAdmission, PushObservation } from '../src/host/agent/ref-push.ts';
import { HOST_ORIGIN } from '../src/host/agent/protocol.ts';
import { fixtureEnvironment } from './fixture-environment.ts';
import { ownDirectory } from './process-cleanup.ts';
import type { TestContext } from 'node:test';
async function fixture(t:TestContext){
 const root=await mkdtemp(join(tmpdir(),'ref-watch-'));const cleanup=ownDirectory(undefined,root);t.after(cleanup);
 const run=join(root,'run');await mkdir(run);
 const heads=new Map<string,string>(),remotes=new Map<string,string>(),signatures=new Map<string,string>(),ancestors=new Set<string>();
 const states=new Map<string,PushObservation>(),attempts:Array<{path:string;args:string[];pending:PushAdmission}>=[],events:Array<any>=[],statuses:Array<Array<{path:string;state:string;cause?:string}>>=[];
 let badProxy=false,badPath='',badMetadata='',ancestryError=false;
 const owner:RefPushOwner={spawn:async(path,args,_log,pending,accepted)=>{attempts.push({path,args,pending:{...pending}});states.set(pending.id,{state:'running'});await accepted({pid:100+attempts.length,identity:'birth'});},observe:async pending=>states.get(pending.id)??{state:'unknown'},stop:async()=>false};
 const git=async(path:string,args:string[])=>{
  if(path===badPath)throw Error('inaccessible watch');
  let stdout='';
  if(args.includes('--git-path'))stdout=join(path,args.at(-1)!);
  else if(args[0]==='rev-parse')stdout=args.at(-1)!.startsWith('refs/cland')?remotes.get(path)??'':heads.get(path)??'A';
  else if(args[0]==='remote')stdout=HOST_ORIGIN;
  else if(args[0]==='config')stdout=badProxy?'/substituted-proxy':join(run,'git-proxy');
  else if(args.includes('ls-remote'))stdout=remotes.get(path)??'';
  else if(args[0]==='merge-base'&&ancestryError)return {code:128,stdout:'',stderr:'injected ancestry read failure'};
  else if(args[0]==='merge-base')return {code:args.at(-2)===args.at(-1)||ancestors.has(`${args.at(-2)}:${args.at(-1)}`)?0:1,stdout:'',stderr:''};
  return {code:0,stdout,stderr:''};
 };
 const make=(extra:{afterSettlement?:()=>Promise<void>;beforeCheckpoint?:(rows:unknown[])=>Promise<void>}={})=>new RefWatches(run,fixtureEnvironment(root,process.env,{}),frame=>{const data=frame as {event:string;watches:Array<{path:string;state:string;cause?:string}>};if(data.event==='ref-moved')events.push(frame);if(data.event==='ref-watch-status')statuses.push(data.watches);},owner,{git,metadata:async files=>{const path=files[0]!.split('/refs/')[0]!;if(path===badMetadata)throw Error('metadata inaccessible');return signatures.get(path)??'one';},...extra});
 const path=join(root,'task');await mkdir(path);heads.set(path,'A');remotes.set(path,'base');
 const watches=make();await watches.start(false);await watches.watch(path,'t/task');
 const finish=(index:number,code:number|null=0)=>{const attempt=attempts[index]!;states.set(attempt.pending.id,{state:'gone',code,signal:null});if(code===0)remotes.set(attempt.path,attempt.pending.head);};
 return {root,run,path,heads,remotes,signatures,ancestors,states,attempts,events,statuses,watches,make,finish,failMetadata:(path:string)=>{badMetadata=path;},failAncestry:(value:boolean)=>{ancestryError=value;},badProxy:()=>{badProxy=true;},badPath:(path:string)=>{badPath=path;}};
}
test('held A push binds its event and the later B attempt to their captured heads and leases',async t=>{
 const f=await fixture(t);await f.watches.scan();f.heads.set(f.path,'B');f.signatures.set(f.path,'two');f.finish(0);
 await f.watches.scan();assert.equal(f.events[0].head,'A');assert.match(f.attempts[0]!.args.at(-1)!,/^A:/);
 assert.match(f.attempts[1]!.args.join(' '),/--force-with-lease=refs\/heads\/t\/task:A/);assert.match(f.attempts[1]!.args.at(-1)!,/^B:/);
 f.finish(1);await f.watches.scan();assert.equal(f.events[1].head,'B');await f.watches.close();
});
test('crash checkpoint recovers the native admission then pushes only the current head with the observed lease',async t=>{
 const f=await fixture(t);await f.watches.scan();
 const persisted=JSON.parse(await readFile(join(f.run,'ref-watches.json'),'utf8'))[0];assert.equal(persisted.pending.head,'A');assert.ok(persisted.pending.native.identity);
 const restarted=f.make();await restarted.start(false);f.heads.set(f.path,'B');f.signatures.set(f.path,'two');f.remotes.set(f.path,'A');f.finish(0,null);
 await restarted.scan();assert.equal(f.attempts.length,2);assert.match(f.attempts[1]!.args.at(-1)!,/^B:/);assert.ok(f.attempts[1]!.args.includes('--force-with-lease=refs/heads/t/task:A'));
 f.finish(1);await restarted.scan();assert.equal(f.remotes.get(f.path),'B');await restarted.close();
});
test('unknown pending child and inaccessible retained watch leave a healthy watch publishing',async t=>{
 const f=await fixture(t);await f.watches.scan();f.states.set(f.attempts[0]!.pending.id,{state:'unknown'});
 const healthy=join(f.root,'healthy');f.heads.set(healthy,'H');f.remotes.set(healthy,'base');await f.watches.watch(healthy,'t/healthy');await f.watches.scan();assert.equal(f.attempts.length,2);f.finish(1);await f.watches.scan();assert.equal(f.remotes.get(healthy),'H');assert.ok(f.events.some(e=>e.path===f.path&&e.result.error?.includes('unknown')));
 const rows=JSON.parse(await readFile(join(f.run,'ref-watches.json'),'utf8'));rows.unshift({path:join(f.root,'stale'),branch:'t/stale'});await writeFile(join(f.run,'ref-watches.json'),JSON.stringify(rows));f.badPath(rows[0].path);
 const restart=f.make();await restart.start(false);f.heads.set(healthy,'H2');f.signatures.set(healthy,'new');await restart.scan();assert.equal(f.attempts.length,3);assert.equal(f.attempts[2]!.pending.head,'H2');f.finish(2);f.finish(0);await restart.scan();if(f.attempts[3]){f.finish(3);await restart.scan();}await restart.close();
});
test('unchanged refused head ignores packed-ref churn and substituted proxy never launches',async t=>{
 const f=await fixture(t);await f.watches.scan();f.finish(0,1);await f.watches.scan();f.signatures.set(f.path,'unrelated-pack');await f.watches.scan();assert.equal(f.attempts.length,1);
 f.heads.set(f.path,'B');f.signatures.set(f.path,'move');await f.watches.scan();assert.equal(f.attempts.length,2);f.finish(1);await f.watches.scan();
 f.badProxy();f.heads.set(f.path,'C');f.signatures.set(f.path,'proxy');await f.watches.scan();assert.equal(f.attempts.length,2);assert.ok(f.events.some(e=>e.result.error?.includes('owned socket')));await f.watches.close();
});
test('dirty removal keeps its durable watch and the next head still publishes',async t=>{
 const f=await fixture(t);await assert.rejects(f.watches.remove(f.path,f.root,async()=>{throw Error('dirty worktree');}),/dirty/);
 assert.equal(JSON.parse(await readFile(join(f.run,'ref-watches.json'),'utf8')).length,1);await f.watches.scan();f.finish(0);await f.watches.scan();await f.watches.remove(f.path,f.root,async()=>{await (await import('node:fs/promises')).rmdir(f.path);return null;});assert.deepEqual(JSON.parse(await readFile(join(f.run,'ref-watches.json'),'utf8')),[]);await f.watches.close();
});

for(const failure of ['reacquisition','registration'])test(`accepted checkout retains unknown ownership after ${failure} failure`,async()=>{
 const { EventEmitter }=await import('node:events');
 const { sshHost }=await import('../src/host/ssh-host.ts');
 const { PREPARED_HOST_CAPABILITY }=await import('../src/host/agent/protocol.ts');
 const { REF_WATCH_CAPABILITY }=await import('../src/host/agent/watch.ts');
 const calls:string[]=[];let committed=false;
 const client=Object.assign(new EventEmitter(),{
  hello:{protocol:1,version:'test',pid:1,bootId:'boot',capabilities:[PREPARED_HOST_CAPABILITY,REF_WATCH_CAPABILITY]},
  request:async(op:string)=>{calls.push(op);if(op==='prepare-worktree')return {token:'prepared'};if(op==='commit-prepared'){committed=true;if(failure==='reacquisition')client.emit('closed');return {};}
   if(op==='watch')throw Error('registration failed');return [];},
  close:async()=>{client.emit('closed');},
 });
 const host=sshHost({name:'fake',transport:{status:()=>({state:'up'}) as ReturnType<import('../src/transport/ssh.ts').SshTransport['status']>,forward:async()=>{throw Error('unused');},unforward:async()=>{}},
  connect:async()=>{if(committed)throw Error('reacquisition failed');return client as unknown as import('../src/host/agent-client.ts').AgentClient;},layout:{node:'node',cli:'/cli',spoke:'/spoke',runDirectory:'/run',logDirectory:'/logs',discoveryFile:'/discovery'}});
 try{await assert.rejects(host.worktreeAdd({root:'/clone',path:'/clone/task',branch:'t/task'}),{code:'CLAND_HOST_OUTCOME_UNKNOWN'});assert.equal(committed,true);assert.equal(calls.filter(op=>op==='commit-prepared').length,1);assert.equal(calls.includes('abort-prepared'),false);}
 finally{await host.close();}
});

test('second crash after settlement checkpoint retains recovery ancestry before an advanced remote',async t=>{
 const f=await fixture(t);await f.watches.scan();f.remotes.set(f.path,'R');f.heads.set(f.path,'C');f.signatures.set(f.path,'new');f.ancestors.add('A:R');f.ancestors.add('C:R');f.finish(0,null);
 const first=f.make({afterSettlement:async()=>{throw Error('injected crash after durable settlement');}});await first.start(false);await first.scan();
 assert.equal(JSON.parse(await readFile(join(f.run,'ref-watches.json'),'utf8'))[0].recovering,true);
 const second=f.make();await second.start(false);f.failAncestry(true);await second.scan();assert.equal(f.attempts.length,1);assert.equal(JSON.parse(await readFile(join(f.run,'ref-watches.json'),'utf8'))[0].recovering,true);f.failAncestry(false);await second.scan();assert.equal(f.attempts.length,1);assert.equal(f.remotes.get(f.path),'R');assert.equal(JSON.parse(await readFile(join(f.run,'ref-watches.json'),'utf8'))[0].head,'C');await second.close();
});
test('successful removal checkpoint loss settles from directory and Git-index absence without replay',async t=>{
 const f=await fixture(t);let fail=true,calls=0;
 const watches=f.make({beforeCheckpoint:async rows=>{if(!rows.length&&fail){fail=false;throw Error('injected removal checkpoint loss');}}});await watches.start(false);
 await assert.rejects(watches.remove(f.path,f.root,async()=>{calls++;await (await import('node:fs/promises')).rmdir(f.path);return null;}),/checkpoint loss/);
 const persisted=JSON.parse(await readFile(join(f.run,'ref-watches.json'),'utf8'))[0];assert.equal(persisted.removal.root,f.root);
 const restarted=f.make();await restarted.start(false);await restarted.remove(f.path,f.root,async()=>{calls++;throw Error('must not replay removal');});assert.equal(calls,1);assert.deepEqual(JSON.parse(await readFile(join(f.run,'ref-watches.json'),'utf8')),[]);await restarted.close();
});
test('next successful leased head clears the named fence while old native cleanup stays owned',async t=>{
 const f=await fixture(t);await f.watches.scan();f.states.set(f.attempts[0]!.pending.id,{state:'unknown'});await f.watches.scan();assert.equal(f.watches.status()[0]!.state,'fenced');
 f.heads.set(f.path,'B');f.signatures.set(f.path,'move');await f.watches.scan();assert.equal(f.attempts.length,2);assert.equal(f.watches.status()[0]!.state,'fenced');
 f.finish(1);await f.watches.scan();assert.equal(f.watches.status()[0]!.state,'watching');assert.equal(f.remotes.get(f.path),'B');f.finish(0);await f.watches.close();
});
test('accepted native receipt rebinds the durable watch before timeout stop; unknown ledger needs producer receipt',async t=>{
 const f=await fixture(t);const { refPushOwner }=await import('../src/host/agent/ref-push.ts');
 const native={pid:123,identity:'birth'};let stopped=false,authority:'owned'|'unknown'='owned';
 const processes={operationReceipt:async()=>({state:'accepted',result:native}),operationRecord:async()=>({...native,launchId:'native-id',authority,ended:false,targets:[native]}),stop:async(target:unknown)=>{assert.deepEqual(target,native);stopped=true;return true;}} as unknown as import('../src/host/agent/processes.ts').AgentProcesses;
 const owner=refPushOwner(processes,{},f.run,async()=>new Map([[123,{identity:'birth',ended:false}]]));
 const pending:PushAdmission={id:'native-id',head:'A',signature:'one',started:0};
 assert.equal((await owner.observe(pending,async receipt=>{pending.native=receipt;await writeFile(join(f.run,'rebound.json'),JSON.stringify(pending));})).state,'running');assert.deepEqual(JSON.parse(await readFile(join(f.run,'rebound.json'),'utf8')).native,native);await owner.stop(pending);assert.equal(stopped,true);
 authority='unknown';const gone=refPushOwner(processes,{},f.run,async()=>new Map([[123,{identity:null,ended:true}]]));assert.equal((await gone.observe(pending)).state,'unknown');
 await mkdir(join(f.run,'ref-push'));await writeFile(join(f.run,'ref-push/native-id.json'),JSON.stringify({launchId:'native-id',...native,head:'A',complete:true,result:{code:0,stdout:'',stderr:''}}));assert.equal((await gone.observe(pending)).state,'gone');
});


test('healthy checkpoint events preserve an inaccessible peer fence through the shared status projection',async t=>{
 const f=await fixture(t);f.badPath(f.path);await f.watches.scan();assert.equal(f.watches.status()[0]?.state,'fenced');
 const healthy=join(f.root,'healthy');f.heads.set(healthy,'H');f.remotes.set(healthy,'base');await f.watches.watch(healthy,'t/healthy');await f.watches.scan();f.finish(0);await f.watches.scan();
 const peer=f.statuses.at(-1)?.find(row=>row.path===f.path);assert.equal(peer?.state,'fenced');assert.match(peer?.cause??'',/inaccessible watch/);assert.equal(f.watches.status().find(row=>row.path===f.path)?.cause,peer.cause);await f.watches.close();
});


test('a recovered peer is positively reobserved before clearing its cached same-signature failure',async t=>{
 const f=await fixture(t);await f.watches.scan();f.finish(0);await f.watches.scan();f.failMetadata(f.path);await f.watches.scan();assert.equal(f.watches.status()[0]?.state,'fenced');
 f.failMetadata('');await f.watches.scan();assert.equal(f.watches.status()[0]?.state,'watching');assert.equal(f.attempts.length,1,'same head reobservation does not replay push');await f.watches.close();
});

test('scoped flush refuses a confirmed failed lease without retrying the unchanged head',async t=>{
 const f=await fixture(t);await f.watches.scan();f.finish(0,1);await f.watches.scan();
 await assert.rejects(f.watches.flush(f.path),/push unconfirmed \(exit 1\)/);
 assert.equal(f.attempts.length,1);await f.watches.close();
});
test('scoped flush confirms a settled publication and names a missing watch',async t=>{
 const f=await fixture(t);await f.watches.scan();f.finish(0);await f.watches.scan();
 await f.watches.flush(f.path);assert.equal(f.attempts.length,1);
 await assert.rejects(f.watches.flush(join(f.root,'absent')),/watch .*absent.*push unconfirmed/);await f.watches.close();
});

test('every unknown native push observation names its boundary without changing authority', async t=>{
 const f=await fixture(t);const {refPushOwner}=await import('../src/host/agent/ref-push.ts');
 const boot='00000000-0000-4000-8000-000000000001',other='00000000-0000-4000-8000-000000000002';
 const native={pid:123,identity:`linux:${boot}:1`};
 let candidate:typeof native|undefined=native,readable=true,pendingReceipt=false,stops=0;
 const processes={operationReceipt:async()=>pendingReceipt?{state:'pending',reason:'pending'}:{state:'accepted',result:native},operationRecord:async()=>candidate?{...candidate,authority:'owned',targets:[candidate]}:undefined,stop:async()=>{stops++;return true;}} as unknown as import('../src/host/agent/processes.ts').AgentProcesses;
 const owner=refPushOwner(processes,{},f.run,async()=>new Map([[123,{identity:readable?native.identity:null,ended:false}]]));
 const pending:PushAdmission={id:'diagnostic',head:'A',signature:'one',started:0,native};
 pendingReceipt=true;
 assert.deepEqual(await owner.observe({id:pending.id,head:pending.head,signature:pending.signature,started:pending.started}),{state:'unknown',cause:'native producer admission receipt pending'});
 pendingReceipt=false;
 for(const [value,field] of [[{...native,pid:124},'pid'],[{...native,identity:`linux:${boot}:2`},'identity'],[{...native,identity:`linux:${other}:1`},'boot'],[{pid:124,identity:`linux:${other}:1`},'pid, boot']] as const){candidate=value;assert.deepEqual(await owner.observe(pending),{state:'unknown',cause:'native producer admission mismatch: '+field});}
 candidate=native;
 await mkdir(join(f.run,'ref-push'));await mkdir(join(f.run,'ref-push/diagnostic.json'));
 assert.deepEqual(await owner.observe(pending),{state:'unknown',cause:'native producer receipt unreadable'});
 const {rmdir}=await import('node:fs/promises');await rmdir(join(f.run,'ref-push/diagnostic.json'));
 readable=false;assert.deepEqual(await owner.observe(pending),{state:'unknown',cause:'native producer target identity unobservable'});
 readable=true;candidate=undefined;
 assert.deepEqual(await owner.observe(pending),{state:'unknown',cause:'native producer ledger missing for observed target'});
 candidate=native;assert.deepEqual(await owner.observe(pending),{state:'running'});
 assert.equal(stops,0,'diagnostic classification never calls stop or grants authority');
});

test('legacy unknown observation without a cause retains its generic fence',async t=>{
 const f=await fixture(t);await f.watches.scan();f.states.set(f.attempts[0]!.pending.id,{state:'unknown'});
 await assert.rejects(f.watches.flush(),/native push identity unknown/);
 assert.equal(f.watches.status()[0]?.cause,'native push identity unknown');await f.watches.close().catch(()=>{});
});
