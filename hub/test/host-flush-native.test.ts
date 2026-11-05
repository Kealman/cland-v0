// T3: native territory checkout and scheduler restart/worker closure prove source retention and disposal.
// Lifecycle: scheduler closes and joins its work before the disposable root and store close.
import test from 'node:test';
import assert from 'node:assert/strict';
import { writeFile, stat, rename, mkdir, symlink, unlink, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { tempProject, eventually } from './harness.ts';
import { fixtureEnvironment } from './fixture-environment.ts';
import { beforeDirectories } from './process-cleanup.ts';
import { writeSuiteFixture } from './suite-fixture.ts';
import { territoryGitAsync, territoryPath } from '../src/territory.ts';
import { Suites, type SuiteJob } from '../src/hub/suites.ts';
import { Store } from '../src/hub/store.ts';

test('queued host verification retains pinned territory snapshot through restart and removes it after completion',async t=>{
 const root=await tempProject(t,'host-flush-');
 const env=fixtureEnvironment(root,process.env,{});
 await writeSuiteFixture(root,'node -e "process.exit(0)"');
 const git=(cwd:string,args:string[])=>territoryGitAsync(cwd,args,false,undefined,fixtureEnvironment(root,env,{}));
 await git(root,['init','-b','dev']);await writeFile(join(root,'.gitignore'),'.cland\nnode_modules\n');
 await git(root,['add','.']);await git(root,['commit','-m','source']);
 await git(root,['clone','--bare',root,territoryPath(root)]);
 const head=await git(root,['rev-parse','HEAD']);
 await git(territoryPath(root),['branch','t/task',head]);
 let store=new Store(join(root,'.cland','hub.db'));
 let suites=new Suites(store,root,async()=>{}, {budget:0,env,locks:[join(root,'suite.lock')]});
 beforeDirectories(t,async()=>{await suites.close();store.close();});
 const [admission,duplicate]=await Promise.all([suites.start({source:{head,branch:'t/task'},mode:'auto',cwd:'/host/path/does-not-exist-on-hub',topic:'agents',to:[],actor:null},()=>{}),suites.start({source:{head,branch:'t/task'},mode:'auto',cwd:'/foreign',topic:'agents',to:[],actor:null},()=>{})]);
 assert.ok('id' in admission);
 assert.ok('reused' in duplicate&&duplicate.reused);assert.equal('id' in duplicate&&duplicate.id,admission.id);
 const queued=(JSON.parse(store.meta('suite-jobs')!) as SuiteJob[]).find(job=>job.id===admission.id)!;
 assert.equal(queued.state,'queued');assert.equal(queued.head,head);assert.equal(queued.branch,'t/task');
 assert.ok(queued.cwd.startsWith(join(root,'.cland','run','host-verify')+'/'));
 assert.equal(await git(queued.cwd,['rev-parse','HEAD']),head);
 await rename(queued.cwd,queued.cwd+'.original');await mkdir(queued.cwd);await writeFile(join(queued.cwd,'human'),'replacement');
 try{await assert.rejects(suites.start({source:{head,branch:'t/task'},mode:'auto',cwd:'/foreign',topic:'agents',to:[],actor:null},()=>{}),/directory identity changed/);assert.equal(await readFile(join(queued.cwd,'human'),'utf8'),'replacement');}
 finally{await rename(queued.cwd,queued.cwd+'.replacement');await rename(queued.cwd+'.original',queued.cwd);}
 await suites.close();store.close();
 store=new Store(join(root,'.cland','hub.db'));
 suites=new Suites(store,root,async()=>{}, {budget:0,env,locks:[join(root,'suite.lock')]});
 await suites.queue();
 assert.equal((await stat(queued.cwd)).isDirectory(),true);
 assert.equal(suites.status().find(job=>job.id===admission.id)?.head,head);
 await suites.close();store.close();
 store=new Store(join(root,'.cland','hub.db'));
 suites=new Suites(store,root,async()=>{}, {budget:1,env,locks:[join(root,'suite.lock')]});
 await eventually('durable completed and reported host run',()=>suites.status().find(job=>job.id===admission.id&&job.reported),/* behaviour: post-signal receipt deadline */ 15000);
 const finished=suites.status().find(job=>job.id===admission.id)!;
 assert.equal(finished.outcome?.code,0);assert.equal(finished.head,head);assert.equal(finished.branch,'t/task');
 await assert.rejects(stat(queued.cwd),{code:'ENOENT'});
 assert.equal((await git(territoryPath(root),['worktree','list','--porcelain'])).includes(`worktree ${queued.cwd}`),false);
 await suites.close();store.close();
 const {hostVerifyWorktree}=await import('../src/territory.ts');const {randomUUID}=await import('node:crypto');
 const orphan=join(root,'.cland','run','host-verify',randomUUID());await hostVerifyWorktree(root,orphan,head,env);
 const {withTerritoryLockAsync}=await import('../src/territory.ts');
 const entered=Promise.withResolvers<void>(),release=Promise.withResolvers<void>();
 const held=withTerritoryLockAsync(root,async()=>{entered.resolve();await release.promise;});await entered.promise;
 const retained:Record<string,unknown>[]=[];
 store=new Store(join(root,'.cland','hub.db'));suites=new Suites(store,root,async()=>{}, {budget:0,env,locks:[join(root,'suite.lock')],log:entry=>{retained.push(entry);}});
 try{await eventually('startup sweep records transient lock refusal',()=>retained.find(entry=>entry.event==='host-verify-source-retained'&&entry.path===orphan));}
 finally{release.resolve();await held;}
 const retried=await suites.start({source:{head,branch:'t/task'},mode:'auto',cwd:'/host',topic:'agents',to:[],actor:null},()=>{});assert.ok('id' in retried);
 await assert.rejects(stat(orphan),{code:'ENOENT'});
 await suites.close();
});

test('host session verify flushes its owner before admission and never opens the host cwd locally',async t=>{
 const {startHub,inProcessSpoke}=await import('./harness.ts');
 const {Tracker}=await import('../src/tracker/tracker.ts');
 const {Sessions}=await import('../src/adapters/sessions.ts');
 const {ProcessTable}=await import('../src/adapters/processes.ts');
 const {localHost}=await import('../src/host/local.ts');
 const root=await tempProject(t,'host-session-flush-');
 const env=fixtureEnvironment(root,process.env,{});
 await writeSuiteFixture(root,'true');
 const git=(cwd:string,args:string[])=>territoryGitAsync(cwd,args,false,undefined,fixtureEnvironment(root,env,{}));
 await git(root,['init','-b','dev']);await writeFile(join(root,'.gitignore'),'.cland\nnode_modules\n');await git(root,['add','.']);await git(root,['commit','-m','source']);
 await git(root,['clone','--bare',root,territoryPath(root)]);
 const {gitIn}=await import('../src/tracker/verdict-git.ts');
 const {manualTips}=await import('./freshness-harness.ts');const tips=manualTips();
 const tracker=new Tracker({root,db:':memory:',git:gitIn(root,env),scheduleTips:tips.scheduleTips});tracker.start();
 const {fixedRoles}=await import('../src/roles/config.ts');
 const hub=await startHub({roles:fixedRoles(),tracker,env,verification:{budget:0,env},control:{status:()=>({root,pid:process.pid,port:0,socket:'',version:'test',startedAt:new Date().toISOString(),uptimeMs:0}),stop(){}}});
 hub.core.assignRole('coord','coordinator');
 const spoke=await inProcessSpoke(t,{hub,cwd:'/host-only/absent',name:'coord',sessionId:'host-caller',role:'coordinator'});
 const actor={id:'host-caller',name:'coord',role:'coordinator'};
 const item=await tracker.create(actor,{title:'Host source',kind:'task',size:'M'});
 await tracker.claim(actor,item.id);
 const branch='t/host-source';const old=await git(root,['rev-parse','HEAD']);await git(territoryPath(root),['branch',branch,old]);
 await git(root,['commit','--allow-empty','-m','unpublished']);const head=await git(root,['rev-parse','HEAD']);
 await git(territoryPath(root),['fetch',root,head]);
 const topic={id:'host-verify-topic'};hub.core.store.createTopic(topic.id,'Host verification',item.id,new Date().toISOString());
 await tracker.link(actor,item.id,{branch,topic:topic.id});
 // This durable owner, not the caller's directory, controls host publication.
 hub.core.store.saveHostWorktree({item:item.id,host:'fake',root:'/host-only',path:'/host-only/task',branch,tip:old});
 let flushes=0;let failure='';let publish=true;
 const host={...localHost(),name:'fake',run:async(command:import('../src/host/host.ts').HostCommand)=>({code:0,stdout:command.args[0]==='symbolic-ref'?branch:head,stderr:''}),flushBranch:async()=>{flushes++;if(failure)throw new Error(failure);if(publish)await git(territoryPath(root),['update-ref',`refs/heads/${branch}`,head]);}};
 const table=new ProcessTable(':memory:');

 const sessions=new Sessions({root,core:hub.core,table,hosts:[localHost(),host]});hub.dispatcher.useSessions(sessions);
 beforeDirectories(t,async()=>{await spoke.close();await sessions.close();await hub.close();table.close();await tracker.stop();});
 const unpublished=await spoke.call('verify',{report:topic.id,to:['coordinator']});assert.match(JSON.stringify(unpublished),/host-flush-refused.*worktree owner unavailable/);assert.equal(flushes,0);
 table.put({name:'coord',harness:'test',role:'coordinator',model:null,cwd:'/host-only/absent',host:'fake',pid:null,harnessId:null,sessionId:'host-caller',harnessSessionId:null,startedAt:'',status:'running',item:item.id});
 const result=await spoke.call<{id:string;error?:string}>('verify',{report:topic.id,to:['coordinator']});
 assert.ok(result.id,JSON.stringify(result));assert.equal(flushes,1);
 const jobs=JSON.parse(hub.core.store.meta('suite-jobs')!) as SuiteJob[];
 const job=jobs.find(job=>job.id===result.id)!;assert.equal(job.head,head);assert.equal(job.branch,branch);assert.notEqual(job.cwd,'/host-only/absent');
 failure='watch fenced: outcome unknown';
 const ready=await spoke.call<{ok?:boolean;error?:string}>('task.edit',{id:item.id,status:'ready'});
 assert.match(JSON.stringify(ready),/host-flush-refused.*watch fenced/);
 assert.equal(flushes,2);assert.notEqual((await tracker.view(item.id)).status,'ready');
 failure='';publish=false;await git(territoryPath(root),['update-ref',`refs/heads/${branch}`,old]);
 const mismatch=await spoke.call('task.edit',{id:item.id,status:'ready'});assert.match(JSON.stringify(mismatch),new RegExp(`worktree HEAD ${head}; territory HEAD ${old}`));
 failure='watch fenced: outcome unknown';
 await git(root,['branch',branch,head]);
 await tracker.link(actor,item.id,{branch,topic:topic.id});
 await tracker.edit(actor,item.id,{status:'review'});
 hub.core.assignRole('rev','reviewer');
 const reviewer=await inProcessSpoke(t,{hub,name:'rev',sessionId:'review-id',role:'reviewer'});
 beforeDirectories(t,()=>reviewer.close());
 await tips.refresh();
 const verdict=await reviewer.call<{ok:boolean}>('task.comment',{id:item.id,verdict:'review',scope:'full',result:'clear',run:'host-source',commit:head});assert.equal(verdict.ok,true);
 await tips.refresh();
 const refusal=await eventually('durable automatic-ready refusal',()=>hub.core.store.topicMessages(topic.id,100).find(message=>message.text.includes('ready refused: host-flush-refused')));
 assert.match(refusal.text,/watch fenced: outcome unknown/);assert.match(refusal.text,new RegExp(head));assert.equal(tracker.view(item.id).status,'review');
 // The same gate, with a local owner, retains the ordinary verdict-driven transition.
 hub.core.store.deleteHostWorktree(item.id);
 table.put({...table.bySessionId('host-caller')!,host:'local',cwd:root});
 await tracker.comment(actor,item.id,'local owner');await tips.refresh();
 await eventually('local verdict-driven ready',()=>tracker.view(item.id).status==='ready'||undefined);
 assert.equal(tracker.view(item.id).status,'ready');
});

test('snapshot admission rejects a planted parent symlink and cleanup preserves a replacement directory',async t=>{
 const root=await tempProject(t,'host-snapshot-identity-');const env=fixtureEnvironment(root,process.env,{});
 const git=(cwd:string,args:string[])=>territoryGitAsync(cwd,args,false,undefined,fixtureEnvironment(root,env,{}));
 await mkdir(join(root,'.cland'),{recursive:true});await git(root,['init','-b','dev']);await git(root,['commit','--allow-empty','-m','source']);await git(root,['clone','--bare',root,territoryPath(root)]);
 const {hostVerifyWorktree,removeHostVerifyWorktree,validateHostVerifyWorktree}=await import('../src/territory.ts');const {randomUUID}=await import('node:crypto');
 const head=await git(root,['rev-parse','HEAD']);const base=join(root,'.cland','run','host-verify'),outside=join(root,'outside');await mkdir(join(root,'.cland','run'));await mkdir(outside);await symlink(outside,base);
 const path=join(base,randomUUID());await assert.rejects(hostVerifyWorktree(root,path,head,env),/symlink/);await assert.rejects(stat(join(outside,path.split('/').at(-1)!)),{code:'ENOENT'});
 await unlink(base);const receipt=await hostVerifyWorktree(root,path,head,env);
 await validateHostVerifyWorktree(root,path,receipt,env);
 const kept=path+'.original';await rename(path,kept);await mkdir(path);await writeFile(join(path,'human'),'replacement');
 try{
  await assert.rejects(removeHostVerifyWorktree(root,path,env,receipt),/directory identity changed/);
  await assert.rejects(validateHostVerifyWorktree(root,path,receipt,env),/directory identity changed/);
  assert.equal(await readFile(join(path,'human'),'utf8'),'replacement');
 }finally{
  await rename(path,path+'.replacement');await rename(kept,path);
  await removeHostVerifyWorktree(root,path,env,receipt);
 }
});

test('interrupted ready publication is abandoned under its Git lock and fresh admission runs at a new path',async t=>{
 const root=await tempProject(t,'host-snapshot-abandon-'),env=fixtureEnvironment(root,process.env,{});
 await writeSuiteFixture(root,'true');const git=(cwd:string,args:string[])=>territoryGitAsync(cwd,args,false,undefined,fixtureEnvironment(root,env,{}));
 await git(root,['init','-b','dev']);await writeFile(join(root,'.gitignore'),'.cland\n');await git(root,['add','.']);await git(root,['commit','-m','source']);await git(root,['clone','--bare',root,territoryPath(root)]);const head=await git(root,['rev-parse','HEAD']);
 const {fileOperations}=await import('../src/host/agent/files.ts');const publish=fileOperations.publishFile;
 let abandoned='',lock='',failInitial=true;
 t.mock.method(fileOperations,'publishFile',async(path:string,bytes:Uint8Array,options?:{mode?:number;replace?:boolean})=>{
  if(!options?.replace&&path.endsWith('.json')&&failInitial){failInitial=false;throw new Error('initial receipt publication fault');}
  if(options?.replace&&path.endsWith('.json')&&JSON.parse(Buffer.from(bytes).toString()).ready===true&&!abandoned){
   abandoned=path.slice(0,-5);lock=join(await git(abandoned,['rev-parse','--absolute-git-dir']),'index.lock');await writeFile(lock,'held preparation');throw new Error('fault after Git close before ready checkpoint');
  }
  return publish(path,bytes,options);
 });
 let store=new Store(join(root,'.cland','hub.db')),suites=new Suites(store,root,async()=>{}, {budget:0,env,locks:[join(root,'suite.lock')]});
 beforeDirectories(t,async()=>{await suites.close();store.close();});
 const source={head,branch:'t/task'};
 await assert.rejects(suites.start({source,mode:'auto',cwd:'/host',topic:'agents',to:[],actor:null},()=>{}),/initial receipt publication fault/);assert.deepEqual(suites.hostSnapshotLeftovers(),[]);
 await assert.rejects(suites.start({source:{...source,head:'1'.repeat(40)},mode:'auto',cwd:'/host',topic:'agents',to:[],actor:null},()=>{}),/git worktree add/);
 assert.deepEqual(suites.hostSnapshotLeftovers(),[]);
 await assert.rejects(suites.start({source,mode:'auto',cwd:'/host',topic:'agents',to:[],actor:null},()=>{}),/fault after Git close/);
 assert.ok(abandoned);
 const ownerFile=join(dirname(lock),'gitdir');await rename(ownerFile,ownerFile+'.held');
 try{const {removeHostVerifyWorktree}=await import('../src/territory.ts');await assert.rejects(removeHostVerifyWorktree(root,abandoned,env),/Git owner unavailable/);assert.equal((await stat(abandoned)).isDirectory(),true);}
 finally{await rename(ownerFile+'.held',ownerFile);}
 assert.equal((await stat(abandoned)).isDirectory(),true);assert.ok(suites.hostSnapshotLeftovers()?.some(item=>item.path===abandoned&&item.cause.includes('index.lock')));
 await suites.close();store.close();
 store=new Store(join(root,'.cland','hub.db'));suites=new Suites(store,root,async()=>{}, {budget:0,env,locks:[join(root,'suite.lock')]});
 const admitted=await suites.start({source,mode:'auto',cwd:'/host',topic:'agents',to:[],actor:null},()=>{});assert.ok('id' in admitted);
 const fresh=(JSON.parse(store.meta('suite-jobs')!) as SuiteJob[]).find(job=>job.id===admitted.id)!;
 assert.notEqual(fresh.cwd,abandoned);assert.equal(fresh.head,head);assert.equal((await stat(abandoned)).isDirectory(),true);
 assert.ok(suites.hostSnapshotLeftovers()?.some(item=>item.path===abandoned&&item.cause.includes('index.lock')));
 await unlink(lock);await suites.close();store.close();
 store=new Store(join(root,'.cland','hub.db'));suites=new Suites(store,root,async()=>{}, {budget:1,env,locks:[join(root,'suite.lock')]});
 await eventually('fresh run completes after abandonment',()=>suites.status().find(job=>job.id===admitted.id&&job.reported),/* behaviour: post-signal receipt deadline */ 15000);
 assert.equal(suites.status().find(job=>job.id===admitted.id)?.outcome?.code,0);
 await assert.rejects(stat(abandoned),{code:'ENOENT'});assert.equal(suites.hostSnapshotLeftovers()?.some(item=>item.path===abandoned),false);
});
