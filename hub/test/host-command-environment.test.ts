import test from 'node:test';
import assert from 'node:assert/strict';
import { hostCommandEnvironment, remoteCommandEnvironment } from '../src/host/command-environment.ts';
import { withoutExecutorCredentials } from '../../shared/executor-credentials.ts';
test('Host command env keeps local effective bytes and sends explicit remote additions only', () => {
  const base = { PATH: '/hub/bin', HUB_ONLY: 'synthetic-hub', DIGITALOCEAN_TOKEN: 'synthetic-do' };
  const additions = { EXPLICIT: 'same', CLAND_SESSION_ID: 'session', CLAND_LAUNCH_TOKEN: 'synthetic-launch' };
  assert.deepEqual(hostCommandEnvironment({ name: 'local' }, base, additions), withoutExecutorCredentials({ ...base, ...additions }));
  assert.deepEqual(hostCommandEnvironment({ name: 'f1' }, base, additions), additions);
});
test('Host command env positive control detects every planted credential before filtering', () => {
  const planted = Object.fromEntries(['DIGITALOCEAN_TOKEN','CLAND_TELEGRAM_TOKEN','CLAND_DISCORD_TOKEN','CLAND_HUB_SECRET','CLAND_PROJECT_SECRET','CLAND_HOST_SECRET'].map(key => [key, 'synthetic-' + key]));
  assert.equal(Object.values(planted).filter(v => v.startsWith('synthetic-')).length, 6);
  assert.deepEqual(remoteCommandEnvironment({ ...planted, EXPLICIT: 'allowed' }), { EXPLICIT: 'allowed' });
});

test('OpenCode shared environment builder keeps local base and excludes planted hub-only input remotely', () => {
  const base = {HUB_ONLY:'synthetic-hub-only',OPENCODE_DB:'/hub/opencode.db',PATH:'/hub/bin'};
  const additions = {CLAND_SESSION_ID:'session',CLAND_HUB_FILE:'/host/hub.json',OPENCODE_DB:'/host/opencode.db'};
  assert.equal(base.HUB_ONLY,'synthetic-hub-only');
  assert.deepEqual(hostCommandEnvironment({name:'local'},base,additions),{...base,...additions});
  assert.deepEqual(hostCommandEnvironment({name:'f1'},base,additions),additions);
});
import { sshHost } from '../src/host/ssh-host.ts';
import type { AgentClient } from '../src/host/agent-client.ts';
test('ssh Host refuses an older hello without prepared capability and never calls a monolithic fallback', async () => {
 let closed=false,called=false;
 const previous=Object.assign(new EventEmitter(),{hello:{protocol:1,version:'older',pid:42,bootId:'old'},close:async()=>{closed=true;},request:async()=>{called=true;}}) as unknown as AgentClient;
 const host=sshHost({name:'f1',transport:{status:()=>({state:'up'})},connect:async()=>previous} as unknown as Parameters<typeof sshHost>[0]);
 await assert.rejects(host.identity(42),/f1.*missing capability host-prepared-v1/);
 assert.equal(closed,true);assert.equal(called,false);
});

