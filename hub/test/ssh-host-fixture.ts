import { mkdir, writeFile, unlink, rmdir, readFile, rename } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { realpathSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { serveAgent } from '../src/host/agent/server.ts';
import { sshHost } from '../src/host/ssh-host.ts';
import { AgentClient } from '../src/host/agent-client.ts';
import { HostRecords, HostSecretStore, hostPaths } from '../src/host/records.ts';
import { SshTransport } from '../src/transport/ssh.ts';
import { createFakeHost } from './fakes/fake-host.ts';
import { fixtureEnvironment } from './fixture-environment.ts';
import { fixtureSocketPath } from '../../test-support/socket-path.ts';
import { enableFixtureHostSockets } from '../../shared/fixture-sockets.ts';
import { fixtureWork } from '../../test-support/fixture-work.ts';
import { ownDirectory, cleanupOwnedProcesses, fixtureProcessCensus } from './process-cleanup.ts';
import { eventually } from './harness.ts';
import type { Socket } from 'node:net';
import assert from 'node:assert/strict';
import {FakeHostProvider} from '../src/host/provider/fake.ts';
import {hostDirectory} from '../../shared/fake-host-directory.ts';
import {territoryGitAsync} from '../src/territory.ts';
import type {Machine} from '../src/host/provider/provider.ts';
import { fixtureResource, type FixtureLifecycle } from './fixture-lifecycle.ts';
export async function sshHostFixture(t: { after(cleanup: () => Promise<void>): void }, options: {lifecycle?:FixtureLifecycle;provider?:{root?:string;project?:string;region:string};afterRepositoryInit?:(root:string,signal:AbortSignal)=>Promise<void>;afterNativeJoin?:()=>Promise<void>;memoryIntervalMs?:number;beforeRun?:(signal:AbortSignal)=>Promise<void>;afterOperation?:(operation:string,connection:Socket)=>void;startTransport?: boolean; env?:NodeJS.ProcessEnv; processHooks?:import('../src/host/agent/processes.ts').ProcessHooks} = {}) {
  let closeResources: () => Promise<void> = async () => {};
  const close = fixtureResource(options.lifecycle, () => closeResources());
  const root = join(realpathSync('/tmp'), 'cland-suite-' + randomUUID()); await mkdir(root,{mode:0o700});
  const previous = process.cwd(); process.chdir(root);
  const cleanup = ownDirectory(undefined,root);
  options.lifecycle?.adoptRoot(root, cleanup);
  const work = fixtureWork();
  let db: DatabaseSync;
  let dbClosed = false;
  const additional: Array<()=>Promise<void>> = [];
  let runConnection:Socket|undefined,runToken='',runGate:Promise<void>|undefined,releaseRun:(()=>void)|undefined,cancelEntered=false;
  let failLogClose=false,dropCommitReply=false,dropReleaseReply=false,dropForgetReply=false,dropRunReply=false,holdSettlement=false,settlementAttempts=0;const cleanupErrors:unknown[]=[];const diagnostics: Record<string,unknown>[]=[];
  const faults={diagnostics,failLogClose:(_path:string)=>{failLogClose=true;return async()=>{failLogClose=false;};}};
  let agent: Awaited<ReturnType<typeof serveAgent>> | undefined;
  let transport: SshTransport | undefined;
  let host: ReturnType<typeof sshHost> | undefined;
  let machine:Machine|undefined;
  let machineDirectory:string|undefined;
  closeResources = async () => {
    // Fence synchronously, then join entire admitted JS sequences. If this
    // bound misses, keep the root/DB/native ownership for later recovery.
    try { await work.close(); } catch (error) { process.chdir(previous); throw error; }
    const failures:unknown[]=[];
    const attempt=async(work:()=>unknown)=>{try{await work();}catch(error){failures.push(error);}};
    holdSettlement=false;releaseRun?.();host?.quiesce();
    for(const close of [...additional].reverse()) await attempt(close);
    await attempt(()=>host?.close());await attempt(()=>transport?.stop());await attempt(()=>agent?.close());
    const census=()=>[...new Map([...fixtureProcessCensus(root),...(machineDirectory?fixtureProcessCensus(machineDirectory):[])].map(row=>[row.pid,row])).values()];
    let joined=false;
    await attempt(async()=>{await cleanupOwnedProcesses(census());assert.deepEqual(census().filter(p=>p.pid!==process.pid),[],'no captured fixture or provider machine writer outlives file');joined=!options.provider||failures.length===0;});
    if(joined) {
      if(options.afterNativeJoin){const before=failures.length;await attempt(options.afterNativeJoin);if(failures.length!==before)joined=false;}
      const paths=hostPaths(root,'f1');
      await attempt(async()=>{for(const path of [paths.agentSocket,paths.gitSocket,paths.controlSocket])await unlink(path).catch(error=>{if(error.code!=='ENOENT')throw error;});});
      if(!paths.socketDirectory.startsWith(root+'/'))await attempt(()=>rmdir(paths.socketDirectory).catch(error=>{if(error.code!=='ENOENT')throw error;}));
      await attempt(()=>{if(!dbClosed){db?.close();dbClosed=true;}});
    }
    process.chdir(previous);if(joined&&!options.lifecycle)await attempt(cleanup);
    if(failures.length)throw new AggregateError(failures,'SSH fixture cleanup incomplete');
  };
  t.after(options.lifecycle ? cleanup : close);
  db = new DatabaseSync(':memory:');
  // The raw root is a disposable repository before socket enrollment. Callers
  // may reinitialize or add/clone it later; local excludes survive git init and
  // prevent alias records from becoming non-private copies in those checkouts.
  return work.run(async (step,signal) => {
  await step(()=>territoryGitAsync(root,['init','--initial-branch=dev'],false,undefined,fixtureEnvironment(root,process.env)));
  if(options.afterRepositoryInit)await step(()=>options.afterRepositoryInit!(root,signal));
  await step(()=>writeFile(join(root,'.git/info/exclude'),'/.fixture-sockets/\n'));
  signal.throwIfAborted();
  enableFixtureHostSockets(root);
  const providerRoot=options.provider?.root??root;
  let fake:Awaited<ReturnType<typeof createFakeHost>>;
  if(options.provider){
    const provider=new FakeHostProvider({env:fixtureEnvironment(root,process.env,{CLAND_FAKE_HOST_ROOT:providerRoot})});
    const acquired=await step(()=>provider.acquire({project:options.provider!.project??root,pool:'agents',region:options.provider!.region,architecture:'x86_64'}));
    if(acquired.state!=='created')throw Error('SSH fixture provider acquisition failed');machine=acquired.machine;
    const directory=hostDirectory(providerRoot,machine.id),home=join(directory,'home');machineDirectory=directory;
    fake={directory,home,run:join(home,'.cland-host/run'),knownHosts:join(directory,'known_hosts'),bootId:join(directory,'boot-id'),key:(await readFile(join(directory,'host-key.pub'),'utf8')).trim()};
  }else fake=await step(()=>createFakeHost(root,'f1'));
  const address=machine?.address??'f1';
  signal.throwIfAborted();
  const env = fixtureEnvironment(root,process.env,{ CLAND_FAKE_HOSTS:address,CLAND_FAKE_HOST_ROOT:providerRoot,CLAND_SSH_BIN:new URL('./fakes/fake-ssh.ts',import.meta.url).pathname,CLAND_HOST_BOOT_ID_FILE:fake.bootId,...options.env });
  const records = new HostRecords(db), secrets = new HostSecretStore(root,records);
  const record = secrets.register({id:'f1',address,user:'agent',clientKeyPath:join(fake.directory,'client-key'),knownHosts:`${address} ${fake.key}\n`});
  agent = await serveAgent({runDir:fake.run,secret:secrets.readSecret('f1'),version:'test',env,...(options.memoryIntervalMs===undefined?{}:{memoryIntervalMs:options.memoryIntervalMs}),runStarted:(token,connection,signal)=>{runToken=token;runConnection=connection;return options.beforeRun?.(signal);},beforeRunCancel:async()=>{if(runGate){cancelEntered=true;await runGate;}},cleanupError:error=>cleanupErrors.push(error),afterOperation:(op,connection)=>{if(op==='settle-prepared'&&holdSettlement){settlementAttempts++;connection.destroy();}if(op==='forget-claude'&&dropForgetReply){dropForgetReply=false;connection.destroy();}if(op==='remove-claude'&&dropReleaseReply){dropReleaseReply=false;connection.destroy();}if(op==='run-host'&&dropRunReply){dropRunReply=false;connection.destroy();}if(op==='commit-prepared'&&dropCommitReply){dropCommitReply=false;connection.destroy();}options.afterOperation?.(op,connection);},processHooks:{...options.processHooks,closeLog:async close=>{await close();if(failLogClose)throw new Error('synthetic descriptor close failure');}}});
  await step(()=>writeFile(join(fake.directory,'ports.json'),JSON.stringify({'12345':join(fake.home,'session.sock')})));
  const supervisor = join(root,'supervisor'); await step(()=>writeFile(supervisor,'#!/bin/sh\n[ "$1" = --check ]\n',{mode:0o700}));
  transport = new SshTransport({root,record,secrets,hubSocket:fixtureSocketPath(root,'hub'),spokeSocket:fixtureSocketPath(root,'spoke'),remoteRun:fake.run,supervisor,agentCommand:['stub'],env});
  if (options.startTransport !== false) {
    await step(()=>transport!.start()); await step(()=>eventually('fake tunnel up',()=>transport!.status().state === 'up' || undefined,10000));
  }
  for(const path of [fixtureSocketPath(root,'hub'),fixtureSocketPath(root,'spoke'),...['agent','hub','spoke','git'].map(name=>join(fake.run,name+'.sock')),hostPaths(root,'f1').agentSocket,hostPaths(root,'f1').gitSocket,hostPaths(root,'f1').controlSocket,hostPaths(root,'f1').sessionSocket('session-id')]) assert.ok(Buffer.byteLength(path)+1<=104,path);
  const layout = Object.freeze({discoveryFile:join(fake.home,'hub.json'),node:process.execPath,cli:'/remote/cland.ts',spoke:'/remote/spoke.ts',runDirectory:fake.run,logDirectory:join(fake.home,'log')});
  host = sshHost({log:entry=>diagnostics.push(entry),name:'f1',transport,layout,connect:()=>AgentClient.connect(hostPaths(root,'f1').agentSocket,secrets.readSecret('f1'))});
  const freePort = host.freePort.bind(host);
  let portWrites = Promise.resolve();
  additional.push(() => portWrites);
  host.freePort = async () => {
    const port = await freePort();
    const write = portWrites.then(async () => {
      const path = join(fake.directory, 'ports.json');
      const routes = JSON.parse(await readFile(path, 'utf8'));
      routes[port] = join(fake.home, 'session.sock');
      await writeFile(path + '.next', JSON.stringify(routes));
      await rename(path + '.next', path);
    });
    portWrites = write;
    await write;
    return port;
  };
  return {root,env,fake,host,transport,layout,faults,cleanupErrors,machine,runOwned:work.run,holdRunCancellation:()=>{cancelEntered=false;runGate=new Promise<void>(resolve=>{releaseRun=resolve;});return {entered:()=>cancelEntered,token:()=>runToken,disconnect:()=>runConnection?.destroy(),release:()=>{releaseRun?.();runGate=undefined;}};},dropNextForgetReply:()=>{dropForgetReply=true;},dropNextReleaseReply:()=>{dropReleaseReply=true;},dropNextCommitReply:()=>{dropCommitReply=true;},dropNextRunReply:()=>{dropRunReply=true;},holdSettlementReplies:()=>{holdSettlement=true;return {attempts:()=>settlementAttempts,release:()=>{holdSettlement=false;}};}, records, secrets, agent, supervisor, addCleanup:(close:()=>Promise<void>)=>additional.push(close), paths:hostPaths(root,'f1')};
  });
}
