// T3: real Git ref rewrites, socket receive-pack and agent restart are the behavior under test.
// Lifecycle: sshHostFixture joins all agents, clients and Git writers before removing its disposable root.
import { pushRecoveryFacts } from './host-push-facts.ts';
import { tmpdir } from 'node:os';
import { spawn } from 'node:child_process';
import { ownProcess, ownDirectory } from './process-cleanup.ts';
import { hostControl } from './fakes/fake-host.ts';
import type { TestContext } from 'node:test';
import test from 'node:test';
import assert from 'node:assert/strict';
import { join, resolve } from 'node:path';
import { mkdir, writeFile, readFile, stat, unlink, mkdtemp } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { sshHostFixture } from './ssh-host-fixture.ts';
import { fixtureEnvironment } from './fixture-environment.ts';
import { eventually } from './harness.ts';
import { territoryGitAsync, territoryPath, refreshTerritoryHook } from '../src/territory.ts';
import { startGitDaemon } from '../src/host/git-daemon.ts';
import { grantBranchLease, revokeBranchLease } from '../src/host/branch-leases.ts';
import { ensureHostClone, hostCloneRoot } from '../src/host/clone.ts';
import { AgentClient } from '../src/host/agent-client.ts';
import { serveAgent } from '../src/host/agent/server.ts';
import { HOST_ORIGIN } from '../src/host/agent/protocol.ts';
import type { AgentEvent } from '../src/host/agent/protocol.ts';

async function setup(t:TestContext,options:Parameters<typeof sshHostFixture>[1]={}){
 const f=await sshHostFixture(t,options);
 const git=(cwd:string,args:string[])=>territoryGitAsync(cwd,['-c','gc.auto=0',...args],false,undefined,fixtureEnvironment(f.root,f.env,{}));
 await git(f.root,['init','--initial-branch=dev']);await writeFile(join(f.root,'seed'),'seed');await writeFile(join(f.root,'.gitignore'),'node_modules\n.cland\n');await git(f.root,['add','seed','.gitignore']);await git(f.root,['commit','-m','seed']);
 await mkdir(join(f.root,'.cland'),{recursive:true});await git(f.root,['clone','--bare',f.root,territoryPath(f.root)]);
 await refreshTerritoryHook(f.root);
 const daemon=await startGitDaemon({host:'f1',socket:f.paths.gitSocket,territory:territoryPath(f.root),env:f.env,log:()=>{}});f.addCleanup(()=>daemon.close());
 await writeFile(f.layout.discoveryFile,'synthetic discovery');
 const root=hostCloneRoot(f.layout.runDirectory,f.root),layout={...f.layout,cli:fileURLToPath(new URL('../bin/cland.ts',import.meta.url))};
 await ensureHostClone({host:f.host,root,layout,bundle:async()=>{throw Error('unexpected fallback');}});
 await mkdir(join(root,'node_modules'));
 return {f,git,root};
}

