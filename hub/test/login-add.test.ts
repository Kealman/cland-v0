// T3: CLI-started hub and terminal SSH subprocess drive fake host provisioning
// and harness sign-in. Native children close before the owned fixture root drains.
import { receiptFixtureCase } from './receipt-fixture-case.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { writeFile, readFile, readdir, unlink, realpath, readlink } from 'node:fs/promises';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { fixture } from './host-create-fixture.ts';
import { startDaemon, killDaemon, cland, testWaitMs, connectUi, eventually, fixtureResidueCensus } from './harness.ts';
import { fixtureEnvironment } from './fixture-environment.ts';
import { loginFixtureOwners, loginChild } from './login-fixture-owners.ts';
import { guardDirectoryRemoval, onCleanup } from './process-cleanup.ts';
import { FakeHostProvider } from '../src/host/provider/fake.ts';
import { hostDirectory } from '../../shared/fake-host-directory.ts';
import type { Volume } from '../src/host/provider/provider.ts';

test('terminal disk logins create a host, reuse it and retain only public metadata', {timeout:testWaitMs(60000)}, t => receiptFixtureCase(t, true, async (t, step, adoptRoot, release) => {
 const f=await step("fixture setup", async () => (fixture(t))), owners=loginFixtureOwners(t);
 adoptRoot(f.root);
 let releasing: Promise<void> | undefined;
 let released = false;
 release(() => { releasing = owners.disposeAsync().then(() => { released = true; }); void releasing.catch(() => {}); });
 onCleanup(t, async () => { await releasing; });
 guardDirectoryRemoval(f.root, () => { if (!released) throw Error('login child drainage incomplete; root retained'); });
 await step("fixture operation", async () => (f.hub.stop()));
 // The wrapper binds fake membership to the destination admitted in the plan.
 // PATH never reaches a real SSH or harness binary in this fixture.
 const ssh=new URL('./fakes/fake-ssh.ts',import.meta.url).pathname;
 const parser=new URL('./fakes/fake-ssh-common.ts',import.meta.url).href;
 const environment=new URL('./fixture-environment.ts',import.meta.url).href;
 await step("fixture operation", async () => (unlink(join(f.root,'bin/ssh'))));
 assert.ok((await step("fixture operation", async () => (realpath(join(f.root,'bin'))))).startsWith(await step("fixture operation", async () => (realpath(f.root)))));
 await step("fixture operation", async () => (writeFile(join(f.root,'bin/ssh'),`#!/usr/bin/env node\nimport {spawn} from 'node:child_process';import {appendFileSync} from 'node:fs';import {parseSsh} from '${parser}';import {fixtureEnvironment} from '${environment}';const args=process.argv.slice(2),parsed=parseSsh(args);appendFileSync(${JSON.stringify(join(f.root,'terminal-argv.jsonl'))},JSON.stringify(args)+'\\n');const env=fixtureEnvironment(${JSON.stringify(f.root)},process.env,{CLAND_FAKE_HOST_ROOT:${JSON.stringify(f.root)},CLAND_FAKE_HOSTS:parsed.destination.split('@').at(-1)});const child=spawn(process.execPath,[${JSON.stringify(ssh)},...args],{env,stdio:'inherit'});child.once('error',()=>{process.exitCode=255;});child.once('close',code=>{process.exitCode=code??255;});for(const s of ['SIGTERM','SIGINT'])process.on(s,()=>child.kill(s));\n`,{mode:0o700})));
 const daemon=await step('daemon setup', async () => {
  const daemon=await startDaemon(t,f.root,f.env as Record<string,string>);
  f.stops.push(async()=>{await cland(f.root,'hub','stop');await killDaemon(daemon.discovery.pid);});
  return daemon;
 });
 const registry=join(f.root,'.fixture-sockets/owners');
 const receipts=await step("fixture operation", async () => (readdir(registry)));
 assert.ok(receipts.length>0,'CLI hub publishes its scratch ownership receipt');
 for(const name of receipts)assert.deepEqual(JSON.parse(await step("fixture operation", async () => (readFile(join(registry,name),'utf8')))).roots,[await step("fixture operation", async () => (realpath(f.root)))],'the source worktree never receives fixture ownership');
 const env=fixtureEnvironment(f.root,process.env,{PATH:join(f.root,'bin')+':'+process.env.PATH,CLAND_FAKE_HOST_ROOT:f.root});
 const cli=new URL('../bin/cland.ts',import.meta.url).pathname;
 async function add(harness:string) {
  const child=spawn(process.execPath,[cli,'login','add',harness],{cwd:f.root,env});
  const joined=loginChild(owners,child);let output='',error='';
  child.stdout.on('data',bytes=>{output+=String(bytes);});child.stderr.on('data',bytes=>{error+=String(bytes);});child.stdin.end('synthetic-code\n');
  assert.equal(await step("fixture operation", async () => (joined())),0,error);return output;
 }
 const first=await step("fixture operation", async () => (add('codex')));assert.match(first,/codex-1\tready/);
 const hosts=JSON.parse((await step("fixture operation", async () => (cland(f.root,'host','list')))).stdout);assert.equal(hosts.length,1);assert.equal(hosts[0].state,'ready');
 const second=await step("fixture operation", async () => (add('claude-code')));assert.match(second,/claude-code-1\tready/);
 assert.equal(JSON.parse((await step("fixture operation", async () => (cland(f.root,'host','list')))).stdout).length,1);
 const listed=await step("fixture operation", async () => (cland(f.root,'login','list','--json')));assert.equal(listed.code,0,listed.stderr);
 const rows=JSON.parse(listed.stdout);assert.equal(rows.length,2);
 const provider=new FakeHostProvider({env:f.env});const volumes=await step("fixture operation", async () => (provider.listVolumes({project:f.root})));assert.equal(volumes.state,'listed');if(volumes.state!=='listed')throw Error('volume list');
 const machine=hostDirectory(f.root,hosts[0].machine.id);
 for(const row of rows) {
  assert.equal(row.state,'ready');assert.deepEqual(row.bindings,[]);assert.equal(row.snapshotIds.length,1);assert.ok(row.lastSignIn);
  const volume:Volume=volumes.volumes.find(v=>v.id===row.volumeId)!;assert.equal(volume.sizeGiB,1);assert.equal(volume.region,'fake-1');assert.equal(volume.attachedTo,null);
  const contents=join(f.root,'volumes',volume.id+'.contents');
  const login=JSON.parse(await step("fixture operation", async () => (readFile(join(contents,'login.json'),'utf8'))));assert.equal(login.generation,0);
  if(row.harness==='codex')assert.equal(await step("fixture operation", async () => (readFile(join(contents,'config.toml'),'utf8'))),'cli_auth_credentials_store = "file"\n');
  const calls=await step("fixture operation", async () => (readFile(join(machine,'login-calls.jsonl'),'utf8')));assert.ok(!calls.includes('logout'));assert.ok(!calls.includes(login.token));
  assert.ok(JSON.stringify(login).includes(login.token),'positive secret-scan control');
  assert.ok(!(await step("fixture operation", async () => (readFile(join(f.root,'terminal-argv.jsonl'),'utf8')))).includes(login.token));
  for(const file of ['log/hub.log','journal.jsonl','hub.db','hub.db-wal']) {try{assert.ok(!(await step("fixture operation", async () => (readFile(join(f.root,'.cland',file))))).includes(Buffer.from(login.token)));}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}}
  assert.ok(!listed.stdout.includes(login.token));assert.ok(!first.includes(login.token));assert.ok(!second.includes(login.token));
  // Check persisted public metadata and journal/log outputs without reading disk credentials through cland.
  for(const entry of await step("fixture operation", async () => (readdir(join(f.root,'.cland/run'))))) if(/journal|log/.test(entry)) {try{assert.ok(!(await step("fixture operation", async () => (readFile(join(f.root,'.cland/run',entry),'utf8')))).includes(login.token));}catch(error){if((error as NodeJS.ErrnoException).code!=='EISDIR')throw error;}}
 }
 const terminal=await step("fixture operation", async () => (connectUi(t,daemon.discovery,'cli')));
 const preparing=await step("fixture operation", async () => (terminal.request({type:'login.add',harness:'codex',name:'disconnected'},testWaitMs())));
 assert.equal(preparing.ok,true,preparing.error);
 const during=JSON.parse((await step("fixture operation", async () => (cland(f.root,'login','list','--json')))).stdout).find((row:{name:string})=>row.name==='disconnected');
 assert.equal(during.state,'creating');assert.deepEqual(during.bindings,[]);
 const stranger=await step("fixture operation", async () => (connectUi(t,daemon.discovery,'cli')));
 const forged=await step("fixture operation", async () => (stranger.request({type:'login.signed-in',name:'disconnected',code:0})));assert.equal(forged.ok,false);
 terminal.close();
 await step("fixture operation", async () => (eventually('disconnect durable interrupted receipt',async()=>{
  const rows=JSON.parse((await step("fixture operation", async () => (cland(f.root,'login','list','--json')))).stdout);
  return rows.find((row:{name:string;state:string})=>row.name==='disconnected'&&row.state==='signed-out');
 },testWaitMs())));
 const interrupted=JSON.parse((await step("fixture operation", async () => (cland(f.root,'login','list','--json')))).stdout).find((row:{name:string})=>row.name==='disconnected');assert.equal(interrupted.signedOut.reason,'sign-in interrupted');assert.equal(interrupted.signedOut.host,hosts[0].id);
 const after=await step("fixture operation", async () => (provider.listVolumes({project:f.root})));assert.equal(after.state,'listed');if(after.state==='listed'){assert.equal(after.volumes.find(v=>v.id===during.volumeId)?.attachedTo,hosts[0].machine.id);}
 assert.equal(await step("fixture operation", async () => (readlink(join(machine,'cland/auth/codex-disconnected')))),join(f.root,'volumes',during.volumeId+'.contents'));
}));

test('fixture file outputs are removed', fixtureResidueCensus());
