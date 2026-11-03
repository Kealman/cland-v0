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
for(const boundary of ['connect','initial receipts'] as const)test(`Host.close joins and closes a connection held at ${boundary}`,async()=>{
 let release!:()=>void,entered!:()=>void;
 const gate=new Promise<void>(resolve=>{release=resolve;}),arrival=new Promise<void>(resolve=>{entered=resolve;});
 let closed=false,operations=0;
 const value=Object.assign(new EventEmitter(),{
  hello:{protocol:1,version:'test',pid:42,bootId:'test',capabilities:[PREPARED_HOST_CAPABILITY]},
  close:async()=>{if(!closed){closed=true;value.emit('closed');}},
  request:async(op:string)=>{if(op==='native-receipts'){if(boundary==='initial receipts'){entered();await gate;}return [];}operations++;return null;},
 }) as unknown as AgentClient;
 const host=sshHost({name:'f1',transport:{status:()=>({state:'up'})},connect:async()=>{if(boundary==='connect'){entered();await gate;}return value;}} as unknown as Parameters<typeof sshHost>[0]);
 const observation=host.identity(42).then(()=>null,error=>error);await arrival;
 const stopping=host.close();release();await stopping;assert.ok(await observation);assert.equal(closed,true);assert.equal(operations,0);
});
