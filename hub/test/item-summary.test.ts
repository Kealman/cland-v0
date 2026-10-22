// T2: explorer facts through snapshots and task deltas of an embedded project hub.
import test, {type TestContext} from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {createConnection} from 'node:net';
import {once} from 'node:events';
import {serializeItem} from '../src/tracker/item.ts';
import {withPlan} from '../src/tracker/plan.ts';
import type {ItemSummary} from '../src/tracker/tracker.ts';
import {frameClient,projectHub,tempProject,connectUi} from './harness.ts';
import {FakeClock} from './fake-clock.ts';
import {onCleanup} from './process-cleanup.ts';

const at = '2026-10-16T12:00:00.000Z';
async function source(root: string,id: string,kind: string,parent: string|null,status?: 'planned'|'in progress'|'done',body='## Problem\n\nFound by QA. The summary describes the work. Another sentence.') {
  await mkdir(join(root,'.cland/tasks'),{recursive:true});
  await writeFile(join(root,`.cland/tasks/${id}-fixture.md`),serializeItem({
    fm:{id,kind,title:id,state:status==='done'?'closed':'open',...(status&&kind==='task'?{status}:{}),...(kind==='task'?{size:'S' as const}:{}),
      labels:[],assignee:null,parent,blocked_by:[],topic:null,branch:null,created:at,updated:at},body,comments:[],
  }));
}
async function featured(t:TestContext,discovery:{socket:string;secret:string}) {
  const socket=createConnection(discovery.socket);onCleanup(t,()=>socket.destroy());
  await once(socket,'connect',{signal:AbortSignal.timeout(2000)});socket.setEncoding('utf8');
  const ui=frameClient(line=>socket.write(line),fn=>socket.on('data',fn),()=>socket.destroy());
  const end=ui.waitFor(f=>f.type==='snapshot.end');
  ui.send({type:'hello',protocol:2,secret:discovery.secret,client:'summary-test',features:['snapshot','numbered-deltas','slim-frames']});
  await end;
  const snapshot=ui.frames.find(f=>f.type==='snapshot'&&f.domain==='items')!;
  return {ui,items:(snapshot.value as {items:ItemSummary[]}).items};
}