test('C1-C4 socket pushes follow commits, amend, reset, rebase, refusal and downtime without hooks',{timeout:30000},async t=>{
 const {f,git,root}=await setup(t);
 const branch='t/T-1609-watch',path=join(root,'.cland/worktrees/T-1609');
 await grantBranchLease(f.root,'f1',branch);
 let client=await AgentClient.connect(f.paths.agentSocket,f.secrets.readSecret('f1'));f.addCleanup(()=>client.close());
 const events:Extract<AgentEvent,{event:'ref-moved'}>[]=[];
 const observe=(frame:AgentEvent)=>{if(frame.event==='ref-moved')events.push(frame);};client.on('event',observe);
 await f.host.worktreeAdd({root,path,branch,territory:{path:'git://cland/territory.git',tip:await git(f.root,['rev-parse','HEAD'])}});
 const reaches=async()=>{const head=await git(path,['rev-parse','HEAD']);await eventually('territory has exact moved head',async()=>await git(territoryPath(f.root),['rev-parse',branch]).catch(()=>'')===head||undefined,5000);assert.equal(await git(territoryPath(f.root),['rev-parse',branch]),head);return head;};
 await reaches();
 await git(path,['commit','--allow-empty','-m','commit']);const committed=await reaches();
 await git(path,['commit','--amend','--allow-empty','-m','amend']);assert.notEqual(await reaches(),committed);
 await git(path,['reset','--hard','HEAD~1']);await reaches();
 await git(path,['checkout','-b','base']);await git(path,['commit','--allow-empty','-m','base']);await git(path,['checkout',branch]);await git(path,['commit','--allow-empty','-m','to-rebase']);await git(path,['rebase','--onto','base','HEAD~1']);await reaches();
 const hook=await git(path,['rev-parse','--git-path','hooks/post-commit']);await assert.rejects(stat(resolve(path,hook)),{code:'ENOENT'});
 await revokeBranchLease(f.root,'f1',branch);
 await git(path,['commit','--allow-empty','-m','refused']);const refused=await git(path,['rev-parse','HEAD']);
 const refusal=await eventually('durable refused push event',()=>events.find(e=>e.head===refused&&e.result.code!==0));
 assert.match(refusal.result.stderr,/not leased to this host/);
 const attempts=events.length;await git(root,['branch','unrelated-ref',await git(path,['rev-parse','HEAD'])]);await git(root,['pack-refs','--all']);await client.request('flush',{});await client.request('flush',{});assert.equal(events.length,attempts,'unchanged refused head never loops');
 await grantBranchLease(f.root,'f1',branch);await git(path,['commit','--allow-empty','-m','retry next move']);await reaches();
 await client.request('flush',{});
 const originalProxy=await readFile(join(f.fake.run,'git-proxy'));const substituted=join(f.fake.run,'substituted'),marker=join(f.fake.run,'proxy-executed');
 await writeFile(substituted,`#!/bin/sh\necho executed > '${marker}'\nexit 1\n`,{mode:0o700});
 await git(root,['config','core.gitProxy',substituted]);await git(path,['commit','--allow-empty','-m','proxy refused']);await client.request('flush',{});
 await assert.rejects(stat(marker),{code:'ENOENT'});assert.ok(events.some(e=>e.result.error?.includes('owned socket')));
 await git(root,['config','core.gitProxy',join(f.fake.run,'git-proxy')]);
 await writeFile(join(f.fake.run,'git-proxy'),await readFile(substituted));await client.request('flush',{});await reaches();await assert.rejects(stat(marker),{code:'ENOENT'});
 await writeFile(join(f.fake.run,'git-proxy'),originalProxy);
 assert.equal((await stat(join(f.fake.run,'ref-git-proxy'))).mode&0o777,0o700);
 assert.equal((await stat(join(f.fake.run,'ref-watches.json'))).mode&0o777,0o600);
 assert.equal(JSON.parse(await readFile(join(f.fake.run,'ref-watches.json'),'utf8'))[0].branch,branch);
 await f.host.close();await client.close();await f.agent.close();
 await git(path,['commit','--allow-empty','-m','during downtime']);
 let dropRemoveReply=false;
 const replacement=await serveAgent({runDir:f.fake.run,secret:f.secrets.readSecret('f1'),version:'test',env:fixtureEnvironment(f.root,process.env,f.env),afterOperation:(op,connection)=>{if(op==='worktreeRemove'&&dropRemoveReply){dropRemoveReply=false;connection.destroy();}}});f.addCleanup(()=>replacement.close());
 client=await AgentClient.connect(replacement.socket,f.secrets.readSecret('f1'));client.on('event',observe);
 await reaches();
 await writeFile(join(path,'dirty'),'dirty');
 await assert.rejects(client.request('worktreeRemove',{root,path}),/modified|untracked|dirty|changes/);
 assert.equal(JSON.parse(await readFile(join(f.fake.run,'ref-watches.json'),'utf8'))[0].path,path);
 await unlink(join(path,'dirty'));await git(path,['commit','--allow-empty','-m','after dirty refusal']);await reaches();
 await client.request('unwatch',{path});assert.deepEqual(JSON.parse(await readFile(join(f.fake.run,'ref-watches.json'),'utf8')),[]);
 const base=await git(path,['rev-parse','HEAD']);await git(path,['commit','--allow-empty','-m','newer leased push']);const newer=await git(path,['rev-parse','HEAD']);
 await git(path,['push',`--force-with-lease=refs/heads/${branch}:${base}`,'origin',`${newer}:refs/heads/${branch}`]);
 await assert.rejects(git(path,['push',`--force-with-lease=refs/heads/${branch}:${base}`,'origin',`${base}:refs/heads/${branch}`]),/stale info|rejected/);
 assert.equal(await git(territoryPath(f.root),['rev-parse',branch]),newer);
 dropRemoveReply=true;await assert.rejects(client.request('worktreeRemove',{root,path}),/closed/);await client.close();client=await AgentClient.connect(replacement.socket,f.secrets.readSecret('f1'));
 await client.request('worktreeRemove',{root,path});await assert.rejects(stat(path),{code:'ENOENT'});
});


