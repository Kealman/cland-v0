import type {Store} from '../hub/store.ts';
import type {HubCards} from '../hub/hub-cards.ts';
import type {Clock} from '../hub/clock.ts';
import type {LoginAddInput,LoginSignIn} from './login-signin.ts';
import type {LoginCardIntent} from './login-card-intents.ts';
import {setImmediate as yieldLoop} from 'node:timers/promises';
import {parseSignInOutput} from './login-signin-output.ts';
import type {Host,SignInOutput,SignInClose,SignInRun} from './host.ts';
import {parseSignInClose} from './agent/signin-types.ts';

type Output=SignInOutput;
type Close=SignInClose;
type Run=SignInRun;
type Input=LoginAddInput & {signin?:boolean};
export type LoginCardSignInOptions={
 store:Store;cards:HubCards;clock:Clock;
 prepare:(input:Input,signal:AbortSignal)=>Promise<{pending:LoginSignIn;host:string;nativeHost?:Host}>;
 run:(input:{host:string;harness:LoginAddInput['harness'];path:string;nativeHost?:Host},output:(value:Output)=>void)=>Promise<Run>;
 registerSecret:(text:string)=>void;
 notice?:(text:string)=>void;
};
type Active={cancel:()=>void};
const limitMs=15*60*1000;

/** Card orchestration only. Preparation, native ownership and disk completion
 * belong to their existing owners; elapsed time never grants disk cleanup. */
