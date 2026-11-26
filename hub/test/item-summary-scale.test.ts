// T2: thousand-item startup receipts and public frames through an in-process projectHub.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {taskWriteGate} from './tracker-write-gate.ts';
import {join} from 'node:path';
import {serializeItem} from '../src/tracker/item.ts';
import {connectUi,projectHub,tempProject,until,eventually,inProcessSpoke,frameClient} from './harness.ts';
import {createConnection} from 'node:net';
import {FakeClock} from './fake-clock.ts';
import {withPlan} from '../src/tracker/plan.ts';
import {trackerFileCase} from './tip-churn-file-fixture.ts';
import {tipChurnFixture} from './tip-churn-fixture.ts';
import {fixtureNativeGuard} from './fake-native-guard.ts';
import {stageCase} from './stage-case-fixture.ts';
import {ExplorerFieldsIndex} from '../src/tracker/explorer-fields.ts';
import {within} from '../src/executor/droplet/deadline.ts';
import {seedPlanStageCover} from './plan-stage-fixture.ts';
import {HubCore} from '../src/hub/core.ts';
import {publicationWork} from './publication-work.ts';

let churnAcquisitions = 0;
test('loading scale cases does not acquire the churn fixture', () => {
  assert.equal(churnAcquisitions, 0, 'unselected churn fixture acquisitions');
});

test('task.view and verify queue replies have p95 below one second during ten-branch churn in a 1650-item tracker', async t => {
  // Selection precedes acquisition; the case owns setup, callback and teardown.
  churnAcquisitions++;
  const churnFixture = await trackerFileCase(async ({owner, root, step}) => {
    const fixture = await step(() => tipChurnFixture(root, owner));
    const hub = await step(() => projectHub(owner.resources, root, {}, {clock: new FakeClock(Date.now()), ...fixture}));
    await step(() => fixture.refresh());
    return {fixture, hub};
  }, t);
  await churnFixture.run(t, async t => {
  assert.equal(churnAcquisitions, 1, 'selected churn consumer acquisition control');
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
  });
});

async function plannedStartup(t:test.TestContext, backlog=false, suppliedRoot?:string, count=1000, history=false) {
  const root=suppliedRoot??await tempProject(t);
  const at='2026-10-16T12:00:00.000Z';
  await mkdir(join(root,'.cland/tasks'),{recursive:true});
  const tasks=Array.from({length:count-2},(_,n)=>`T-${n+3}`);
  const writes=await Promise.allSettled(Array.from({length:count},(_,n)=>{
    const num=n+1,kind=num===1?'release':num===2?'epic':'task',id=`${kind==='release'?'R':kind==='epic'?'E':'T'}-${num}`;
    return writeFile(join(root,`.cland/tasks/${id}-fixture.md`),serializeItem({
      fm:{id,kind,title:`Item ${num}`,state:history&&num>=3&&(num<503||num>=750)?'closed':'open',...(kind==='task'?{size:'S' as const,status:history&&(num<503||num>=750)?'done':(backlog&&num===3?'backlog':'planned') as 'backlog'|'planned'}:{}),labels:[],assignee:null,
        parent:num===1?null:num===2?'R-1':'E-2',blocked_by:[],topic:null,branch:history&&num>=750?`t/fixture-${num}`:null,created:at,updated:at},
      body:num===2?withPlan('## Summary\n\nStartup fixture.',{stages:history?Array.from({length:4},(_,stage)=>({name:`stage-${stage}`,qa:{scope:'none',when:'after-stage'},lanes:[tasks.slice(stage*250,stage===3?undefined:(stage+1)*250)]})):[{name:'first',qa:{scope:'none',when:'per-item'},lanes:[tasks]}]}):'## Summary\n\nStartup fixture.'+(history?'\n\n## Acceptance criteria\n- [ ] C1. The fixture works.':''),comments:kind==='task'&&(history||num%20===0)?[{author:'reviewer',at,text:'Reviewed',verdict:{verdict:'review' as const,result:'clear' as const,by:'reviewer',run:`review-${id}`,commit:'a'.repeat(40)}}]:[],
    }));
  }));
  const failures=writes.filter(result=>result.status==='rejected');
  if(failures.length)throw new AggregateError(failures.map(result=>result.reason),'planned fixture writes failed after all writers settled');
  return {root};
}

