import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import type { TestContext } from 'node:test';
import type { admissionFixture } from './host-admission-fixture.ts';
import { hostWatchdogPaths } from '../src/host/host-watchdog.ts';
import { until, testWaitMs } from './until.ts';

/** Capture the real registered ownership hook so the body can observe teardown. */
export function capturedCleanup(t:TestContext) {
 const hooks:Array<()=>unknown>=[];
 const context={after:(hook:()=>unknown)=>{hooks.push(hook);},mock:t.mock} as unknown as TestContext;
 let completion:Promise<void>|undefined;
 const dispose=()=>completion??=(async()=>{for(const hook of hooks)await hook();})();
 return {context,dispose};
}

export async function admissionCloseContract(t:TestContext,create:(context:TestContext)=>Promise<{
 api:{stateRoot:string;close(options?:{retainRoot?:boolean}):Promise<void>};
 admissions:ReturnType<typeof admissionFixture>;
}>) {
 const cleanup=capturedCleanup(t);
 const release=Promise.withResolvers<void>();
 t.after(()=>{release.resolve();return cleanup.dispose();});
 const {api,admissions}=await create(cleanup.context);
 let held=false,observations=0,apiClosed=false;
 const identity=admissions.processes.identity.bind(admissions.processes);
 t.mock.method(admissions.processes,'identity',async()=>{
  if(++observations===1){held=true;await release.promise;}
  return identity();
 });
 const apiClose=api.close.bind(api);
 t.mock.method(api,'close',async(options?:{retainRoot?:boolean})=>{apiClosed=true;return apiClose(options);});
 const observed=until(()=>held,{what:'issuance reached persisted watchdog observation',timeoutMs:testWaitMs()});
 const baseIds=new Set([...admissions.leases.active()].map(lease=>lease.id));
 const pending=Promise.allSettled([
  admissions.issue('contract','agents'),
  admissions.issue('contract',''),
  admissions.issue('contract','agents'),
 ]);
 let disposal:Promise<void>|undefined;
 try {
  await observed;
  disposal=cleanup.dispose();
  const closing=admissions.close();
  assert.equal(admissions.close(),closing,'repeat close shares drainage completion');
  await assert.rejects(admissions.issue('contract','late'),/fixture is closed/);
  await access(api.stateRoot);
  const leases=[...admissions.leases.active()];
  assert.ok(leases.length>=2,'SQLite retains the base and held issue');
  const heldLease=leases.find(lease=>!baseIds.has(lease.id));
  assert.ok(heldLease);
  const checkpoint=JSON.parse(await readFile(hostWatchdogPaths(api.stateRoot,heldLease.id).input,'utf8'));
  assert.equal(checkpoint.id,heldLease.id);
  assert.equal(checkpoint.pool,'agents');
  assert.equal(apiClosed,false,'API disposal follows issuance drainage');
 } finally {release.resolve();await pending;await disposal;}
 const results=await pending;
 assert.deepEqual(results.map(result=>result.status),['fulfilled','rejected','fulfilled']);
 if(results[1]!.status==='rejected')assert.match(String(results[1]!.reason),/pool/);
 for(const result of [results[0]!,results[2]!])if(result.status==='fulfilled')assert.ok(result.value.watchdog?.pidIdentity);
 assert.equal(apiClosed,true);
 assert.throws(()=>[...admissions.leases.active()],/closed|not open/i);
 await assert.rejects(access(api.stateRoot),{code:'ENOENT'});
}
