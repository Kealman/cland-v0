import { mkdir, symlink, readlink, unlink, realpath, readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fakeLoginMount } from './fake-login-mount.ts';
import { loginDiskError } from './login-disk.ts';
import type { LoginDisk } from './resource-types.ts';

import type { AgentProcesses } from './processes.ts';
import { run } from './command.ts';

async function usesDisk(pid: number, disk: string, env: NodeJS.ProcessEnv): Promise<boolean> {
  let paths: string[];
  if(process.platform==='linux') {
    try {
      paths=[await readlink(`/proc/${pid}/cwd`)];
      for(const fd of await readdir(`/proc/${pid}/fd`)) {
        try { paths.push(await readlink(`/proc/${pid}/fd/${fd}`)); }
        catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
      }
    } catch { throw loginDiskError('writers-remain'); }
  } else {
    const result=await run('lsof',['-a','-p',String(pid),'-Fn'],env);
    if(result.code!==0||result.error||!result.stdout.includes(`p${pid}\n`))throw loginDiskError('writers-remain');
    paths=result.stdout.split('\n').filter(line=>line.startsWith('n')).map(line=>line.slice(1));
  }
  return paths.some(path=>path===disk||path.startsWith(disk+'/'));
}
async function drain(processes: AgentProcesses, disk: string, env: NodeJS.ProcessEnv) {
  if(!await processes.drainDiskUsers(pid=>usesDisk(pid,disk,env)).catch(()=>false))throw loginDiskError('writers-remain');
}

/** Only a configured fake host can map a login path onto directory-backed volumes. */
export async function fakeLoginDisk(input: LoginDisk, env: NodeJS.ProcessEnv, processes: AgentProcesses) {
  const {path,contents,target}=await fakeLoginMount(input,env);
  if (input.op === 'mount') {
    await mkdir(dirname(path),{recursive:true,mode:0o700});
    for (const entry of await readdir(dirname(path),{withFileTypes:true})) {
      const other=join(dirname(path),entry.name);
      if(other===path || !entry.isSymbolicLink())continue;
      if(await readlink(other)!==contents.directory)continue;
      await drain(processes,await realpath(contents.directory),env);
      await unlink(other);
    }
    if(target)return null;
    await symlink(contents.directory,path);
  } else {
    if (!target) throw loginDiskError('wrong-volume');
    if(input.op==='umount') {await drain(processes,await realpath(contents.directory),env);await unlink(path);}
    // Directory fixtures have no filesystem freeze primitive.
  }
  return null;
}
