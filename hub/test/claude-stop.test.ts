// T1: scripted Claude shutdown observations prove capture authority and escalation without native timers.
import test from 'node:test';
import { testWaitMs } from './until.ts';
import assert from 'node:assert/strict';
import { stopClaude, type ClaudeStopMember } from '../src/host/agent/claude-stop.ts';
const root={pid:100,identity:'linux:boot:1'},hook={pid:101,identity:'linux:boot:2'};
for(const mode of ['natural','ignores TERM','after root exit','reparented','foreign'] as const)test(`Claude SessionEnd ${mode} has bounded native ownership`,async()=>{
 let now=0,triggered=false,closed=false,hookAlive=true;
 const signals:Array<{pid:number;signal:string}>=[],checkpoints:number[][]=[];
 const uid=process.getuid!();
 const member=(pid:number,parent:number,user=uid):ClaudeStopMember=>({pid,parent,uid:user,group:100});
 const result=await stopClaude(root,[root],{},async(targets,signal)=>{
   for(const target of targets){signals.push({pid:target.pid,signal});assert.ok(target.identity===root.identity||checkpoints.some(rows=>rows.includes(target.pid)),'new native birth is checkpointed before signaling');}
   triggered=true;
   if(signal==='SIGKILL'){closed=true;hookAlive=false;}
   return true;
 },2,async targets=>{checkpoints.push(targets.map(target=>target.pid));},{
   snapshot:async()=>!triggered?[member(100,1)]:closed?[]:[...(mode==='after root exit'?[]:[member(100,1)]),member(101,mode==='reparented'?1:100,mode==='foreign'?uid+1:uid)],
   observe:async pids=>new Map(pids.map(pid=>[pid,{identity:pid===100?(closed||mode==='after root exit'?null:root.identity):hookAlive?hook.identity:null,ended:pid===100?(closed||mode==='after root exit'):!hookAlive}])),
   now:()=>now,pause:async()=>{now++;if(mode==='natural'){closed=true;hookAlive=false;}},
 });
 if(mode==='natural'||mode==='ignores TERM'){
   assert.ok(result);assert.ok(checkpoints.some(rows=>rows.includes(101)));
   assert.equal(signals.some(row=>row.pid===101&&row.signal==='SIGKILL'),mode==='ignores TERM');
 }else{assert.equal(result,null);assert.equal(signals.some(row=>row.pid===101),false);}
});

test('Claude refuses a foreign UID already present in its captured set before any signal',async()=>{
 let signals=0;
 const result=await stopClaude(root,[root,hook],{},async()=>{signals++;return true;},testWaitMs(),async()=>{},{snapshot:async()=>[{pid:100,parent:1,group:100,uid:process.getuid!()},{pid:101,parent:100,group:100,uid:process.getuid!()+1}]});
 assert.equal(result,null);assert.equal(signals,0);
});

for(const mode of ['foreign UID','reparented','old PID','root birth gone'] as const)test(`pre-signal Claude capture refuses ${mode}`,async()=>{
 const {claudeDescendantCapture}=await import('../src/host/agent/claude-stop.ts');
 const uid=process.getuid!(),rows=[{pid:100,parent:1,group:100,uid},{pid:101,parent:mode==='reparented'?1:100,group:100,uid:mode==='foreign UID'?uid+1:uid}];
 const proof=new Map([[100,{identity:mode==='root birth gone'?'linux:reused:3':root.identity,ended:false}],[101,{identity:hook.identity,ended:false}]]);
 const result=claudeDescendantCapture(root,[root],new Set(mode==='old PID'?[100,101]:[100]),rows,proof);
 assert.ok('reason' in result);
});

for(const ended of [true,false])test(`pinned Claude member ${ended?'exit':'birth replacement'} is settled before comparing captures`,async()=>{
 const {claudeDescendantCapture}=await import('../src/host/agent/claude-stop.ts');
 const uid=process.getuid!(),proof=new Map([[100,{identity:root.identity,ended:false}],[101,{identity:ended?null:'linux:boot:replacement',ended}]]);
 const captured=claudeDescendantCapture(root,[root,hook],new Set([100,101]),[{pid:100,parent:1,group:100,uid}],proof);
 assert.deepEqual(captured,{targets:[root]});
});

