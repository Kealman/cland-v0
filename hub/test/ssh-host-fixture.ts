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
import { ownDirectory, cleanupOwnedProcesses, fixtureProcessCensus } from './process-cleanup.ts';
import { eventually } from './harness.ts';
import type { Socket } from 'node:net';
import type { TestContext } from 'node:test';
import assert from 'node:assert/strict';
export async function sshHostFixture(t: TestContext, options: {startTransport?: boolean; env?:NodeJS.ProcessEnv; processHooks?:import('../src/host/agent/processes.ts').ProcessHooks} = {}) {
  const root = join(realpathSync('/tmp'), 'cland-suite-' + randomUUID()); await mkdir(root,{mode:0o700});
  const previous = process.cwd(); process.chdir(root);
  const cleanup = ownDirectory(undefined,root);
  const db = new DatabaseSync(':memory:');
  const additional: Array<()=>Promise<void>> = [];
  let runConnection:Socket|undefined,runToken='',runGate:Promise<void>|undefined,releaseRun:(()=>void)|undefined,cancelEntered=false;
  let failLogClose=false,dropCommitReply=false,dropReleaseReply=false,dropForgetReply=false,dropRunReply=false,holdSettlement=false,settlementAttempts=0;const cleanupErrors:unknown[]=[];const diagnostics: Record<string,unknown>[]=[];
  const faults={diagnostics,failLogClose:(_path:string)=>{failLogClose=true;return async()=>{failLogClose=false;};}};
  let agent: Awaited<ReturnType<typeof serveAgent>> | undefined;
  let transport: SshTransport | undefined;
  let host: ReturnType<typeof sshHost> | undefined;
  t.after(async () => {
    const failures:unknown[]=[];
    const attempt=async(work:()=>unknown)=>{try{await work();}catch(error){failures.push(error);}};
    holdSettlement=false;releaseRun?.();host?.quiesce();
    for(const close of [...additional].reverse()) await attempt(close);
    await attempt(()=>host?.close());await attempt(()=>transport?.stop());await attempt(()=>agent?.close());
    let joined=false;
    await attempt(async()=>{await cleanupOwnedProcesses(fixtureProcessCensus(root));assert.deepEqual(fixtureProcessCensus(root).filter(p=>p.pid!==process.pid),[],'no fixture writer or cland host serve outlives file');joined=true;});
    if(joined) {
      const paths=hostPaths(root,'f1');
      await attempt(async()=>{for(const path of [paths.agentSocket,paths.gitSocket,paths.controlSocket])await unlink(path).catch(error=>{if(error.code!=='ENOENT')throw error;});});
      if(!paths.socketDirectory.startsWith(root+'/'))await attempt(()=>rmdir(paths.socketDirectory).catch(error=>{if(error.code!=='ENOENT')throw error;}));
      await attempt(()=>db.close());
    }
    process.chdir(previous);if(joined)await attempt(cleanup);
    if(failures.length)throw new AggregateError(failures,'SSH fixture cleanup incomplete');
  });
  const fake = await createFakeHost(root,'f1');
  const env = fixtureEnvironment(root,process.env,{ CLAND_FAKE_HOSTS:'f1',CLAND_FAKE_HOST_ROOT:root,CLAND_SSH_BIN:new URL('./fakes/fake-ssh.ts',import.meta.url).pathname,CLAND_HOST_BOOT_ID_FILE:fake.bootId,...options.env });
  const records = new HostRecords(db), secrets = new HostSecretStore(root,records);
  const record = secrets.register({id:'f1',address:'f1',user:'agent',clientKeyPath:join(fake.directory,'client-key'),knownHosts:`f1 ${fake.key}\n`});
  agent = await serveAgent({runDir:fake.run,secret:secrets.readSecret('f1'),version:'test',env,runStarted:(token,connection)=>{runToken=token;runConnection=connection;},beforeRunCancel:async()=>{if(runGate){cancelEntered=true;await runGate;}},cleanupError:error=>cleanupErrors.push(error),afterOperation:(op,connection)=>{if(op==='settle-prepared'&&holdSettlement){settlementAttempts++;connection.destroy();}if(op==='forget-claude'&&dropForgetReply){dropForgetReply=false;connection.destroy();}if(op==='remove-claude'&&dropReleaseReply){dropReleaseReply=false;connection.destroy();}if(op==='run-host'&&dropRunReply){dropRunReply=false;connection.destroy();}if(op==='commit-prepared'&&dropCommitReply){dropCommitReply=false;connection.destroy();}},processHooks:{...options.processHooks,closeLog:async close=>{await close();if(failLogClose)throw new Error('synthetic descriptor close failure');}}});
  await writeFile(join(fake.directory,'ports.json'),JSON.stringify({'12345':join(fake.home,'session.sock')}));
  const supervisor = join(root,'supervisor'); await writeFile(supervisor,'#!/bin/sh\n[ "$1" = --check ]\n',{mode:0o700});
  transport = new SshTransport({root,record,secrets,hubSocket:fixtureSocketPath(root,'hub'),spokeSocket:fixtureSocketPath(root,'spoke'),remoteRun:fake.run,supervisor,agentCommand:['stub'],env});
  if (options.startTransport !== false) {
    await transport.start(); await eventually('fake tunnel up',()=>transport!.status().state === 'up' || undefined,10000);
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
  return {root,env,fake,host,transport,layout,faults,cleanupErrors,holdRunCancellation:()=>{cancelEntered=false;runGate=new Promise<void>(resolve=>{releaseRun=resolve;});return {entered:()=>cancelEntered,token:()=>runToken,disconnect:()=>runConnection?.destroy(),release:()=>{releaseRun?.();runGate=undefined;}};},dropNextForgetReply:()=>{dropForgetReply=true;},dropNextReleaseReply:()=>{dropReleaseReply=true;},dropNextCommitReply:()=>{dropCommitReply=true;},dropNextRunReply:()=>{dropRunReply=true;},holdSettlementReplies:()=>{holdSettlement=true;return {attempts:()=>settlementAttempts,release:()=>{holdSettlement=false;}};}, records, secrets, agent, supervisor, addCleanup:(close:()=>Promise<void>)=>additional.push(close), paths:hostPaths(root,'f1')};
}
