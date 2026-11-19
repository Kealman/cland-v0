// T2: thousand-item startup receipts and public frames through an in-process projectHub.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {taskWriteGate} from './tracker-write-gate.ts';
import {join} from 'node:path';
import {serializeItem} from '../src/tracker/item.ts';
import {connectUi,projectHub,tempProject,until} from './harness.ts';
import {FakeClock} from './fake-clock.ts';
import {withPlan} from '../src/tracker/plan.ts';
import {trackerFileCase} from './tip-churn-file-fixture.ts';
import {tipChurnFixture} from './tip-churn-fixture.ts';
import {fixtureNativeGuard} from './fake-native-guard.ts';
import {stageCase} from './stage-case-fixture.ts';
import {ExplorerFieldsIndex} from '../src/tracker/explorer-fields.ts';
import {within} from '../src/executor/droplet/deadline.ts';

// A single consumer gets a fresh file-owned hub; no other case mutates its tips.
const churnFixture = await trackerFileCase(async ({owner, root, step}) => {
  const fixture = await step(() => tipChurnFixture(root, owner));
  const hub = await step(() => projectHub(owner.resources, root, {}, {clock: new FakeClock(Date.now()), ...fixture}));
  await step(() => fixture.refresh());
  return {fixture, hub};
});

test('task.view and verify queue replies have p95 below one second during ten-branch churn in a 1650-item tracker', t => churnFixture.run(t, async t => {
  await fixtureNativeGuard(t);
  const {fixture, hub} = churnFixture.value;
  try {
    const ui = await connectUi(t, hub.discovery);
    const samples = {view: [] as number[], queue: [] as number[]};
    for (let round = 0; round < 40; round++) {
      fixture.move();
      // Start both observers before the producer. Sample ends at the exact reply,
      // and includes queued refresh work, socket delivery and task.view file I/O.
      const viewStart = performance.now();
      const view = ui.request({type: 'task.view', item: `T-${51 + round % 10}`}).then(reply => {
        samples.view.push(performance.now() - viewStart);
        assert.equal(reply.ok, true, reply.error);
        assert.equal((reply.value as {item: {id: string}}).item.id, `T-${51 + round % 10}`);
      });
      const queueStart = performance.now();
      const queue = ui.request({type: 'suite.queue'}).then(reply => {
        samples.queue.push(performance.now() - queueStart);
        assert.equal(reply.ok, true, reply.error);
        assert.ok(reply.value, 'queue reply has its structured snapshot');
      });
      await Promise.all([view, queue, fixture.refresh()]);
    }
    for (const [name, values] of Object.entries(samples)) {
      const p95 = [...values].sort((a, b) => a - b)[Math.ceil(values.length * 0.95) - 1]!;
      t.diagnostic(`${name}: ${values.length} replies, p95 ${p95.toFixed(3)} ms; behaviour bound 1000 ms; excludes fixture setup; real socket, fake Git, no browser`);
      assert.ok(p95 < 1000, `${name} p95 ${p95.toFixed(3)} ms exceeds behaviour bound 1000 ms`);
    }
  } finally { await hub.dispose(); }
}));

