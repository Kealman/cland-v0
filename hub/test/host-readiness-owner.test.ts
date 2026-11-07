// T2: registry readiness ownership with typed carrier/Git owners and a frozen clock.
import test from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { tempProject, eventually, testWaitMs } from './harness.ts';
import { onCleanup } from './process-cleanup.ts';
import { fixtureEnvironment } from './fixture-environment.ts';
import { FakeClock } from './fake-clock.ts';
import { Store } from '../src/hub/store.ts';
import { HostSecretStore } from '../src/host/records.ts';
import { projectSshHosts } from '../src/host/registry.ts';

for(const action of ['close','remove'] as const)test(`owner ${action} drains down-tunnel readiness without advancing time`,async t=>{
 const root=await tempProject(t),clock=new FakeClock(new Date()),store=new Store(join(root,'hub.db'));
 let polled=false;
 const events:string[]=[];
 const owner=await projectSshHosts({root,clock,records:store.hosts,env:fixtureEnvironment(root,{}),hubSocket:join(root,'hub.sock'),spokeSocket:join(root,'spoke.sock'),log:()=>{},
 settle:async id=>{store.hosts.revoke(id);return {inventoryComplete:true,timedOut:false,leftovers:[]};},
 createTransport:()=>({start:async()=>{},stop:async()=>{},status:()=>{polled=true;return {name:'held',state:'down',since:null,lastProbe:null,reconnects:0};},forward:async()=>({socket:'unused'}),unforward:async()=>{}}),gitDaemon:async()=>({close:async()=>{}})});
 let ready:Promise<void>|undefined,failure:unknown;
 onCleanup(t,async()=>{await owner.close();await clock.advance(300000);await ready;store.close();});
 await owner.add(new HostSecretStore(root,store.hosts).register({id:'held',address:'held',user:'agent',clientKeyPath:'unused',knownHosts:'unused'}));
 const observation=eventually('down carrier poll observed',()=>polled?true:undefined,testWaitMs());
 ready=owner.ready('held').then(()=>{events.push('ready');},error=>{failure=error;events.push('rejected');});
 await observation;
 if(action==='close')await owner.close();else await owner.remove('held');
 events.push('closed');
 assert.deepEqual(events,['rejected','closed']);
 await ready;assert.match(String(failure),/abort|stopp/i);
 // Native timers remain real; lifecycle fake time has not moved at all.
 assert.equal(clock.pending,0);
});
