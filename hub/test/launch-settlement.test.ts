// T2: in-process failed-launch settlement ownership; no children.
import test from 'node:test';
import assert from 'node:assert/strict';
import { boundedSettlement } from '../src/adapters/launch-settlement.ts';
import { deferred } from './fakes/scripted-codex.ts';

test('settlement preserves synchronous callbacks and retries a rejected async callback', async () => {
  const order: string[] = [];
  const sync = boundedSettlement(() => { order.push('settled'); }, 100);
  assert.equal(sync(), undefined);
  assert.deepEqual(order, ['settled']);
  let attempts = 0;
  const retry = boundedSettlement(async () => { if (++attempts === 1) throw new Error('unforward refused'); }, 100);
  await assert.rejects(Promise.resolve(retry()), /unforward refused/);
  await retry();
  assert.equal(attempts, 2);
});

test('a hanging settlement is bounded while concurrent retries share the producer', async () => {
  const held = deferred<void>();
  let calls = 0, closes = 0;
  const close = () => {closes++;};
  const settle = boundedSettlement(() => { calls++; close(); return held.promise; }, 10);
  const first = assert.rejects(Promise.resolve(settle()), /cleanup-incomplete.*10 ms/);
  const second = assert.rejects(Promise.resolve(settle()), /cleanup-incomplete.*10 ms/);
  await Promise.all([first, second]);
  assert.equal(calls, 1);
  assert.equal(closes, 1, 'concurrent settlement callers share one close');
  held.resolve();
  await settle();
  assert.equal(calls, 1, 'the timed-out producer is joined rather than duplicated');
  assert.equal(closes, 1, 'deferred completion cannot repeat close');
});

import { FailedLaunches, LaunchFiles } from '../src/adapters/launch-files.ts';
import { eventually } from './harness.ts';
test('deferred recovery reports a hung settlement and retains one producer until the receipt',async()=>{
  const held=deferred<void>();let calls=0;
  const reports:Record<string,unknown>[]=[];
  const owner=new FailedLaunches(entry=>reports.push(entry),1,false,10);
  try {
    await assert.rejects(owner.failed('launch','worker',new LaunchFiles(),new Error('handshake failed'),()=>{calls++;return held.promise;}),/cleanup is pending/);
    assert.throws(()=>owner.assertAvailable('worker'),/cleanup is pending/);
    assert.match(String(reports[0]?.error),/cleanup-incomplete.*10 ms/);
    await eventually('deferred timeout diagnostic',()=>reports.some(entry=>entry.event==='launch-cleanup-incomplete')||undefined,1000);
    assert.equal(calls,1,'deferred retry cannot duplicate the hung producer');
    held.resolve();
    await eventually('deferred settlement receipt',()=>reports.some(entry=>entry.event==='launch-recovered')||undefined,1000);
    assert.doesNotThrow(()=>owner.assertAvailable('worker'));
    assert.equal(calls,1);
  } finally {held.resolve();await owner.drain();}
});

test('deferred path retries a rejecting settlement and records successful recovery',async()=>{
  let calls=0;const reports:Record<string,unknown>[]=[];
  const owner=new FailedLaunches(entry=>reports.push(entry),1,false,100);
  try {
    await assert.rejects(owner.failed('rejected','worker',new LaunchFiles(),new Error('handshake failed'),async()=>{if(++calls===1)throw new Error('cancel refused');}),/cleanup is pending/);
    assert.throws(()=>owner.assertAvailable('worker'),/cleanup is pending/);
    await eventually('rejected settlement recovery receipt',()=>reports.some(entry=>entry.event==='launch-recovered')||undefined,1000);
    assert.equal(calls,2);
    assert.doesNotThrow(()=>owner.assertAvailable('worker'));
    assert.match(String(reports[0]?.error),/cancel refused/);
  } finally {await owner.drain();}
});
