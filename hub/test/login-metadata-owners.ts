import type {TestContext} from 'node:test';
import {beforeDirectories,guardDirectoryRemoval} from './process-cleanup.ts';

/** Prearm resource ownership before acquisition; failed joins retain the root. */
export function loginMetadataOwners(t:TestContext,root:string) {
 let hub:{stop():Promise<void>}|undefined,store:{close():unknown}|undefined;
 let hubClosed=true,storeClosed=true,work:Promise<void>|undefined;
 const assertReleased=()=>{if(!hubClosed||!storeClosed)throw Error('login metadata fixture drainage unconfirmed; root retained');};
 const close=()=>work??=(async()=>{
  const errors:unknown[]=[];
  if(!hubClosed&&hub)try{await hub.stop();hubClosed=true;}catch(error){errors.push(error);}
  if(!storeClosed&&store)try{await store.close();storeClosed=true;}catch(error){errors.push(error);}
  if(errors.length)throw new AggregateError(errors,'login metadata fixture drainage failed');
  assertReleased();
 })().finally(()=>{work=undefined;});
 guardDirectoryRemoval(root,assertReleased);beforeDirectories(t,close);
 return {
  store<T extends {close():unknown}>(owned:T):T {store=owned;storeClosed=false;return owned;},
  async start<T extends {stop():Promise<void>}>(acquire:()=>Promise<T>):Promise<T>{
   if(hub&&!hubClosed){await hub.stop();hubClosed=true;}
   hub=undefined;hubClosed=false;const owned=await acquire();hub=owned;return owned;
  },
  close,assertReleased,
 };
}