async function plannedStartup(t:test.TestContext, backlog=false, suppliedRoot?:string) {
  const root=suppliedRoot??await tempProject(t);
  const at='2026-10-16T12:00:00.000Z';
  await mkdir(join(root,'.cland/tasks'),{recursive:true});
  const tasks=Array.from({length:998},(_,n)=>`T-${n+3}`);
  const writes=await Promise.allSettled(Array.from({length:1000},(_,n)=>{
    const num=n+1,kind=num===1?'release':num===2?'epic':'task',id=`${kind==='release'?'R':kind==='epic'?'E':'T'}-${num}`;
    return writeFile(join(root,`.cland/tasks/${id}-fixture.md`),serializeItem({
      fm:{id,kind,title:`Item ${num}`,state:'open',...(kind==='task'?{size:'S' as const,status:(backlog&&num===3?'backlog':'planned') as 'backlog'|'planned'}:{}),labels:[],assignee:null,
        parent:num===1?null:num===2?'R-1':'E-2',blocked_by:[],topic:null,branch:null,created:at,updated:at},
      body:num===2?withPlan('## Summary\n\nStartup fixture.',{stages:[{name:'first',qa:{scope:'none',when:'per-item'},lanes:[tasks]}]}):'## Summary\n\nStartup fixture.',comments:kind==='task'&&num%20===0?[{author:'reviewer',at,text:'Reviewed',verdict:{verdict:'review' as const,result:'clear' as const,by:'reviewer',run:`review-${id}`,commit:'a'.repeat(40)}}]:[],
    }));
  }));
  const failures=writes.filter(result=>result.status==='rejected');
  if(failures.length)throw new AggregateError(failures.map(result=>result.reason),'planned fixture writes failed after all writers settled');
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
  const owner=stageCase(t);
  await owner.run(async step=>{
  const root=await owner.wait('root setup',()=>step(async()=>{const root=await tempProject(owner.fixtures);owner.adoptRoot(root);return root;}));
  const seeding=step(()=>plannedStartup(owner.fixtures,true,root));
  // Observation can time out; the cleanup owner still joins every original
  // seed writer before it releases the root or restores fixture seams.
  owner.requireClose(async()=>{await Promise.allSettled([seeding]);});
  await within(seeding,15000,undefined,()=>new Error('planned tracker seed setup incomplete after 15000 ms'));
  const gate=await owner.wait('write gate setup',()=>step(()=>taskWriteGate(owner.fixtures,root)));
  await owner.wait('write gate armed',()=>step(()=>gate.arm()));
  let plannedBeforeServing=false;
  const listening=Promise.withResolvers<number>(),socketBound=Promise.withResolvers<string>(),serving=Promise.withResolvers<number>();
  const firstRead=Promise.withResolvers<void>();
  const releaseFirstRead=Promise.withResolvers<void>();
  owner.releaseOnClose(()=>releaseFirstRead.resolve());
  const ancestorRefreshes=new Map<string,number>();
  let inFirstRead=false,readCount=0;
  const update=ExplorerFieldsIndex.prototype.update;
  owner.patch(ExplorerFieldsIndex.prototype,'update',function(this:ExplorerFieldsIndex,...args:Parameters<ExplorerFieldsIndex['update']>){
    if(inFirstRead&&(args[0]==='E-2'||args[0]==='R-1'))ancestorRefreshes.set(args[0],(ancestorRefreshes.get(args[0])??0)+1);
    return update.apply(this,args);
  });
  // Both observers are armed before startup. The early client connects to the
  // actual Unix edge, so waiting for projectHub's return cannot hide starvation.
  const client=socketBound.promise.then(async socket=>{
    const secret=await step(()=>readFile(join(root,'.cland/secret'),'utf8'));
    return step(()=>connectUi(owner.fixtures,{root,socket,secret:secret.trim()}));
  });
  const response=serving.promise.then(async at=>{
    try{
    const ui=await client;
    const reply=await step(()=>ui.request({type:'hub.status'}));
    return {reply,elapsed:performance.now()-at,duringFirstRead:inFirstRead};
    }
    finally{releaseFirstRead.resolve();}
  });
  void client.catch(()=>{});void response.catch(()=>{});
  const starting=step(()=>projectHub(owner.resources,root,gate.env, {clock:new FakeClock(),stageTree:async()=>null,
    git:async args=>args[0]==='for-each-ref'?`${'a'.repeat(40)} refs/heads/dev`:null,
    readBase:async()=> 'dev',
    scheduleTips:read=>{
      const run=async()=>{const first=readCount++===0;if(first)inFirstRead=true;try{if(first)await releaseFirstRead.promise;await read();}finally{if(first){inFirstRead=false;firstRead.resolve();}}};
      void run();return {poke(){},stop(){}};
    },
    log:entry=>{if(entry.event==='listening'){listening.resolve(performance.now());if(typeof entry.socket==='string')socketBound.resolve(entry.socket);}if(entry.event==='serving'){serving.resolve(performance.now());plannedBeforeServing=existsSync(join(gate.env.CLAND_TEST_TASK_WRITE_GATE,'entered'));}},
  }));
  void starting.catch(()=>{});
  try{
  const bound=await within(listening.promise,15000,undefined,()=>new Error('fixture listener bound incomplete after 15000 ms'));
  const served=await owner.wait('serving receipt after listening',()=>within(serving.promise,2000,undefined,()=>new Error('serving receipt after listening: not within 2000 ms')));
  const gap=served-bound;
  assert.ok(gap<2000,`listening to serving took ${gap.toFixed(3)} ms; bound 2000 ms`);
  await owner.wait('first freshness announcement completed',()=>firstRead.promise);
  t.diagnostic(`first-batch ancestor refreshes ${JSON.stringify(Object.fromEntries(ancestorRefreshes))}`);
  assert.deepEqual(Object.fromEntries(ancestorRefreshes),{'R-1':1,'E-2':1},'each ancestor is refreshed once in the first freshness batch');
  const answered=await owner.wait('post-serving status reply',()=>response);
  assert.equal(answered.reply.ok,true,answered.reply.error); // lint-allow-wall-clock: asserts the real socket reply carried beside the monotonic latency receipt
  assert.ok(answered.elapsed<2000,`serving to status reply took ${answered.elapsed.toFixed(3)} ms; bound 2000 ms`); // lint-allow-wall-clock: real post-serving socket responsiveness cannot be measured by the fixture scheduling clock
  assert.equal(answered.duringFirstRead,true,'the status reply arrives while the first freshness batch is still running'); // lint-allow-wall-clock: checks the first-read boundary recorded at the actual socket response
  const hub=await starting;
  await owner.wait('planned write entered',()=>step(()=>gate.entered()));
  assert.equal(plannedBeforeServing,false,'planned writes start after serving');
  const ui=await client;
  assert.equal((await ui.request({type:'hub.status'})).ok,true,'status replies while planned write is held');
  await step(()=>gate.release());
  const planned=await ui.request({type:'task.view',item:'T-3'});
  assert.equal((planned.value as {item:{status:string}}).item.status,'planned');
  t.diagnostic(`${process.platform}/${process.arch}; local projectHub; listening to serving ${gap.toFixed(3)} ms; serving to status reply ${answered.elapsed.toFixed(3)} ms; bounds 2000 ms; ancestor refreshes ${JSON.stringify(Object.fromEntries(ancestorRefreshes))}`);
  }finally{await gate.release();}
  });
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