test('card facts arrive in snapshots and deltas while body and comments stay on demand',async t=>{
  const root=await tempProject(t);
  const body='## Summary\n\nCard summary.\n\n## Implementation\n\nPrivate implementation details.';
  await source(root,'T-1','task',null,'planned',body);
  const path=join(root,'.cland/tasks/T-1-fixture.md');
  const {parseItem}=await import('../src/tracker/item.ts');
  const item=parseItem(await readFile(path,'utf8'));
  item.comments=[
    {author:'reviewer',at,text:'Old reason '+ 'é'.repeat(300)+'.',verdict:{verdict:'review',result:'not clear',run:'r1',by:'reviewer',scope:'full'}},
    {author:'human',at,text:'## Resolution\n\nUse the shared projection. Keep full prose on demand.'},
    {author:'reviewer',at,text:'Fixed the missing boundary. More review detail stays private.',verdict:{verdict:'review',result:'clear',run:'r2',by:'reviewer',scope:'delta'}},
  ];
  await writeFile(path,serializeItem(item));
  const hub=await projectHub(t,root,{}, {clock:new FakeClock()});
  const {ui,items}=await featured(t,hub.discovery);
  const task=items.find(i=>i.id==='T-1')!;
  assert.equal(task.created,at,'open snapshot opts in to card transport dates');
  assert.equal(task.branch,null);
  const lean=await ui.request({type:'task.list',projection:'summary',state:'open',include_containers:true});
  assert.equal(lean.ok,true,lean.error);
  for(const field of ['created','branch','verify','regression_of','follows']) {
    assert.equal(Object.hasOwn((lean.value as {items:ItemSummary[]}).items[0]!,field),false,`native list omits ${field}`);
  }
  assert.deepEqual(task.verdicts.map(v=>({run:v.run,reason:v.reason,round:v.round,scope:v.scope})),
    [{run:'r2',reason:'Fixed the missing boundary.',round:2,scope:'delta'}]);
  assert.deepEqual(task.decision,{text:'Use the shared projection. Keep full prose on demand.',by:'human',at});
  assert.deepEqual(task.agents_text,{sections:['Summary','Implementation'],words:9});
  assert.equal(Object.hasOwn(task,'body'),false);assert.equal(Object.hasOwn(task,'comments'),false);
  assert.ok(!JSON.stringify(task).includes('Private implementation details'));
  const changed=ui.waitFor(f=>f.type==='task'&&f.id==='T-1'&&(f.item as ItemSummary).agents_text?.words===5);
  assert.equal((await ui.request({type:'task.edit',item:'T-1',body:'## Summary\n\nA smaller body.'})).ok,true);
  const delta=(await changed).item as ItemSummary;
  assert.deepEqual(delta.agents_text,{sections:['Summary'],words:5});
  assert.equal(Array.from(delta.verdicts[0]!.reason!).length,96);assert.ok(delta.verdicts[0]!.reason!.endsWith('…'));
  assert.deepEqual(delta.decision,task.decision);assert.equal(delta.verdicts.at(-1)?.reason,'Fixed the missing boundary.');
  const decision=ui.waitFor(f=>f.type==='task'&&f.id==='T-1'&&(f.item as ItemSummary).decision?.text==='Choose the new path.');
  assert.equal((await ui.request({type:'task.comment',item:'T-1',text:'## Decided\n\nChoose the new path.'})).ok,true);
  assert.equal(((await decision).item as ItemSummary).decision?.by,'human');
  const verdict=ui.waitFor(f=>f.type==='task'&&f.id==='T-1'&&(f.item as ItemSummary).verdicts.at(-1)?.run==='r3');
  void verdict.catch(()=>{});
  assert.equal((await ui.request({type:'task.comment',item:'T-1',text:'A new evidence reason. More private details.',
    verdict:{verdict:'review',result:'not clear',run:'r3',scope:'evidence',findings:[]}})).ok,true);
  const latest=((await verdict).item as ItemSummary).verdicts.at(-1)!;
  assert.equal(latest.reason,'A new evidence reason.');assert.equal(latest.round,3);assert.equal(latest.scope,'evidence');
  const closed=ui.waitFor(f=>f.type==='task'&&f.id==='T-1'&&(f.item as ItemSummary).state==='closed');
  assert.equal((await ui.request({type:'task.edit',item:'T-1',state:'closed'})).ok,true);
  const compact=(await closed).item as ItemSummary;
  assert.equal(compact.agents_text,undefined);assert.equal(compact.decision,undefined);
  assert.ok(compact.verdicts.every(v=>v.reason===undefined&&v.round===undefined&&v.scope===undefined));
  const fresh=(await featured(t,hub.discovery)).items.find(i=>i.id==='T-1')!;
  assert.equal(fresh,undefined,'closed task leaves the snapshot');
  const page=await ui.request({type:'task.list',projection:'summary',ids:['T-1']});
  assert.equal(page.ok,true,page.error);
  const full=(page.value as {items:ItemSummary[]}).items[0]!;
  assert.equal(full.created,at,'closed by-id page retains card transport dates');
  assert.equal(full.branch,null);
  assert.deepEqual(full.agents_text,{sections:['Summary'],words:5});assert.equal(full.decision?.text,'Choose the new path.');
  assert.deepEqual(full.verdicts.map(v=>({run:v.run,reason:v.reason,round:v.round,scope:v.scope})),
    [{run:'r3',reason:'A new evidence reason.',round:3,scope:'evidence'}]);
  assert.equal(Object.hasOwn(full,'body'),false);assert.equal(Object.hasOwn(full,'comments'),false);
  assert.ok(!ui.frames.some(f=>f.type==='result'&&JSON.stringify(f).includes('Private implementation details')));
});

