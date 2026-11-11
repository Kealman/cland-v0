import { lstat } from 'node:fs/promises';
import { run, nativeCommandIncomplete } from './command.ts';
import type { LoginDisk } from './resource-types.ts';
import type { AgentProcesses } from './processes.ts';

export const loginDiskError = (code: 'bad-argument' | 'busy' | 'writers-remain' | 'wrong-volume') => Object.assign(new Error(`login-disk: ${code}`), {code});
/** Match the privileged helper grammar before invoking any command. */
export function parseLoginDisk(args: Record<string, unknown>): LoginDisk {
  if (typeof args.op !== 'string' || !['mount','umount','freeze','thaw'].includes(args.op) || typeof args.volume !== 'string' || !/^[a-z][a-z0-9-]{0,63}$(?![\s\S])/.test(args.volume) || typeof args.path !== 'string' || !/^\/cland\/auth\/[a-z][a-z0-9]*-[a-z0-9][a-z0-9-]*$(?![\s\S])/.test(args.path)) throw loginDiskError('bad-argument');
  return args as LoginDisk;
}
export async function rejectLoginSymlinks(path: string, allowLeaf = false): Promise<void> {
  const parts = path.split('/').filter(Boolean);
  let current = '';
  for (const [index, part] of parts.entries()) {
    current += '/' + part;
    try { if ((await lstat(current)).isSymbolicLink() && !(allowLeaf && index === parts.length - 1)) throw loginDiskError('bad-argument'); }
    catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e; }
  }
}
export function loginDiskOperation(env: NodeJS.ProcessEnv, processes: AgentProcesses,
  runOwned: (input:LoginDisk,work:()=>Promise<import('../host.ts').HostRunResult>)=>Promise<import('../host.ts').HostRunResult>,
  assertMutable:()=>void, runHelper:typeof run=run) {
  let busy = false;
  let incomplete=false;
  const failed=Promise.withResolvers<never>();void failed.promise.catch(()=>{});
  const mutations=new Set<Promise<void>>();
  const enterMutation=(cleanup=false)=>{
    if(incomplete&&!cleanup)throw loginDiskError('writers-remain');
    if(busy)throw Object.assign(new Error('login-disk owns writer admission'),{code:'CLAND_AGENT_ADMISSION_REFUSED'});
    if(!cleanup)assertMutable();
    const admission=Promise.withResolvers<void>();mutations.add(admission.promise);
    return Object.assign(()=>{mutations.delete(admission.promise);admission.resolve();},{incomplete(){incomplete=true;failed.reject(loginDiskError('writers-remain'));}});
  };
  const operation=async (args: Record<string,unknown>) => {
    const input = parseLoginDisk(args);
    if(incomplete)throw loginDiskError('writers-remain');
    await rejectLoginSymlinks(input.path);
    if (busy) throw loginDiskError('busy');
    busy = true;
    try {
      await Promise.race([Promise.all([...mutations]),failed.promise]);
      assertMutable();
      if (env.CLAND_FAKE_HOSTS && env.CLAND_FAKE_HOST_ROOT) return await (await import('./fake-login-disk.ts')).fakeLoginDisk(input,env,processes);
      const result = await runOwned(input,()=>runHelper('sudo', ['-n','/usr/local/sbin/cland-auth',input.op,input.volume,input.path], env, 60_000));
      if(nativeCommandIncomplete(result))throw Object.assign(new Error(result.error),{code:'CLAND_NATIVE_INCOMPLETE'});
      if (result.code !== 0 || result.error) throw loginDiskError(result.code === 2 ? 'bad-argument' : result.code === 5 ? 'busy' : result.code === 4 || result.code === 6 || result.error ? 'writers-remain' : 'wrong-volume');
      return null;
    } finally { busy = false; }
  };
  return Object.assign(operation,{enterMutation});
}