export class LoginCardSignIn {
 readonly #o:LoginCardSignInOptions;
 readonly #work=new Set<Promise<void>>();
 readonly #failures=new Set<unknown>();
 readonly #recovery:Promise<void>;
 readonly #active=new Set<Active>();
 readonly #codes=new Map<string,{run:Run;cancel:()=>void;acceptsInput:boolean}>();
 #stopped=false;
 constructor(o:LoginCardSignInOptions){
  this.#o=o;
  this.#recovery=this.#recover(o.store.cardSignIns.through()).catch(error=>{this.#failures.add(error);});
  o.cards.onAnswer('login-create',(payload,_answer,context)=>{
   if(context.declined||context.option!==1)return 'Not now';
   const {pool,harness}=payload as {pool:string;harness:Input['harness']};
   this.#admit();
   const input={pool,harness};this.#setIntent(context.id,{input,at:o.clock.now().getTime()});
   context.afterCommit(()=>this.#start(context.id,input));return 'Signing in';
  });
  o.cards.onAnswer('login-signin',(payload,_answer,context)=>{
   if(context.declined||context.option===2)return 'Not now';
   this.#admit();
   const {login,episode}=payload as {login:string;episode:string},row=o.store.hosts.logins.get(login);
   if(row?.kind!=='disk'||row.state!=='signed-out'||row.signedOut?.id!==episode||o.store.hosts.logins.isRemoving(login))throw Error('Sign-in episode unavailable');
   const input={name:login,harness:row.harness,signin:true};this.#setIntent(context.id,{input,at:o.clock.now().getTime()});
   context.afterCommit(()=>this.#start(context.id,input));return 'Signing in';
  });
  o.cards.onAnswer('login-signin-code',(_payload,answer,context)=>{
   const active=this.#codes.get(context.id);if(!active)throw Error('Sign-in no longer active');
   if(context.declined||!active.acceptsInput){context.afterCommit(()=>active.cancel());return 'Cancelled';}
   const text=answer.trim();
   if(!text||Buffer.byteLength(text)>4096||/[\r\n\x00-\x1f\x7f]/.test(text))throw Error('Enter one code');
   o.registerSecret(text);
   context.afterCommit(()=>{
    const work=(async()=>{try{await active.run.write(text+'\n');}catch{active.cancel();}})();
    this.#track(work);return work;
   });
   return 'Code received';
  });
 }
 #admit(){if(this.#stopped)throw Error('Sign-in stopped');}
 async #recover(through:number):Promise<void>{
  const o=this.#o;let after=0;await yieldLoop();
  while(!this.#stopped){const page=o.store.cardSignIns.page(after,through);if(!page.length)return;
   for(const intent of page)o.store.transaction(()=>{
    const login=intent.login?o.store.hosts.logins.get(intent.login):null;
    if(login&&(login.state==='ready'||login.state==='in-use')){
     if(intent.card&&o.store.ask(intent.card)?.state==='open')o.cards.withdraw(intent.card,'Login ready');
     o.store.cardSignIns.remove(intent.id,intent.seq);return;
    }
    if(!o.notice)throw Error('Sign-in recovery notice unavailable');
    const unknown=!intent.input.signin&&intent.login&&intent.host;
    const reason=unknown?'sign-in outcome unknown':'Sign-in interrupted';
    if(intent.card&&o.store.ask(intent.card)?.state==='open')o.cards.withdraw(intent.card,reason);
    o.notice(unknown?`Login ${intent.login} on host ${intent.host}: sign-in outcome unknown`:'Card sign-in interrupted; inspect the login before retrying');
    o.store.cardSignIns.remove(intent.id,intent.seq);
   });
   after=page.at(-1)!.seq;await yieldLoop();
  }
 }
 #setIntent(id:string,value:LoginCardIntent):void{
  this.#o.store.cardSignIns.put(id,value);
 }
 #track(work:Promise<void>):void{
  this.#work.add(work);void work.catch(error=>{this.#failures.add(error);}).finally(()=>this.#work.delete(work));
 }
 #start(id:string,input:Input):void {
  if(this.#stopped)return;
  this.#track(this.#execute(id,input));
 }
 async #execute(id:string,input:Input):Promise<void>{
  const o=this.#o,controller=new AbortController();
  const admitted=o.store.cardSignIns.get(id)!,accepted=admitted.at;
  let pending:LoginSignIn|undefined,run:Run|undefined,card:string|undefined,expired=false,cancelling=false,completionStarted=false,retire=false;
  let output='',outputAdmission:string|undefined;
  let hostName:string|undefined;
  const cancellation=Promise.withResolvers<Close>();
  // A rejection is observed immediately, even if preparation has not returned.
  void cancellation.promise.catch(()=>{});
  const withdraw=(reason='Sign-in ended')=>{if(card){this.#codes.delete(card);if(o.store.ask(card)?.state==='open')o.cards.withdraw(card,reason);}};
  const cancel=(reason?:string)=>{
   expired=true;controller.abort();if(card)this.#codes.delete(card);
   if(reason)withdraw(reason);
   if(run&&!cancelling){cancelling=true;void Promise.resolve().then(()=>run!.cancel()).then(cancellation.resolve,cancellation.reject);}
  };
  const publish=()=>{
   if(expired||card||!run||!pending||!hostName||!outputAdmission)return;
   if(outputAdmission!==run.admission)throw Error('Sign-in admission changed');
   const parsed=parseSignInOutput(input.harness,output);if(!parsed)return;
   const {url,code}=parsed,handle=run,name=pending.name;
   o.store.transaction(()=>{
    card=o.cards.raise('login-signin-code','general',`Sign in ${name}: ${url}${code?' Code: '+code:''}`,
     input.harness==='claude-code'?[]:['Cancel'],input.harness==='claude-code',{login:name,admission:handle.admission,harness:input.harness,url},input.harness==='claude-code');
    this.#codes.set(card,{run:handle,cancel,acceptsInput:input.harness==='claude-code'});
    this.#setIntent(id,{input,at:accepted,card,login:name,host:hostName!});
   });
  };
  const active={cancel};this.#active.add(active);
  const timer=o.clock.setTimeout(()=>cancel('sign-in timed out; closing'),Math.max(1,accepted+limitMs-o.clock.now().getTime()));
  try{
   const prepared=await o.prepare(input,controller.signal);pending=prepared.pending;hostName=prepared.host;
   this.#setIntent(id,{input,at:accepted,login:pending.name,host:prepared.host});
   if(expired){completionStarted=true;await pending.complete(null);retire=true;return;}
   run=await o.run({host:prepared.host,harness:input.harness,path:pending.path,...(prepared.nativeHost?{nativeHost:prepared.nativeHost}:{})},value=>{
    if(expired)return;
    if(outputAdmission&&outputAdmission!==value.admission)throw Error('Sign-in output admission changed');
    outputAdmission=value.admission;
    output+=value.text;
    if(Buffer.byteLength(output)>65536)throw Error('Sign-in output limit');
    publish();
   });
   if(outputAdmission&&outputAdmission!==run.admission)throw Error('Sign-in admission changed');
   publish();
   if(expired)cancel();
   const closed=parseSignInClose(await Promise.race([run.closed,cancellation.promise]),run.admission);
   withdraw();
   completionStarted=true;await pending.complete(!expired&&!closed.outcome&&closed.signal===null?closed.code:null);retire=true;
  }catch(error){
   const notAdmitted=!run&&(error as {nativeAdmission?:string})?.nativeAdmission==='not-admitted';
   const unknown=pending&&!completionStarted&&!notAdmitted&&!input.signin;
   // Never infer writer closure from transport rejection or a deadline.
   if(pending&&!completionStarted){
    if(notAdmitted)await pending.complete(null);
    else if(pending.interrupt)await pending.interrupt();
   }
   o.store.transaction(()=>{
    withdraw(unknown?'sign-in outcome unknown':'Sign-in ended');
    if(unknown&&!o.notice)throw Error('Unknown sign-in outcome notice unavailable');
    o.notice?.(unknown?`Login ${pending!.name} on host ${hostName}: sign-in outcome unknown`:'Sign-in incomplete; inspect the login before retrying');
    o.store.cardSignIns.remove(id,admitted.seq);
   });
  }finally{o.clock.clearTimeout(timer);this.#active.delete(active);if(retire)o.store.cardSignIns.remove(id,admitted.seq);}
 }
 async idle():Promise<void>{await this.#recovery;while(this.#work.size)await Promise.allSettled([...this.#work]);if(this.#failures.size)throw new AggregateError([...this.#failures],'card sign-in drainage failed');}
 async stop():Promise<void>{this.#stopped=true;for(const active of this.#active)active.cancel();await this.idle();}
}
