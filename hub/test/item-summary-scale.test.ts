// T2: a thousand durable rows, one public frame mutation, measured synchronous recomputation.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {serializeItem} from '../src/tracker/item.ts';
import {connectUi,projectHub,tempProject} from './harness.ts';
import {FakeClock} from './fake-clock.ts';

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
