// T1: Claude launch receipts use scripted command and native identity facts; no processes or sockets.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { claudeLaunches } from '../src/host/agent/claude.ts';
import { tempProject } from './harness.ts';
import { within } from '../src/executor/droplet/deadline.ts';
import { nativeCommandIncomplete, boundedCommandResult } from '../src/host/agent/command.ts';
const generation='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const command=(root:string)=>({command:'fake',args:['--bg','--settings',join(root,'sessions','a'.repeat(64),generation,'settings.json')],cwd:root,env:{CLAUDE_CONFIG_DIR:root}});
for(const output of ['[]','[{"id":"abc","pid":42,"sessionId":"native"},{"id":"abc","pid":43,"sessionId":"native"}]','malformed'])test(`Claude launch fails closed on ambiguous discovery ${output}`,async t=>{
 const root=await tempProject(t),calls:string[]=[];
 const owner=claudeLaunches(root,{}, {run:async command=>{calls.push(command.args[0]!);return {code:0,stdout:command.args[0]==='--bg'?'claude attach abc':output,stderr:''};},identity:async()=> 'linux:boot:1',uid:async()=>process.getuid!(),closed:()=>true});
 const result=await owner.launch(command(root),generation);
 assert.equal(result.claudeAdmission,undefined,'unknown native outcome never grants non-admission');
 assert.match(result.error!,/cleanup incomplete/);assert.deepEqual(calls,['--bg','agents','stop']);
 const record=JSON.parse(await readFile(join(root,'claude',generation+'.json'),'utf8'));assert.equal(record.generation,generation);assert.equal(record.phase,'launching');assert.equal(record.job,'abc');assert.equal(record.config.path,root);assert.equal(record.jobs.path,join(root,'jobs'));assert.equal(record.privateDirectory,join(root,'sessions','a'.repeat(64),generation));assert.equal(record.nativeStopCode,0);await assert.rejects(owner.receipt(generation),/cleanup-incomplete/);
});
test('Claude receipt pins generation native birth and uid and refuses PID reuse',async t=>{
 const root=await tempProject(t);let birth='linux:boot:1';
 const owner=claudeLaunches(root,{}, {run:async command=>({code:0,stdout:command.args[0]==='--bg'?'claude attach abc':'[{"id":"abc","pid":42,"sessionId":"native"}]',stderr:''}),identity:async()=>birth,uid:async()=>process.getuid!(),closed:()=>true});
 assert.equal((await owner.launch(command(root),generation)).code,0);
 const {config,jobs,privateDirectory,...receipt}=await owner.receipt(generation);assert.equal(privateDirectory,join(root,'sessions','a'.repeat(64),generation));assert.equal(config.path,root);assert.equal(jobs?.path,join(root,'jobs'));assert.deepEqual(receipt,{generation,pid:42,identity:'linux:boot:1',uid:process.getuid!(),job:'abc',session:'native'});
 birth='linux:boot:2';await assert.rejects(owner.receipt(generation),/identity mismatch/);
 await owner.remove(generation);await owner.forget(generation);await assert.rejects(readFile(join(root,'claude',generation+'.json')),{code:'ENOENT'});
});

test('Claude refuses nonprivate account root before any command and rejects foreign-owner metadata',async t=>{
 const {chmod}=await import('node:fs/promises');
 const {claudeConfigRefusal}=await import('../src/host/agent/claude.ts');
 const root=await tempProject(t);await chmod(root,0o755);let calls=0;
 const owner=claudeLaunches(root,{}, {run:async()=>{calls++;throw new Error('must not run');}});
 const result=await owner.launch(command(root),generation);
 assert.match(result.error!,/config root.*0700/);assert.equal(calls,0);
 assert.deepEqual(result.claudeAdmission,{generation,outcome:'refused-before-spawn'});
 assert.match(claudeConfigRefusal({directory:true,symlink:false,uid:process.getuid!()+1,mode:0o700})!,/agent-owned/);
});

test('Claude cleanup removes only the pinned job and leaves another session job intact',async t=>{
 const {mkdir,writeFile}=await import('node:fs/promises');
 const root=await tempProject(t);await mkdir(join(root,'jobs'));
 await writeFile(join(root,'jobs','abc.json'),'synthetic-private-token');
 await writeFile(join(root,'jobs','sibling.json'),'sibling-job');
 const owner=claudeLaunches(root,{}, {run:async command=>({code:0,stdout:command.args[0]==='--bg'?'claude attach abc':'[{"id":"abc","pid":42,"sessionId":"native"}]',stderr:''}),identity:async()=> 'linux:boot:1',uid:async()=>process.getuid!(),closed:()=>true});
 assert.equal((await owner.launch(command(root),generation)).code,0);
 assert.equal((await readFile(join(root,'claude',generation+'.json'),'utf8')).includes('synthetic-private-token'),false);
 await owner.remove(generation);
 await assert.rejects(readFile(join(root,'jobs','abc.json')),{code:'ENOENT'});
 assert.equal(await readFile(join(root,'jobs','sibling.json'),'utf8'),'sibling-job');
 await owner.remove(generation);await owner.forget(generation);await owner.forget(generation);await assert.rejects(readFile(join(root,'claude',generation+'.json')),{code:'ENOENT'});
});

