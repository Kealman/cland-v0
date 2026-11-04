import { join } from 'node:path';
import type { Host } from './host.ts';
import { grantBranchLeaseLocked, revokeBranchLease } from './branch-leases.ts';
import { territoryPath, territoryGitAsync, withTerritoryLockAsync, type TaskWorktree } from '../territory.ts';
import { HOST_ORIGIN } from './clone.ts';
export type HostWorktreeRecord={item:string;host:string;root:string;path:string;branch:string;tip:string;createdBranch?:boolean;phase?:'adding'|'ready'};
export type HostWorktreeStore={hostWorktrees():HostWorktreeRecord[];saveHostWorktree(row:HostWorktreeRecord):void;deleteHostWorktree(item:string):void};
/** Territory branch creation and lease ownership share the caller's territory lock. */
export async function addHostTaskWorktree(o:{project:string;root:string;host:Host;item:string;branch:string;store:HostWorktreeStore;env:NodeJS.ProcessEnv;authorize:()=>void}):Promise<TaskWorktree> {
 return withTerritoryLockAsync(o.project,async()=>{
  const git=(args:string[])=>territoryGitAsync(territoryPath(o.project),args,false,undefined,o.env);
  const old=o.store.hostWorktrees().find(r=>r.item===o.item);
  if(old&&old.host!==o.host.name)throw new Error(`${o.item}: worktree belongs to host ${old.host}`);
  if(old?.phase==='adding')throw new Error(`${o.item}: previous host worktree outcome needs reconciliation`);
  if(old&&old.branch!==o.branch)throw new Error(`${o.item}: recorded branch differs`);
  await git(['check-ref-format','--branch',o.branch]);
  const tip=(await git(['rev-parse','--verify',`refs/heads/${o.branch}`]).catch(()=>'' )).trim();
  const base=tip?null:(await git(['show-ref','--verify','--quiet','refs/heads/dev']).then(()=> 'dev',()=> 'main'));
  const selected=tip||(await git(['rev-parse',`refs/heads/${base}`])).trim();
  const path=join(o.root,'.cland/worktrees',o.item);
  o.authorize();
  if(!tip)await git(['branch','--no-track',o.branch,selected]);
  let accepted=false;
  try {
   await grantBranchLeaseLocked(o.project,o.host.name,o.branch);
   o.authorize();
   const record={item:o.item,host:o.host.name,root:o.root,path,branch:o.branch,tip:old?.tip ?? selected,createdBranch:old?.createdBranch ?? !tip};
   if(!old)o.store.saveHostWorktree({...record,phase:'adding'});
   const result=await o.host.worktreeAdd({root:o.root,path,branch:o.branch,territory:{path:HOST_ORIGIN,tip:selected},...(old?{reuseOnly:true}:{}),beforeInstall:()=>o.authorize()});
   accepted=true;
   o.store.saveHostWorktree({...record,phase:'ready'});
   return {item:o.item,path,branch:o.branch,base,createdBranch:!tip,createdWorktree:!old,...result};
  } catch(error) {
   // An unknown native outcome keeps its lease and branch fenced for recovery.
   if(accepted)throw Object.assign(error instanceof Error?error:new Error(String(error)),{code:'CLAND_HOST_OUTCOME_UNKNOWN'});
   if((error as NodeJS.ErrnoException).code==='CLAND_HOST_OUTCOME_UNKNOWN')throw error;
   if(!old)o.store.deleteHostWorktree(o.item);
   if(!old)await revokeBranchLease(o.project,o.host.name,o.branch);
   if(!tip)await git(['update-ref','--no-deref','-d',`refs/heads/${o.branch}`,selected]);
   throw error;
  }
 });
}

export async function pruneHostTaskWorktree(o:{project:string;row:HostWorktreeRecord;host:Host;store:HostWorktreeStore;env:NodeJS.ProcessEnv;expected?:{branch:string;tip:string};validate:()=>Promise<void>}):Promise<void> {
 await withTerritoryLockAsync(o.project,async()=>{
  const {row,host}=o;
  if(row.phase==='adding')throw new Error(`${row.item}: host worktree outcome needs reconciliation`);
  const git=(args:string[])=>territoryGitAsync(territoryPath(o.project),args,false,undefined,o.env);
  const tip=(await git(['rev-parse',`refs/heads/${row.branch}`])).trim();
  if(o.expected&&(o.expected.branch!==row.branch||o.expected.tip!==tip))throw new Error(`${row.item}: branch moved since merge; kept`);
  const remote=await host.run({command:'git',args:['-c','gc.auto=0','rev-parse',`refs/heads/${row.branch}`],cwd:row.root,env:{}});
  if(remote.error||remote.code!==0||remote.stdout.trim()!==tip)throw new Error(`${row.item}: host branch has unpublished work; kept`);
  await o.validate();
  await host.worktreeRemove({root:row.root,path:row.path});
  await revokeBranchLease(o.project,row.host,row.branch);
  if(o.expected || row.createdBranch && tip===row.tip)await git(['update-ref','--no-deref','-d',`refs/heads/${row.branch}`,tip]);
  o.store.deleteHostWorktree(row.item);
 });
}
