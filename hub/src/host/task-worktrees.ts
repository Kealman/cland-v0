import { territoryLockHeld } from '../territory-lock-context.ts';
import { randomUUID } from 'node:crypto';
import type { CheckoutOwnership } from './agent/prepared-checkout.ts';
import { join } from 'node:path';
import type { Host } from './host.ts';
import { BRANCH_REVOKE_WAIT_MS, branchLeaseOwnersLocked, grantBranchLeaseLocked, revokeBranchLease, transferBranchLeaseLocked } from './branch-leases.ts';
import { territoryPath, territoryGitAsync, withTerritoryLockAsync, type TaskWorktree } from '../territory.ts';
import { HOST_ORIGIN } from './clone.ts';
export type HostWorktreeRecord={item:string;host:string;root:string;path:string;branch:string;tip:string;createdBranch?:boolean;phase?:'adding'|'ready'|'removing';removal?:{id:string;tip:string;leases:string[]};checkout?:CheckoutOwnership;retained?:{tree:HostWorktreeRecord;reason:string;refWatch:boolean}[]};
export type HostWorktreeStore={hostWorktrees():HostWorktreeRecord[];saveHostWorktree(row:HostWorktreeRecord):void;deleteHostWorktree(item:string):void};
/** Exact durable checkpoint comparison; conservative on field/order changes. */
export function hostWorktreeMatches(current:HostWorktreeRecord|undefined, expected:HostWorktreeRecord|undefined):boolean { return JSON.stringify(current)===JSON.stringify(expected); }
export function requireUnlockedCaller(project:string):void { if(territoryLockHeld(project))throw new Error('host-worktree-lock-order: checkout requires an unlocked caller'); }
/** One admission policy for checkout helpers and public relaunch admission. */
export async function withHostWorktreeCheckpoint<T>(project:string,work:()=>Promise<T>):Promise<T> { requireUnlockedCaller(project);return withTerritoryLockAsync(project,work,undefined,BRANCH_REVOKE_WAIT_MS); }
/** Lease/row checkpoints hold territory.lock; Host calls that can join pushes never do. */
export async function addHostTaskWorktree(o:{project:string;root:string;host:Host;item:string;branch:string;store:HostWorktreeStore;env:NodeJS.ProcessEnv;authorize:()=>void}):Promise<TaskWorktree> {
 requireUnlockedCaller(o.project);
 const git=(args:string[])=>territoryGitAsync(territoryPath(o.project),args,false,undefined,o.env);
 const plan=await withHostWorktreeCheckpoint(o.project,async()=>{
  const old=o.store.hostWorktrees().find(r=>r.item===o.item);
  if(old&&old.host!==o.host.name)throw new Error(`${o.item}: worktree belongs to host ${old.host}`);
  if(old?.phase&&old.phase!=='ready')throw new Error(`${o.item}: previous host worktree outcome needs reconciliation`);
  if(old&&old.branch!==o.branch)throw new Error(`${o.item}: recorded branch differs`);
  await git(['check-ref-format','--branch',o.branch]);
  const tip=(await git(['rev-parse','--verify',`refs/heads/${o.branch}`]).catch(()=>'' )).trim();
  const base=tip?null:(await git(['show-ref','--verify','--quiet','refs/heads/dev']).then(()=> 'dev',()=> 'main'));
  const selected=tip||(await git(['rev-parse',`refs/heads/${base}`])).trim();
  const path=join(o.root,'.cland/worktrees',o.item);
  o.authorize();
  if(!tip)await git(['branch','--no-track',o.branch,selected]);
  try {
   await grantBranchLeaseLocked(o.project,o.host.name,o.branch);
   o.authorize();
   const row:HostWorktreeRecord={...old,item:o.item,host:o.host.name,root:o.root,path,branch:o.branch,tip:old?.tip??selected,createdBranch:old?.createdBranch??!tip,phase:'adding'};
   o.store.saveHostWorktree(row);
   return {old,row,tip,base,selected,leases:await branchLeaseOwnersLocked(o.project,o.branch)};
  }catch(error){
   if(!old)o.store.deleteHostWorktree(o.item);
   if(!old)await revokeBranchLease(o.project,o.host.name,o.branch);
   if(!tip)await git(['update-ref','--no-deref','-d',`refs/heads/${o.branch}`,selected]);
   throw error;
  }
 });
 let accepted=false;
 try {
  const result=await o.host.worktreeAdd({root:o.root,path:plan.row.path,branch:o.branch,territory:{path:HOST_ORIGIN,tip:plan.selected},...(plan.old?{reuseOnly:true}:{}),beforeInstall:()=>o.authorize()});
  accepted=true;
  await withHostWorktreeCheckpoint(o.project,async()=>{
   if(!hostWorktreeMatches(o.store.hostWorktrees().find(row=>row.item===o.item),plan.row))throw new Error(`${o.item}: host worktree preparation ownership changed`);
   if((await git(['rev-parse',`refs/heads/${o.branch}`])).trim()!==plan.selected||JSON.stringify(await branchLeaseOwnersLocked(o.project,o.branch))!==JSON.stringify(plan.leases))throw new Error(`${o.item}: host worktree preparation tip or lease changed`);
   if(!hostWorktreeMatches(o.store.hostWorktrees().find(row=>row.item===o.item),plan.row))throw new Error(`${o.item}: host worktree preparation ownership changed`);
   o.authorize();o.store.saveHostWorktree({...plan.row,phase:'ready'});
  });
  return {item:o.item,path:plan.row.path,branch:o.branch,base:plan.base,createdBranch:!plan.tip,createdWorktree:!plan.old,...result};
 }catch(error){
  if(accepted||(error as NodeJS.ErrnoException).code==='CLAND_HOST_OUTCOME_UNKNOWN')throw Object.assign(error instanceof Error?error:new Error(String(error)),{code:'CLAND_HOST_OUTCOME_UNKNOWN'});
  await withHostWorktreeCheckpoint(o.project,async()=>{
   if(!hostWorktreeMatches(o.store.hostWorktrees().find(row=>row.item===o.item),plan.row))throw new Error(`${o.item}: host worktree rollback ownership changed; retained`);
   if(JSON.stringify(await branchLeaseOwnersLocked(o.project,o.branch))!==JSON.stringify(plan.leases)||(await git(['rev-parse',`refs/heads/${o.branch}`])).trim()!==plan.selected)throw new Error(`${o.item}: host worktree rollback tip or lease changed; retained`);
   if(plan.old)o.store.saveHostWorktree(plan.old);
   else {o.store.deleteHostWorktree(o.item);await revokeBranchLease(o.project,o.host.name,o.branch);}
   if(!plan.tip)await git(['update-ref','--no-deref','-d',`refs/heads/${o.branch}`,plan.selected]);
  });
  throw error;
 }
}

