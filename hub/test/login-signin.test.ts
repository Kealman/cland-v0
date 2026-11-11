// T1: injected Host/provider boundaries; no native processes or socket.
import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { LoginRecords } from '../src/host/logins.ts';
import { prepareLoginSignIn, loginSignInCommand } from '../src/host/login-signin.ts';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { Host } from '../src/host/host.ts';
import type { HostProvider } from '../src/host/provider/provider.ts';
import { FakeClock } from './fake-clock.ts';

test('all harness sign-in plans contain only the documented home and native arguments',()=>{
 assert.equal(loginSignInCommand('codex','/cland/auth/codex-work'),"CODEX_HOME='/cland/auth/codex-work' codex login --device-auth");
 assert.equal(loginSignInCommand('claude-code','/cland/auth/claude-code-work'),"CLAUDE_CONFIG_DIR='/cland/auth/claude-code-work' claude auth login");
 assert.equal(loginSignInCommand('opencode','/cland/auth/opencode-work'),"OPENCODE_DB='/cland/auth/opencode-work/opencode.db' opencode auth login");
});
test('production harness command sources contain no logout commands',async()=>{
 const root=new URL('../src/',import.meta.url).pathname;
 async function scan(path:string):Promise<void>{for(const entry of await readdir(path,{withFileTypes:true})){
  const file=join(path,entry.name);if(entry.isDirectory())await scan(file);else if(entry.name.endsWith('.ts'))assert.doesNotMatch(await readFile(file,'utf8'),/codex\s+logout|claude\s+auth\s+logout|\/logout/);
 }}
 await scan(root);
});

for(const code of [1,null]) test(`failed terminal sign-in ${code} keeps a detached signed-out disk`,async t=>{
 const db=new DatabaseSync(':memory:');t.after(()=>db.close());const logins=new LoginRecords(db);
 let mounted=false,attached=false,snapshots=0;
 const volume={id:'volume-1',project:'/project',name:'disk',region:'lon1',sizeGiB:1,created:'2026-11-10T00:00:00.000Z',attachedTo:null};
 const provider={createVolume:async()=>({state:'created',volume}),attachVolume:async()=>{attached=true;return {state:'attached'};},detachVolume:async()=>{attached=false;return {state:'detached'};},snapshotVolume:async()=>{snapshots++;throw Error('unexpected');}} as unknown as HostProvider;
 const host={name:'host-a',loginDisk:async({op}:{op:string})=>{mounted=op==='mount';}} as unknown as Host;
 const pending=await prepareLoginSignIn({logins,provider,host,machine:{id:'machine-a',address:'fake',architecture:'arm64',created:volume.created},project:'/project',tag:'cland-test',region:'lon1',providerName:'fake',harness:'claude-code',clock:new FakeClock(Date.parse(volume.created))});
 assert.equal(mounted,true);assert.equal(attached,true);
 const row=await pending.complete(code);
 assert.equal(row.state,'signed-out');assert.ok(row.signedOut?.id);assert.equal(row.signedOut.reason,'sign-in failed');assert.equal(row.signedOut.host,null);assert.equal(row.lastSignIn,null);assert.equal(row.kind==='disk'&&row.volumeId,'volume-1');
 assert.equal(mounted,false);assert.equal(attached,false);assert.equal(snapshots,0);
});

test('disk sign-in stays creating until unmount, snapshot and detach receipts', async t => {
 const db = new DatabaseSync(':memory:'); t.after(() => db.close());
 const logins = new LoginRecords(db), events: string[] = [];
 const volume = {id:'volume-123',project:'/project',name:'disk',region:'lon1',sizeGiB:1,created:'2026-11-10T00:00:00Z',attachedTo:null};
 let config = '';
 const host = {name:'host-a',loginDisk:async ({op}: {op:string})=>{events.push(op);},publishFile:async (_path:string,bytes:Uint8Array)=>{config=Buffer.from(bytes).toString();return true;}} as unknown as Host;
 const provider = {createVolume:async (input:unknown)=>{assert.deepEqual(input,{project:'/project',name:'cland-test-codex-1',region:'lon1',sizeGiB:1});return {state:'created',volume};},attachVolume:async()=>({state:'attached'}),snapshotVolume:async()=>{events.push('snapshot');return {state:'snapshotted',snapshot:{id:'snapshot-1',volumeId:volume.id,created:volume.created}};},detachVolume:async()=>{events.push('detach');return {state:'detached'};}} as unknown as HostProvider;
 const clock=new FakeClock(Date.parse(volume.created));
 logins.useClock(clock);
 const pending=await prepareLoginSignIn({logins,provider,host,machine:{id:'machine-a',address:'fake',architecture:'arm64',created:volume.created},project:'/project',tag:'cland-test',region:'lon1',providerName:'fake',harness:'codex',clock});
 assert.equal(pending.name,'codex-1'); assert.equal(pending.path,'/cland/auth/codex-codex-1');
 assert.equal(logins.get(pending.name)?.state,'creating'); assert.deepEqual(logins.free(),[]); assert.deepEqual(logins.bindings(pending.name),[]);
 assert.equal(config,'cli_auth_credentials_store = "file"\n');
 await pending.complete(0);
 const row=logins.get(pending.name)!;
 assert.equal(row.state,'ready'); assert.equal(row.lastSignIn,'2026-11-10T00:00:00.000Z');
 assert.deepEqual(row.kind==='disk'&&row.snapshotIds,['snapshot-1']);
 assert.deepEqual(events,['mount','umount','snapshot','detach']);
});

test('sign-in records volume and snapshot lifetime receipts in the admitted pool',async t=>{
 const db=new DatabaseSync(':memory:');t.after(()=>db.close());const logins=new LoginRecords(db);
 const created='2026-11-10T00:00:00Z',clock=new FakeClock(Date.parse(created));logins.useClock(clock);
 const volume={id:'v',project:'/project',name:'disk',region:'lon1',sizeGiB:1,created,attachedTo:null};
 const host={name:'h',loginDisk:async()=>{},publishFile:async()=>true} as unknown as Host;
 const provider={createVolume:async()=>({state:'created',volume}),attachVolume:async()=>({state:'attached'}),snapshotVolume:async()=>({state:'snapshotted',snapshot:{id:'s',volumeId:'v',created}}),detachVolume:async()=>({state:'detached'})} as unknown as HostProvider;
 const pending=await prepareLoginSignIn({logins,provider,host,machine:{id:'m',address:'fake',architecture:'arm64',created},project:'/project',tag:'fixture',region:'lon1',providerName:'fake',harness:'codex',pool:'agents',clock});
 const row=await pending.complete(0);
 assert.deepEqual(row.storage,{pool:'agents',items:[{kind:'volume',id:'v',sizeGiB:1,created,deleted:null},{kind:'snapshot',id:'s',sizeGiB:1,created,deleted:null}]});
 logins.deleteStorage(row.name,'snapshot','s');
 assert.equal(logins.get(row.name)!.storage!.items[1]!.deleted,'2026-11-10T00:00:00.000Z');
 await clock.advance(22*86400000);
 logins.recordStorage(row.name,'agents',{kind:'snapshot',id:'next',sizeGiB:1,created:clock.now().toISOString(),deleted:null});
 assert.deepEqual(logins.get(row.name)!.storage!.items.map(item=>item.id),['v','next']);
 assert.throws(()=>logins.useClock(new FakeClock(Date.parse(created))),/clock already set/);
});
