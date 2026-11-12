// T3: native fake SSH loss and CLI-started hub recovery push host outage receipts.
// Lifecycle: host-create fixture joins hub, SSH, agent and watchdog before root disposal.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, writeFile, access } from 'node:fs/promises';
import { hostDirectory } from '../../shared/fake-host-directory.ts';
import { FakeHostProvider } from '../src/host/provider/fake.ts';
import { join } from 'node:path';
import { fixture } from './host-create-fixture.ts';
import { cland, connectUi, startDaemon, testWaitMs } from './harness.ts';
import { controlRequest } from './fakes/fake-ssh-common.ts';
import { fixtureEnvironment } from './fixture-environment.ts';
import { tunnelControl } from './fakes/host-tunnel-control.ts';
import type { HostsStatePool } from '../src/protocol.ts';
const OUTAGE_MS=3000;
test('native tunnel outage pushes host alert and CLI scratch control restores it', {timeout:testWaitMs(60000)}, async t=>{
 const f=await fixture(t);
 // Creation must run on the CLI hub so its ready receipt includes the live tunnel.
 await f.hub.stop();
 const daemon=await startDaemon(t,f.root,f.env as Record<string,string>);
 assert.equal(daemon.result.code,0,daemon.result.stderr);
 const created=await cland(f.root,'host','create','agents');assert.equal(created.code,0,created.stderr);
 const host=JSON.parse(created.stdout);assert.equal(host.state,'ready');
 const ui=await connectUi(t,daemon.discovery);
 assert.equal((await ui.request({type:"subscribe"})).ok,true);
 const pool=(frame:Record<string,unknown>)=>(frame.pools as HostsStatePool[]|undefined)?.find(p=>p.name==='agents');
 await ui.waitFor(frame=>frame.type==='hosts.state'&&pool(frame)?.hosts.some(h=>h.id===host.id&&h.state==='ready')===true,testWaitMs(15000));
 const run=async(action:string)=>promisify(execFile)(process.execPath,[new URL('./fakes/host-tunnel-control.ts',import.meta.url).pathname,f.root,host.id,action],{env:fixtureEnvironment(f.root,f.env,{CLAND_FAKE_HOST_ROOT:f.root})});
 const boundary=ui.frames.length;
 const outage=ui.waitFor(frame=>ui.frames.indexOf(frame)>=boundary&&frame.type==='hosts.state'&&pool(frame)?.alert?.kind==='outage',OUTAGE_MS);void outage.catch(()=>{});
 await run('down');
 const alert=pool(await outage)!.alert;assert.equal(alert?.kind,'outage');if(alert?.kind==='outage')assert.equal(alert.host,host.id);
 assert.equal((await new FakeHostProvider({env:f.env}).status(host.machine)).state,'ready','transport loss leaves provider machine running');
 const recoveryBoundary=ui.frames.length;
 const recovered=ui.waitFor(frame=>ui.frames.indexOf(frame)>=recoveryBoundary&&frame.type==='hosts.state'&&pool(frame)?.alert===null,testWaitMs(15000));void recovered.catch(()=>{});
 await run('up');assert.equal(pool(await recovered)!.alert,null);
 const receiptPath=join(hostDirectory(f.root,host.machine.address),'master-control');
 const originalReceipt=await readFile(receiptPath,'utf8'),receipt=JSON.parse(originalReceipt);
 await writeFile(receiptPath,JSON.stringify({...receipt,owner:{...receipt.owner,boot:'foreign-boot'}}));
 await assert.rejects(tunnelControl(f.root,host.id,'down',f.env),/owner mismatch/);
 await writeFile(receiptPath,originalReceipt);
 // A non-fake pool cannot acquire authority over even a valid fake receipt.
 const config=join(f.root,'.cland/config.toml'),original=await readFile(config,'utf8');
 await writeFile(config,original.replace(/provider\s*=\s*"fake"/,'provider="digitalocean"'));
 await assert.rejects(tunnelControl(f.root,host.id,'down',f.env),/fake-provider pool/);
 await writeFile(config,original);
 await assert.rejects(tunnelControl(f.root,'unowned-host','down',f.env),/owned fake host/);
 await assert.rejects(tunnelControl(f.root,host.id,'down',{}),/owned fake host root/);
 await assert.rejects(access(join(hostDirectory(f.root,host.machine.address),'tunnel-down')), {code:'ENOENT'});
 await controlRequest(receipt.control,{operation:'check',forwards:[],owner:receipt.owner,token:receipt.token});
});
