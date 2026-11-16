import { open, rename, unlink, opendir } from 'node:fs/promises';
import { setImmediate as yieldIO } from 'node:timers/promises';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
export type CheckpointIO = {
  open(path: string, flags: string, mode: number): Promise<{writeFile(value: string): Promise<unknown>; sync(): Promise<unknown>; close(): Promise<unknown>}>;
  rename(from: string, to: string): Promise<unknown>;
  unlink(path: string): Promise<unknown>;
};
/** Private atomic checkpoint; return only after the new file's bytes are synced. */
export async function checkpoint(path: string, value: unknown, io: CheckpointIO = {open, rename, unlink}): Promise<void> {
  const temporary = `${path}.new-${process.pid}-${randomUUID()}`;
  // Never recreate a missing parent: its owner may already have released it.
  const file = await io.open(temporary, 'wx', 0o600);
  try {
    try { await file.writeFile(JSON.stringify(value)); await file.sync(); } finally { await file.close(); }
    await io.rename(temporary, path);
  } finally {
    await io.unlink(temporary).catch(error => { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; });
  }
}

type RecoveryTarget = {directory:string; basenames?:readonly string[]};
export type CheckpointRecoveryIO = {
  entries(directory:string):AsyncIterable<{name:string;directory:boolean}>;
  unlink(path:string):Promise<unknown>;
  pause():Promise<unknown>;
};
const recoveryIO:CheckpointRecoveryIO = {
  async *entries(directory) {
    let handle;
    try { handle=await opendir(directory,{bufferSize:32}); }
    catch(error) { if((error as NodeJS.ErrnoException).code==='ENOENT')return;throw error; }
    for await(const entry of handle) yield {name:entry.name,directory:entry.isDirectory()};
  },
  unlink, pause:yieldIO,
};
/** One cancellable startup pass, scheduled after readiness. No retained tree is materialized. */
export function checkpointRecovery(targets:readonly RecoveryTarget[], exited:(pids:number[])=>Promise<Set<number>>, io:CheckpointRecoveryIO=recoveryIO, onError:(error:unknown)=>void=()=>{}) {
  let stopped=false,work:Promise<void>|undefined,failure:unknown,entries=0;
  let candidates:Array<{path:string;pid:number}>=[];
  const flush=async()=>{
    if(stopped||!candidates.length)return;
    const batch=candidates;candidates=[];
    const gone=await exited([...new Set(batch.map(row=>row.pid))]);
    for(const row of batch) {
      if(stopped)return;
      if(gone.has(row.pid))await io.unlink(row.path).catch(error=>{if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;});
    }
  };
  const scan=async(directory:string,basenames?:readonly string[]):Promise<void>=>{
    if(stopped)return;
    for await(const entry of io.entries(directory)) {
      if(stopped)break;
      const path=join(directory,entry.name);
      const match=/^(.*)\.new-([1-9][0-9]*)-[a-f0-9-]{36}$/.exec(entry.name);
      if(!entry.directory&&match&&(!basenames||basenames.includes(match[1]!)))candidates.push({path,pid:Number(match[2])});
      if(++entries===32){entries=0;await flush();if(stopped)break;await io.pause();if(stopped)break;}
      if(entry.directory&&!basenames)await scan(path);
    }
  };
  return {
    start() {
      if(work||stopped)return;
      work=(async()=>{await io.pause();for(const target of targets){if(stopped)break;await scan(target.directory,target.basenames);}await flush();})().catch(error=>{failure=error;try{onError(error);}catch{}});
    },
    async finished(){await work;if(failure)throw failure;},
    async close(){stopped=true;await work;if(failure)throw failure;},
  };
}
