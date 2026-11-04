// T1: previous agent hello and additive request routing; no native resources.
import test from 'node:test';
import assert from 'node:assert/strict';
import { updateRefWatch } from '../src/host/agent-client.ts';
import { REF_WATCH_CAPABILITY } from '../src/host/agent/watch.ts';
test('new client accepts previous agent hello without issuing watch operations',async()=>{
 const calls:unknown[]=[];
 const client={hello:{protocol:1,version:'old',pid:1,bootId:'old'},request:async(...args:unknown[])=>{calls.push(args);return null;}};
 await updateRefWatch(client,'watch',{path:'/task',branch:'t/task'});await updateRefWatch(client,'unwatch',{path:'/task'});
 assert.deepEqual(calls,[]);
 const capable={...client,hello:{...client.hello,capabilities:[REF_WATCH_CAPABILITY]}};
 await updateRefWatch(capable,'watch',{path:'/task',branch:'t/task'});await updateRefWatch(capable,'unwatch',{path:'/task'});
 assert.deepEqual(calls,[['watch',{path:'/task',branch:'t/task'}],['unwatch',{path:'/task'}]]);
});

test('push environment removes inherited Git routes and installs only the owned Unix proxy override',async()=>{
 const { refPushEnvironment }=await import('../src/host/agent/ref-push.ts');
 const env=refPushEnvironment({GIT_PROXY_COMMAND:'substituted-tcp-proxy',GIT_DIR:'/foreign',GIT_CONFIG_COUNT:'5',DIGITALOCEAN_TOKEN:'synthetic-token',HOME:'/scratch'},'/run/ref-git-proxy');
 assert.equal(env.GIT_PROXY_COMMAND,'/run/ref-git-proxy');assert.equal(env.GIT_DIR,undefined);assert.equal(env.GIT_CONFIG_COUNT,undefined);assert.equal(env.DIGITALOCEAN_TOKEN,undefined);
 assert.equal(env.GIT_CONFIG_NOSYSTEM,'1');assert.equal(env.GIT_CONFIG_GLOBAL,'/dev/null');
});


test('new status reader accepts the previous watch-v1 agent without requesting an unsupported operation',async()=>{
 const { readRefWatchStatus }=await import('../src/host/agent-client.ts');const { REF_WATCH_STATUS_CAPABILITY }=await import('../src/host/agent/watch.ts');
 const calls:string[]=[],reports:unknown[]=[];
 const old={hello:{protocol:1,version:'old',pid:1,bootId:'boot',capabilities:[REF_WATCH_CAPABILITY]},request:async(op:string)=>{calls.push(op);return [{path:'/task',branch:'t/task',state:'fenced',cause:'producer result missing'}];}};
 await readRefWatchStatus(old,rows=>{reports.push(rows);});assert.deepEqual(calls,[]);assert.equal(reports.length,0);
 await readRefWatchStatus({...old,hello:{...old.hello,capabilities:[REF_WATCH_CAPABILITY,REF_WATCH_STATUS_CAPABILITY]}},rows=>{reports.push(rows);});assert.deepEqual(calls,['watch-status']);assert.equal((reports[0] as Array<{cause:string}>)[0]?.cause,'producer result missing');
});
