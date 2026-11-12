import {preparePoolLogin} from '../src/host/login-add.ts';
import type {Host,SignInClose} from '../src/host/host.ts';
import {remoteRedactor} from '../src/remote/redact.ts';
import {assertPublishable} from '../../.agents/skills/qa/qa-demo-policy.ts';

export const NATIVE_CARD_INPUT='SENTINEL-native-card-input';

/** Observe the actual prepared Host operation before it starts, including a
 * pre-prompt failure. This never replaces native ownership or its output bytes. */
export function nativeSignInTrace(){
 type Record={harness:string;admission?:string;status:string;stdout:string;stderr:string;bytes:number;truncated:boolean;close?:SignInClose;errorCode?:string};
 const runs:Record[]=[],wrapped=new WeakSet<Host>(),redact=remoteRedactor([NATIVE_CARD_INPUT]);let dropped=false;
 const prepare:typeof preparePoolLogin=async(options,input)=>{
  const prepared=await preparePoolLogin(options,input),host=prepared.nativeHost;
  if(host?.signIn&&!wrapped.has(host)){
   const signIn=host.signIn.bind(host);wrapped.add(host);
   host.signIn=async(input,output)=>{
    const record:Record={harness:input.harness,status:'starting',stdout:'',stderr:'',bytes:0,truncated:false};
    if(runs.length<8)runs.push(record);else dropped=true;
    try{
     const run=await signIn(input,value=>{
      record.admission=value.admission;const bytes=Buffer.byteLength(value.text);
      if(record.bytes+bytes<=65536){record[value.stream]+=value.text;record.bytes+=bytes;}else record.truncated=true;
      output(value);
     });
     record.admission=run.admission;record.status='running';
     void run.closed.then(close=>{record.close=close;record.status='closed';},()=>{record.status='native-incomplete';});
     return run;
    }catch(error){
     const failure=error as {nativeAdmission?:unknown;code?:unknown};
     record.status=failure?.nativeAdmission==='not-admitted'?'not-admitted':'native-incomplete';
     if(typeof failure?.code==='string'&&/^CLAND_[A-Z_]+$/.test(failure.code))record.errorCode=failure.code;
     throw error;
    }
   };
  }
  return prepared;
 };
 return {prepare,diagnostics:()=>{
  // Redact the complete bounded stream first, then cut its tail: chunk splits
  // and a secret crossing the tail boundary cannot publish partial input.
  const facts=runs.map(record=>({harness:record.harness,admission:record.admission??'unknown',status:record.status,
   close:record.close??{state:'incomplete',reason:'native close receipt unavailable'},errorCode:record.errorCode??null,
   stderrTail:redact.text(record.stderr).slice(-3000),stdoutTail:redact.text(record.stdout).slice(-3000),truncated:record.truncated}));
  const result={runs:facts.length?facts:[{status:'incomplete',reason:'no native operation observed'}],dropped};
  try{assertPublishable(result);return result;}catch{return {runs:[{status:'incomplete',reason:'diagnostic withheld by secret scan'}],dropped};}
 }};
}
