// T3: actual fake-SSH master death, detached supervisor bootstrap and Unix forwarding receipts.
// Lifecycle: stop carrier and capture/drain all scratch-root descendants before deleting storage.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, stat, rename } from 'node:fs/promises';
import { join } from 'node:path';
import net from 'node:net';
import { DatabaseSync } from 'node:sqlite';
import { fixtureEnvironment } from './fixture-environment.ts';
import { createFakeHost, hostControl } from './fakes/fake-host.ts';
import { ownDirectory, fixtureProcessCensus, cleanupOwnedProcesses } from './process-cleanup.ts';
import { eventually } from './harness.ts';
import { HostRecords, HostSecretStore, hostPaths } from '../src/host/records.ts';
import { SshTransport } from '../src/transport/ssh.ts';
import { AgentClient } from '../src/host/agent-client.ts';
const supervisor = new URL('../src/host/agent/supervisor.sh', import.meta.url).pathname;
const cli = new URL('../bin/cland.ts', import.meta.url).pathname;
async function fixture(t: import('node:test').TestContext, clock?: import('../src/hub/clock.ts').Clock, spaces=false) {
  const root = await mkdtemp(spaces?'/tmp/ts space-':'/tmp/ts-');
  const servers: net.Server[] = [], sockets = new Set<net.Socket>();
  let carrier: SshTransport | undefined;
  const db = new DatabaseSync(':memory:');
  const cleanup = ownDirectory(undefined,root,{beforeRemove: async()=>{await cleanupOwnedProcesses(fixtureProcessCensus(root));}});
  t.after(async()=>{ await carrier?.stop(); try { const tail=(await readFile(join(root,'one/home/.cland-host/run/supervisor.log'),'utf8')).slice(-3000).replaceAll(secrets.readSecret('one'),'[redacted]'); if(tail.trim())t.diagnostic(tail); } catch {} for(const s of sockets)s.destroy(); for(const s of servers)await new Promise<void>(r=>s.close(()=>r())); db.close(); await cleanup(); });
  const host = await createFakeHost(root,'one');
  const bin = join(root,'bin'); await mkdir(bin);
  // macOS has no setsid binary. This fake implements its one required operation
  // with Node's native detached spawn; the production script still calls setsid.
  await writeFile(join(bin,'setsid'),`#!${process.execPath}\nimport {spawn} from 'node:child_process'; import {fixtureEnvironment} from '${new URL('./fixture-environment.ts',import.meta.url).pathname}'; const c=spawn(process.argv[2],process.argv.slice(3),{detached:true,stdio:'inherit',env:fixtureEnvironment(process.cwd(),process.env,process.env)}); c.unref();`,{mode:0o700});
  const argvFile = join(root,'argv.jsonl');
  const ssh = join(bin,'ssh');
  await writeFile(ssh,`#!${process.execPath}\nimport {appendFileSync,existsSync,readFileSync} from 'node:fs'; if(process.argv.includes('exit')&&existsSync(${JSON.stringify(join(root,'refuse-exit'))})&&readFileSync(${JSON.stringify(join(root,'refuse-exit'))},'utf8')==='yes')process.exit(1); appendFileSync(${JSON.stringify(argvFile)},JSON.stringify(process.argv.slice(2))+'\\n'); await import('${new URL('./fakes/fake-ssh.ts',import.meta.url).pathname}');`,{mode:0o700});
  const globalTrust=join(root,'global_known_hosts');await writeFile(globalTrust,`one ${host.key}\n`);
  const env = fixtureEnvironment(root,process.env,{PATH:bin+':'+process.env.PATH,CLAND_FAKE_HOSTS:'one',CLAND_FAKE_HOST_ROOT:root,CLAND_SSH_BIN:ssh,...(spaces?{FAKE_SSH_GLOBAL_KNOWN_HOSTS:globalTrust}:{})});
  const records=new HostRecords(db), secrets=new HostSecretStore(root,records);
  const record=secrets.register({id:'one',address:'one',user:'agent',clientKeyPath:join(host.directory,'client-key'),knownHosts:`one ${host.key}\n`});
  const paths=hostPaths(root,'one');
  const logs:string[]=[];
  const options={...(clock ? {clock} : {}),root,record,secrets,hubSocket:join(root,'hub.sock'),spokeSocket:join(root,'spoke.sock'),remoteRun:host.run,supervisor,agentCommand:['/usr/bin/env',`CLAND_HOST_BOOT_ID_FILE=${host.bootId}`,process.execPath,cli,'host','serve'],env,random:()=>0.5,log:(s:string)=>logs.push(s)};
  async function echo(path:string){ const s=net.createServer({allowHalfOpen:true},c=>{sockets.add(c);c.on('error',()=>c.destroy());c.once('close',()=>sockets.delete(c));c.pipe(c);}); servers.push(s);await new Promise<void>((r,j)=>{s.once('error',j);s.listen(path,r);}); return s; }
  async function exchange(path:string){return new Promise<string>((r,j)=>{const s=net.createConnection({path,allowHalfOpen:true}); sockets.add(s);s.once('close',()=>sockets.delete(s));s.setTimeout(1000,()=>s.destroy(new Error('exchange timeout')));s.once('error',j);let out='';s.on('connect',()=>s.end('proof'));s.on('data',b=>out+=b);s.on('end',()=>{s.destroy();r(out);});});}
  carrier=new SshTransport(options);
  return {root,host,paths,options,carrier,logs,echo,exchange,argv:async()=>JSON.parse('['+(await readFile(argvFile,'utf8')).trim().split('\n').join(',')+']') as string[][]};
}
test('C1/C2/C4/C5/C6 fake master restores four forwards and probe after SIGKILL', {timeout:25000},async t=>{
  const f=await fixture(t), secret=f.options.secrets.readSecret('one');
  // Positive control proves argv scanning detects this exact secret before launch.
  const scan=(rows:string[][])=>rows.flat().some(arg=>arg.includes(secret));
  assert.equal(scan([['planted',secret]]),true);
  await f.echo(f.options.hubSocket); await f.echo(f.options.spokeSocket); await f.echo(f.paths.gitSocket);
  const stale=await f.echo(f.paths.controlSocket);
  await rename(f.paths.controlSocket,f.paths.controlSocket+'.stale');
  await new Promise<void>(resolve=>stale.close(()=>resolve()));
  await rename(f.paths.controlSocket+'.stale',f.paths.controlSocket);
  await f.carrier.start();
  await eventually('up after authenticated agent probe',()=>f.carrier.status().state==='up'||undefined,10000);
  const supervisorPid=await readFile(join(f.host.run,'supervisor.lock/pid'),'utf8');
  process.kill(Number(supervisorPid),0);
  const client=await AgentClient.connect(f.paths.agentSocket,secret); const agentPid=client.hello.pid;await client.close();
  assert.equal((await stat(f.host.run)).mode&0o777,0o700);
  assert.equal(await readFile(join(f.host.run,'secret'),'utf8'),secret);
  assert.equal((await stat(join(f.host.run,'secret'))).mode&0o777,0o600);
  const first=await f.argv(), master=first.find(a=>a.includes('-N'))!;
  for(const v of ['-N','-a','-x','/dev/null','BatchMode=yes','IdentitiesOnly=yes','ExitOnForwardFailure=yes','ServerAliveInterval=15','ServerAliveCountMax=4','StrictHostKeyChecking=yes',`UserKnownHostsFile="${f.paths.knownHosts}"`])assert.ok(master.includes(v),v);
  const forwards=master.flatMap((a,i)=>a==='-R'||a==='-L'?[master[i+1]!]:[]);assert.equal(forwards.length,4);
  for(const path of forwards)assert.match(path,/^\/[^:]+:\/[^:]+$/);
  assert.equal(scan(first),false);
  for(const name of ['hub','spoke','git'])assert.equal(await f.exchange(join(f.host.run,`${name}.sock`)),'proof');
  const before=performance.now();
  await hostControl('kill-master','one',f.options.env);
  await eventually('replacement forwards and authenticated probe',async()=>{
    if(f.carrier.status().state!=='up'||f.carrier.status().reconnects<1)return undefined;
    try{for(const name of ['hub','spoke','git'])if(await f.exchange(join(f.host.run,`${name}.sock`))!=='proof')return undefined;
      const c=await AgentClient.connect(f.paths.agentSocket,secret);try{assert.equal(c.hello.pid,agentPid);}finally{await c.close();}return true;
    }catch{return undefined;}
  },10000);
  assert.ok(performance.now()-before<10000); // lint-allow-wall-clock: C5 measures SIGKILL to all forwards plus authenticated probe
  assert.equal(await readFile(join(f.host.run,'supervisor.lock/pid'),'utf8'),supervisorPid);
  const rows=await f.argv();assert.equal(scan(rows),false);
  const starts=rows.flatMap((a,i)=>a.includes('-N')?[i]:[]);assert.ok(starts.length>=2);
  for(const [i,index] of starts.entries())assert.ok(rows.slice(i===0?0:starts[i-1]!+1,index).some(a=>a.includes('exit')));
  assert.ok(rows.some(a=>a.includes('check')));assert.equal(f.carrier.status().lastProbe?.ok,true);
});
test('C7 wrong pin refuses before bootstrap and logs no key material', {timeout:10000},async t=>{
  const f=await fixture(t);await writeFile(f.paths.knownHosts,'one ssh-ed25519 WRONG\n');await f.carrier.start();
  await eventually('pin refusal log',()=>f.logs.length||undefined);
  await f.carrier.stop();assert.equal(f.carrier.status().state,'down');
  assert.doesNotMatch(f.logs.join(' '),/WRONG|ssh-ed25519/);
  const argv=await f.argv();assert.equal(argv.some(a=>a.includes('-N')),false);
  await assert.rejects(readFile(join(f.host.run,'supervisor.lock/pid')),{code:'ENOENT'});
});

