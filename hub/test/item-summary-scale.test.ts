// T2: thousand-item startup receipts and public frames through an in-process projectHub.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {taskWriteGate} from './tracker-write-gate.ts';
import {onCleanup} from './process-cleanup.ts';
import {join} from 'node:path';
import {serializeItem} from '../src/tracker/item.ts';
import {connectUi,projectHub,tempProject,until} from './harness.ts';
import {FakeClock} from './fake-clock.ts';
import {withPlan} from '../src/tracker/plan.ts';

async function plannedStartup(t:test.TestContext, backlog=false) {
  const root=await tempProject(t),at='2026-10-16T12:00:00.000Z';
  await mkdir(join(root,'.cland/tasks'),{recursive:true});
  const tasks=Array.from({length:998},(_,n)=>`T-${n+3}`);
  await Promise.all(Array.from({length:1000},(_,n)=>{
    const num=n+1,kind=num===1?'release':num===2?'epic':'task',id=`${kind==='release'?'R':kind==='epic'?'E':'T'}-${num}`;
    return writeFile(join(root,`.cland/tasks/${id}-fixture.md`),serializeItem({
      fm:{id,kind,title:`Item ${num}`,state:'open',...(kind==='task'?{size:'S' as const,status:(backlog&&num===3?'backlog':'planned') as 'backlog'|'planned'}:{}),labels:[],assignee:null,
        parent:num===1?null:num===2?'R-1':'E-2',blocked_by:[],topic:null,branch:null,created:at,updated:at},
      body:num===2?withPlan('## Summary\n\nStartup fixture.',{stages:[{name:'first',qa:{scope:'none',when:'per-item'},lanes:[tasks]}]}):'## Summary\n\nStartup fixture.',comments:kind==='task'&&num%20===0?[{author:'reviewer',at,text:'Reviewed',verdict:{verdict:'review' as const,result:'clear' as const,by:'reviewer',run:`review-${id}`,commit:'a'.repeat(40)}}]:[],
    }));
  }));
  return {root};
}

test('a thousand-item planned startup batches explorer recomputation',async t=>{
  const {root}=await plannedStartup(t);
  const logs:Record<string,unknown>[]=[];
  const hub=await projectHub(t,root,{}, {clock:new FakeClock(),git:async args=>args[0]==='for-each-ref'?`${'a'.repeat(40)} refs/heads/dev`:null,readBase:async()=> 'dev',log:entry=>logs.push(entry)});
  const ui=await connectUi(t,hub.discovery);
  const reply=await ui.request({type:'task.plan',item:'E-2',op:'show'});
  assert.equal(reply.ok,true,reply.error);
  assert.equal((reply.value as {stages:Array<{items:string[]}>}).stages[0]!.items.length,998);
  const receipts=logs.filter(log=>log.event==='explorer-recomputed');
  // Initial projection, freshness, core context and restored verification sources are separate batches.
  assert.ok(receipts.length>0&&receipts.length<=4,`startup recomputed explorer ${receipts.length} times; bound 4 batches`);
  t.diagnostic(`1000 rows with planned epic; ${receipts.length} explorer recompute batches`);
});

// C2 explicitly measures the real listening-to-serving interval; fixture setup has its own bound.
test('a thousand-item planned hub serves within two seconds of listening before maintenance',async t=>{
  const {root}=await plannedStartup(t,true);
  const gate=await taskWriteGate(t,root);await gate.arm();onCleanup(t,()=>gate.release());
  let plannedBeforeServing=false;
  let listening:number|undefined,serving:number|undefined;
  const starting=projectHub(t,root,gate.env, {clock:new FakeClock(),
    git:async args=>args[0]==='for-each-ref'?`${'a'.repeat(40)} refs/heads/dev`:null,
    readBase:async()=> 'dev',
    log:entry=>{if(entry.event==='listening')listening??=performance.now();if(entry.event==='serving'){serving=performance.now();plannedBeforeServing=existsSync(join(gate.env.CLAND_TEST_TASK_WRITE_GATE,'entered'));}},
  });
  await until(()=>listening!==undefined,{what:'fixture listener bound',timeoutMs:15000});
  await until(()=>serving!==undefined,{what:'serving receipt after listening',timeoutMs:2000,loadFactor:1});
  const hub=await starting;
  const gap=serving!-listening!;
  assert.ok(gap<2000,`listening to serving took ${gap.toFixed(3)} ms; bound 2000 ms`);
  await gate.entered();
  assert.equal(plannedBeforeServing,false,'planned writes start after serving');
  const ui=await connectUi(t,hub.discovery);
  assert.equal((await ui.request({type:'hub.status'})).ok,true,'status replies while planned write is held');
  await gate.release();
  const planned=await ui.request({type:'task.view',item:'T-3'});
  assert.equal((planned.value as {item:{status:string}}).item.status,'planned');
  t.diagnostic(`${process.platform}/${process.arch}; local projectHub; listening to serving ${gap.toFixed(3)} ms; bound 2000 ms`);
});

test('a thousand-item task change recomputes only its three-row chain within 100 ms',async t=>{
  const root=await tempProject(t),at='2026-10-16T12:00:00.000Z';
  await mkdir(join(root,'.cland/tasks'),{recursive:true});
  await Promise.all(Array.from({length:1000},(_,n)=>{
    const num=n+1,kind=num===1?'release':num<=11?'epic':'task',id=`${kind==='release'?'R':kind==='epic'?'E':'T'}-${num}`;
    return writeFile(join(root,`.cland/tasks/${id}-fixture.md`),serializeItem({
      fm:{id,kind,title:`Item ${num}`,state:'open',...(kind==='task'?{size:'S' as const,status:'planned' as const}:{}),labels:[],assignee:null,
        parent:num===1?null:kind==='epic'?'R-1':`E-${2+(num-12)%10}`,blocked_by:[],topic:null,branch:null,created:at,updated:at},
      body:'## Summary\n\nA scale fixture summary.',comments:[],
    }));
  }));
  const logs:Record<string,unknown>[]=[];
  const hub=await projectHub(t,root,{}, {clock:new FakeClock(),log:entry=>logs.push(entry)});
  const ui=await connectUi(t,hub.discovery);await ui.request({type:'subscribe'});logs.length=0;
  const changed=ui.waitFor(f=>f.type==='task'&&f.id==='T-12'&&(f.item as {status:string}).status==='in progress');
  const reply=await ui.request({type:'task.edit',item:'T-12',status:'in progress'});assert.equal(reply.ok,true,reply.error);await changed;
  await ui.request({type:'topic.list'});
  const receipts=logs.filter(log=>log.event==='explorer-recomputed');assert.ok(receipts.length>0);
  const touched=receipts.flatMap(log=>log.items as string[]);
  assert.deepEqual([...new Set(touched)].sort(),['E-2','R-1','T-12']);
  const duration=receipts.reduce((total,log)=>total+Number(log.durationMs),0);
  // T-1052's synchronous roll-up bound excludes setup, I/O, transport and freshness probes.
  assert.ok(duration<100,`recomputation took ${duration.toFixed(3)} ms; bound 100 ms`);
  t.diagnostic(`1000 rows; recomputed ${touched.join(', ')} in ${duration.toFixed(3)} ms; bound 100 ms`);
});
