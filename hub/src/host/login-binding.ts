import type { LoginRecords, Login } from './logins.ts';
import type { Host } from './host.ts';
import type { HostProvider, Machine } from './provider/provider.ts';
import { mountedOpenCodeDatabase, type AccountSelection } from '../accounts/registry.ts';

export const loginMount = (login: Pick<Login,'harness'|'name'>): string => `/cland/auth/${login.harness}-${login.name}`;
export function loginEnvironment(login: Pick<Login,'harness'|'name'>): Record<string,string> {
 const path=loginMount(login);
 return login.harness==='opencode' ? {OPENCODE_DB:mountedOpenCodeDatabase(path)} : login.harness==='codex' ? {CODEX_HOME:path} : {CLAUDE_CONFIG_DIR:path};
}
export type BoundLogin = AccountSelection & {login:string};
/** One owner serializes selection and persists the pending fence before any native effect. */
export class LoginBinder {
 #tail:Promise<unknown>=Promise.resolve();
 #closed=false;
 #pending=0;
 readonly records:LoginRecords;
 constructor(records:LoginRecords) {this.records=records;}
 bind(input:{host:Host;machine:Machine;provider:()=>HostProvider;providerName:string;region:string;pool:string;project:string;harness:string;account:string|null;validate():void;checkAccount(account:string):void}):Promise<BoundLogin> {
  if(this.#closed)return Promise.reject(Error('login binding owner is closed'));
  this.#pending++;
  const work=this.#tail.then(()=>this.#bind(input)).finally(()=>{this.#pending--;});
  this.#tail=work.catch(()=>{});return work;
 }
 close():void|Promise<void> {this.#closed=true;if(this.#pending)return this.#tail.then(()=>{});}
 #validate(input:Parameters<LoginBinder['bind']>[0], login?:Login):void {if(this.#closed)throw Error('login binding owner is closed');input.validate();if(login)input.checkAccount(login.account);}
 async #bind(input:Parameters<LoginBinder['bind']>[0]):Promise<BoundLogin> {
  this.#validate(input);
  const selection=this.records.selectForLaunch({host:input.host.name,harness:input.harness,provider:input.providerName,region:input.region,account:input.account});
  const held=selection.held;
  if(held.some(({binding})=>binding.phase==='pending'))throw Error(`login ${held.find(({binding})=>binding.phase==='pending')!.login.name}: outcome unknown`);
  if(held.length){
   const login=held[0]!.login;
   if(held.length!==1 || login.kind!=='disk' || login.state!=='in-use' || login.provider!==input.providerName || login.region!==input.region)throw Error(`login ${login.name}: incompatible host binding`);
   if(input.account&&login.account!==input.account)throw Error(`no login ${input.harness} in pool ${input.pool}: host account differs`);
   this.#validate(input,login);
   return {login:login.name,account:login.account,accountEnv:loginEnvironment(login)};
  }
  const login=selection.ready;
  if(!login||login.kind!=='disk'||!login.volumeId)throw Error(`no login ${input.harness} in pool ${input.pool}`);
  if(!input.host.loginDisk)throw Error(`login ${login.name}: host lacks login-disk`);
  this.#validate(input,login);
  const provider=input.provider();
  const inventory=await provider.listVolumes({project:input.project});
  this.#validate(input,login);
  const volume=inventory.state==='listed'?inventory.volumes.find(v=>v.id===login.volumeId):undefined;
  if(!volume)throw Error(`login ${login.name}: volume unavailable`);
  this.records.bind(login.name,{host:input.host.name,role:'writer',volumeId:volume.id,phase:'pending'});
  let attached=false;
  try {
   const result=await provider.attachVolume(volume,input.machine);
   if(result.state!=='attached') {
    if(result.state==='refused'){this.records.unbind(login.name,input.host.name);throw Error(`login ${login.name}: attachment refused`);}
    throw Error(`login ${login.name}: outcome unknown`);
   }
   attached=true;this.#validate(input,login);
   await input.host.loginDisk({op:'mount',volume:volume.name,path:loginMount(login)});
   this.#validate(input,login);
   this.records.settleBinding(login.name,input.host.name);
   return {login:login.name,account:login.account,accountEnv:loginEnvironment(login)};
  } catch(error) {
   // Native unknowns retain their admission fence. Only an observed unmount and
   // detach permit reuse, including a mount whose error may follow a side effect.
   if(['CLAND_HOST_OUTCOME_UNKNOWN','CLAND_NATIVE_INCOMPLETE'].includes(String((error as NodeJS.ErrnoException).code)))throw Error(`login ${login.name}: outcome unknown`);
   let rolledBack=false;
   if(attached)try {
    await input.host.loginDisk({op:'umount',volume:volume.name,path:loginMount(login)});
    const result=await provider.detachVolume(volume,input.machine);
    if(result.state==='detached'){
     this.records.unbind(login.name,input.host.name);
     rolledBack=true;
    }
   }catch { /* Missing native settlement keeps the durable binding fenced. */ }
   if(rolledBack)throw Error(`login ${login.name}: bind failed`);
   if(this.records.bindings(login.name).some(b=>b.host===input.host.name))throw Error(`login ${login.name}: outcome unknown`);
   throw error;
  }
 }
}
