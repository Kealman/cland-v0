import { readFile, stat, mkdir, opendir } from 'node:fs/promises';
import { join } from 'node:path';
import { parseFakeVolumeRecord, isFakeVolumeId, type FakeVolumeRecord } from './fake-volume-record.ts';
import type { Machine, Volume } from './resource-types.ts';

export type FakeMachineRecord = { region?:string; machine:Machine; project:string; pool:string; leaseId?:string|undefined; readyAt:number; neverBoot:boolean };
const missing=(e:unknown)=>(e as NodeJS.ErrnoException).code==='ENOENT';
export function fakeVolumePath(root:string,id:string):string {
  if(!isFakeVolumeId(id))throw new Error('invalid volume identity');return join(root,'volumes',id+'.json');
}
export function fakeVolumeContentsDirectory(root:string,id:string):string {
  fakeVolumePath(root,id);return join(root,'volumes',id+'.contents');
}
export async function readFakeVolume(root:string,volume:Volume):Promise<FakeVolumeRecord> {
  const record=parseFakeVolumeRecord(await readFile(fakeVolumePath(root,volume.id),'utf8'),volume.id);
  for(const key of ['id','project','name','region','sizeGiB','created'] as const)if(record.volume[key]!==volume[key])throw new Error('volume identity mismatch');
  return record;
}
export async function listFakeVolumes(root:string,project:string):Promise<{state:'listed';volumes:Volume[]}|{state:'failed';reason:string}> {
  try {
    let directory;
    try{directory=await opendir(join(root,'volumes'));}catch(e){if(missing(e))return {state:'listed',volumes:[]};throw e;}
    const volumes:Volume[]=[];
    for await(const entry of directory) {
      if(entry.isDirectory()||!entry.name.endsWith('.json')||!isFakeVolumeId(entry.name.slice(0,-5)))continue;
      const record=parseFakeVolumeRecord(await readFile(join(root,'volumes',entry.name),'utf8'),entry.name.replace(/\.json$/,''));
      if(record.volume.project===project)volumes.push(record.volume);
    }
    return {state:'listed',volumes:volumes.sort((a,b)=>a.id.localeCompare(b.id))};
  }catch{return {state:'failed',reason:'fake volume list failed'};}
}
export async function readFakeMachine(directory:string,machine:Machine):Promise<FakeMachineRecord> {
  const record=JSON.parse(await readFile(join(directory,'provider.json'),'utf8')) as FakeMachineRecord;
  const captured=record.machine;
  if(captured.id!==machine.id||captured.created!==machine.created||captured.address!==machine.address||captured.architecture!==machine.architecture)throw new Error('machine identity mismatch');
  return record;
}
export async function fakeMachineStatus(directory:string,machine:Machine,now:()=>number):Promise<{state:'booting'|'ready'|'gone'}|{state:'failed';reason:string}> {
  try {
    try {await stat(directory);}catch(e){if(missing(e))return {state:'gone'};throw e;}
    const record=await readFakeMachine(directory,machine);
    try {
      const marker=await readFile(join(directory,'gone'),'utf8');
      if(marker!=='deleted')return {state:'failed',reason:'fake machine unavailable'};
      for(const key of ['host-key.pub','client-key','known_hosts']) {
        try{await stat(join(directory,key));return {state:'failed',reason:'fake machine key retained'};}catch(e){if(!missing(e))throw e;}
      }
      return {state:'gone'};
    }catch(e){if(!missing(e))throw e;}
    if(record.neverBoot)return {state:'failed',reason:'fake machine will not boot'};
    return {state:now()<record.readyAt?'booting':'ready'};
  }catch{return {state:'failed',reason:'fake machine read failed'};}
}
/** Canonical test-only attachment seam, used by provider and delivered fake agent. */
export async function fakeVolumeContents(root:string,directory:string,volume:Volume,machine:Machine,now:()=>number):Promise<{state:'ready';directory:string}|{state:'failed';reason:string}> {
  try {
    const record=await readFakeVolume(root,volume);
    await readFakeMachine(directory,machine);
    if(record.volume.attachedTo!==machine.id||(await fakeMachineStatus(directory,machine,now)).state!=='ready')throw new Error('volume unavailable');
    const contents=fakeVolumeContentsDirectory(root,volume.id);
    await mkdir(contents,{recursive:true,mode:0o700});return {state:'ready',directory:contents};
  }catch{return {state:'failed',reason:'fake volume contents unavailable'};}
}
