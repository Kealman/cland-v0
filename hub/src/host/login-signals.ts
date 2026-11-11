import type { LoginRecords } from './logins.ts';
import type { HarnessProcess } from '../adapters/contract.ts';

export const ONE_SIGN_IN_HINT='This account seems to allow one sign-in: set exclusive or add an account.';
export function loginSignInHint(episode:{oneSignIn?:true}|undefined):string {
 return episode?.oneSignIn?ONE_SIGN_IN_HINT:'';
}

export type MarkLoginSignedOut = (name:string, receipt:{reason:string;host:string|null})=>void;
type SignalOptions={records:LoginRecords;markSignedOut:MarkLoginSignedOut;signedOut:(name:string)=>void};
export class LoginSignals {
 readonly options:SignalOptions;
 constructor(options:SignalOptions) {this.options=options;}
 report(row:HarnessProcess, hit:{reason:string}):void {
  if(!row.host||row.host==='local'||!row.login)return;
  const login=this.options.records.get(row.login);
  if(!login||login.harness!==row.harness||!['ready','in-use'].includes(login.state))return;
  if(login.kind==='disk'&&!this.options.records.heldForLaunch({host:row.host,harness:row.harness}).some(held=>held.login.name===login.name&&held.binding.phase!=='pending'))return;
  this.options.markSignedOut(login.name,{reason:hit.reason,host:row.host});
  this.options.signedOut(login.name);
 }
}

/** Classify only native error fields, returning a bounded public signal, never
 * the diagnostic body (which can contain secrets or user text). */
export function deadLoginReason(harness: string, error: unknown): string | undefined {
 const row = error && typeof error === 'object' ? error as Record<string,unknown> : {};
 if(harness==='opencode')return row.type==='provider.auth'?'provider.auth':undefined;
 const text=[typeof error==='string'?error:'',row.error,row.error_details,row.message].filter(v=>typeof v==='string').join('\n');
 const signals=harness==='claude-code'?['authentication_failed','Login expired','OAuth token revoked']:harness==='codex'?['refresh_token_reused']:[];
 for(const signal of signals)if(text.includes(signal))return signal;
 if(harness==='codex'&&row.codexErrorInfo==='unauthorized')return 'unauthorized';
 if((harness==='claude-code'||harness==='codex')&&([row.status,row.statusCode,row.httpStatus].some(v=>v===401)||/\b401\b/.test(text)))return '401';
 return undefined;
}
