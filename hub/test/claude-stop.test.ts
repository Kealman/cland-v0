// T1: scripted Claude shutdown observations prove capture authority and escalation without native timers.
import test from 'node:test';
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
 const result=await stopClaude(root,[root,hook],{},async()=>{signals++;return true;},1,async()=>{},{snapshot:async()=>[{pid:100,parent:1,group:100,uid:process.getuid!()},{pid:101,parent:100,group:100,uid:process.getuid!()+1}]});
 assert.equal(result,null);assert.equal(signals,0);
});

for(const mode of ['foreign UID','reparented','old PID','root birth gone'] as const)test(`pre-signal Claude capture refuses ${mode}`,async()=>{
 const {claudeDescendantCapture}=await import('../src/host/agent/claude-stop.ts');
 const uid=process.getuid!(),rows=[{pid:100,parent:1,group:100,uid},{pid:101,parent:mode==='reparented'?1:100,group:100,uid:mode==='foreign UID'?uid+1:uid}];
 const proof=new Map([[100,{identity:mode==='root birth gone'?'linux:reused:3':root.identity,ended:false}],[101,{identity:hook.identity,ended:false}]]);
 const result=claudeDescendantCapture(root,[root],new Set(mode==='old PID'?[100,101]:[100]),rows,proof);
 assert.ok('reason' in result);
});

test('second pre-signal descendant churn is incomplete without sending any signal',async()=>{
 let signals=0;const uid=process.getuid!();
 const result=await stopClaude(root,[root,hook],{},async()=>{signals++;return true;},1,async()=>{},{
   snapshot:async()=>[{pid:100,parent:1,group:100,uid},{pid:101,parent:100,group:100,uid},{pid:102,parent:101,group:100,uid}],
   observe:async pids=>new Map(pids.map(pid=>[pid,{identity:pid===100?root.identity:pid===101?hook.identity:'linux:boot:3',ended:false}])),
 });
 assert.equal(result,null);assert.equal(signals,0);
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
 const result=await stopClaude(root,[root,hook],{},async targets=>{assert.equal(reads.length,2,'unknown identity is re-read before TERM');signals.push(...targets.map(t=>t.pid));rootEnded=true;return true;},1,async()=>{},{
   snapshot:async()=>rootEnded?[]:[{pid:100,parent:1,group:100,uid},{pid:101,parent:100,group:100,uid}],
   observe:async pids=>{reads.push([...pids]);return new Map(pids.map(pid=>[pid,pid===100?{identity:rootEnded?null:root.identity,ended:rootEnded}:persistent||reads.length===1?{identity:null,ended:false}:{identity:null,ended:true}]));},
 });
 assert.deepEqual(reads[1],[101],'only the unknown pinned member is re-read');
 if(persistent){assert.equal(result,null);assert.equal(reads.length,2);assert.deepEqual(signals,[]);}
 else{assert.ok(result);assert.deepEqual(signals,[100]);}
});

for(const mode of ['unused','outer spent','second descendant'] as const)test(`Claude helper admission budget ${mode} preserves the one-recapture boundary`,async()=>{
 let snapshots=0,ended=false,spent=mode==='outer spent',takes=0;const signals:number[]=[],checkpoints:number[][]=[],uid=process.getuid!();
 const result=await stopClaude(root,[root],{},async targets=>{assert.ok(checkpoints.some(rows=>rows.includes(101)),'new birth checkpoint precedes TERM');signals.push(...targets.map(t=>t.pid));ended=true;return true;},1,async targets=>{checkpoints.push(targets.map(t=>t.pid));},{
   admission:{initial:new Set([100]),take:()=>{takes++;if(spent)return false;spent=true;return true;}},
   snapshot:async()=>{snapshots++;return ended?[]:[{pid:100,parent:1,group:100,uid},{pid:101,parent:100,group:100,uid},...(mode==='second descendant'&&snapshots>1?[{pid:102,parent:101,group:100,uid}]:[])];},
   observe:async pids=>new Map(pids.map(pid=>[pid,{identity:ended?null:pid===100?root.identity:pid===101?hook.identity:'linux:boot:3',ended}])),
 });
 assert.equal(takes,1,'the helper asks for the admission budget once');
 if(mode==='unused'){assert.ok(result);assert.deepEqual(signals,[100]);}
 else{assert.equal(result,null);assert.deepEqual(signals,[]);}
});

test('a new Claude stop admission starts a fresh single-use budget',async()=>{
 const {claudeStopAdmission}=await import('../src/host/agent/claude-stop.ts');
 const first=claudeStopAdmission(new Set([100])),next=claudeStopAdmission(new Set([100,101]));
 assert.equal(first.take(),true);assert.equal(first.take(),false);assert.equal(next.take(),true);assert.equal(next.take(),false);
 assert.deepEqual([...next.initial],[100,101]);
});