test('closing and reopening a compact card never posts its historical scoped verdicts again',async t=>{
  const root=await tempProject(t);
  await source(root,'T-1','task',null,'planned');
  const path=join(root,'.cland/tasks/T-1-fixture.md');
  const {parseItem}=await import('../src/tracker/item.ts');
  const item=parseItem(await readFile(path,'utf8'));
  item.comments=['full','delta'].map((scope,n)=>({author:'reviewer',at,text:`Historical reason ${n+1}.`,
    verdict:{verdict:'review',result:'not clear',run:`old-${n+1}`,by:'reviewer',scope:scope as 'full'|'delta'}}));
  await writeFile(path,serializeItem(item));
  const logs:Record<string,unknown>[]=[];
  const hub=await projectHub(t,root,{}, {clock:new FakeClock(),log:entry=>logs.push(entry)});
  const {ui}=await featured(t,hub.discovery);
  const {inProcessSpoke}=await import('./harness.ts');
  const observer=await inProcessSpoke(t,{discover:true,cwd:root,name:'observer',role:'coordinator'});
  onCleanup(t,()=>observer.close());await observer.waitForPresence(['observer']);
  assert.equal((await observer.call<{ok:boolean}>('subscribe',{subject:{item:'T-1'},events:['task']})).ok,true);
  const posted=()=>logs.filter(l=>l.event==='event-announced'&&String(l.text).includes('verdict posted'));
  for (const state of ['closed','open'] as const) {
    const changed=ui.waitFor(f=>f.type==='task'&&f.id==='T-1'&&(f.item as ItemSummary).state===state);
    assert.equal((await ui.request({type:'task.edit',item:'T-1',state})).ok,true);
    const row=(await changed).item as ItemSummary;
    assert.equal((await ui.request({type:'hub.status',flushLogs:true})).ok,true);
    assert.deepEqual(posted(),[],`${state} must not create postedVerdicts or verdict events`);
    const history=await ui.request({type:'topic.history',topic:'agents'});
    assert.equal(history.ok,true,history.error);
    assert.deepEqual((history.value as {messages:Array<{kind:string;text:string}>}).messages.filter(m=>m.kind==='event'&&m.text.includes('verdict posted')),[]);
    if (state==='closed') {
      assert.equal(row.agents_text,undefined);assert.equal(row.decision,undefined);
      assert.ok(row.verdicts.every(v=>v.reason===undefined&&v.round===undefined&&v.scope===undefined));
      const page=await ui.request({type:'task.list',projection:'summary',ids:['T-1']});
      assert.equal(page.ok,true,page.error);assert.ok(Buffer.byteLength(JSON.stringify(page)+'\n')<=256*1024);
      assert.deepEqual((page.value as {items:ItemSummary[]}).items[0]!.verdicts.map(v=>({run:v.run,scope:v.scope,round:v.round,reason:v.reason})),
        [{run:'old-2',scope:'delta',round:2,reason:'Historical reason 2.'}]);
    }
  }
  assert.equal((await observer.call<{ok:boolean}>('subscribe',{subject:{item:'T-1'},events:['task']})).ok,true);
  const genuine=ui.waitFor(f=>f.type==='task'&&f.id==='T-1'&&(f.item as ItemSummary).verdicts.at(-1)?.run==='new-evidence');
  assert.equal((await ui.request({type:'task.comment',item:'T-1',text:'A genuine new verdict.',
    verdict:{verdict:'review',result:'not clear',run:'new-evidence',scope:'evidence',findings:[]}})).ok,true);
  await genuine;assert.equal((await ui.request({type:'hub.status',flushLogs:true})).ok,true);
  assert.equal(posted().length,1);assert.equal((posted()[0]!.verdict as {run:string;scope:string}).run,'new-evidence');
  assert.equal((posted()[0]!.verdict as {scope:string}).scope,'evidence');
  const history=await ui.request({type:'topic.history',topic:'agents'});
  const delivered=(history.value as {messages:Array<{kind:string;text:string;to:string[]}>}).messages.filter(m=>m.kind==='event'&&m.text.includes('verdict posted'));
  assert.equal(delivered.length,1);assert.match(delivered[0]!.text,/review not clear · evidence · new-evidence/);
  assert.deepEqual(delivered[0]!.to,['observer']);
});

