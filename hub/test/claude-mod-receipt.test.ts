// T1: pure native receipt correlation; no process or filesystem access.
import test from 'node:test';
import assert from 'node:assert/strict';
import { completedModInput, type ModClose, type ModInterpretation } from './claude-mod-receipt.ts';
import { heldModPosts, waitForModHold } from './held-mod-post.ts';

test('held receipt publication failure closes its observer and preserves the error without a child',async()=>{
  const owner=heldModPosts();
  const failure=new Error('fixture receipt publication failed');
  let closed=false,launches=0;
  const work=owner.run(signal=>waitForModHold(signal,{
    watch:()=>()=>{closed=true;},released:()=>false,publish:()=>{throw failure;},
  }),async()=>{launches++;return 'launched';},'cancelled');
  await assert.rejects(work,error=>error===failure);
  await owner.stop();
  assert.equal(closed,true,'publication failure closes the original observer');
  assert.equal(launches,0,'failed receipt setup admits no native launch');
});

test('stopping a held mod post releases and joins it without admitting a late child',async()=>{
  const owner=heldModPosts();
  const entered=Promise.withResolvers<void>();
  let released=false,launches=0;
  const work=owner.run(signal=>waitForModHold(signal,{
    watch:()=>()=>{released=true;},released:()=>false,publish:()=>entered.resolve(),
  }),async()=>{launches++;return 'launched';},'cancelled');
  await entered.promise;
  await owner.stop();
  assert.equal(released,true,'the original held continuation is released');
  assert.equal(await work,'cancelled');
  assert.equal(launches,0,'positive launch callback must never run after stop');
  assert.equal(await owner.run(async()=>{},async()=>{launches++;return 'late';},'cancelled'),'cancelled');
  assert.equal(launches,0);
});

test('stopping a mod post joins its already admitted native close',async()=>{
  const owner=heldModPosts();
  const launched=Promise.withResolvers<void>(),closed=Promise.withResolvers<string>();
  const work=owner.run(async()=>{},()=>{launched.resolve();return closed.promise;},'cancelled');
  await launched.promise;
  let settled=false;
  const stop=owner.stop().then(()=>{settled=true;});
  await Promise.resolve();
  assert.equal(settled,false,'stop retains the original native close owner');
  closed.resolve('native closed');
  await stop;
  assert.equal(await work,'native closed');
  assert.equal(settled,true);
});

test('mod completion belongs to the exact native turn even when interpretation precedes start',()=>{
  const close: ModClose={job:'job',turnId:'turn',event:'mod-turn-complete',payload:{at:42},pid:123,code:0,signal:null};
  const expected={job:'job',turnId:'turn',start:{turnId:'turn',at:41},sessionId:'session',input:'input'};
  const rows: ModInterpretation[]=[{sessionId:'session',event:'mod-turn-complete',at:42},{sessionId:'session',event:'mod-turn-start',at:41,turnId:'turn',confirms:['input']}];
  assert.equal(completedModInput(close,expected,rows),true);
  assert.equal(completedModInput({...close,turnId:'other'},expected,rows),false);
  assert.equal(completedModInput(close,{...expected,start:{turnId:'other',at:41}},rows),false);
  assert.equal(completedModInput(close,expected,[rows[0]!,{...rows[1]!,at:40}]),false);
  assert.equal(completedModInput({...close,payload:{at:43}},expected,rows),false);
  assert.equal(completedModInput({...close,code:1},expected,rows),false);
  assert.equal(completedModInput(close,expected,rows.slice(1)),false);
});
