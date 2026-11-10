// T1: pure deadline policy; no waits, sockets or native children.
import test from 'node:test';
import assert from 'node:assert/strict';
import { waitTimeoutMs } from './until.ts';

test('wait deadline policy preserves local, droplet, explicit and invalid scaling',()=>{
 const keys=['CLAND_TEST_LOAD_FACTOR','CLAND_SUITE_EXECUTOR'] as const;
 const saved=keys.map(key=>process.env[key]);
 try {
  for(const key of keys)delete process.env[key];
  assert.equal(waitTimeoutMs(100),100);
  process.env.CLAND_SUITE_EXECUTOR='droplet';assert.equal(waitTimeoutMs(100),200);
  assert.equal(waitTimeoutMs(100,3),300);
  process.env.CLAND_TEST_LOAD_FACTOR='invalid';assert.equal(waitTimeoutMs(100),100);
  assert.equal(waitTimeoutMs(100,0),100);
  assert.throws(()=>waitTimeoutMs(0),/positive finite deadline/);
  assert.throws(()=>waitTimeoutMs(-1),/positive finite deadline/);
  assert.throws(()=>waitTimeoutMs(Number.POSITIVE_INFINITY),/positive finite deadline/);
 } finally {keys.forEach((key,i)=>{if(saved[i]===undefined)delete process.env[key];else process.env[key]=saved[i];});}
});