test('snapshot supplies summary provenance, container progress, stage, blocked and next without task.view',async t=>{
  const root=await tempProject(t);
  await source(root,'R-1','release',null);
  await source(root,'E-2','epic','R-1',undefined,withPlan('## Summary\n\nThe epic summary.',{stages:[{name:'first',qa:{scope:'none',when:'per-item'},lanes:[['T-3','T-4']]},{name:'second',qa:{scope:'none',when:'per-item'},lanes:[['T-5']]}]}));
  await source(root,'T-3','task','E-2','planned');await source(root,'T-4','task','E-2','done');await source(root,'T-5','task','E-2','done');
  await source(root,'E-6','epic','R-1','done',withPlan('## Summary\n\nClosed epic.',{stages:[{name:'closed',qa:{scope:'none',when:'per-item'},lanes:[['T-7']]}]}));
  await source(root,'T-7','task','E-6','done');
  const clock=new FakeClock();
  const hub=await projectHub(t,root,{}, {clock});
  await clock.advance(1);
  const actor=await connectUi(t,hub.discovery);
  const initial=await featured(t,hub.discovery);
  assert.equal(initial.items.find(i=>i.id==='E-2')!.rollup?.layer,'watch','startup layer is ready before any mutation');
  assert.deepEqual(initial.items.find(i=>i.id==='E-6')!.stages,[{name:'closed',state:'closed',qa:{scope:'none',when:'per-item'},merged:0,total:1,statuses:{done:1}}]);
  assert.equal((await actor.request({type:'task.link',item:'T-3',blocked_by:['T-4']})).ok,true);
  const {items}=await featured(t,hub.discovery);
  const task=items.find(i=>i.id==='T-3')!, epic=items.find(i=>i.id==='E-2')!, release=items.find(i=>i.id==='R-1')!;
  assert.deepEqual(task.summary,{text:'The summary describes the work. Another sentence.',from:'Problem',provenance:'fallback from ## Problem · no ## Summary yet'});
  assert.equal(task.blocked,false);assert.equal(epic.next,'T-3');assert.equal(release.next,'T-3');
  assert.deepEqual(epic.child_counts,{total:3,done:2,statuses:{planned:1,done:2},work:{'in progress':0,review:0,qa:0}});
  assert.equal(epic.derived_status,'planned');assert.equal(epic.glyph,'○');
  assert.deepEqual(epic.stages,[{name:'first',state:'open',qa:{scope:'none',when:'per-item'},merged:0,total:2,statuses:{planned:1,done:1}},
    {name:'second',state:'open',qa:{scope:'none',when:'per-item'},merged:0,total:1,statuses:{done:1}}]);
  assert.deepEqual(epic.rollup?.stage,{number:1,total:2,name:'first'});assert.equal(epic.rollup?.layer,'watch');
  assert.deepEqual(epic.rollup?.claims,[]);assert.deepEqual(epic.rollup?.holds,[]);
  assert.equal(epic.rollup?.last_activity.item,'T-3');
  const block=await actor.request({type:'task.link',item:'T-3',blocked_by:['R-1']});assert.equal(block.ok,true,block.error);
  const after=await featured(t,hub.discovery);
  assert.equal(after.items.find(i=>i.id==='T-3')!.blocked,true);
  assert.equal(after.items.find(i=>i.id==='T-3')!.glyph,'◌');
  assert.equal(after.items.find(i=>i.id==='E-2')!.next,null);


});

test('one task change recomputes and sends only changed task and ancestor fields',async t=>{
  const root=await tempProject(t),clock=new FakeClock();
  await source(root,'R-1','release',null);await source(root,'E-2','epic','R-1');
  await source(root,'T-3','task','E-2','planned');await source(root,'E-4','epic','R-1');await source(root,'T-5','task','E-4','planned');
  const logs:Record<string,unknown>[]=[];
  const hub=await projectHub(t,root,{}, {clock,log:entry=>logs.push(entry)});
  const {ui}=await featured(t,hub.discovery);
  const original=await readFile(join(root,'.cland/tasks/E-2-fixture.md'),'utf8');
  logs.length=0;const mark=ui.frames.length;
  const changed=ui.waitFor(f=>f.type==='task'&&f.id==='T-3'&&(f.item as ItemSummary)?.status==='in progress');
  const reply=await ui.request({type:'task.edit',item:'T-3',status:'in progress'});assert.equal(reply.ok,true,reply.error);await changed;
  assert.equal((await ui.request({type:'topic.list'})).ok,true);
  const deltas=ui.frames.slice(mark).filter(f=>f.type==='task');
  assert.deepEqual([...new Set(deltas.map(f=>f.id))].sort(),['E-2','R-1','T-3']);
  assert.equal(deltas.length,3,'each changed projection is sent once');
  const touched=logs.filter(l=>l.event==='explorer-recomputed').flatMap(l=>l.items as string[]);
  assert.deepEqual([...new Set(touched)].sort(),['E-2','R-1','T-3']);
  const epic=deltas.findLast(f=>f.id==='E-2')!.item as ItemSummary;
  assert.equal(epic.derived_status,'in work');assert.equal(epic.rollup?.layer,'now');assert.equal(epic.next,null);
  assert.equal(await readFile(join(root,'.cland/tasks/E-2-fixture.md'),'utf8'),original,'roll-ups never rewrite ancestor files');
  assert.equal(deltas.findLast(f=>f.id==='R-1')!.item && (deltas.findLast(f=>f.id==='R-1')!.item as ItemSummary).child_counts?.work['in progress'],1);
  const nextMark=ui.frames.length;
  const summaryChanged=ui.waitFor(f=>f.type==='task'&&f.id==='T-3'&&(f.item as ItemSummary).summary?.text==='A changed summary.');
  assert.equal((await ui.request({type:'task.edit',item:'T-3',body:'## Summary\n\nA changed summary.'})).ok,true);await summaryChanged;
  await ui.request({type:'topic.list'});
  assert.deepEqual(ui.frames.slice(nextMark).filter(f=>f.type==='task').map(f=>f.id),['T-3'],'unchanged ancestor fields produce no delta');
});