test('interrupted admitted native push survives agent SIGKILL and recovery publishes only the current head',{timeout:30000},async t=>{
 const {f,git,root}=await setup(t);const branch='t/T-1609-crash',path=join(root,'.cland/worktrees/crash');
 await grantBranchLease(f.root,'f1',branch);await f.host.worktreeAdd({root,path,branch,territory:{path:HOST_ORIGIN,tip:await git(f.root,['rev-parse','HEAD'])}});
 let client=await AgentClient.connect(f.paths.agentSocket,f.secrets.readSecret('f1'));await client.request('flush',{});await client.close();await f.host.close();await f.agent.close();
 const bin=join(f.root,'push-bin'),entered=join(f.root,'push-entered'),gate=join(f.root,'push-gate');await mkdir(bin);
 const quote=(value:string)=>"'"+value.replaceAll("'","'\\''")+"'";
 await writeFile(join(bin,'git'),`#!/bin/sh
case " $* " in *" push "*) echo entered > ${quote(entered)}; while [ ! -f ${quote(gate)} ]; do sleep 0.02; done;; esac
exec /usr/bin/git "$@"
`,{mode:0o700});
 const env=fixtureEnvironment(f.root,process.env,{...f.env,PATH:bin+':'+f.env.PATH,CLAND_HOST_RUN_DIR:f.fake.run,CLAND_HOST_SECRET:f.secrets.readSecret('f1'),CLAND_VERSION_OVERRIDE:'test'});
 const supervisor=new URL('../src/host/agent/supervisor.sh',import.meta.url).pathname,cli=new URL('../bin/cland.ts',import.meta.url).pathname;
 const child=spawn('sh',[supervisor,f.fake.run,process.execPath,cli,'host','serve'],{cwd:f.fake.home,env:fixtureEnvironment(f.root,process.env,env),stdio:'ignore'});f.addCleanup(ownProcess(undefined,child.pid));
 client=await eventually('supervised watch agent ready',()=>AgentClient.connect(f.paths.agentSocket,f.secrets.readSecret('f1')).catch(()=>undefined));f.addCleanup(()=>client.close());
 const helloBefore={...client.hello};const oldPid=client.hello.pid;await git(path,['commit','--allow-empty','-m','captured A']);const captured=await git(path,['rev-parse','HEAD']);
 const pending=await eventually('durable pending native push before crash',async()=>{
  const rows=JSON.parse(await readFile(join(f.fake.run,'ref-watches.json'),'utf8'));return rows.find((row:{pending?:{head:string;native?:unknown}})=>row.pending?.head===captured&&row.pending.native);
 });assert.ok(pending.pending.native.identity);await eventually('native push held at executable receipt',()=>readFile(entered,'utf8').catch(()=>undefined));
 await hostControl('kill-agent','f1',env);await client.close();
 await git(path,['commit','--allow-empty','-m','current B']);const current=await git(path,['rev-parse','HEAD']);assert.notEqual(current,captured);
 client=await eventually('replacement watch agent ready',async()=>{const next=await AgentClient.connect(f.paths.agentSocket,f.secrets.readSecret('f1')).catch(()=>undefined);if(next?.hello.pid===oldPid){await next.close();return undefined;}return next;});
 await writeFile(gate,'release');
 let observedHead:string|null=null;
 try{await eventually('current head durable publication after interrupted push',async()=>{observedHead=await git(territoryPath(f.root),['rev-parse',branch]);return observedHead===current||undefined;},5000);}
 catch(error){
  try{const facts=JSON.stringify(await pushRecoveryFacts({runDir:f.fake.run,path,bootFile:f.fake.bootId,before:helloBefore,after:client.hello,captured:pending.pending,expectedHead:current,observedHead,secrets:[f.secrets.readSecret('f1')],observe:pid=>client.request('identity',{pid},1000) as Promise<string|null>}));t.diagnostic('push recovery receipts '+facts.slice(0,16384)+(facts.length>16384?' [incomplete: diagnostic truncated at16384characters]':''));}
  catch(diagnostic){t.diagnostic('push recovery diagnostic incomplete: '+(diagnostic as Error).name);}
  throw error;
 }
 await client.request('flush',{});assert.equal(await git(territoryPath(f.root),['rev-parse',branch]),current);
 const rows=JSON.parse(await readFile(join(f.fake.run,'ref-watches.json'),'utf8'));assert.equal(rows[0].head,current);assert.equal(rows[0].pending,undefined);

});