test('a planned-stage status and verdict comment permits a task view within two seconds at 1650 items',async t=>{
  const owner=stageCase(t);
  await owner.run(async step=>{
  const owned=<T>(name:string,operation:()=>Promise<T>,timeoutMs=15000)=>owner.wait(name,()=>step(operation),timeoutMs);
  const pokeWork:Promise<void>[]=[];
  // Joining rejected reads is separate from the required positive hub/resource
  // close receipts registered by projectHub through owner.resources.
  owner.requireClose(async()=>{await Promise.allSettled(pokeWork);});
  const root=await owned('root setup',async()=>{
    const root=await tempProject(owner.fixtures);owner.adoptRoot(root);return root;
  });
  await owned('tracker seed setup',()=>plannedStartup(owner.fixtures,false,root,1650,true));
  const head='a'.repeat(40);
  await owned('stage cover seed setup',()=>seedPlanStageCover(root,head));
  let armed=false;
  let moved=false;
  let refresh:(()=>Promise<void>)|undefined;
  const entered=Promise.withResolvers<number>();
  const firstPublication=Promise.withResolvers<void>();
  let tailPublished=false;
  const hub=await owned('hub setup',()=>projectHub(owner.resources,root,{}, {clock:new FakeClock(),
    git:async args=>args[0]==='for-each-ref'?`${head} refs/heads/dev\n`+Array.from({length:1148},(_,n)=>`${moved?'b'.repeat(40):head} refs/heads/t/fixture-${n+503}`).join('\n'):args[0]==='rev-parse'?head:args[0]==='diff'?'changed.ts':'',
    scheduleTips:read=>{
      refresh=read;let stopped=false;
      return {poke(){if(moved&&!stopped){
        const work=owned('poke freshness work',read,60000);pokeWork.push(work);
        void work.catch(()=>{}); // Retained and propagated through the joined poke set below.
      }},stop(){stopped=true;refresh=undefined;}};
    },
    stageTree:async()=> 'f'.repeat(40), readBase:async()=> 'dev',
    log:entry=>{
      if(!armed||entry.event!=='explorer-recomputed')return;
      const ids=entry.items as string[];
      if(ids.includes('T-750'))firstPublication.resolve();
      if(ids.includes('T-1650')){armed=false;tailPublished=true;entered.resolve(performance.now());}
    },
  }));
  const ui=await owned('legacy client setup',()=>connectUi(owner.fixtures,hub.discovery));
  const reader=await owned('request client setup',()=>connectUi(owner.fixtures,hub.discovery));
  const reviewer=await owned('reviewer setup',()=>inProcessSpoke(owner.resources,{discover:true,cwd:root,name:'scale-reviewer',role:'reviewer'}));
  assert.equal((await owned('legacy subscription setup',()=>ui.request({type:'subscribe'}))).ok,true);
  await owned('initial tips setup',()=>refresh!());
  await owned('earlier stage closure setup',()=>eventually('earlier stages have durable closure receipts',async()=>{
    const reply=await step(()=>ui.request({type:'task.view',item:'E-2'}));
    return (reply.value as {item:{stages:Array<{closure?:unknown}>}}).item.stages.slice(0,2).every(s=>s.closure)?true:undefined;
  }));
  assert.equal((await owned('review status setup',()=>ui.request({type:'task.edit',item:'T-503',status:'review'}))).ok,true);
  for(let n=0;n<20;n++){
    await owned(`subscriber ${n} setup`,async()=>{
    const socket=createConnection(hub.discovery.socket);
    const closed=new Promise<void>(resolve=>socket.once('close',()=>resolve()));
    owner.requireClose(async()=>{socket.destroy();await closed;});
    await step(()=>within(new Promise<void>((resolve,reject)=>{socket.once('connect',resolve);socket.once('error',reject);}),5000,undefined,()=>new Error('subscriber connection setup incomplete')));
    socket.setEncoding('utf8');socket.on('error',()=>{});
    let receive:((chunk:string)=>void)|undefined;
    const subscriber=frameClient(line=>socket.write(line),fn=>{receive=fn;socket.on('data',fn);},()=>socket.destroy());
    await step(async()=>subscriber.send({type:'hello',protocol:2,secret:hub.discovery.secret,client:'ui'}));
    await step(()=>subscriber.waitFor(frame=>frame.type==='welcome'));
    assert.equal((await step(()=>subscriber.request({type:'subscribe'}))).ok,true);
    // Extra clients drain native bytes; only the legacy subscriber parses
    // task frames. Twenty in-process JSON parsers would measure fixture CPU.
    socket.removeListener('data',receive!);socket.resume();
    });
  }
  // Arm before the write. Start the latency clock at the producer's explorer
  // receipt, so a blocked loop cannot hide behind a late timer callback.
  const observed=owned('task view observation',async()=>{
    const started=await step(()=>within(entered.promise,60000,undefined,()=>new Error('tail explorer receipt incomplete')));
    const reply=await step(()=>reader.request({type:'task.view',item:'T-4'},60000));
    return {reply,elapsed:performance.now()-started};
  },60000);
  const frameMark=ui.frames.length;
  const settled=(id:string)=>(frame:Record<string,unknown>)=>ui.frames.indexOf(frame)>=frameMark&&frame.type==='task'&&frame.id===id&&frame.item!==null&&
    (frame.item as {verdicts:Array<{current?:boolean}>}).verdicts.at(-1)?.current===false;
  const tail=owned('legacy tail publication receipt',()=>ui.waitFor(settled('T-1650'),60000),60000);
  const secondChange=owned('mid-publication edit sequence',async()=>{
    await step(()=>within(firstPublication.promise,60000,undefined,()=>new Error('first publication receipt incomplete')));
    const interleaved=!tailPublished;
    const reply=await step(()=>reader.request({type:'task.edit',item:'T-1649',title:'Updated during publication'},60000));
    assert.equal(reply.ok,true,reply.error);
    return {afterEdit:ui.frames.length,interleaved};
  },60000);
  // Observations can reject before the body reaches their join; each original
  // stays enrolled in the owner and is still awaited below.
  void observed.catch(()=>{});void tail.catch(()=>{});void secondChange.catch(()=>{});
  let mapEntriesCompared=0,hubCpuMicros=0;
  const keys=Object.keys;
  const accounting=publicationWork(JSON.stringify);
  owner.patch(JSON,'stringify',accounting.stringify);
  owner.patch(Object,'keys',((value:object)=>{
    const result=keys(value);
    if(result.length===1650&&'R-1' in value)mapEntriesCompared+=result.length;
    return result;
  }) as typeof Object.keys);
  const publish=HubCore.prototype.publishTask;
  owner.patch(HubCore.prototype,'publishTask',function(this:HubCore,...args:Parameters<HubCore['publishTask']>){
    const started=process.cpuUsage();
    try{return publish.apply(this,args);}finally{const cpu=process.cpuUsage(started);hubCpuMicros+=cpu.user+cpu.system;}
  });
  const cpuStarted=process.cpuUsage(),workStarted=performance.now();
  accounting.start();
  armed=true;
  moved=true;
  const comment=owned('status and verdict comment',()=>reviewer.call<{ok:boolean;error?:string;item:{status:string;verdicts:Array<{run:string}>;criteria:Array<{id:string;marks:Array<{kind:string;note?:string}>}>}}>('task.comment',{id:'T-503',text:'Please fix the regression.',
    verdict:'review',scope:'full',result:'not clear',run:'scale-review',failed:[{criterion:'C1',note:'Regression'}]}),60000);
  const posted=await comment;
  const answered=await within(observed,60000,undefined,()=>new Error('task view receipt incomplete'));
  const {afterEdit,interleaved}=await secondChange;
  await tail;
  const {mapEntriesSerialized,encodedBytes}=accounting.stop();
  const cpu=process.cpuUsage(cpuStarted);
  t.diagnostic(JSON.stringify({mapEntriesSerialized,mapEntriesCompared,encodedBytes,hubCpuMicros,node:process.version}));
  assert.ok(mapEntriesSerialized<1_000_000,`serialized ${mapEntriesSerialized} layer entries; bound below half the legacy fixture work`);
  assert.ok(mapEntriesCompared<1_000_000,`compared ${mapEntriesCompared} layer entries; legacy baseline 2,989,800`);
  assert.ok(encodedBytes<32_000_000,`encoded ${encodedBytes} task/map JSON bytes; legacy baseline 64,062,183`);
  t.diagnostic(JSON.stringify({cpuUserMs:cpu.user/1000,cpuSystemMs:cpu.system/1000,publicationReceiptMs:performance.now()-workStarted}));
  const later=ui.frames.slice(afterEdit).filter(frame=>frame.type==='task'&&frame.id==='T-1649');
  assert.equal(posted.ok,true,posted.error);
  const changed=posted.item;
  assert.equal(changed.status,'in progress');
  assert.ok(changed.verdicts.some(v=>v.run==='scale-review'));
  assert.ok(changed.criteria.find(c=>c.id==='C1')?.marks.some(mark=>mark.kind==='failed'&&mark.note==='Regression'));
  const {reply,elapsed}=answered;
  assert.equal(reply.ok,true,reply.error);
  assert.equal((reply.value as {item:{id:string}}).item.id,'T-4');
  t.diagnostic(`${process.platform}/${process.arch}; local projectHub, fake Git, no browser; task.view ${elapsed.toFixed(3)} ms from explorer receipt during status-and-verdict write; excludes setup`);
  assert.ok(elapsed<2000,`task.view during planned comment took ${elapsed.toFixed(3)} ms; bound 2000 ms`);
  assert.equal(interleaved,true,'the second change starts before the tail publication');
  assert.ok(later.length>0,'remaining freshness publication reaches the edited tail item');
  assert.ok(later.every(frame=>(frame.item as {title:string}).title==='Updated during publication'),'no old title follows the newer write');
  await owned('all poke work settled',async()=>{await Promise.all(pokeWork);},60000);
  });
  await owner.close();
  t.diagnostic('whole-case hub/resource close confirmed before root and native-guard restoration');
});