export async function pruneHostTaskWorktree(o:{project:string;row:HostWorktreeRecord;host:Host;store:HostWorktreeStore;env:NodeJS.ProcessEnv;expected?:{branch:string;tip:string};validate:()=>Promise<void|(()=>void)>}):Promise<void> {
 requireUnlockedCaller(o.project);
 const {row,host}=o;
 const changed=(reason:string)=>new Error(`host-prune-changed: ${row.item}: ${reason}; ownership retained`);
 const git=(args:string[])=>territoryGitAsync(territoryPath(o.project),args,false,undefined,o.env);
 const readTip=()=>git(['rev-parse',`refs/heads/${row.branch}`]).then(value=>value.trim());
 const checkHost=async(tip:string)=>{
  const remote=await host.run({command:'git',args:['-c','gc.auto=0','rev-parse',`refs/heads/${row.branch}`],cwd:row.root,env:{}});
  if(remote.error||remote.code!==0||remote.stdout.trim()!==tip)throw changed('host branch has unpublished work');
  try{return await o.validate();}catch(error){throw changed(error instanceof Error?error.message:String(error));}
 };
 const fresh=(guard:void|(()=>void))=>{try{guard?.();}catch(error){throw changed(error instanceof Error?error.message:String(error));}};
 const removing=await withHostWorktreeCheckpoint(o.project,async()=>{
  const current=o.store.hostWorktrees().find(value=>value.item===row.item);
  if(!hostWorktreeMatches(current,row))throw changed('row changed before removal');
  if(row.retained?.length)throw new Error(`${row.item}: retained host checkout/ref-watch obligations need settlement`);
  if(row.phase==='adding')throw new Error(`${row.item}: host worktree outcome needs reconciliation`);
  const tip=await readTip();
  if(o.expected&&(o.expected.branch!==row.branch||o.expected.tip!==tip))throw changed('branch moved since merge');
  const leases=await branchLeaseOwnersLocked(o.project,row.branch);
  if(row.removal&&(row.removal.tip!==tip||JSON.stringify(row.removal.leases)!==JSON.stringify(leases)))throw changed('retained removal tip or lease changed');
  const guard=await checkHost(tip);
  if((await readTip())!==tip||JSON.stringify(await branchLeaseOwnersLocked(o.project,row.branch))!==JSON.stringify(leases))throw changed('preflight tip or lease changed');
  if(!hostWorktreeMatches(o.store.hostWorktrees().find(value=>value.item===row.item),row))throw changed('preflight row changed');
  fresh(guard);
  const marked:HostWorktreeRecord={...row,phase:'removing',removal:row.removal??{id:randomUUID(),tip,leases}};
  o.store.saveHostWorktree(marked);
  return marked;
 });
 // Agent removal joins pending receive-pack producers. Never hold their territory lock here.
 await host.worktreeRemove({root:row.root,path:row.path});
 await withHostWorktreeCheckpoint(o.project,async()=>{
  const guard=await checkHost(removing.removal!.tip);
  const tip=await readTip().catch(()=>{throw changed('territory branch disappeared');});
  if(tip!==removing.removal!.tip)throw changed('territory branch moved');
  if(JSON.stringify(await branchLeaseOwnersLocked(o.project,row.branch))!==JSON.stringify(removing.removal!.leases))throw changed('branch lease changed');
  const finalOwner=()=>{if(!hostWorktreeMatches(o.store.hostWorktrees().find(value=>value.item===row.item),removing))throw changed('removal row changed');fresh(guard);};
  finalOwner();
  await revokeBranchLease(o.project,row.host,row.branch);
  finalOwner();
  if(o.expected || row.createdBranch && tip===row.tip)await git(['update-ref','--no-deref','-d',`refs/heads/${row.branch}`,tip]);
  finalOwner();
  o.store.deleteHostWorktree(row.item);
 });
}