test('native producer receipt is private and contains bounded redacted output without planted credentials',{timeout:15000},async t=>{
 const {f,root}=await setup(t);const { AgentProcesses }=await import('../src/host/agent/processes.ts');const { refPushOwner }=await import('../src/host/agent/ref-push.ts');
 const runDir=join(f.root,'receipt-owner'),bin=join(f.root,'receipt-bin'),control=join(f.root,'planted-control');await mkdir(runDir);await mkdir(bin);await mkdir(join(runDir,'ref-push'));
 const planted='synthetic-native-receipt-secret';await writeFile(join(bin,'git'),`#!/bin/sh\necho '${planted}' > '${control}'\necho 'Bearer ${planted}' >&2\necho 'token=${planted}' >&2\necho 'https://account:${planted}@invalid.example' >&2\nexit 0\n`,{mode:0o700});
 const env=fixtureEnvironment(f.root,process.env,{...f.env,PATH:bin+':'+f.env.PATH});
 const processes=new AgentProcesses(runDir,env,()=>{});await processes.load();const owner=refPushOwner(processes,env,runDir);
 const pending:import('../src/host/agent/ref-push.ts').PushAdmission={id:crypto.randomUUID(),head:'a'.repeat(40),signature:'test',started:Date.now()};
 f.addCleanup(async()=>{if(pending.native&&await processes.alive(pending.native))await processes.stop(pending.native);await processes.drain();});
 await owner.spawn(root,['push',`${pending.head}:refs/heads/t/test`],join(runDir,'ref-push',pending.id+'.log'),pending,async native=>{pending.native=native;});
 const receiptPath=join(runDir,'ref-push',pending.id+'.json');const bytes=await eventually('durable producer command-close receipt',()=>readFile(receiptPath,'utf8').catch(()=>undefined));
 assert.equal(await readFile(control,'utf8'),planted+'\n','planted output positive control');assert.equal(bytes.includes(planted),false);assert.equal(bytes.includes('https://'),false);assert.ok(bytes.includes('[redacted]'));
 const receipt=JSON.parse(bytes);assert.deepEqual(Object.keys(receipt).sort(),['complete','head','identity','launchId','pid','result']);assert.equal(receipt.complete,true);assert.equal(receipt.result.code,0);assert.ok(receipt.result.stderr.length<=4096);assert.equal((await stat(receiptPath)).mode&0o777,0o600);
 await eventually('producer native and captured targets closed',async()=>((await owner.observe(pending)).state==='gone')||undefined);
});