test('concurrent release callers share one durable settlement producer',async t=>{
 const root=await tempProject(t),entered=Promise.withResolvers<void>(),release=Promise.withResolvers<void>();let producers=0;
 const owner=claudeLaunches(root,{}, {run:async command=>({code:0,stdout:command.args[0]==='--bg'?'claude attach abc':'[{"id":"abc","pid":42,"sessionId":"native"}]',stderr:''}),identity:async()=> 'linux:boot:1',uid:async()=>process.getuid!(),closed:()=>true});
 assert.equal((await owner.launch(command(root),generation)).code,0);
 const settle=async()=>{producers++;entered.resolve();await release.promise;};
 const first=owner.remove(generation,settle);void first.catch(error=>entered.reject(error));
 let second:Promise<void>|undefined;
 try{await within(entered.promise,1000);second=owner.remove(generation,settle);release.resolve();await Promise.all([first,second]);}
 finally{release.resolve();await Promise.allSettled([first,...(second?[second]:[])]);}
 assert.equal(producers,1);await owner.forget(generation);
});

test('terminal receipt forget requires confirmed private directory deletion',async t=>{
 const {mkdir,writeFile,unlink,rmdir}=await import('node:fs/promises');
 const root=await tempProject(t),privateDirectory=join(root,'sessions','a'.repeat(64),generation);await mkdir(privateDirectory,{recursive:true,mode:0o700});
 await writeFile(join(privateDirectory,'settings.json'),'synthetic-private-token',{mode:0o600});
 const owner=claudeLaunches(root,{}, {run:async command=>({code:0,stdout:command.args[0]==='--bg'?'claude attach abc':'[{"id":"abc","pid":42,"sessionId":"native"}]',stderr:''}),identity:async()=> 'linux:boot:1',uid:async()=>process.getuid!(),closed:()=>true});
 assert.equal((await owner.launch(command(root),generation)).code,0);await owner.remove(generation);
 const receipt=JSON.parse(await readFile(join(root,'claude',generation+'.json'),'utf8'));assert.equal(receipt.released,true);assert.equal(JSON.stringify(receipt).includes('synthetic-private-token'),false);
 await assert.rejects(owner.forget(generation),/private generation deletion incomplete/);
 await unlink(join(privateDirectory,'settings.json'));await rmdir(privateDirectory);await owner.forget(generation);await owner.forget(generation);
 await assert.rejects(readFile(join(root,'claude',generation+'.json')),{code:'ENOENT'});
});

test('Claude jobs symlink refuses before commands can copy the planted token outside the private root',async t=>{
 const {mkdir,symlink,writeFile,readdir}=await import('node:fs/promises');
 const root=await tempProject(t),account=join(root,'account'),outside=join(root,'outside');await mkdir(account,{mode:0o700});await mkdir(outside,{mode:0o755});await symlink(outside,join(account,'jobs'));
 let calls=0;const token='synthetic-jobs-symlink-token';
 const owner=claudeLaunches(root,{}, {run:async command=>{calls++;if(command.args[0]==='--bg')await writeFile(join(account,'jobs','abc.json'),token);return {code:0,stdout:command.args[0]==='--bg'?'claude attach abc':'[{"id":"abc","pid":42,"sessionId":"native"}]',stderr:''};},identity:async()=> 'linux:boot:1',uid:async()=>process.getuid!(),closed:()=>true});
 const input=command(root);input.env.CLAUDE_CONFIG_DIR=account;
 const result=await owner.launch(input,generation);
 assert.match(result.error!,/launch refused.*jobs directory/i);assert.equal(calls,0);
 assert.deepEqual(await readdir(outside),[]);
});

test('Claude launch pins jobs before execution and refuses a replacement directory',async t=>{
 const {rename,mkdir}=await import('node:fs/promises');const root=await tempProject(t);let calls=0;
 const owner=claudeLaunches(root,{}, {run:async input=>{calls++;if(input.args[0]==='--bg'){await rename(join(root,'jobs'),join(root,'original-jobs'));await mkdir(join(root,'jobs'));}return {code:0,stdout:input.args[0]==='--bg'?'claude attach abc':'[{"id":"abc","pid":42,"sessionId":"native"}]',stderr:''};},identity:async()=> 'linux:boot:1',uid:async()=>process.getuid!()});
 const result=await owner.launch(command(root),generation);
 assert.match(result.error!,/cleanup incomplete/);assert.equal(calls,2);
 await assert.rejects(owner.receipt(generation),/cleanup-incomplete/);
});

