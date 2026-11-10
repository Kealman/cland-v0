// T2: metadata setup ownership; no process, socket or elapsed-time assertion.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Store } from '../src/hub/store.ts';
import { withFixtureStore } from './fixture-store.ts';
import { ownDirectory, onCleanup } from './process-cleanup.ts';

for(const rejected of [false,true])test(`setup Store joins a held producer before closing: rejected=${rejected}`,async t=>{
 const root=await mkdtemp(join(tmpdir(),'owned-setup-store-'));ownDirectory(t,root);
 const entered=Promise.withResolvers<void>(),release=Promise.withResolvers<void>();
 const events:string[]=[],owners:Array<()=>Promise<void>>=[];
 let store:Store|undefined,work:Promise<void>|undefined,drain:Promise<void>|undefined;
 onCleanup(t,async()=>{release.resolve();await Promise.allSettled([work,drain]);for(const close of owners)await close();});
 work=withFixtureStore(join(root,'metadata.db'),close=>owners.push(close),async current=>{
  store=current;const close=current.close.bind(current);current.close=()=>{events.push('closed');close();};
  entered.resolve();await release.promise;
  current.setMeta('setup','settled');events.push('producer-settled');
  if(rejected)throw Error('forced setup rejection');
 });
 const result=work.catch(error=>error);
 await entered.promise;drain=owners[0]!();await Promise.resolve();release.resolve();
 const outcome=await result;await drain;
 if(rejected)assert.match(String(outcome),/forced setup rejection/);else assert.equal(outcome,undefined);
 assert.deepEqual(events,['producer-settled','closed']);assert.throws(()=>store!.meta('setup'));
 await owners[0]!();assert.equal(events.filter(event=>event==='closed').length,1);
});