test('killed producer without result stays named and fenced until a later successful leased head',{timeout:30000},async t=>{
 const outer=await mkdtemp(join(tmpdir(),'push-kill-')),bin=join(outer,'bin'),arm=join(outer,'arm'),gate=join(outer,'gate'),entered=join(outer,'entered');await mkdir(bin);
 await writeFile(join(bin,'git'),`#!/usr/bin/env node\nconst fs=require('node:fs');if(process.argv.includes('push')&&fs.existsSync(${JSON.stringify(arm)})){fs.writeFileSync(${JSON.stringify(entered)},'entered');const wait=new Int32Array(new SharedArrayBuffer(4));while(!fs.existsSync(${JSON.stringify(gate)}))Atomics.wait(wait,0,0,20);}process.execve('/usr/bin/git',['/usr/bin/git',...process.argv.slice(2)],process.env);\n`,{mode:0o700});
 let killRoot=false,killedRoot=false;
 const {f,git,root}=await setup(t,{env:{PATH:bin+':'+process.env.PATH},processHooks:{beforeSignals:async targets=>{
  if(!killRoot)return;killRoot=false;const native=targets[0]!;const { observeProcesses }=await import('../src/host/agent/native.ts');
  const proof=(await observeProcesses([native.pid],f.env)).get(native.pid);assert.equal(proof?.identity,native.identity);process.kill(native.pid,'SIGKILL');killedRoot=true;throw Error('injected producer-only crash');
 }}});t.after(ownDirectory(undefined,outer));
 const branch='t/T-1609-killed',path=join(root,'.cland/worktrees/killed');await grantBranchLease(f.root,'f1',branch);await f.host.worktreeAdd({root,path,branch,territory:{path:HOST_ORIGIN,tip:await git(f.root,['rev-parse','HEAD'])}});
 const client=await AgentClient.connect(f.paths.agentSocket,f.secrets.readSecret('f1'));f.addCleanup(()=>client.close());await client.request('flush',{});await writeFile(arm,'armed');
 await git(path,['commit','--allow-empty','-m','producer killed']);const head=await git(path,['rev-parse','HEAD']);
 const interrupted=await eventually('admitted producer identity before fault',async()=>JSON.parse(await readFile(join(f.fake.run,'ref-watches.json'),'utf8')).find((row:{pending?:{head:string;native?:unknown}})=>row.pending?.head===head&&row.pending.native));await eventually('native Git held before receipt',()=>readFile(entered,'utf8').catch(()=>undefined));
 killRoot=true;await eventually('positive producer-only fault receipt',async()=>{
  try{assert.equal(await client.request('signal',{...interrupted.pending.native,signal:'SIGKILL'}),false,'a declined capture sends no signal');return undefined;}
  catch(error){assert.match(String(error),/producer-only crash/);return killedRoot||undefined;}
 },5000);assert.equal(killedRoot,true);
 await eventually('missing result named fence',async()=>{const rows=await client.request('watch-status',{}) as Array<{path:string;state:string;cause?:string}>;return rows.find(row=>row.path===path&&row.state==='fenced'&&row.cause?.includes('producer result missing'));});await assert.rejects(stat(join(f.fake.run,'ref-push',interrupted.pending.id+'.json')),{code:'ENOENT'});
 // The surviving captured Git child is still owned by the existing ledger; join it before fixture cleanup.
 assert.equal(await client.request('stop',interrupted.pending.native),true);await writeFile(gate,'release');await git(path,['commit','--allow-empty','-m','later leased head']);const next=await git(path,['rev-parse','HEAD']);
 await eventually('later leased head clears fenced publication',async()=>await git(territoryPath(f.root),['rev-parse',branch])===next||undefined,5000);await client.request('flush',{});
 assert.equal((await client.request('watch-status',{}) as Array<{state:string}>)[0]?.state,'watching');
});
