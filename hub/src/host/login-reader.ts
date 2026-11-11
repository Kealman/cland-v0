import type { LoginRecords, ReaderOperation } from './logins.ts';
import type { HostProvider, Volume } from './provider/provider.ts';

export const sameVolume=(a:Volume,b:Volume)=>a.id===b.id&&a.name===b.name&&a.project===b.project&&a.region===b.region&&a.created===b.created&&a.sizeGiB===b.sizeGiB;

/** A deletion intent follows confirmed detach (or a create that never attached).
 * Recovery still requires the provider's exact-id deletion/absence receipt. */
export async function deleteReaderVolume(records:LoginRecords,operation:ReaderOperation,provider:HostProvider,authorize:()=>void=()=>{}):Promise<void> {
 authorize();
 let current=records.readerOperation(operation.login,operation.host);
 if(!current||current.name!==operation.name||!current.volume)throw Error('reader ownership missing');
 if(current.phase!=='deleting'&&current.phase!=='deleted')throw Error('reader detach receipt missing');
 if(current.phase==='deleting'){
  const inventory=await provider.listVolumes({project:current.project});
  authorize();
  if(inventory.state!=='listed')throw Error('reader deletion inventory unavailable');
  const volume=inventory.volumes.find(v=>v.id===current!.volume!.id);
  if(JSON.stringify(records.readerOperation(current.login,current.host))!==JSON.stringify(current))throw Error('reader ownership changed');
  if(volume&&(!sameVolume(volume,current.volume)||volume.attachedTo!==null))throw Error('reader deletion identity changed');
  if((await provider.deleteVolume(volume??current.volume)).state!=='deleted')throw Error('reader deletion unconfirmed');
  authorize();
  if(JSON.stringify(records.readerOperation(current.login,current.host))!==JSON.stringify(current))throw Error('reader ownership changed');
  current={...current,phase:'deleted'};records.saveReader(current);
 }
 authorize();records.completeReader(current);
}

/** Unknown creation never retries a send. A unique pre-send name fences it until
 * inventory returns its admitted resource; cleanup then uses its captured id. */
export async function recoverReaderCreation(records:LoginRecords,operation:ReaderOperation,provider:HostProvider):Promise<void> {
 let current=operation;
 const owned=()=>{if(current.phase!=='creating'||JSON.stringify(records.readerOperation(current.login,current.host))!==JSON.stringify(current))throw Error('reader ownership changed');};
 owned();
 if(!current.volume){
  const inventory=await provider.listVolumes({project:current.project});
  owned();
  if(inventory.state!=='listed')throw Error(`login ${current.login}: outcome unknown`);
  const matches=inventory.volumes.filter(v=>v.name===current.name&&v.project===current.project&&v.region===current.region);
  if(matches.length!==1||matches[0]!.attachedTo!==null)throw Error(`login ${current.login}: outcome unknown`);
  current={...current,volume:matches[0]!};records.saveReader(current);
 }
 owned();
 if(current.volume!.attachedTo!==null)throw Error(`login ${current.login}: outcome unknown`);
 current={...current,phase:'deleting'};records.saveReader(current);
 await deleteReaderVolume(records,current,provider);
}