/** A lost host's checkout is never read or removed. Incomplete destinations stay adding. */
export async function relaunchHostTaskWorktree(o: {project:string;root:string;host:Host;item:string;from:string;store:HostWorktreeStore;env:NodeJS.ProcessEnv;authorize:()=>void;retry?:HostWorktreeRecord}): Promise<HostWorktreeRecord> {
 requireUnlockedCaller(o.project);
 const plan=await withHostWorktreeCheckpoint(o.project, async () => {
  const old = o.store.hostWorktrees().find(row => row.item === o.item);
  if (!old || old.phase==='removing' || (o.retry ? !hostWorktreeMatches(old,o.retry) || !old.checkout : old.host !== o.from || old.phase === 'adding')) throw new Error(`${o.item}: original host worktree ownership is unavailable or needs reconciliation`);
  const tip = (await territoryGitAsync(territoryPath(o.project), ['rev-parse', '--verify', `refs/heads/${old.branch}`], false, undefined, o.env)).trim();
  o.authorize();
  const same = !!o.retry && old.host===o.host.name;
  if(o.retry && !same && old.retained?.some(r=>r.tree.host===o.host.name))throw new Error('destination has a retained checkout obligation; reconciliation required');
  const retainedTree={...old};delete retainedTree.retained;
  const row: HostWorktreeRecord = {...old, host:o.host.name, root:o.root, path:join(o.root,'.cland/worktrees',o.item), tip, phase:'adding',...(o.retry&&!same?{retained:[...(old.retained??[]),{tree:retainedTree,reason:'native admission failed; checkout and ref-watch retained for settlement',refWatch:true}]}:{})};
  delete row.checkout;
  o.store.saveHostWorktree(row);
  await transferBranchLeaseLocked(o.project, o.host.name, old.branch);
  o.authorize();
  return {row,same,old,leases:await branchLeaseOwnersLocked(o.project,row.branch)};
 });
 const {row,same,old}=plan;
 const prepared = await o.host.worktreeAdd({root:row.root,path:row.path,branch:row.branch,territory:{path:HOST_ORIGIN,tip:row.tip},...(same?{reuseOnly:true,checkout:old.checkout}:{}),beforeInstall:o.authorize});
 return withHostWorktreeCheckpoint(o.project,async()=>{
  if(!hostWorktreeMatches(o.store.hostWorktrees().find(value=>value.item===o.item),row))throw new Error(`${o.item}: relaunch preparation ownership changed; retained`);
  const tip=(await territoryGitAsync(territoryPath(o.project),['rev-parse',`refs/heads/${row.branch}`],false,undefined,o.env)).trim();
  if(tip!==row.tip||JSON.stringify(await branchLeaseOwnersLocked(o.project,row.branch))!==JSON.stringify(plan.leases))throw new Error(`${o.item}: relaunch preparation tip or lease changed; retained`);
  if(!hostWorktreeMatches(o.store.hostWorktrees().find(value=>value.item===o.item),row))throw new Error(`${o.item}: relaunch preparation ownership changed; retained`);
  if(prepared.checkout)row.checkout=prepared.checkout;
  o.store.saveHostWorktree(row);
  o.authorize();
  return row;
 });
}