import { FakeClock } from './fake-clock.ts';
test('C3 injected clock drives consecutive retries and immediately retries on wake jump', {timeout:15000}, async t=>{
  const clock=new FakeClock(), f=await fixture(t,clock);
  await writeFile(f.paths.knownHosts,'one ssh-ed25519 WRONG\n');
  await f.carrier.start();await eventually('first durable attempt completion log',()=>f.logs.length===1||undefined);
  for(const [index,delay] of [1000,2000,4000,8000,16000,30000].entries()){
    await clock.advance(delay-1);assert.equal(f.logs.length,index+1);
    await clock.advance(1);await eventually('next failed attempt completion',()=>f.logs.length===index+2||undefined);
  }
  const previous=f.logs.length;
  clock.block(90000);await clock.advance(1000);
  await eventually('wake jump completes immediate retry',()=>f.logs.length===previous+1||undefined);
  const count=f.logs.length; f.carrier.wake();
  await eventually('explicit wake before backoff deadline',()=>f.logs.length===count+1||undefined);
  await f.carrier.stop();assert.equal(clock.pending,0);
});
test('C6 injected clock probes agent.sock every 30 seconds', {timeout:15000}, async t=>{
  const clock=new FakeClock(),f=await fixture(t,clock);
  await f.carrier.start();
  await eventually('ready authenticated probe',async()=>{await clock.advance(100);return f.carrier.status().state==='up'||undefined;},10000);
  const before=f.carrier.status().lastProbe!.at;
  const due=Date.parse(f.carrier.status().since!)+30000;
  await clock.advance(due-clock.now().getTime()-1);assert.equal(f.carrier.status().lastProbe!.at,before);
  await clock.advance(1);
  await eventually('periodic authenticated probe receipt',()=>f.carrier.status().lastProbe?.at!==before&&f.carrier.status().lastProbe?.ok||undefined);
  assert.equal(Date.parse(f.carrier.status().lastProbe!.at),due);
});

