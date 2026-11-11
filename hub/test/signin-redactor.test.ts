// T1: memory-only stream redaction, no native resources.
import test from 'node:test';
import assert from 'node:assert/strict';
import { SignInRedactor } from '../src/host/agent/signin-redactor.ts';
test('registered input is hidden across every output split and at close',()=>{
 for(let split=0;split<=22;split++){
  const r=new SignInRedactor();r.register('sentinel-private-input\n');
  const raw='sentinel-private-input';
  const output=r.push(raw.slice(0,split))+r.push(raw.slice(split)+' accepted')+r.finish();
  assert.equal(output,'[redacted] accepted');
 }
});
