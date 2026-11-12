import type {TestContext} from 'node:test';
import {beforeDirectories,guardDirectoryRemoval} from './process-cleanup.ts';

/** External gateways drain before the hub, storage and disposable root. A failed
 * upper-phase join keeps every dependency owned so a later retry can finish. */
export function loginCardFixtureOwners(t:TestContext,root:string){
 type Owner={phase:number;closed:boolean;close:()=>unknown|Promise<unknown>};
 const owners:Owner[]=[];let closing:Promise<void>|undefined;
 const assertReleased=()=>{if(owners.some(owner=>!owner.closed))throw Error('card fixture drainage unconfirmed; root retained');};
 const close=()=>closing??=(async()=>{
  for(const phase of [0,1,2]){
   const pending=owners.filter(owner=>owner.phase===phase&&!owner.closed);
   const results=await Promise.allSettled(pending.map(async owner=>{await owner.close();owner.closed=true;}));
   const errors=results.flatMap(result=>result.status==='rejected'?[result.reason]:[]);
   if(errors.length)throw new AggregateError(errors,'card fixture drainage failed');
  }
  assertReleased();
 })().finally(()=>{closing=undefined;});
 guardDirectoryRemoval(root,assertReleased);beforeDirectories(t,close);
 return {
  gateway<T extends {stop():Promise<void>}>(resource:T):T{owners.push({phase:0,closed:false,close:()=>resource.stop()});return resource;},
  store<T extends {close():unknown}>(resource:T):T{owners.push({phase:2,closed:false,close:()=>resource.close()});return resource;},
  async start<T extends {stop():Promise<void>}>(acquire:()=>Promise<T>):Promise<T>{
   let resource:T|undefined;
   owners.push({phase:1,closed:false,close:()=>resource?resource.stop():Promise.reject(Error('card hub acquisition drainage unconfirmed'))});
   resource=await acquire();return resource;
  },close,assertReleased,
 };
}
