import { hostSettlementComplete } from './settle.ts';
import { readFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { machineEnv } from '../executor/droplet/machine.ts';
import { spawn } from 'node:child_process';
import { setTimeout as pause } from 'node:timers/promises';
import { parse } from 'smol-toml';
import { poolImageKey, samePoolImageKey } from './provider/pool-image.ts';
import { HostProviderRegistry } from './provider/registry.ts';
import { readHostPools } from './transport-config.ts';
import { renderPrelude } from './prelude.ts';
import { HostSecretStore } from './records.ts';
import type { HostRecords } from './records.ts';
import type { HostProvider, Machine } from './provider/provider.ts';
import { hostDirectory } from '../../../shared/fake-host-directory.ts';
import { deliverRuntime, RuntimeDeliveryIncomplete } from './code-delivery.ts';
import { remoteRedactor } from './agent/redact.ts';
import { VERSION } from '../version.ts';
import type { projectSshHosts } from './registry.ts';

const creations=new Map<string,{abort:AbortController;done:Promise<void>}>();
export const PROVISION_GATE_MS = 300000;
export type { ProvisionState, ProvisionRecord } from './provision-records.ts';
import type { ProvisionRecord } from './provision-records.ts';
const directory=(root:string)=>join(root,'.cland/run/host-provisions');
export async function listHosts(records:HostRecords, env:NodeJS.ProcessEnv) {
 const registry=new HostProviderRegistry({env});
 return records.provisions.list().map(record=>{
  const declarations=registry.resolve(record).declarations;
  return {...record,uptime:record.machine&&record.state==='ready'?Math.max(0,(Date.now()-Date.parse(record.machine.created))/1000):null,livePerHour:'state' in declarations?null:declarations.prices[record.size]?.livePerHour??null};
 });
}
/** Joins native close before returning, including deadline termination. Inputs stay on stdin. */
async function command(binary:string,args:string[],env:NodeJS.ProcessEnv,input='',timeoutMs=10000):Promise<void> {
 await new Promise<void>((resolve,reject)=>{
  const child=spawn(binary,args,{env:machineEnv(env),stdio:['pipe','ignore','pipe']});
  let error:Error|undefined;let tail='';const redact=remoteRedactor();
  child.stderr.on('data',bytes=>{tail=(tail+redact(String(bytes))).slice(-1000);});
  child.once('error',e=>{error=e;});
  child.stdin.on('error',()=>{});child.stdin.end(input);
  const timer=setTimeout(()=>{child.kill('SIGKILL');},timeoutMs);
  child.once('close',(code,signal)=>{clearTimeout(timer);if(error||code!==0)reject(error??new Error(`provision command exit=${code} signal=${signal}: ${tail}`));else resolve();});
 });
}
export async function createHost(o:{root:string;pool?:string|undefined; provider?:HostProvider; gateMs?:number;signal?:AbortSignal;registerSecrets?:(values:readonly string[])=>void;env:NodeJS.ProcessEnv;records:HostRecords;owner:Awaited<ReturnType<typeof projectSshHosts>>}) {
 const text=await readFile(join(o.root,'.cland/config.toml'),'utf8');
 const {pools}=readHostPools(parse(text).hosts), names=Object.keys(pools).sort();
 const pool=o.pool??(names.includes('agents')?'agents':names.length===1?names[0]:undefined);
 if(!pool||!Object.hasOwn(pools,pool))throw Error(`choose a configured pool: ${names.join(', ')||'none'}`);
 const config=pools[pool]!;
 const provider=o.provider??new HostProviderRegistry({env:o.env,digitalocean:{root:o.root}}).resolve(config);
 const admission=provider.createAdmission();
 if(admission.state==='refused')throw Error(admission.reason);
 const key=await poolImageKey(o.root,o.env,config.provider);
 let prepared;
 try {prepared=JSON.parse(await readFile(join(o.root,'.cland/run/hosts',pool+'-image.json'),'utf8'));}catch{}
 if(!prepared?.key||!samePoolImageKey(prepared.key,key))throw Error(`pool ${pool} image is not current; run cland host prepare ${pool}`);
 const record:ProvisionRecord={id:'host-'+randomUUID(),...config,pool,created:new Date().toISOString(),state:'creating'};
 o.records.provisions.save(record);
 const completion=Promise.withResolvers<void>(),abort=new AbortController();
 const signal=o.signal?AbortSignal.any([o.signal,abort.signal]):abort.signal;
 const creationKey=join(o.root,record.id);
 creations.set(creationKey,{abort,done:completion.promise});
 let registered=false,acquiring=false;
 try {
  // An actual OpenSSH key, never a key inferred from a responding machine.
  await mkdir(directory(o.root),{recursive:true,mode:0o700});
  const privateDirectory=join(directory(o.root),record.id);
  await mkdir(privateDirectory,{mode:0o700});
  const hostKey=join(privateDirectory,'host-key');
  await command('ssh-keygen',['-t','ed25519','-N','','-C','cland','-f',hostKey],o.env);
  const publicKey=(await readFile(hostKey+'.pub','utf8')).trim().split(/\s+/).slice(0,2).join(' ');
  const userData=renderPrelude({hostKey:await readFile(hostKey,'utf8'),hostPublicKey:publicKey,providerSteps:''});
  signal?.throwIfAborted();
  acquiring=true;
  const acquired=await provider.acquire({project:o.root,pool,architecture:process.arch==='arm64'?'arm64':'x86_64',region:config.region,userData,image:key});
  if(acquired.state!=='created')throw Error(acquired.reason);
  record.machine=acquired.machine;record.state='booting';o.records.provisions.save(record);
  signal?.throwIfAborted();
  const fake=hostDirectory(o.env.CLAND_FAKE_HOST_ROOT!,acquired.machine.id);
  const provisioningEnv={...o.env,CLAND_FAKE_HOSTS:[o.env.CLAND_FAKE_HOSTS,acquired.machine.address].filter(Boolean).join(',')};
  const known=join(privateDirectory,'known_hosts');
  const {writeFile}=await import('node:fs/promises');
  await writeFile(known,`${acquired.machine.address} ${publicKey}\n`,{mode:0o600});
  const base=['-F','/dev/null','-i',join(fake,'client-key'),...['BatchMode=yes','StrictHostKeyChecking=yes','GlobalKnownHostsFile=/dev/null','KnownHostsCommand=none','VerifyHostKeyDNS=no','UpdateHostKeys=no',`UserKnownHostsFile="${known}"`].flatMap(v=>['-o',v])];
  const destination=`agent@${acquired.machine.address}`;
  const ssh=o.env.CLAND_SSH_BIN??'ssh',scp=o.env.CLAND_SCP_BIN??'scp';
  const deadline=Date.now()+(o.gateMs??PROVISION_GATE_MS);
  signal?.throwIfAborted();
  let lastGateFailure='machine has not answered';
  while(true) {
   try {if((await provider.status(acquired.machine)).state!=='ready')throw Error('machine booting');await command(ssh,[...base,destination,'sh','-s'],provisioningEnv,'true\n',Math.max(1,Math.min(10000,deadline-Date.now())));break;}
   catch(error) {lastGateFailure=error instanceof Error?error.message:'probe outcome unavailable';signal?.throwIfAborted();if(Date.now()>=deadline)throw Error('pinned-key provisioning gate timed out: '+lastGateFailure);await pause(Math.max(1,Math.min(250,deadline-Date.now())),undefined,signal?{signal:signal}:{});}
  }
  record.state='connecting';o.records.provisions.save(record);
  const home=join(fake,'home');
  await deliverRuntime({transport:{execute:script=>command(ssh,[...base,destination,'sh','-s'],provisioningEnv,script,120000),copyFile:(source,target)=>command(scp,[...base,source,`${destination}:${target}`],provisioningEnv)},codeRoot:join(home,'.cland-host/code'),node:process.execPath,version:VERSION,...(signal?{signal:signal}:{})});
  signal?.throwIfAborted();
  const registration=new HostSecretStore(o.root,o.records,o.registerSecrets).register({id:record.id,address:acquired.machine.address,user:'agent',clientKeyPath:join(fake,'client-key'),knownHosts:`${acquired.machine.address} ${publicKey}\n`});
  registered=true;
  o.env.CLAND_FAKE_HOSTS=[o.env.CLAND_FAKE_HOSTS,acquired.machine.address].filter(Boolean).join(',');
  await o.owner.add(registration);
  record.state='cloning';o.records.provisions.save(record);
  await o.owner.ready(record.id,signal);
  signal?.throwIfAborted();
  record.state='ready';o.records.provisions.ready(record);
 } catch(error) {
  record.state='failed';record.reason=error instanceof Error?error.message:String(error);
  // A runtime owner must close before its machine can be released.
  try {
   if(error instanceof RuntimeDeliveryIncomplete)record.release='incomplete';
   else {
    const settled=!registered||hostSettlementComplete(await o.owner.remove(record.id));
    if(!settled)record.release='incomplete';
    else if(record.machine)record.release=(await provider.release(record.machine)).state;
    else if(acquiring)record.release='incomplete';
   }
  }catch {record.release='incomplete';}
  o.records.provisions.save(record);
 } finally {creations.delete(creationKey);completion.resolve();}
 return record;
}

/** Restore only the admitted registration/machine association. No new registration,
 * acquire, delivery or destructive reconciliation is inferred from a checkpoint. */
export async function restoreProvisionedFakeHosts(records:HostRecords,env:NodeJS.ProcessEnv):Promise<void> {
 // Probe only caller-supplied membership through indexed ownership lookups; do
 // not scan retained failed history on startup. Valid registrations rejoin below.
 const membership=new Set((env.CLAND_FAKE_HOSTS?.split(',').filter(Boolean)??[]).filter(address=>!records.provisions.ownsFakeAddress(address)));
 for(const provision of records.provisions.registered()) {
  if(provision.provider!=='fake')continue;
  const registration=records.get(provision.id);
  if(!registration)continue;
  // A caller's prior env entry is not the provider's identity receipt.
  membership.delete(registration.address);
  if(registration.state!=='registered'||provision.release==='released')continue;
  const machine=provision.machine;
  let owned=false;
  if(env.CLAND_FAKE_HOST_ROOT&&machine&&registration.address===machine.address) {
   const provider=new HostProviderRegistry({env}).resolve(provision);
   owned=(await provider.status(machine)).state==='ready';
   const current=records.get(provision.id);
   owned=owned&&current?.state==='registered'&&current.address===registration.address;
  }
  if(owned)membership.add(machine!.address);
  else records.provisions.save({...provision,state:'failed',release:'incomplete',reason:'fake host identity or environment unavailable; machine retained'});
 }
 env.CLAND_FAKE_HOSTS=[...membership].join(',');
}

/** Explicit destruction remains available when the transport cannot answer.
 * remove joins the existing revoke owner before provider deletion. */
export async function destroyHost(o:{root:string;id:string;env:NodeJS.ProcessEnv;records:HostRecords;owner:Awaited<ReturnType<typeof projectSshHosts>>;provider?:HostProvider;settleDeleted?:(id:string,read:string)=>void|Promise<void>;log:(event:{event:string;host:string;resource:string;read:string})=>void}) {
 const initial=o.records.provisions.get(o.id);
 if(!initial)throw Error('unknown host');
 let record:ProvisionRecord=initial;
 if(record.state==='destroyed')return record;
 record.state='destroying';record.reason='deletion not confirmed';o.records.provisions.save(record);
 try {
  const creation=creations.get(join(o.root,o.id));
  if(creation){creation.abort.abort();await creation.done;record=o.records.provisions.get(o.id)!;record.state='destroying';record.reason='deletion not confirmed';o.records.provisions.save(record);}
  // A failed provisioning attempt may never have published a registration.
  if(o.records.get(record.id))await o.owner.remove(record.id);
  const provider=o.provider??new HostProviderRegistry({env:o.env}).resolve(record);
  const confirmed=new Set<string>();
  if(!record.machine)throw Error('acquisition outcome unknown');
  const result=await provider.release(record.machine,receipt=>{confirmed.add(receipt.resource);if(receipt.resource==='machine'){record.machineDeletionRead=receipt.read;o.records.provisions.save(record);}o.log({event:'host-destroy',host:record.id,...receipt});});
  if(record.machineDeletionRead&&o.records.get(record.id))await o.settleDeleted?.(record.id,record.machineDeletionRead);
  record.release=result.state;
  if(result.state==='released'&&(!record.machine||confirmed.has('machine')&&confirmed.has('key'))){record.state='destroyed';delete record.reason;}
  else {record.release='incomplete';record.reason='deletion not confirmed'+(result.state==='incomplete'?': '+result.reason:': confirming reads missing');}
 }catch{record.release='incomplete';record.reason='deletion not confirmed';}
 o.records.provisions.save(record);
 return record;
}
