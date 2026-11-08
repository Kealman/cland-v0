// T1: injected fixture owners; no native process, filesystem or timers.
import test from 'node:test';
import assert from 'node:assert/strict';
import { drainFixtureOwners } from './host-watchdog-drain.ts';
test('fixture drain attempts later owners and census after a failed stop, retaining an unknown root',async()=>{
 const calls:string[]=[];
 const result=await drainFixtureOwners([async()=>{calls.push('first');throw Error('unknown birth');},async()=>{calls.push('second');}],async()=>{calls.push('census');},async()=>{calls.push('proof');return false;});
 assert.deepEqual(calls,['first','second','census','proof']);assert.equal(result.drained,false);assert.equal(result.errors.length,2);
});
test('fixture drain accepts positive closure after fallback cleanup while preserving the original failure',async()=>{
 const result=await drainFixtureOwners([async()=>{throw Error('first stop failed');}],async()=>{},async()=>true);
 assert.equal(result.drained,true);assert.equal(result.errors.length,1);
});