import { EventEmitter } from 'node:events';
import { PREPARED_HOST_CAPABILITY } from '../src/host/agent/protocol.ts';
import { CLAUDE_LAUNCH_CAPABILITY } from '../src/host/agent/claude.ts';
for(const shape of ['legacy','extended'] as const)test(`SSH spawn reconciles a dropped commit reply with an exact exit result from ${shape} receipts`,async t=>{
 const native={event:'process-exited',pid:42,identity:'synthetic-birth',code:7,signal:null,...(shape==='extended'?{authority:'closed',ended:true}:{})};
 let connections=0,settled=false;
 const host=sshHost({name:'f1',transport:{status:()=>({state:'up'})},connect:async()=>{
  const recovery=connections++>0;
  const client=Object.assign(new EventEmitter(),{
   hello:{protocol:1,version:'test',pid:42,bootId:'test',capabilities:[PREPARED_HOST_CAPABILITY]},
   close:async()=>{client.emit('closed');},
   request:async(op:string)=>{
    if(op==='processes')return [];
    if(op==='native-receipts')return recovery?[native]:[];
    if(op==='prepare-spawn')return {token:'synthetic-token'};
    if(op==='commit-prepared')throw new Error('synthetic lost commit reply');
    if(op==='settle-prepared'){settled=true;return {state:'accepted',result:{pid:42,identity:'synthetic-birth'}};}
    throw new Error('unexpected operation '+op);
   },
  });
  return client as unknown as AgentClient;
 }} as Parameters<typeof sshHost>[0]);
 t.after(()=>host.close());
 const child=await receipt(host.spawn({command:'/synthetic/node',args:[],cwd:'/scratch',env:{}}),'reconciled spawn');
 assert.equal(settled,true,'the dropped commit reply was reconciled');
 assert.equal(connections,2,'recovery loads the native receipt before settlement returns');
 assert.deepEqual(await receipt(child.exited,'cached native completion'),{code:7,signal:null});
});
// These fakes perform only promise work: bound the receipt by work, not native time.
async function receipt<T>(promise:Promise<T>,what:string):Promise<T>{
 let settled=false;
 void promise.then(()=>{settled=true;},()=>{settled=true;});
 for(let turn=0;turn<100&&!settled;turn++)await Promise.resolve();
 assert.ok(settled,`${what}: incomplete after 100 microtask turns`);
 return promise;
}
for(const boundary of ['connect','initial receipts'] as const)test(`Host.close joins and closes a connection held at ${boundary}`,async t=>{
 let release!:()=>void,entered!:()=>void;
 const gate=new Promise<void>(resolve=>{release=resolve;}),arrival=new Promise<void>(resolve=>{entered=resolve;});
 let closed=false,operations=0;
 const value=Object.assign(new EventEmitter(),{
  hello:{protocol:1,version:'test',pid:42,bootId:'test',capabilities:[PREPARED_HOST_CAPABILITY]},
  close:async()=>{if(!closed){closed=true;value.emit('closed');}},
  request:async(op:string)=>{if(op==='processes')return [];if(op==='native-receipts'){if(boundary==='initial receipts'){entered();await gate;}return [];}operations++;return null;},
 }) as unknown as AgentClient;
 const host=sshHost({name:'f1',transport:{status:()=>({state:'up'})},connect:async()=>{if(boundary==='connect'){entered();await gate;}return value;}} as unknown as Parameters<typeof sshHost>[0]);
 let observation:Promise<unknown>|undefined;
 t.after(async()=>{release();await receipt(host.close(),'recovery cleanup close');if(observation)await receipt(observation,'recovery cleanup operation');});
 observation=host.freePort().then(()=>null,error=>error);await receipt(arrival,'held recovery acquisition');
 const stopping=host.close();release();await receipt(stopping,'recovery close');assert.ok(await receipt(observation,'rejected recovery operation'));assert.equal(closed,true);assert.equal(operations,0);
});


test('Host.close joins a held observation connection independently of recovery receipts',async t=>{
 const entered=Promise.withResolvers<void>(),release=Promise.withResolvers<void>();let closed=false,operations=0;
 const value=Object.assign(new EventEmitter(),{
  hello:{protocol:1,version:'test',pid:42,bootId:'test',capabilities:[PREPARED_HOST_CAPABILITY]},
  close:async()=>{closed=true;value.emit('closed');},
  request:async()=>{operations++;return null;},
 }) as unknown as AgentClient;
 const host=sshHost({name:'f1',transport:{status:()=>({state:'up'})},connect:async()=>{entered.resolve();await release.promise;return value;}} as unknown as Parameters<typeof sshHost>[0]);
 let observation:Promise<unknown>|undefined;
 t.after(async()=>{release.resolve();await receipt(host.close(),'observation cleanup close');if(observation)await receipt(observation,'observation cleanup operation');});
 observation=host.identity(42).then(()=>null,error=>error);await receipt(entered.promise,'held observation acquisition');
 const stopping=host.close();release.resolve();await receipt(stopping,'observation close');
 assert.ok(await receipt(observation,'rejected observation operation'));assert.equal(closed,true);assert.equal(operations,0);
});

for(const shape of ['legacy','native-only','other-generation','matching-generation'] as const)test(`SSH Claude pre-spawn admission receipt ${shape}`,async t=>{
 const generation='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
 const result:import('../src/host/host.ts').HostRunResult={code:1,stdout:'',stderr:'',error:'Claude launch refused: account config root must be private',...(shape==='native-only'?{nativeAdmission:'no-process' as const}:{}),...(shape==='legacy'||shape==='native-only'?{}:{claudeAdmission:{generation:shape==='other-generation'?'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb':generation,outcome:'refused-before-spawn' as const}})};
 const client=Object.assign(new EventEmitter(),{
  hello:{protocol:1,version:'test',pid:42,bootId:'test',capabilities:[PREPARED_HOST_CAPABILITY,CLAUDE_LAUNCH_CAPABILITY]},
  request:async(op:string)=>{if(op==='processes'||op==='native-receipts')return [];if(op==='run-host')return result;throw new Error('unexpected operation '+op);},
  close:async()=>{client.emit('closed');},
 });
 const host=sshHost({name:'f1',transport:{status:()=>({state:'up'})},connect:async()=>client as unknown as AgentClient} as Parameters<typeof sshHost>[0]);
 t.after(()=>host.close());
 const launch=host.launchClaude!({command:'claude',args:['--bg'],cwd:'/scratch',env:{}},generation);
 if(shape==='matching-generation')await assert.rejects(launch,{code:'CLAND_AGENT_ADMISSION_REFUSED'});
 else assert.deepEqual(await launch,result,'older replies and foreign generations grant no rollback authority');
});