for(const persistent of [false,true])test(`Claude ${persistent?'persistent':'transient'} unknown member gets one identity re-read before signals`,async()=>{
 let rootEnded=false;const reads:number[][]=[],signals:number[]=[];
 const uid=process.getuid!();
 const result=await stopClaude(root,[root,hook],{},async targets=>{assert.equal(reads.length,2,'unknown identity is re-read before TERM');signals.push(...targets.map(t=>t.pid));rootEnded=true;return true;},testWaitMs(),async()=>{},{
   snapshot:async()=>rootEnded?[]:[{pid:100,parent:1,group:100,uid},{pid:101,parent:100,group:100,uid}],
   observe:async pids=>{reads.push([...pids]);return new Map(pids.map(pid=>[pid,pid===100?{identity:rootEnded?null:root.identity,ended:rootEnded}:persistent||reads.length===1?{identity:null,ended:false}:{identity:null,ended:true}]));},
 });
 assert.deepEqual(reads[1],[101],'only the unknown pinned member is re-read');
 if(persistent){assert.equal(result,null);assert.equal(reads.length,2);assert.deepEqual(signals,[]);}
 else{assert.ok(result);assert.deepEqual(signals,[100]);}
});

test('Claude signals the spawner then converges across successive descendant births',async()=>{
 let now=0,term=false,ended=false,samples=0;const uid=process.getuid!(),signals:number[][]=[],checkpoints:number[][]=[];
 const result=await stopClaude(root,[root],{},async targets=>{signals.push(targets.map(t=>t.pid));if(!term){assert.deepEqual(targets,[root]);term=true;}else ended=true;return true;},3,async targets=>{checkpoints.push(targets.map(t=>t.pid));},{
   admission:{initial:new Set([100])},
   now:()=>now,pause:async()=>{now++;},
   snapshot:async()=>{if(ended)return [];if(term)samples++;return [{pid:100,parent:1,group:100,uid},{pid:101,parent:100,group:100,uid},...(samples>1?[{pid:102,parent:101,group:100,uid}]:[])];},
   observe:async pids=>new Map(pids.map(pid=>[pid,{identity:ended?null:pid===100?root.identity:pid===101?hook.identity:'linux:boot:3',ended}])),
 });
 assert.ok(result);assert.deepEqual(signals[0],[100]);assert.ok(signals.some(pids=>pids.includes(102)));assert.ok(checkpoints.some(pids=>pids.includes(101)&&pids.includes(102)));
});

for(const mode of ['successive births','settled exits','unstable deadline'] as const)test(`Claude post-TERM convergence: ${mode}`,async()=>{
 let now=0,term=false,ended=false,sample=0;const uid=process.getuid!(),signals:number[][]=[],reasons:string[]=[];
 const result=await stopClaude(root,[root],{},async targets=>{signals.push(targets.map(t=>t.pid));if(term&&mode!=='unstable deadline')ended=true;term=true;return true;},3,async()=>{},{
   admission:{initial:new Set([100])},now:()=>now,pause:async()=>{now++;},diagnostic:reason=>reasons.push(reason),
   snapshot:async()=>{if(ended)return [];const n=term?++sample:0;return [{pid:100,parent:1,group:100,uid},...Array.from({length:n?mode==='unstable deadline'?n:Math.min(n,3):0},(_,i)=>({pid:101+i,parent:100,group:100,uid}))];},
   observe:async pids=>new Map(pids.map(pid=>{const gone=ended||mode==='settled exits'&&pid===101&&sample>1;return [pid,{identity:gone?null:pid===100?root.identity:`linux:boot:${pid}`,ended:gone}];})),
 });
 if(mode==='unstable deadline'){assert.equal(result,null);assert.deepEqual(signals,[[100]],'unstable descendants are never signalled');assert.match(reasons.join(';'),/deadline/);assert.equal(now,9);}
 else {assert.ok(result);assert.ok(signals.some(pids=>pids.includes(103)),'all converged births are joined');}
});

