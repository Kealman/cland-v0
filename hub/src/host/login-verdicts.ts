import type { LoginRecords } from './logins.ts';
import type { HarnessVerdict } from './scheduler.ts';

type Selection = {host:string;harness:string;provider:string;region:string;account?:string|null};
/** Read metadata only. LoginBinder remains the owner of binding and native effects. */
export function loginVerdict(records:LoginRecords,input:Selection):HarnessVerdict {
 const held=records.heldForLaunch(input);
 if(held.length){
  if(held.some(({login})=>login.state==='signed-out'))return 'signed-out';
  if(held.length!==1)return 'no-login';
  const {login,binding}=held[0]!;
  if(binding.phase==='pending'||login.state!=='in-use'||(input.account&&login.account!==input.account))return 'no-login';
  if(login.kind==='key')return 'serves';
  return login.provider===input.provider&&login.region===input.region&&!!binding.volumeId?'serves':'no-login';
 }
 return records.selectCapacityLogin(input)?'can-bind':'no-login';
}
