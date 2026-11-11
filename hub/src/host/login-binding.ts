import type { LoginRecords, Login, ReaderOperation } from './logins.ts';
import type { Host } from './host.ts';
import type { HostProvider, Machine } from './provider/provider.ts';
import { mountedOpenCodeDatabase, type AccountSelection } from '../accounts/registry.ts';
import { randomUUID } from 'node:crypto';
import { deleteReaderVolume, recoverReaderCreation } from './login-reader.ts';

export const loginMount = (login: Pick<Login,'harness'|'name'>): string => `/cland/auth/${login.harness}-${login.name}`;
export function loginEnvironment(login: Pick<Login,'harness'|'name'>): Record<string,string> {
 const path=loginMount(login);
 return login.harness==='opencode' ? {OPENCODE_DB:mountedOpenCodeDatabase(path)} : login.harness==='codex' ? {CODEX_HOME:path} : {CLAUDE_CONFIG_DIR:path};
}
export type ProvisionLoginDemand = {harness:string;account:string|null;validate?():void};
export type ProvisionLoginWork = {ready():Promise<void>;failed():Promise<void>};
type BindingInput = {host:Pick<Host,'name'|'loginDisk'>;machine:Machine;provider:()=>HostProvider;providerName:string;region:string;pool:string;project:string;harness:string;account:string|null;validate():void;checkAccount(account:string):void};
export type PreparedLogin = {finish(host:Pick<Host,'name'|'loginDisk'>):Promise<BoundLogin>;rollback():Promise<void>};
export type BoundLogin = AccountSelection & {login:string};
/** One owner serializes selection and persists the pending fence before any native effect. */
export class LoginBinder {
 #tail:Promise<unknown>=Promise.resolve();
 #closed=false;
 #pending=0;
 readonly records:LoginRecords;
 constructor(records:LoginRecords) {this.records=records;}
 bind(input:BindingInput):Promise<BoundLogin> {
  if(this.#closed)return Promise.reject(Error('login binding owner is closed'));
  this.#pending++;
  const work=this.#tail.then(async()=>{const prepared=await this.#prepare(input);return prepared.finish(input.host);}).finally(()=>{this.#pending--;});
  this.#tail=work.catch(()=>{});return work;
 }
 prepare(input:BindingInput):Promise<PreparedLogin> {
  if(this.#closed)return Promise.reject(Error('login binding owner is closed'));
  this.#pending++;
  const work=this.#tail.then(()=>this.#prepare(input)).finally(()=>{this.#pending--;});
  this.#tail=work.catch(()=>{});return work;
 }
 close():void|Promise<void> {this.#closed=true;if(this.#pending)return this.#tail.then(()=>{});}
 #validate(input:Parameters<LoginBinder['bind']>[0], login?:Login):void {if(this.#closed)throw Error('login binding owner is closed');input.validate();if(login)input.checkAccount(login.account);}
 async #prepare(input:BindingInput):Promise<PreparedLogin> {
  this.#validate(input);
  const retained=this.records.readerForHost(input.host.name,input.harness);
  if(retained&&retained.phase!=='bound'){
   if(retained.provider!==input.providerName||retained.project!==input.project||retained.machine.id!==input.machine.id||retained.machine.created!==input.machine.created)throw Error(`login ${retained.login}: outcome unknown`);
   if(retained.phase==='creating')await recoverReaderCreation(this.records,retained,input.provider());
   else await deleteReaderVolume(this.records,retained,input.provider());
   throw Error(`login ${retained.login}: previous reader allocation recovered; retry launch`);
  }
  const selection=this.records.selectForLaunch({host:input.host.name,harness:input.harness,provider:input.providerName,region:input.region,account:input.account});
  const held=selection.held;
  if(held.some(({binding})=>binding.phase==='pending'))throw Error(`login ${held.find(({binding})=>binding.phase==='pending')!.login.name}: outcome unknown`);
  if(held.length){
   const login=held[0]!.login;
   if(held.length!==1 || login.kind!=='disk' || login.state!=='in-use' || login.provider!==input.providerName || login.region!==input.region)throw Error(`login ${login.name}: incompatible host binding`);
   if(input.account&&login.account!==input.account)throw Error(`no login ${input.harness} in pool ${input.pool}: host account differs`);
   this.#validate(input,login);
   return {finish:async()=>({login:login.name,account:login.account,accountEnv:loginEnvironment(login)}),rollback:async()=>{}};
  }
  const login=selection.ready;
  if(login?.kind==='key'){
   this.#validate(input,login);
   return {finish:async()=>{this.#validate(input,login);return {login:login.name,account:login.account,accountEnv:{}};},rollback:async()=>{}};
  }
  if(!login||login.kind!=='disk'||!login.volumeId)throw Error(`no login ${input.harness} in pool ${input.pool}`);
  if(!input.host.loginDisk)throw Error(`login ${login.name}: host lacks login-disk`);
  this.#validate(input,login);
  const provider=input.provider();
  const inventory=await provider.listVolumes({project:input.project});
  this.#validate(input,login);
  let volume=inventory.state==='listed'?inventory.volumes.find(v=>v.id===login.volumeId):undefined;
  if(!volume)throw Error(`login ${login.name}: volume unavailable`);
  const reader=login.state==='in-use';
  let operation:ReaderOperation|undefined;
  if(reader){
   const snapshot=login.snapshotIds.at(-1);
   if(!snapshot)throw Error(`login ${login.name}: missing snapshot for reader`);
   operation={login:login.name,host:input.host.name,harness:input.harness,provider:input.providerName,project:input.project,pool:input.pool,region:input.region,machine:input.machine,name:`cland-reader-${randomUUID()}`,snapshot,phase:'creating'};
   this.records.beginReader(operation);
   const clone=await provider.createVolume({project:input.project,name:operation.name,region:input.region,sizeGiB:1,fromSnapshot:snapshot,admission:{login:login.name,project:input.project,pool:input.pool}});
   if(clone.state==='refused')this.records.refuseReader(operation);
   if(clone.state!=='created')throw Error(`login ${login.name}: reader volume unavailable`);
   volume=clone.volume;
   operation={...operation,volume};this.records.saveReader(operation);
   try {this.#validate(input,login);this.records.bindReader(operation);}
   catch(error){await recoverReaderCreation(this.records,operation,provider);throw error;}
  }else{
   this.records.bind(login.name,{host:input.host.name,role:'writer',volumeId:volume.id,phase:'pending'});
  }
  let attached=false,attachAttempted=false,mountAttempted=false,mountHost=input.host,settled=false,fenced=false;
  const rollback=async()=>{
   if(settled||fenced||(!attached&&(!reader||attachAttempted)))return;
   fenced=true;
   if(mountAttempted)await mountHost.loginDisk!({op:'umount',volume:volume.name,path:loginMount(login)});
   if(attached&&(await provider.detachVolume(volume,input.machine)).state!=='detached')throw Error(`login ${login.name}: outcome unknown`);
   if(operation){operation={...operation,phase:'deleting'};this.records.saveReader(operation);await deleteReaderVolume(this.records,operation,provider);}
   else this.records.unbind(login.name,input.host.name);
   attached=false;
  };
  const fail=async(error:unknown):Promise<never>=>{
   if(['CLAND_HOST_OUTCOME_UNKNOWN','CLAND_NATIVE_INCOMPLETE'].includes(String((error as NodeJS.ErrnoException).code))){fenced=true;throw Error(`login ${login.name}: outcome unknown`);}
   try {await rollback();}catch {throw Error(`login ${login.name}: outcome unknown`);}
   if(this.records.bindings(login.name).some(b=>b.host===input.host.name))throw Error(`login ${login.name}: outcome unknown`);
   if(mountAttempted)throw Error(`login ${login.name}: bind failed`);
   throw error;
  };
  try {
   this.#validate(input,login);
   attachAttempted=true;
   const result=await provider.attachVolume(volume,input.machine);
   if(result.state!=='attached') {
    if(result.state==='refused'){
     if(operation){operation={...operation,phase:'deleting'};this.records.saveReader(operation);await deleteReaderVolume(this.records,operation,provider);}
     else this.records.unbind(login.name,input.host.name);
     throw Error(`login ${login.name}: attachment refused: ${result.reason}`);
    }
    throw Error(`login ${login.name}: outcome unknown`);
   }
   attached=true;this.#validate(input,login);
  }catch(error){return fail(error);}
  return {rollback,finish:async host=>{
   try {
    this.#validate(input,login);mountHost=host;
    if(host.name!==input.host.name||!host.loginDisk)throw Error(`login ${login.name}: host lacks login-disk`);
    mountAttempted=true;
    await host.loginDisk({op:'mount',volume:volume.name,path:loginMount(login)});
    this.#validate(input,login);this.records.settleBinding(login.name,input.host.name);settled=true;
    return {login:login.name,account:login.account,accountEnv:loginEnvironment(login)};
   }catch(error){return fail(error);}
  }};
 }
}