test('Claude captures a new writer from a pinned live parent after root exit',async()=>{
 const {claudeDescendantCapture}=await import('../src/host/agent/claude-stop.ts');const uid=process.getuid!();
 assert.deepEqual(claudeDescendantCapture(root,[root,hook],new Set([100,101]),[{pid:101,parent:1,group:100,uid},{pid:102,parent:101,group:100,uid}],new Map([[100,{identity:null,ended:true}],[101,{identity:hook.identity,ended:false}],[102,{identity:'linux:boot:3',ended:false}]])),{targets:[hook,{pid:102,identity:'linux:boot:3'}]});
});

test('Claude persistent unknown after root TERM retains incomplete ownership',async()=>{
 let triggered=false,reads=0;const signals:number[]=[],uid=process.getuid!(),reasons:string[]=[];
 const result=await stopClaude(root,[root],{},async targets=>{signals.push(...targets.map(t=>t.pid));triggered=true;return true;},3,async()=>{},{
   admission:{initial:new Set([100])},now:()=>0,diagnostic:reason=>reasons.push(reason),
   snapshot:async()=>[{pid:100,parent:1,group:100,uid},...(triggered?[{pid:101,parent:100,group:100,uid}]:[])],
   observe:async pids=>{if(triggered)reads++;return new Map(pids.map(pid=>[pid,pid===100?{identity:root.identity,ended:false}:{identity:null,ended:false}]));},
 });
 assert.equal(result,null);assert.deepEqual(signals,[100]);assert.equal(reads,2,'unknown receives exactly one native re-read');assert.match(reasons.join(';'),/birth unavailable/);
});

for(const state of ['exited','replaced','unknown'] as const)test(`Claude retry after root ${state} retains only pinned hook authority`,async()=>{
 let now=0,ended=false;const signals:number[][]=[],uid=process.getuid!();
 const result=await stopClaude(root,[root,hook],{},async targets=>{signals.push(targets.map(target=>target.pid));ended=true;return true;},2,async()=>{},{
   now:()=>now,pause:async()=>{now++;},admission:{initial:new Set([100,101])},
   snapshot:async()=>[...(state==='replaced'?[{pid:100,parent:1,group:100,uid}]:[]),...(!ended?[{pid:101,parent:1,group:100,uid}]:[])],
   observe:async pids=>new Map(pids.map(pid=>[pid,pid===100?{identity:state==='replaced'?'linux:boot:replacement':null,ended:state==='exited'}:{identity:ended?null:hook.identity,ended}])),
 });
 if(state==='unknown'){assert.equal(result,null);assert.deepEqual(signals,[]);}
 else {assert.deepEqual(result,[]);assert.deepEqual(signals,[[101]],'retry signals only the retained live birth');}
});

test('Claude deadline retains a pinned hook for a later root-absent retry',async()=>{
 let now=0,rootEnded=false,hookEnded=false,retry=false;let retained=[root,hook];const uid=process.getuid!(),signals:number[][]=[];
 const facts={admission:{initial:new Set([100,101])},now:()=>now,pause:async()=>{now++;},
   snapshot:async()=>[...(!rootEnded?[{pid:100,parent:1,group:100,uid}]:[]),...(!hookEnded?[{pid:101,parent:rootEnded?1:100,group:100,uid}]:[])],
   observe:async(pids:number[])=>new Map(pids.map(pid=>[pid,{identity:pid===100?rootEnded?null:root.identity:hookEnded?null:hook.identity,ended:pid===100?rootEnded:hookEnded}])),
 };
 const signal=async(targets:readonly typeof root[])=>{signals.push(targets.map(target=>target.pid));if(targets.some(target=>target.pid===100))rootEnded=true;if(retry)hookEnded=true;return true;};
 assert.equal(await stopClaude(root,retained,{},signal,2,async targets=>{retained=[...targets];},facts),null,'first deadline leaves the TERM-resistant pinned hook held');
 assert.deepEqual(retained,[hook]);assert.equal(rootEnded,true);assert.equal(hookEnded,false);
 retry=true;signals.length=0;
 assert.deepEqual(await stopClaude(root,retained,{},signal,2,async targets=>{retained=[...targets];},facts),[]);
 assert.deepEqual(signals,[[101]],'a later stop joins only the retained birth');assert.deepEqual(retained,[]);
});
