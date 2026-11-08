import type { Clock } from '../hub/clock.ts';
import type { HostRecords } from './records.ts';
import type { HostPools } from './pools.ts';
import { inspectHostSpendSnapshot } from '../executor/droplet/spend.ts';

/** Current inventory only; retained terminal provision history is not read. */
export async function hostStatus(records:HostRecords, settings:HostPools, processes:readonly {name:string;host?:string;harness:string;status:string}[], env:NodeJS.ProcessEnv, clock:Clock, project?:string, usage:(host:string)=>{usedMilli:number;promisedMilli:number}=()=>({usedMilli:0,promisedMilli:0})) {
 const now=clock.now().getTime();
 const {totals:settled,billing}=await inspectHostSpendSnapshot(env,clock,project);
 const rows=new Map([...records.provisions.currentInventory(),...records.provisions.registered()].filter(r=>r.state!=='destroyed'&&r.release!=='released').map(r=>[r.id,r]));
 const names=new Set([...Object.keys(settings.pools),...Object.keys(settled.pools),...[...rows.values()].map(r=>r.pool)]);
 return {pools:[...names].sort().map(name=>{
  const spend:{today:number|null;month:number|null}={...(settled.pools[name]??{today:0,month:0})};
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
   return {id:row.id,size:row.size,region:row.region,state:row.state,uptime,sessions:sessions.map(p=>p.name),priceHourly,slotsUsed:(capacity.usedMilli+capacity.promisedMilli)/1000,...(capacity.promisedMilli?{slotsPromised:capacity.promisedMilli/1000}:{}),slotsTotal:settings.pools[name]?.slots??0};
  });
  return {name,hosts,hostCount:hosts.length,slotsUsed:hosts.reduce((n,h)=>n+h.slotsUsed,0),slotsTotal:hosts.reduce((n,h)=>n+h.slotsTotal,0),...(hosts.some(h=>h.slotsPromised)?{slotsPromised:hosts.reduce((n,h)=>n+(h.slotsPromised??0),0)}:{}),spend};
 })};
}