test('closed summary batches keep full Lua text, validate ids and stay within reply byte budgets',async t=>{
  const root=await tempProject(t);const text='é'.repeat(80000);
  await source(root,'T-1','task',null,'done',`## Summary\n\n${text}`);await source(root,'T-2','task',null,'done',`## Summary\n\n${text}`);
  await source(root,'T-3','task',null,'done',`## Summary\n\n${'é'.repeat(140000)}`);
  const hub=await projectHub(t,root,{}, {clock:new FakeClock()});const {ui,items}=await featured(t,hub.discovery);
  assert.ok(items.every(i=>i.summary&&!Object.hasOwn(i.summary,'text')));
  const reply=await ui.request({type:'task.list',projection:'summary',ids:['T-1','T-2']});assert.equal(reply.ok,true,reply.error);
  assert.ok(Buffer.byteLength(JSON.stringify(reply)+'\n')<256*1024);
  const page=reply.value as {items:Array<{id:string;summary:{text:string}}>;remaining:string[]};
  assert.deepEqual(page.items.map(i=>i.id),['T-1']);assert.equal(page.items[0]!.summary.text,text);assert.deepEqual(page.remaining,['T-2']);
  for(const request of [{type:'task.list',ids:['T-1']},{type:'task.list',projection:'summary',ids:['T-999']},{type:'task.list',projection:'summary',ids:Array(101).fill('T-1')},{type:'task.list',projection:'summary',ids:[1]},{type:'task.list',projection:'summary',ids:['T-3']}]) {
    assert.equal((await ui.request(request)).ok,false);
  }
});

