import {FAKE_STORAGE_PRICES} from './provider/fake.ts';
import {DIGITALOCEAN_STORAGE_PRICES} from './provider/digitalocean.ts';
import type { Clock } from '../hub/clock.ts';
import type { HostRecords } from './records.ts';
import type { HostPools } from './pools.ts';
import { inspectHostSpendSnapshot } from '../executor/droplet/spend.ts';

/** Current inventory only; retained terminal provision history is not read. */
export async function hostStatus(records:HostRecords, settings:HostPools, processes:readonly {name:string;host?:string;harness:string;status:string}[], env:NodeJS.ProcessEnv, clock:Clock, project?:string, usage:(host:string)=>{usedMilli:number;promisedMilli:number}=()=>({usedMilli:0,promisedMilli:0}), roles:readonly {pool:string;harness:string}[]=[]) {
 const now=clock.now().getTime();
 const {totals:settled,billing}=await inspectHostSpendSnapshot(env,clock,project);
 const rows=new Map([...records.provisions.currentInventory(),...records.provisions.registered()].filter(r=>r.state!=='destroyed'&&r.release!=='released').map(r=>[r.id,r]));
 const month=Date.parse(clock.now().toISOString().slice(0,7)+'-01T00:00:00Z');
 const end=new Date(month);end.setUTCMonth(end.getUTCMonth()+1);
 const storage=new Map<string,number|null>();
 for(const login of records.logins.storageRows(new Date(month).toISOString())){
  if(login.kind!=='disk'||!login.storage)continue;
  const pool=login.storage.pool;
  const prices=login.provider==='digitalocean'?DIGITALOCEAN_STORAGE_PRICES:login.provider==='fake'?FAKE_STORAGE_PRICES:null;
  let cost=storage.has(pool)&&storage.get(pool)===null?NaN:storage.get(pool)??0;
  for(const item of login.storage.items){
   const overlap=Math.max(0,Math.min(now,item.deleted===null?now:Date.parse(item.deleted))-Math.max(month,Date.parse(item.created)));
   if(!overlap)continue;
   if(!prices){cost=NaN;break;}
   cost+=item.sizeGiB*(item.kind==='volume'?prices.volumePerGiBMonth:prices.snapshotPerGiBMonth)*overlap/(end.getTime()-month);
  }
  storage.set(pool,Number.isFinite(cost)?cost:null);
 }
 const harnesses=records.logins.harnesses();
 const names=new Set([...Object.keys(settings.pools),...Object.keys(settled.pools),...storage.keys(),...[...rows.values()].map(r=>r.pool)]);
 return {pools:[...names].sort().map(name=>{
  const spend:{today:number|null;month:number|null}={...(settled.pools[name]??{today:0,month:0})};
  const storageCost=storage.has(name)?storage.get(name)!:0;
  if(spend.month!==null)spend.month=storageCost===null?null:spend.month+storageCost;
  const pool=settings.pools[name];
  const capacity=Object.fromEntries([...new Set([...harnesses,...roles.filter(role=>role.pool===name).map(role=>role.harness)])].sort().map(harness=>[harness,pool?records.logins.capacity({harness,provider:pool.provider,region:pool.region},pool.maxHosts):0]));
  const hosts=[...rows.values()].filter(r=>r.pool===name).sort((a,b)=>a.id.localeCompare(b.id)).map(row=>{
   const sessions=processes.filter(p=>p.host===row.id&&p.status==='running');
   const priceHourly=billing[row.id]??null;
   const created=row.machine?Date.parse(row.machine.created):null;
   const uptime=created===null?null:Math.max(0,(now-created)/1000);
   if(created!==null&&priceHourly!==null&&!row.machineDeletionRead){
    const day=Date.parse(clock.now().toISOString().slice(0,10)+'T00:00:00Z');
    const month=Date.parse(clock.now().toISOString().slice(0,7)+'-01T00:00:00Z');
    if(spend.today!==null)spend.today+=Math.max(0,now-Math.max(created,day))/3600000*priceHourly;
    if(spend.month!==null)spend.month+=Math.max(0,now-Math.max(created,month))/3600000*priceHourly;
   }
   if(created!==null&&priceHourly===null&&!row.machineDeletionRead){spend.today=null;spend.month=null;}
   const capacity=usage(row.id);
   const logins=records.logins.forHost(row.id).map(binding=>({harness:records.logins.get(binding.login)!.harness,name:binding.login}));
   return {logins,id:row.id,size:row.size,region:row.region,state:row.state,uptime,sessions:sessions.map(p=>p.name),priceHourly,slotsUsed:(capacity.usedMilli+capacity.promisedMilli)/1000,...(capacity.promisedMilli?{slotsPromised:capacity.promisedMilli/1000}:{}),slotsTotal:settings.pools[name]?.slots??0};
  });
  return {name,capacity,storage:storageCost,hosts,hostCount:hosts.length,slotsUsed:hosts.reduce((n,h)=>n+h.slotsUsed,0),slotsTotal:hosts.reduce((n,h)=>n+h.slotsTotal,0),...(hosts.some(h=>h.slotsPromised)?{slotsPromised:hosts.reduce((n,h)=>n+(h.slotsPromised??0),0)}:{}),spend};
 })};
}
