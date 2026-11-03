import test from 'node:test';
import assert from 'node:assert/strict';
import { isCapturedOrExited } from '../src/host/agent/native.ts';
test('stop observation accepts positive end before comparing a captured birth',()=>{
 assert.equal(isCapturedOrExited({identity:null,ended:true},'birth'),true);
 assert.equal(isCapturedOrExited({identity:null,ended:true},undefined),true);
});
test('missing birth without positive end remains a mismatch',()=>{
 assert.equal(isCapturedOrExited({identity:null,ended:false},'birth'),false);
 assert.equal(isCapturedOrExited({identity:null,ended:false},undefined),false);
 assert.equal(isCapturedOrExited(undefined,'birth'),false);
 assert.equal(isCapturedOrExited(undefined,undefined),false);
});
test('live stop observation requires the exact captured birth',()=>{
 assert.equal(isCapturedOrExited({identity:'birth',ended:false},'birth'),true);
 assert.equal(isCapturedOrExited({identity:'replacement',ended:false},'birth'),false);
 assert.equal(isCapturedOrExited({identity:'birth',ended:false},undefined),false);
});