import { spawn } from 'node:child_process';
import { sshArguments } from '../src/transport/ssh.ts';
import { ownProcess } from './process-cleanup.ts';
async function ownedCommand(t: import('node:test').TestContext, f: Awaited<ReturnType<typeof fixture>>, args: string[]) {
  const child=spawn(f.options.env.CLAND_SSH_BIN!,args,{env:fixtureEnvironment(f.root,process.env,f.options.env),cwd:f.root,detached:true,stdio:'ignore'});
  let receipt: {code:number|null;signal:NodeJS.Signals|null}|undefined;
  child.once('close',(code,signal)=>{receipt={code,signal};});
  const stop=ownProcess(undefined,child.pid);t.after(stop);
  const closed=()=>eventually('owned fake SSH native close',()=>receipt,5000);
  return {child,stop,closed};
}
test('C4 refused old-master exit fences unlink/start with backoff and concurrent carriers', {timeout:15000}, async t=>{
  const clock=new FakeClock(),f=await fixture(t,clock);
  const base=await sshArguments(f.options);
  const old=await ownedCommand(t,f,[...base,'-N','-M','-S',f.paths.controlSocket,'agent@one']);
  const oldReceipt=await eventually('independently owned master control receipt',async()=>readFile(join(f.host.directory,'master-control'),'utf8').catch(()=>undefined));
  process.kill(old.child.pid!,0);
  const inode=(await stat(f.paths.controlSocket)).ino;
  // The wrapper refuses exit while the old master continues answering on its socket.
  await writeFile(join(f.root,'refuse-exit'),'yes');
  const competitor=new SshTransport(f.options);
  const admissions=await Promise.allSettled([f.carrier.start(),competitor.start()]);
  assert.equal(admissions[0]!.status,'fulfilled');
  assert.equal(admissions[1]!.status,'rejected');
  if(admissions[1]!.status==='rejected')assert.match(String(admissions[1]!.reason),/already owned/);
  await f.carrier.start();
  await eventually('old-master cleanup decision',async()=>f.logs.length||((await f.argv()).filter(a=>a.includes('-N')).length>1)||undefined,3000);
  assert.equal((await stat(f.paths.controlSocket)).ino,inode);
  assert.equal((await f.argv()).filter(a=>a.includes('-N')).length,1);
  assert.match(f.carrier.status().reason??'',/control endpoint/);
  await clock.advance(999);assert.equal(f.logs.length,1);
  await clock.advance(1);await eventually('fenced retry completion',()=>f.logs.length===2||undefined);
  assert.equal((await stat(f.paths.controlSocket)).ino,inode);
  process.kill(old.child.pid!,0);old.child.kill('SIGKILL');await old.closed();
  await writeFile(join(f.root,'refuse-exit'),'no');
  f.carrier.wake();
  await eventually('replacement after positive old-owner absence',async()=>{await clock.advance(100);return f.carrier.status().state==='up'||undefined;},10000);
  assert.notEqual(JSON.parse(await readFile(join(f.host.directory,'master-control'),'utf8')).token,JSON.parse(oldReceipt).token);
  const next=await AgentClient.connect(f.paths.agentSocket,f.options.secrets.readSecret('one'));await next.close();
});
test('C7 private pin is exclusive despite matching global trust and supports spaces', {timeout:15000}, async t=>{
  const f=await fixture(t,undefined,true);
  await writeFile(f.paths.knownHosts,'one ssh-ed25519 WRONG\n');
  // Positive control: the fake models the global trust fallback that exposed this bug.
  const base=await sshArguments(f.options);
  const legacy=base.filter((arg,i)=>arg!=='-o'||!base[i+1]?.startsWith('GlobalKnownHostsFile=')).filter(arg=>!arg.startsWith('GlobalKnownHostsFile='));
  const control=await ownedCommand(t,f,[...legacy,'agent@one','true']);assert.equal((await control.closed()).code,0);
  await f.carrier.start();await eventually('exclusive pin admission decision',()=>f.logs.length||f.carrier.status().state==='up'||undefined,5000);await f.carrier.stop();
  assert.equal((await f.argv()).some(a=>a.includes('-N')),false);
  await assert.rejects(readFile(join(f.host.run,'secret')),{code:'ENOENT'});
  await writeFile(f.paths.knownHosts,`one ${f.host.key}\n`);
  await f.carrier.start();await eventually('private pin with spaces reaches authenticated readiness',()=>f.carrier.status().state==='up'||undefined,10000);
  assert.equal(f.carrier.status().lastProbe?.ok,true);
});
