import { lstat, opendir } from 'node:fs/promises';
import { join } from 'node:path';
import { SUITE_RETENTION_BATCH_SIZE } from './suite-retention-policy.ts';

export type SuiteInventory = {mtimeMs:number; newestMtimeMs:number; bytes:number; files:number; device:number; inode:number};
export type RetirementInventory = SuiteInventory & {id:string; indexAbsent:true; referenced:false; pinned:false; pointer:false};
export class InventoryBoundError extends Error {}

/** Shared discovery/removal reader: bounded metadata only, no link traversal.
 * Every iterator closes before returning or refusing a depth/entry overflow. */
export async function readSuiteInventory(root:string):Promise<SuiteInventory> {
  const original=await lstat(root);
  if(!original.isDirectory()||original.isSymbolicLink())throw new Error('refusing linked suite inventory root');
  let bytes=0,files=0,entries=0,newestMtimeMs=original.mtimeMs;
  async function walk(path:string,depth:number):Promise<void> {
    if(depth>16)throw new InventoryBoundError('retirement inventory depth exceeds 16');
    for await(const entry of await opendir(path,{bufferSize:SUITE_RETENTION_BATCH_SIZE})) {
      if(++entries>4096)throw new InventoryBoundError('retirement inventory exceeds 4096 entries');
      const child=join(path,entry.name),info=await lstat(child);
      newestMtimeMs=Math.max(newestMtimeMs,info.mtimeMs);
      if(info.isDirectory()&&!info.isSymbolicLink())await walk(child,depth+1);
      else {bytes+=info.size;files++;}
      if(entries%SUITE_RETENTION_BATCH_SIZE===0)await new Promise<void>(resolve=>setImmediate(resolve));
    }
  }
  await walk(root,0);
  const current=await lstat(root);
  if(current.dev!==original.dev||current.ino!==original.ino||current.mtimeMs!==original.mtimeMs)throw new Error('suite inventory root changed during scan');
  return {mtimeMs:original.mtimeMs,newestMtimeMs,bytes,files,device:original.dev,inode:original.ino};
}

/** This is conservative revalidation, not a claim that native writers closed.
 * Changes or an unusable inventory keep the root instead of authorizing rm. */
export async function suiteInventoryUnchanged(path:string,expected:SuiteInventory):Promise<boolean> {
  const current=await readSuiteInventory(path);
  return current.device===expected.device&&current.inode===expected.inode
    &&current.mtimeMs===expected.mtimeMs&&current.newestMtimeMs===expected.newestMtimeMs
    &&current.bytes===expected.bytes&&current.files===expected.files;
}
