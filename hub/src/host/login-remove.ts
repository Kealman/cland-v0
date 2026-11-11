import type {LoginRecords, Login} from './logins.ts';
import type {HostProvider} from './provider/provider.ts';
import type {LoginSnapshots} from './login-snapshots.ts';
import {removeLoginKey} from './login-keys.ts';

type Options={root:string;logins:LoginRecords;provider:(row:Extract<Login,{kind:'disk'}>)=>HostProvider;snapshots:Pick<LoginSnapshots,'beginRemoval'>};
/** Own the durable removal fence before any provider I/O. Retry retains exact remaining ids. */
const active=new WeakMap<LoginRecords,Map<string,Promise<{removed:string}>>>();
export function removeLogin(o:Options,name:string):Promise<{removed:string}> {
 let work=active.get(o.logins);if(!work){work=new Map();active.set(o.logins,work);}
 const prior=work.get(name);if(prior)return prior;
 const operation=performRemoval(o,name).finally(()=>work!.delete(name));work.set(name,operation);return operation;
}
async function performRemoval(o:Options,name:string):Promise<{removed:string}> {
 let row=o.logins.get(name);if(!row)throw Error('unknown login: '+name);
 // Key deletion is synchronous, so no native launch can interleave it.
 if(row.kind==='key') {o.logins.beginRemove(name);removeLoginKey(o.root,name);o.logins.remove(name);return {removed:name};}
 o.logins.beginRemove(name);
 await o.snapshots.beginRemoval(name);
 row=o.logins.get(name)!;if(row.kind!=='disk')throw Error('login changed');
 const provider=o.provider(row),remaining:string[]=[];
 // Snapshots first: the original volume remains available for inventory and retry.
 for(const id of row.snapshotIds){
  try {const result=await provider.deleteSnapshot(id);if(result.state!=='deleted')remaining.push(id);else o.logins.confirmRemovedResource(name,'snapshot',id);}catch{remaining.push(id);}
 }
 if(row.volumeId){
  const id=row.volumeId;
  try {
   const inventory=await provider.listVolumes({project:o.root});
   if(inventory.state!=='listed')remaining.push(id);
   else {
    const live=inventory.volumes.find(v=>v.id===id);
    const volume=live?o.logins.removalVolume(name,live):o.logins.removalVolume(name);
    if(!volume)remaining.push(id);
    else if((await provider.deleteVolume(volume)).state!=='deleted')remaining.push(id);
    else o.logins.confirmRemovedResource(name,'volume',id);
   }
  }catch{remaining.push(id);}
 }
 if(remaining.length)throw Error(`login ${name}: deletion unconfirmed: ${remaining.join(', ')}`);
 o.logins.remove(name);return {removed:name};
}