test('claims, holds, subtree verdicts and topic activity update their container facts',async t=>{
  const root=await tempProject(t),clock=new FakeClock();
  await source(root,'E-1','epic',null);await source(root,'T-2','task','E-1','in progress');
  const hub=await projectHub(t,root,{}, {clock});const actor=await connectUi(t,hub.discovery);
  const {inProcessSpoke}=await import('./harness.ts');
  const {ui}=await featured(t,hub.discovery);
  const readEpic=async()=>{
    const reply=await ui.request({type:'task.list',projection:'summary'});assert.equal(reply.ok,true,reply.error);
    return (reply.value as {items:ItemSummary[]}).items.find(i=>i.id==='E-1')!;
  };
  for(const [name,role,tool] of [['worker','implementer','task.claim'],['verifier','reviewer','task.hold']] as const){
    const launched=await actor.request({type:'session.launch',name,role,harness:'claude-code'});assert.equal(launched.ok,true,launched.error);
    const session=await inProcessSpoke(t,{discover:true,cwd:root,name,sessionId:(launched.value as {process:{sessionId:string}}).process.sessionId,role});
    onCleanup(t,()=>session.close());await session.waitForPresence([name]);
    if(role==='implementer') assert.equal((await actor.request({type:'task.edit',item:'T-2',assignee:name})).ok,true);
    const expected=ui.waitFor(f=>f.type==='task'&&f.id==='E-1'&&((f.item as ItemSummary).rollup?.[tool==='task.claim'?'claims':'holds'].length??0)>0);
    void expected.catch(()=>{});
    const taken=await session.call<{ok:boolean;error?:string}>(tool,{id:'T-2'});assert.equal(taken.ok,true,taken.error);await expected;
    if(tool==='task.claim')assert.equal((await readEpic()).rollup?.claims[0]?.claim.session,name);
    else{
      assert.equal((await readEpic()).rollup?.holds[0]?.hold.session,name);
      const verdict=ui.waitFor(f=>f.type==='task'&&f.id==='E-1'&&(f.item as ItemSummary).rollup?.latest_verdict?.run==='r1');
      assert.equal((await session.call<{ok:boolean}>('task.comment',{id:'T-2',text:'Source checked.',verdict:'review',result:'not clear',run:'r1',scope:'full',findings:[]})).ok,true);
      await verdict;assert.equal((await readEpic()).rollup?.latest_verdict?.item,'T-2');
      const released=ui.waitFor(f=>f.type==='task'&&f.id==='E-1'&&(f.item as ItemSummary).rollup?.holds.length===0);
      assert.equal((await session.call<{ok:boolean}>('task.hold',{id:'T-2',release:true})).ok,true);await released;
    }
  }
  const made=await actor.request({type:'topic.create',title:'Task topic',item:'T-2'});assert.equal(made.ok,true,made.error);
  const topic=(made.value as {topic:{id:string}}).topic.id;await clock.advance(1);
  const activity=ui.waitFor(f=>f.type==='task'&&f.id==='E-1'&&(f.item as ItemSummary).rollup?.last_activity.source==='a message in its topic');
  const sent=await actor.request({type:'topic.send',topic,text:'A later activity'});assert.equal(sent.ok,true,sent.error);await activity;
  assert.deepEqual((await readEpic()).rollup?.last_activity,{at:clock.now().toISOString(),item:'T-2',title:'T-2',source:'a message in its topic'});
});

test('stage-cover settlement pushes a changed current stage without another item edit or reread',async t=>{
  const {Tracker}=await import('../src/tracker/tracker.ts');
  const {startHub,connectWsUi,eventually}=await import('./harness.ts');
  const {fixtureEnvironment}=await import('./fixture-environment.ts');
  const root=await tempProject(t),clock=new FakeClock(),head='a'.repeat(40),tree='b'.repeat(40);
  const tracker=new Tracker({root,db:':memory:',clock,env:fixtureEnvironment(root,process.env),
    git:async args=>args[0]==='for-each-ref'?`${head} refs/heads/dev`:args[0]==='rev-parse'?head:'',
    readBase:async()=> 'dev',stageTree:async()=>tree,scheduleTips:()=>({poke(){},stop(){}}),
  });
  await tracker.start();onCleanup(t,()=>tracker.stop());
  const hub=await startHub({tracker,clock,env:fixtureEnvironment(root,process.env)});onCleanup(t,()=>hub.close());
  const ui=await connectWsUi(t,hub);await ui.request({type:'subscribe'});
  const epicReply=await ui.request({type:'task.create',kind:'epic',title:'Stage publication'});
  const epic=(epicReply.value as {item:{id:string}}).item.id;
  const childReply=await ui.request({type:'task.create',size:'S',title:'Landed',parent:epic});
  const child=(childReply.value as {item:{id:string}}).item.id;
  assert.equal((await ui.request({type:'task.plan',item:epic,op:'set',yaml:JSON.stringify({stages:[{name:'only',qa:{scope:'none',when:'after-stage'},lanes:[[child]]}]})})).ok,true);
  assert.equal((await ui.request({type:'task.close',item:child})).ok,true);
  tracker.recordMerge(child,{branch:'t/landed',tip:head,commit:head,base:'dev'});
  let covers:import('../src/hub/suites.ts').StageCover[]=[{id:'linux',head,tree,platform:'Linux droplet'}];
  tracker.useVerify(()=>null,()=>covers);await tracker.refreshFreshness();
  await eventually('linux cover is settled before observing the missing platform',async()=>{
    const reply=await ui.request({type:'task.plan',item:epic,op:'show'});
    const stage=(reply.value as {stages:Array<{state:string;cover?:{linux?:string;missing:string[];pending?:string[]}}>}).stages[0]!;
    return stage.cover?.linux==='linux'&&!stage.cover.pending?.length&&stage.state==='open'?true:undefined;
  });
  const baseline=await ui.request({type:'task.list',projection:'summary'});
  assert.deepEqual((baseline.value as {items:ItemSummary[]}).items.find(i=>i.id===epic)!.rollup?.stage,{number:1,total:1,name:'only'});
  const mark=ui.frames.length;
  const settled=ui.waitFor(f=>ui.frames.indexOf(f)>=mark&&f.type==='task'&&f.id===epic&&(f.item as ItemSummary).rollup?.stage===null,1000);
  covers=[...covers,{id:'mac',head,tree,platform:'macOS'}];
  tracker.useVerify(()=>null,()=>covers);
  const delta=await settled;
  assert.equal((delta.item as ItemSummary).rollup?.stage,null);
  assert.deepEqual((delta.item as ItemSummary).stages,[{name:'only',state:'closed',qa:{scope:'none',when:'after-stage'},merged:1,total:1,statuses:{done:1}}]);
  const snapshot=await ui.request({type:'task.list',projection:'summary'});
  assert.deepEqual((snapshot.value as {items:ItemSummary[]}).items.find(i=>i.id===epic)!.stages,(delta.item as ItemSummary).stages);
});

