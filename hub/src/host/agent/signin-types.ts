export const SIGNIN_CAPABILITY = 'signin-v1';
export const SIGNIN_OUTPUT_BYTES = 64 * 1024;
export const SIGNIN_CHUNK_BYTES = 4096;
export const SIGNIN_RECEIPT_CACHE = 32;
export function signInNotAdmitted(code:string,message:string){return Object.assign(new Error(message),{nativeAdmission:'not-admitted' as const,code});}
export function signInRefusalFields(error:unknown):{nativeAdmission?:'not-admitted'}{
 return (error as {nativeAdmission?:unknown})?.nativeAdmission==='not-admitted'?{nativeAdmission:'not-admitted'}:{};
}
/** Both sides require an actual native exit fact and the captured admission. */
export function parseSignInClose(value:unknown,admission:string):SignInClose{
 const r=value as SignInClose;
 const code=Number.isInteger(r?.code)&&Number(r.code)>=0;
 const signal=typeof r?.signal==='string'&&/^SIG[A-Z0-9]+$/.test(r.signal);
 if(!r||r.admission!==admission||r.state!=='closed'||!(r.code===null||code)||!(r.signal===null||signal)||(!code&&!signal)||(r.outcome!==undefined&&r.outcome!=='output-limit'))throw new Error('sign-in native close incomplete');
 return {admission,state:'closed',code:r.code,signal:r.signal,...(r.outcome?{outcome:r.outcome}:{})};
}
export type SignInInput = {harness:'codex'|'claude-code'|'opencode';path:string};
export type SignInOutput = {admission:string;stream:'stdout'|'stderr';text:string};
export type SignInClose = {admission:string;state:'closed';code:number|null;signal:string|null;outcome?:'output-limit'};
export type SignInRun = {admission:string;write(text:string):Promise<void>;cancel():Promise<SignInClose>;closed:Promise<SignInClose>};
