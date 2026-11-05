#!/usr/bin/env node
import { mkdir, readFile, writeFile, access, realpath, rm, open, rename } from 'node:fs/promises';
import { join, resolve, relative, isAbsolute } from 'node:path';
import { createServer, type Socket } from 'node:net';
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { hostDirectory } from '../../../shared/fake-host-directory.ts';
export { hostDirectory } from '../../../shared/fake-host-directory.ts';
import { fakeHostSocketPath } from './fake-host-socket.ts';
import { AgentClient } from '../../src/host/agent-client.ts';
import { cleanupOwnedProcesses, fixtureProcessCensus } from '../process-cleanup.ts';
import { observeProcesses } from '../../src/host/agent/native.ts';
import { controlRequest, hostOwner, sameOwner } from './fake-ssh-common.ts';
import type { MasterReceipt, Control } from './fake-ssh-common.ts';
export async function createFakeHost(root: string, name: string) {
  const directory = hostDirectory(root, name);
  const home = join(directory, 'home');
  fakeHostSocketPath(home);
  const run = join(home, '.cland-host/run');
  await mkdir(run, { recursive: true, mode: 0o700 });
  const key = `ssh-ed25519 ${Buffer.from(`fake-host:${name}`).toString('base64')}`;
  await writeFile(join(directory, 'host-key.pub'), key);
  await writeFile(join(directory, 'client-key'), 'FAKE CLIENT KEY\n', { mode: 0o600 });
  await writeFile(join(directory, 'boot-id'), randomUUID());
  const knownHosts = join(directory, 'known_hosts');
  await writeFile(knownHosts, `${name} ${key}\n`);
  return { directory, home, run, knownHosts, bootId: join(directory, 'boot-id'), key };
}
export async function fakeHost(env: NodeJS.ProcessEnv, name: string) {
  if (!env.CLAND_FAKE_HOSTS?.split(',').includes(name) || !env.CLAND_FAKE_HOST_ROOT) throw new Error('unreachable fake host');
  const directory = hostDirectory(env.CLAND_FAKE_HOST_ROOT, name);
  fakeHostSocketPath(join(directory, 'home'));
  await access(join(directory, 'host-key.pub'));
  try { await access(join(directory, 'gone')); } catch { return { directory, home: join(directory, 'home') }; }
  throw new Error('unreachable fake host');
}
export async function hostPath(home: string, path: string): Promise<string> {
  const root = await realpath(home);
  const input = path.replace(/^~\//, '');
  const candidate = isAbsolute(input) && contained(resolve(home), resolve(input))
    ? resolve(root, relative(resolve(home), resolve(input))) : resolve(root, input);
  // Resolve the nearest existing parent as well, so scp cannot follow an escaping symlink.
  let parent = candidate;
  while (true) {
    try { const actual = await realpath(parent); if (!contained(root, actual)) throw new Error('fake host path escapes home'); break; }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; const next = resolve(parent, '..'); if (next === parent) throw error; parent = next; }
  }
  if (!contained(root, candidate)) throw new Error('fake host path escapes home');
  // Keep the short lexical alias after canonical containment validation.
  return resolve(home, relative(root, candidate));
}
function contained(root: string, path: string) { const rel = relative(root, path); return rel !== '..' && !rel.startsWith('../') && !isAbsolute(rel); }
/** Fixture lifetime owner, started before native workers. A later CLI carries no
 * recovered signal authority; this live owner admits and joins its own cleanup. */
export async function serveFakeReboots(name: string, env: NodeJS.ProcessEnv, hooks: {
  beforePublish?: () => Promise<void>;
  beforeAdmission?: () => Promise<void>;
  reboot?: () => Promise<void>;
} = {}) {
  const host = await fakeHost(env, name);
  let owner = await hostOwner(host.directory), closing = false, work: Promise<void> | undefined;
  const token = randomUUID(), control = join(host.home, '.cland-host/reboot.sock');
  const record = join(host.directory, 'reboot-control');
  const sockets = new Set<Socket>(), admissions = new Set<Promise<void>>();
  const publish = async () => {
    await hooks.beforePublish?.();
    const staging = record+'.'+token+'.new';
    let file;
    try {
      file=await open(staging,'wx',0o600);
      await file.writeFile(JSON.stringify({control,owner,token}));await file.sync();
      await file.close();file=undefined;
      await rename(staging,record);
    } finally {await file?.close();await rm(staging,{force:true});}
  };
  const server = createServer({allowHalfOpen:true}, socket=>{
    if (closing) {socket.destroy();return;}
    sockets.add(socket);socket.once('close',()=>sockets.delete(socket));
    let line = '';
    socket.setTimeout(3000,()=>socket.destroy());
    socket.on('error',()=>{});
    socket.on('data',bytes=>{line+=bytes;if(line.length>65536)socket.destroy();});
    socket.on('end',()=>{
      if (closing) return;
      // Register the owner before its first await; socket close cannot retire it.
      const admission = Promise.resolve().then(async()=>{
        const request = JSON.parse(line) as Control;
        const admitted = owner;
        if (closing || request.operation !== 'reboot' || request.token !== token || !sameOwner(request.owner, admitted)) throw new Error('fake reboot owner mismatch');
        await hooks.beforeAdmission?.();
        const observed = await hostOwner(host.directory);
        if (closing || !sameOwner(admitted, observed) || owner !== admitted) throw new Error('fake reboot owner mismatch');
        socket.setTimeout(15000,()=>socket.destroy());
        work ??= (hooks.reboot ? hooks.reboot() : rebootOwnedHost(host)).then(async()=>{owner=await hostOwner(host.directory);await publish();}).finally(()=>{work=undefined;});
        await work;
      });
      admissions.add(admission);
      void admission.then(()=>{if(!socket.destroyed)socket.end('ok\n');},error=>{if(!socket.destroyed)socket.end((error as Error).message+'\n');}).finally(()=>admissions.delete(admission));
    });
  });
  let closeWork: Promise<void> | undefined;
  const close = (removeRecord: boolean) => closeWork ??= (async()=>{
    closing=true;
    const stopped = new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()));
    for(const socket of sockets)socket.destroy();
    // No end handler can enter after closing; admitted producers drain even if
    // their socket already disappeared or its timeout fired.
    await Promise.allSettled([...admissions]);
    await stopped;
    if(removeRecord)await rm(record);
  })();
  await new Promise<void>((resolve,reject)=>{server.once('error',reject);server.listen(control,resolve);});
  try {await publish();}
  catch(error) {
    try {await close(false);}
    catch(cleanup) {throw new AggregateError([error,cleanup], 'fake reboot controller setup cleanup incomplete');}
    throw error;
  }
  return {close:()=>close(true)};
}

