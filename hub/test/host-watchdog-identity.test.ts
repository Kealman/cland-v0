// T1: injected native identity probes; never starts or signals an OS process.
import test from 'node:test';
import assert from 'node:assert/strict';
import { stopHostWatchdog } from '../src/host/host-watchdog.ts';
import { FakeClock } from './fake-clock.ts';

for(const identity of ['original','reused',null])test(`host watchdog stop respects captured birth: ${identity}`,async()=>{
 const signals:NodeJS.Signals[]=[];let alive=true;
 const stopping=stopHostWatchdog({pid:123,startedUtc:'fixture',pidIdentity:'original'},{},{clock:new FakeClock(),processes:{
  started:async()=> 'fixture',identity:async()=>identity,alive:()=>alive,
  signal:(_pid,signal)=>{signals.push(signal);alive=false;},
 }});
 if(identity===null)await assert.rejects(stopping,/watchdog stop unconfirmed/);else await stopping;
 assert.deepEqual(signals,identity==='original'?['SIGTERM']:[]);
});

import { parseHostAbsenceReceipt, type HostWatchdogInput } from '../src/host/host-watchdog.ts';
const captured:HostWatchdogInput={root:'/fixture',id:'host-1',provider:'fake',machine:{id:'machine-1',address:'machine-1',architecture:'arm64',created:'2026-11-08T00:00:00Z'}};
const valid={...captured,confirmedAt:'2026-11-08T00:00:30Z',reads:[{resource:'machine',read:'machine absent'},{resource:'key',read:'key absent'}]};
for(const [name,change] of Object.entries({root:{root:'/other'},host:{id:'host-2'},provider:{provider:'other'},machine:{machine:{...captured.machine,id:'machine-2'}},birth:{machine:{...captured.machine,created:'2026-11-07T00:00:00Z'}},address:{machine:{...captured.machine,address:'other'}},architecture:{machine:{...captured.machine,architecture:'x86_64'}},empty:{reads:[]},missingKey:{reads:[valid.reads[0]]},blankRead:{reads:[{resource:'machine',read:''},valid.reads[1]]},badDate:{confirmedAt:'bad'},earlyDate:{confirmedAt:'2026-11-07T00:00:00Z'}}))test(`absence receipt fences invalid captured ${name}`,()=>{
 assert.throws(()=>parseHostAbsenceReceipt({...valid,...change},captured),/invalid host absence receipt/);
});
test('complete absence receipt retains the exact captured acquisition',()=>{assert.deepEqual(parseHostAbsenceReceipt(valid,captured),valid);});
