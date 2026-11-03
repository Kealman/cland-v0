import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { hostDirectory } from '../../../shared/fake-host-directory.ts';
import { HostSecretStore, hostPaths } from './records.ts';
import type { HostRecords } from './records.ts';
import type { Host, HostLaunchLayout } from './host.ts';
import { remoteHostLayout, remoteCodeDirectory, remoteSupervisor } from './remote-layout.ts';
import { sshHost } from './ssh-host.ts';
import { SshTransport, type SshOptions } from '../transport/ssh.ts';
import { remoteDiscovery, publishRemoteDiscovery } from './discovery.ts';
import { AgentClient } from './agent-client.ts';
import { startGitDaemon, type GitDaemonOptions } from './git-daemon.ts';
import { territoryPath } from '../territory.ts';

type Carrier = Pick<SshTransport,'start'|'stop'|'status'|'forward'|'unforward'>;
export type HostConfiguration = { home?: string; layout?: Partial<HostLaunchLayout>; supervisor?: string };
/** Carrier and Host share one lifecycle owner; sessions close before this owner. */
export async function projectSshHosts(options: {createTransport?: (options:SshOptions)=>Carrier; gitDaemon?: (options:GitDaemonOptions)=>Promise<{close():Promise<void>}>; root:string; records:HostRecords; hubSocket:string; spokeSocket:string; env:NodeJS.ProcessEnv; configurations?: Readonly<Record<string,HostConfiguration>>; log:(entry:Record<string,unknown>)=>void; provided?:readonly Host[]}) {
  const hosts: Host[] = [], owners: Array<()=>Promise<void>> = [];
  const quiescers: Array<()=>void> = [];
  const close = async () => { const errors: unknown[]=[]; for (const cleanup of [...owners].reverse()) {try {await cleanup();} catch(error) {errors.push(error);}} if(errors.length) throw new AggregateError(errors,'SSH hosts cleanup failed'); };
  const secrets = new HostSecretStore(options.root,options.records);
  try {
    for (const record of options.records.list()) {
      if (record.state !== 'registered' || options.provided?.some(host=>host.name === record.id)) continue;
      const config = options.configurations?.[record.id];
      const fake = options.env.CLAND_FAKE_HOSTS?.split(',').includes(record.id) && options.env.CLAND_FAKE_HOST_ROOT;
      const home = config?.home ?? (fake ? join(hostDirectory(String(fake),record.id),'home') : record.user === 'root' ? '/root' : `/home/${record.user}`);
      const installed = fileURLToPath(new URL('../../..',import.meta.url));
      const layout = remoteHostLayout(home, { ...(fake ? {node:process.execPath,cli:join(installed,'hub/bin/cland.ts'),spoke:join(installed,'hub/bin/cland-spoke.ts')} : {}), ...config?.layout });
      const code = remoteCodeDirectory(layout);
      const carrier = (options.createTransport ?? (o=>new SshTransport(o)))({ beforeReady:async(signal)=>{
        const client = await AgentClient.connect(hostPaths(options.root,record.id).agentSocket,secrets.readSecret(record.id));
        try { await publishRemoteDiscovery(client,layout.discoveryFile,remoteDiscovery(layout.runDirectory,secrets.readSecret(record.id)),signal); } finally { await client.close(); }
      }, root:options.root,record,secrets,hubSocket:options.hubSocket,spokeSocket:options.spokeSocket,remoteRun:layout.runDirectory,supervisor:config?.supervisor ?? remoteSupervisor(layout),agentCommand:[layout.node,layout.cli,'host','serve'],env:options.env,log:message=>options.log({event:'host-tunnel',host:record.id,message}) });
      const host = sshHost({...(fake ? {} : {codeDirectory:code}),available:()=>options.records.get(record.id)?.state === 'registered',name:record.id,transport:carrier,layout,connect:()=>AgentClient.connect(hostPaths(options.root,record.id).agentSocket,secrets.readSecret(record.id))});
      quiescers.push(()=>host.quiesce());
      let daemon: {close():Promise<void>} | undefined;
      owners.push(async () => {
        const failures: unknown[] = [];
        for (const cleanup of [() => host.close(), () => carrier.stop(), () => daemon?.close()]) {
          try { await cleanup(); } catch (error) { failures.push(error); }
        }
        if (failures.length) throw new AggregateError(failures, `host ${record.id}: cleanup incomplete`);
      });
      daemon = await (options.gitDaemon ?? startGitDaemon)({host:record.id,socket:hostPaths(options.root,record.id).gitSocket,territory:territoryPath(options.root),env:options.env,log:options.log});
      await carrier.start(); hosts.push(host);
    }
    return {hosts,close,quiesce:()=>{for(const quiesce of quiescers)quiesce();}};
  } catch(error) {await close();throw error;}
}