async function rebootOwnedHost(host: {home:string;directory:string}) {
    // The fake owns this disposable machine. Snapshot live cwd/birth owners,
    // exclude its controller, and join them before removing volatile state.
    const owners = fixtureProcessCensus(host.home).filter(p => p.pid !== process.pid);
    if (!owners.length) throw new Error('fake reboot requires native host owners');
    const master = JSON.parse(await readFile(join(host.directory, 'master-control'), 'utf8')) as MasterReceipt;
    const owner = await hostOwner(host.directory);
    if (!sameOwner(master.owner, owner) || !master.token) throw new Error('fake reboot master owner mismatch');
    await writeFile(join(host.directory, 'gone'), 'rebooting');
    await controlRequest(master.control, {operation:'kill-master', forwards:[], owner, token:master.token});
    await cleanupOwnedProcesses(owners);
    const remaining = fixtureProcessCensus(host.home).filter(p => p.pid !== process.pid);
    if (remaining.length) throw new Error('fake reboot incomplete: host writers remain');
    await rm(join(host.home, '.cland-host/run'), {recursive:true, force:true});
    await writeFile(join(host.directory, 'boot-id'), randomUUID());
    await rm(join(host.directory, 'gone'));
    // The carrier can reconnect only after the new boot and cleared run are
    // durable. Tunnel loss alone never proves reboot.
 }

export async function hostControl(action: string, name: string, env = process.env) {
  const host = await fakeHost(env, name);
  if (action === 'reboot') {
    const record = JSON.parse(await readFile(join(host.directory, 'reboot-control'), 'utf8')) as MasterReceipt;
    const owner = await hostOwner(host.directory);
    if (!sameOwner(record.owner, owner) || !record.token) throw new Error('fake reboot owner mismatch');
    await controlRequest(record.control, {operation:'reboot', forwards:[], owner, token:record.token},15000);
    return;
  }
  if (action === 'kill-agent') {
    const record = JSON.parse(await readFile(join(host.home, '.cland-host/run/agent.pid'), 'utf8')) as { pid: number; identity: string };
    // Bind the receipt to the requested host's authenticated live endpoint.
    // Every fake has its own explicit boot id on Linux and macOS. The live
    // endpoint also binds the requested host; no signal op enters the agent protocol.
    if (!env.CLAND_HOST_SECRET) throw new Error('fake agent owner check requires CLAND_HOST_SECRET');
    const client = await AgentClient.connect(fakeHostSocketPath(host.home), env.CLAND_HOST_SECRET);
    try {
      if (client.hello.pid !== record.pid) throw new Error('fake agent owner mismatch; nothing signalled');
      const native = await observeProcesses([record.pid], { ...env, CLAND_HOST_BOOT_ID_FILE: join(host.directory, 'boot-id') });
      if (!Number.isSafeInteger(record.pid) || record.pid <= 1 || !record.identity || native.get(record.pid)?.identity !== record.identity) throw new Error('fake agent identity mismatch; nothing signalled');
      process.kill(record.pid, 'SIGKILL');
    } finally { await client.close(); }
    return;
  }
  if (action === 'gone') { await writeFile(join(host.directory, 'gone'), 'gone'); return; }
  if (action !== 'kill-master') throw new Error('usage: fake-host.ts create|kill-master|kill-agent|reboot|gone <host>');
  // Ask the live master to SIGKILL itself: never trust a persisted PID as signal authority.
  const record = JSON.parse(await readFile(join(host.directory, 'master-control'), 'utf8')) as MasterReceipt;
  const owner = await hostOwner(host.directory);
  if (!sameOwner(record.owner, owner) || !record.token) throw new Error('fake master owner mismatch');
  await controlRequest(record.control, { operation: 'kill-master', forwards: [], owner, token: record.token });
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const [action, name] = process.argv.slice(2);
    if (!name) throw new Error('usage: fake-host.ts create|kill-master|kill-agent|reboot|gone <host>');
    if (action === 'create') { if (!process.env.CLAND_FAKE_HOST_ROOT) throw new Error('missing fake root'); await createFakeHost(process.env.CLAND_FAKE_HOST_ROOT, name); }
    else await hostControl(action ?? '', name);
  } catch (error) { console.error((error as Error).message); process.exitCode = 1; }
}