test('an invalid native job handle never becomes a stop option',async t=>{
 const root=await tempProject(t),calls:string[][]=[];
 const owner=claudeLaunches(root,{}, {run:async input=>{calls.push([...input.args]);return {code:0,stdout:input.args[0]==='--bg'?'claude attach --all':'[{"id":"--all","pid":42,"sessionId":"native"}]',stderr:''};},identity:async()=> 'linux:boot:1',uid:async()=>process.getuid!()});
 const result=await owner.launch(command(root),generation);assert.match(result.error!,/cleanup incomplete/);assert.deepEqual(calls.map(args=>args[0]),['--bg','agents']);
 await assert.rejects(owner.receipt(generation),/cleanup-incomplete/);
});

test('restart restore consumes live generation receipts and skips pending released and confirmed closed workers',async t=>{
 const {writeFile}=await import('node:fs/promises');
 const root=await tempProject(t),observed:number[]=[],restored:string[]=[];
 const owner=claudeLaunches(root,{}, {run:async input=>({code:0,stdout:input.args[0]==='--bg'?'claude attach abc':'[{"id":"abc","pid":42,"sessionId":"native"}]',stderr:''}),identity:async pid=>{observed.push(pid);return 'linux:boot:1';},uid:async()=>process.getuid!()});
 assert.equal((await owner.launch(command(root),generation)).code,0);
 const original=JSON.parse(await readFile(join(root,'claude',generation+'.json'),'utf8'));
 for(const [gen,extra] of [['bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',{pid:43,released:true}],['cccccccc-cccc-cccc-cccc-cccccccccccc',{pid:44}],['dddddddd-dddd-dddd-dddd-dddddddddddd',{pid:45,phase:'launching'}]] as const){
  await writeFile(join(root,'claude',gen+'.json'),JSON.stringify({...original,...extra,generation:gen}));
 }
 observed.length=0;
 const outcome=await owner.restore(async worker=>worker.pid===44,async worker=>{restored.push(worker.generation);});
 assert.deepEqual(outcome.incomplete,[{generation:'dddddddd-dddd-dddd-dddd-dddddddddddd',stage:'pending'}]);
 assert.deepEqual(restored,[generation]);assert.deepEqual(observed,[42]);
});


test('restart restore reports a vanished generation without blocking a healthy receipt',async t=>{
 const {writeFile}=await import('node:fs/promises');
 const root=await tempProject(t),restored:string[]=[];
 const owner=claudeLaunches(root,{}, {run:async input=>({code:0,stdout:input.args[0]==='--bg'?'claude attach abc':'[{"id":"abc","pid":42,"sessionId":"native"}]',stderr:''}),identity:async pid=>pid===42?'linux:boot:1':null,uid:async()=>process.getuid!()});
 assert.equal((await owner.launch(command(root),generation)).code,0);
 const record=JSON.parse(await readFile(join(root,'claude',generation+'.json'),'utf8'));
 const vanished='bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
 await writeFile(join(root,'claude',vanished+'.json'),JSON.stringify({...record,generation:vanished,pid:43}));
 const outcome=await owner.restore(async()=>false,async worker=>{restored.push(worker.generation);});
 assert.deepEqual(restored,[generation]);assert.deepEqual(outcome.incomplete,[{generation:vanished,stage:'receipt'}]);
 assert.equal(JSON.parse(await readFile(join(root,'claude',vanished+'.json'),'utf8')).released,undefined);
});

test('an already admitted Claude generation cannot claim pre-spawn refusal',async t=>{
 const root=await tempProject(t);
 const owner=claudeLaunches(root,{}, {run:async command=>({code:0,stdout:command.args[0]==='--bg'?'claude attach abc':'[{"id":"abc","pid":42,"sessionId":"native"}]',stderr:''}),identity:async()=> 'linux:boot:1',uid:async()=>process.getuid!(),closed:()=>true});
 assert.equal((await owner.launch(command(root),generation)).code,0);
 const duplicate=await owner.launch(command(root),generation);
 assert.match(duplicate.error!,/already admitted/);
 assert.equal(duplicate.claudeAdmission,undefined,'an existing worker retains its receipt fence');
});

for(const proof of ['native','generation','untyped','real-incomplete'] as const)test(`native incomplete classification honors owner proof ${proof}`,()=>{
 const result:import('../src/host/host.ts').HostRunResult={code:null,stdout:'',stderr:'',error:proof==='real-incomplete'?'cleanup incomplete: native close missing':'ENOENT: /fixture/cleanup incomplete/missing',...(proof==='native'?{nativeAdmission:'no-process' as const}:{}),...(proof==='generation'?{claudeAdmission:{generation,outcome:'refused-before-spawn' as const}}:{})};
 assert.equal(nativeCommandIncomplete(result),proof==='untyped'||proof==='real-incomplete');
 const bounded=boundedCommandResult({...result,stdout:'x'.repeat(1024*1024)});
 assert.equal(nativeCommandIncomplete(bounded),proof==='untyped'||proof==='real-incomplete','bounded output retains the authoritative receipt');
});