test('a thousand-item planned startup batches explorer recomputation',async t=>{
  const {root}=await plannedStartup(t);
  const logs:Record<string,unknown>[]=[];
  const hub=await projectHub(t,root,{}, {clock:new FakeClock(),git:async args=>args[0]==='for-each-ref'?`${'a'.repeat(40)} refs/heads/dev`:null,readBase:async()=> 'dev',log:entry=>logs.push(entry)});
  const ui=await connectUi(t,hub.discovery);
  const reply=await ui.request({type:'task.plan',item:'E-2',op:'show'});
  assert.equal(reply.ok,true,reply.error);
  assert.equal((reply.value as {stages:Array<{items:string[]}>}).stages[0]!.items.length,998);
  const receipts=logs.filter(log=>log.event==='explorer-recomputed');
  // The old four-batch ceiling permitted 4,000 rows on this 1,000-row fixture.
  // Enforce a tighter work budget while permitting publication to yield.
  const recomputed=receipts.reduce((sum,receipt)=>sum+(receipt.items as string[]).length,0);
  assert.ok(recomputed>=1000&&recomputed<=2100,`startup recomputed ${recomputed} rows; bound 1000–2100 rows`);
  t.diagnostic(`1000 rows with planned epic; ${receipts.length} explorer recompute chunks, ${recomputed} rows`);
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
