// T2: filesystem lease and lock ownership, without Git or child processes.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir,readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tempProject } from './harness.ts';
import { withTerritoryLockAsync } from '../src/territory.ts';
import { territoryLockHeld } from '../src/territory-lock-context.ts';
import { grantBranchLeaseLocked,branchLeasePath } from '../src/host/branch-leases.ts';
test('locked grant succeeds under its active matching root owner',async t=>{
 const root=await tempProject(t);await mkdir(join(root,'.cland/territory.git'),{recursive:true});
 await withTerritoryLockAsync(root,async()=>{
  await grantBranchLeaseLocked(root,'f1','t/task');assert.equal(territoryLockHeld(root),true);
 });
 assert.equal(territoryLockHeld(root),false);assert.equal(await readFile(branchLeasePath(root),'utf8'),'f1\tt/task\n');
});
test('locked grant refuses no owner and a different-root owner',async t=>{
 const root=await tempProject(t),other=await tempProject(t);await mkdir(join(root,'.cland/territory.git'),{recursive:true});await mkdir(join(other,'.cland/territory.git'),{recursive:true});
 let release!:()=>void;let entered!:()=>void;const ready=new Promise<void>(r=>entered=r);const held=new Promise<void>(r=>release=r);
 await assert.rejects(grantBranchLeaseLocked(root,'f1','t/task'),{name:'TerritoryLockRequired'});
 const owner=withTerritoryLockAsync(other,async()=>{entered();await held;});await ready;
 try {await withTerritoryLockAsync(root,async()=>{await assert.rejects(grantBranchLeaseLocked(other,'f1','t/task'),{name:'TerritoryLockRequired'});});}
 finally {release();await owner;}
});