test('next excludes planned work below closed ancestors and follows reopening and movement',async t=>{
  const root=await tempProject(t);
  await source(root,'R-1','release',null,'done');await source(root,'E-2','epic','R-1');await source(root,'T-3','task','E-2','planned');
  await source(root,'R-4','release',null);
  const hub=await projectHub(t,root,{}, {clock:new FakeClock()});const {ui,items}=await featured(t,hub.discovery);
  assert.equal(items.find(i=>i.id==='E-2')!.next,null,JSON.stringify(items.map(i=>({id:i.id,parent:i.parent,state:i.state,next:i.next}))));
  const opened=ui.waitFor(f=>f.type==='task'&&f.id==='E-2'&&(f.item as ItemSummary).next==='T-3');
  assert.equal((await ui.request({type:'task.edit',item:'R-1',state:'open'})).ok,true);await opened;
  assert.equal((await ui.request({type:'task.edit',item:'R-4',state:'closed'})).ok,true);
  const moved=ui.waitFor(f=>f.type==='task'&&f.id==='E-2'&&(f.item as ItemSummary).parent==='R-4'&&(f.item as ItemSummary).next===null);
  assert.equal((await ui.request({type:'task.link',item:'E-2',parent:'R-4'})).ok,true);await moved;
  const reopening=ui.frames.length;
  const reopened=ui.waitFor(f=>ui.frames.indexOf(f)>=reopening&&f.type==='task'&&f.id==='E-2'&&(f.item as ItemSummary).next==='T-3');
  assert.equal((await ui.request({type:'task.edit',item:'R-4',state:'open'})).ok,true);await reopened;
  assert.equal((ui.frames.findLast(f=>f.type==='task'&&f.id==='E-2')!.item as ItemSummary).next,'T-3');
});


