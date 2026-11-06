import { updateHostWatches } from '../transport/transport.ts';
import { terminalAttachCommand } from './attach.ts';
import { VERSION } from '../version.ts';
import { agentVersionHandoff } from './code-delivery.ts';
import { ensureHostClone, hostCloneRoot } from './clone.ts';
import { randomUUID } from 'node:crypto';
import { rm } from 'node:fs/promises';
import { hasTerritory, territoryGitAsync } from '../territory.ts';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { hostDirectory } from '../../../shared/fake-host-directory.ts';
import { HostSecretStore, hostPaths } from './records.ts';
import type { HostRecords, HostRecord } from './records.ts';
import type { Host, HostLaunchLayout } from './host.ts';
import { remoteHostLayout, remoteCodeDirectory, remoteSupervisor } from './remote-layout.ts';
import { sshHost } from './ssh-host.ts';
import { SshTransport, type SshOptions } from '../transport/ssh.ts';
import { remoteDiscovery, publishRemoteDiscovery } from './discovery.ts';
import { AgentClient, restoreAdoptedWorkers } from './agent-client.ts';
import { startGitDaemon, type GitDaemonOptions } from './git-daemon.ts';
import { territoryPath } from '../territory.ts';

type Carrier = Pick<SshTransport,'start'|'stop'|'status'|'forward'|'unforward'> & Partial<Pick<SshTransport,'copyFile'|'execute'>>;
export type HostConfiguration = { home?: string; layout?: Partial<HostLaunchLayout>; supervisor?: string };
/** Carrier and Host share one lifecycle owner; sessions close before this owner. */
export async function projectSshHosts(options: { onAdd?: (host: Host) => void; settle?: (id: string) => Promise<unknown>; onRemove?: (id: string) => void; onReady?: (host: string, bootId: string) => void; createTransport?: (options:SshOptions)=>Carrier; gitDaemon?: (options:GitDaemonOptions)=>Promise<{close():Promise<void>}>; root:string; records:HostRecords; hubSocket:string; spokeSocket:string; env:NodeJS.ProcessEnv; configurations?: Readonly<Record<string,HostConfiguration>>; log:(entry:Record<string,unknown>)=>void; provided?:readonly Host[]}) {
  const hosts: Host[] = [];
  const owners = new Map<string, {quiesce: () => void; close: () => Promise<void>}>();
  let stopped = false, pending = Promise.resolve();
  const serial = <T>(work: () => Promise<T>): Promise<T> => {
    const result = pending.then(work); pending = result.then(() => {}, () => {}); return result;
  };
  const closeOwners = async () => { const errors: unknown[]=[]; for (const owner of [...owners.values()].reverse()) {try {await owner.close();} catch(error) {errors.push(error);}} if(errors.length) throw new AggregateError(errors,'SSH hosts cleanup failed'); };
  const quiesce = () => { stopped = true; for (const owner of owners.values()) owner.quiesce(); };
  const close = () => { quiesce(); return serial(closeOwners); };
  const secrets = new HostSecretStore(options.root,options.records);
  const open = async (record: HostRecord) => {
      if (stopped) throw new Error('SSH hosts owner stopped');
      const persisted = options.records.get(record.id);
      if (record.state !== 'registered' || !persisted || (Object.keys(persisted) as Array<keyof HostRecord>).some(key => persisted[key] !== record[key])) throw new Error('host registration changed');
      if (owners.has(record.id) || options.provided?.some(host=>host.name === record.id)) throw new Error('host already open');
      const config = options.configurations?.[record.id];
      const fake = options.env.CLAND_FAKE_HOSTS?.split(',').includes(record.id) && options.env.CLAND_FAKE_HOST_ROOT;
      const home = config?.home ?? (fake ? join(hostDirectory(String(fake),record.id),'home') : record.user === 'root' ? '/root' : `/home/${record.user}`);
      const installed = fileURLToPath(new URL('../../..',import.meta.url));
      const layout = remoteHostLayout(home, { ...(fake ? {modDir:join(installed,'hub/mod/cland'),node:process.execPath,cli:join(installed,'hub/bin/cland.ts'),spoke:join(installed,'hub/bin/cland-spoke.ts')} : {}), ...config?.layout });
      const code = remoteCodeDirectory(layout);
      const carrier = (options.createTransport ?? (o=>new SshTransport(o)))({ beforeReady:async(signal)=>{
        const client = await AgentClient.connect(hostPaths(options.root,record.id).agentSocket,secrets.readSecret(record.id));
        try {
          await publishRemoteDiscovery(client,layout.discoveryFile,remoteDiscovery(layout.runDirectory,secrets.readSecret(record.id)),signal);
        } finally { await client.close(); }
      }, root:options.root,record,secrets,hubSocket:options.hubSocket,spokeSocket:options.spokeSocket,remoteRun:layout.runDirectory,supervisor:config?.supervisor ?? remoteSupervisor(layout),agentCommand:[layout.node,layout.cli,'host','serve'],agentNode:layout.node,env:options.env,log:message=>options.log({event:'host-tunnel',host:record.id,message}) });
      const handoff=agentVersionHandoff({transport:carrier,codeRoot:join(layout.runDirectory,'..','code'),node:layout.node,version:VERSION});
      const host = sshHost({ watchStatus:rows=>updateHostWatches(options.root,record.id,rows), onTable:(_rows,bootId)=>options.onReady?.(record.id,bootId), ...(fake ? {} : {expectedVersion:VERSION}), agentReady:handoff.ready,updateAgent:handoff.update,restoreAdoptedWorkers:client=>restoreAdoptedWorkers(client,outcome=>{try{options.log({event:'host-claude-restore',host:record.id,state:outcome?(outcome.incomplete.length?'incomplete':'complete'):'unknown',incomplete:outcome?.incomplete??null});}catch{/* Diagnostics do not discard restored ownership. */}}),...(fake ? {} : {codeDirectory:code}),terminalAttachCommand: name => {
        if (options.records.get(record.id)?.state !== 'registered') throw new Error('host is revoked');
        return terminalAttachCommand(options.root, record, layout, name);
      },available:()=>options.records.get(record.id)?.state === 'registered',name:record.id,transport:carrier,layout,connect:()=>AgentClient.connect(hostPaths(options.root,record.id).agentSocket,secrets.readSecret(record.id))});
      // The carrier owns connectivity; task preparation owns the clone separately.
      const cloneAbort=new AbortController();let clone:Promise<void>|undefined;
      const prepareClone=async()=>{
        if(!await hasTerritory(options.root,options.env))return;
        clone ??= (async()=>{
          options.log({event:'host-clone',host:record.id,state:'cloning'});
          await ensureHostClone({host,root:hostCloneRoot(layout.runDirectory,options.root),layout,signal:cloneAbort.signal,bundle:async destination=>{
            const source=join(options.root,'.cland/run',`host-clone-${randomUUID()}.bundle`);
            try {await territoryGitAsync(territoryPath(options.root),['bundle','create',source,'--branches','HEAD'],false,undefined,options.env);if(!carrier.copyFile)throw new Error('host bundle copy unavailable');await carrier.copyFile(source,destination);}
            finally {await rm(source,{force:true});}
          }});
          options.log({event:'host-clone',host:record.id,state:'ready'});
        })().catch(error=>{clone=undefined;options.log({event:'host-clone',host:record.id,state:'failed',error:String(error)});throw new Error(`host ${record.id}: territory clone failed: ${error instanceof Error?error.message:String(error)}`);});
        await clone;
      };
      const add=host.worktreeAdd.bind(host),preparations=new Set<Promise<{warning?:string}>>();
      host.worktreeAdd=args=>{
        const work=(async()=>{cloneAbort.signal.throwIfAborted();await prepareClone();cloneAbort.signal.throwIfAborted();return add(args);})();
        preparations.add(work);void work.then(()=>preparations.delete(work),()=>preparations.delete(work));return work;
      };
      const quiesce=()=>{cloneAbort.abort();host.quiesce();};

      let daemon: {close():Promise<void>} | undefined;
      owners.set(record.id, {quiesce, close: async () => {
        const failures: unknown[] = [];
        for (const cleanup of [async()=>{quiesce();await Promise.allSettled([...preparations]);await clone?.catch(()=>{});}, () => host.close(), () => carrier.stop(), () => daemon?.close()]) {
          try { await cleanup(); } catch (error) { failures.push(error); }
        }
        if (failures.length) throw new AggregateError(failures, `host ${record.id}: cleanup incomplete`);
      }});
      daemon = await (options.gitDaemon ?? startGitDaemon)({host:record.id,socket:hostPaths(options.root,record.id).gitSocket,territory:territoryPath(options.root),env:options.env,log:options.log});
      await carrier.start();
      if (stopped || options.records.get(record.id)?.state !== 'registered') throw new Error('host registration changed while opening');
      options.onAdd?.(host);
      hosts.push(host);
      return host;
  };
  /** The record and private bootstrap material must already be persisted. */
  const add = (record: HostRecord) => serial(async () => {
    try { return await open(record); }
    catch (error) {
      // A duplicate must not close an already published owner.
      if (!hosts.some(host => host.name === record.id)) {
        await owners.get(record.id)?.close(); owners.delete(record.id);
      }
      throw error;
    }
  });
  /** Settle and cut authority through the daemon's existing host.revoke path first. */
  const remove = (id: string) => serial(async () => {
    if (stopped) throw new Error('SSH hosts owner stopped');
    if (!options.settle) throw new Error('host settlement unavailable');
    const settlement = await options.settle(id);
    await owners.get(id)?.close();
    options.onRemove?.(id);
    owners.delete(id);
    const index = hosts.findIndex(host => host.name === id); if (index >= 0) hosts.splice(index, 1);
    return settlement;
  });
  try {
    for (const record of options.records.list()) {
      if (record.state === 'registered' && !options.provided?.some(host => host.name === record.id)) await add(record);
    }
    return {hosts,add,remove,close,quiesce};
  } catch(error) {await close();throw error;}
}
