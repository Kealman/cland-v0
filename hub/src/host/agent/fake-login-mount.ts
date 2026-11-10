import { readFile, readlink, realpath } from "node:fs/promises";
import { dirname, join, basename } from "node:path";
import { fakeVolumeContents, listFakeVolumes, fakeVolumeContentsDirectory } from "./fake-volume-contents.ts";
import { fakeMachineStorageDirectory, fakeLoginMountPath } from "./fake-layout.ts";
import { realClock } from "./clock.ts";
import { loginDiskError, rejectLoginSymlinks } from "./login-disk.ts";
import type { LoginDisk, Machine } from "./resource-types.ts";

export async function fakeLoginMount(input: Pick<LoginDisk, 'path'> & {volume?: string}, env: NodeJS.ProcessEnv) {
  const root = env.CLAND_FAKE_HOST_ROOT;
  const directory = dirname(env.CLAND_HOST_BOOT_ID_FILE ?? '');
  const name = basename(directory);
  if(!root||!env.CLAND_FAKE_HOSTS?.split(',').includes(name))throw loginDiskError('wrong-volume');
  try {if(await realpath(directory)!==await realpath(fakeMachineStorageDirectory(root,name)))throw new Error('machine directory mismatch');}
  catch {throw loginDiskError('wrong-volume');}
  let machine:Machine,project:string;
  try {const record=JSON.parse(await readFile(join(directory,'provider.json'),'utf8'));machine=record.machine;project=record.project;if(machine.id!==name)throw new Error('machine mismatch');}
  catch {throw loginDiskError('wrong-volume');}
  const volumes=await listFakeVolumes(root,project);
  if(volumes.state!=='listed')throw loginDiskError('wrong-volume');
  const path = fakeLoginMountPath(await realpath(directory),input.path);
  await rejectLoginSymlinks(path,true);
  let target: string | undefined;
  try { target=await readlink(path); }
  catch(e) { if((e as NodeJS.ErrnoException).code!=='ENOENT') throw loginDiskError('bad-argument'); }
  const matches=volumes.volumes.filter(volume=>input.volume===undefined?fakeVolumeContentsDirectory(root,volume.id)===target:volume.name===input.volume);
  if(matches.length!==1)throw loginDiskError('wrong-volume');
  const contents=await fakeVolumeContents(root,directory,matches[0]!,machine,()=>realClock.now().getTime());
  if(contents.state!=='ready')throw loginDiskError('wrong-volume');
  if (target !== undefined && target !== contents.directory) throw loginDiskError('bad-argument');
  return {path, contents, target};
}

/** Host execution maps logical disk paths only after attachment and exact-link validation. */
export async function loginFilePath(path:string, env:NodeJS.ProcessEnv):Promise<string> {
 if(!env.CLAND_FAKE_HOSTS||!env.CLAND_FAKE_HOST_ROOT||!path.startsWith('/cland/auth/'))return path;
 const match=path.match(/^(\/cland\/auth\/[a-z][a-z0-9]*-[a-z0-9][a-z0-9-]*)(?:\/(.+))?$/);
 if(!match||match[2]!==undefined&&match[2].split('/').some(part=>!part||part==='.'||part==='..'||part.includes('\0')))throw loginDiskError('bad-argument');
 const mount=await fakeLoginMount({path:match[1]!},env);
 if(!mount.target)throw loginDiskError('wrong-volume');
 const mapped=join(await realpath(mount.contents.directory),match[2]??'');
 await rejectLoginSymlinks(mapped);
 return mapped;
}