test('closed children page per parent under the reply budget and a closing delta leaves the open snapshot',async t=>{
  const root=await tempProject(t);
  await source(root,'E-1','epic',null,'done');
  await Promise.all(Array.from({length:105},(_,n)=>source(root,`T-${n+2}`,'task','E-1','done')));
  await source(root,'T-107','task','E-1','planned');
  const {parseItem}=await import('../src/tracker/item.ts');
  for(const id of ['T-2','T-3','T-4']) {
    const path=join(root,`.cland/tasks/${id}-fixture.md`),row=parseItem(await readFile(path,'utf8'));
    row.fm.title='é'.repeat(50000);await writeFile(path,serializeItem(row));
  }
  const hub=await projectHub(t,root,{}, {clock:new FakeClock()});
  const {ui,items}=await featured(t,hub.discovery);
  assert.deepEqual(items.map(i=>i.id).sort(),['E-1','T-107']);
  assert.equal(items.find(i=>i.id==='E-1')!.child_counts?.done,105);
  assert.equal((ui.frames.find(f=>f.type==='snapshot'&&f.domain==='items')!.value as {done_items:number}).done_items,106);
  assert.equal((await featured(t,hub.discovery)).items.find(i=>i.id==='E-1')!.state,'closed');
  const capped=await ui.request({type:'task.list',projection:'summary',state:'closed',parent:'E-1'});
  assert.equal(capped.ok,true,capped.error);
  assert.ok(Buffer.byteLength(JSON.stringify(capped)+'\n')<=256*1024);
  assert.equal((capped.value as {items:ItemSummary[]}).items.length,2,'UTF-8 bytes end the page before its row limit');
  for(const row of (capped.value as {items:ItemSummary[]}).items) for(const field of ['created','branch','verify','regression_of','follows']) {
    assert.equal(Object.hasOwn(row,field),false,`closed parent page omits ${field}`);
  }
  assert.equal((capped.value as {next:string}).next,'T-3');
  let cursor:string|undefined;const archived:ItemSummary[]=[];
  do {
    const reply=await ui.request({type:'task.list',projection:'summary',state:'closed',parent:'E-1',limit:40,...(cursor?{cursor}:{})});
    assert.equal(reply.ok,true,reply.error);
    assert.ok(Buffer.byteLength(JSON.stringify(reply)+'\n')<=256*1024);
    const page=reply.value as {items:ItemSummary[];next:string|null;total:number};
    assert.equal(page.total,105);assert.ok(page.items.length<=40);
    archived.push(...page.items);cursor=page.next??undefined;
  } while(cursor);
  assert.equal(new Set(archived.map(i=>i.id)).size,105);
  const closing=ui.waitFor(f=>f.type==='task'&&f.id==='T-107'&&(f.item as ItemSummary).state==='closed');
  assert.equal((await ui.request({type:'task.edit',item:'T-107',state:'closed'})).ok,true);
  const closedFrame=await closing;
  assert.equal((closedFrame.item as ItemSummary).state,'closed');
  assert.equal(closedFrame.done_items,107);
  const open=await ui.request({type:'task.list',projection:'summary',state:'open',include_containers:true});
  assert.equal(open.ok,true,open.error);
  assert.deepEqual((open.value as {items:ItemSummary[]}).items.map(i=>i.id),['E-1']);
  const fresh=(await featured(t,hub.discovery)).items;
  assert.deepEqual(fresh.map(i=>i.id),['E-1']);
  const page=await ui.request({type:'task.list',projection:'summary',state:'closed',parent:'E-1',cursor:'T-106'});
  assert.equal(page.ok,true,page.error);
  assert.deepEqual((page.value as {items:ItemSummary[]}).items.map(i=>i.id),['T-107']);
  assert.equal((page.value as {total:number}).total,106);
  assert.equal((await ui.request({type:'task.edit',item:'T-40',state:'open'})).ok,true);
  const continuation=await ui.request({type:'task.list',projection:'summary',state:'closed',parent:'E-1',cursor:'T-40'});
  assert.equal(continuation.ok,true,continuation.error);
  assert.equal((continuation.value as {items:ItemSummary[]}).items[0]!.id,'T-41','a vanished cursor row does not skip the next identity');
  assert.equal((await ui.request({type:'task.edit',item:'T-107',title:'é'.repeat(140000)})).ok,true);
  const oversized=await ui.request({type:'task.list',projection:'summary',state:'closed',parent:'E-1',cursor:'T-106'});
  assert.equal(oversized.ok,false);assert.match(oversized.error??'',/reply budget/);
  for(const bad of [{limit:0},{limit:101},{cursor:'garbage'},{ids:['T-2']}]) {
    assert.equal((await ui.request({type:'task.list',projection:'summary',state:'closed',parent:'E-1',...bad})).ok,false);
  }
  // This client has never read a closed page; only the removal fact can update its total.
  const unloaded=await featured(t,hub.discovery);
  assert.ok(unloaded.items.every(row=>row.id!=='T-107'));
  assert.equal((unloaded.ui.frames.find(f=>f.type==='snapshot'&&f.domain==='items')!.value as {done_items:number}).done_items,106);
  const removed=unloaded.ui.waitFor(f=>f.type==='task'&&f.id==='T-107'&&f.item===null);
  await rm(join(root,'.cland/tasks/T-107-fixture.md'));
  const removal=await removed;
  assert.equal(removal.item,null);assert.equal(removal.done_items,105);
  const afterRemoval=await featured(t,hub.discovery);
  assert.equal((afterRemoval.ui.frames.find(f=>f.type==='snapshot'&&f.domain==='items')!.value as {done_items:number}).done_items,105);
});
