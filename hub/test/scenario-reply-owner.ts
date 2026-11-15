import {realClock,type Clock} from '../src/hub/clock.ts';
import type {HubFrame} from '../src/protocol.ts';
import {testWaitMs,waitTimeoutMs} from './until.ts';
type Result=Extract<HubFrame,{type:'result'}>;

/** Result receipt ownership independent of frameClient's uncancellable waiters. */
export function scenarioReplyOwner(clock:Clock=realClock) {
 const waiting=new Map<string,(error:Error|null,frame?:Result)=>void>();
 const operations=new Set<Promise<Result>>();
 let closing=false;
 return {
  receive(frame:HubFrame){if(frame.type==='result')waiting.get(frame.id)?.(null,frame);},
  exchange(id:string,upload:()=>void):Promise<Result>{
   const work=Promise.resolve().then(async()=>{
    if(closing)throw Error('scenario reply owner is closed');
    if(waiting.has(id))throw Error('duplicate scenario reply id');
    const receipt=Promise.withResolvers<Result>();
    void receipt.promise.catch(()=>{});
    const timer=clock.setTimeout(()=>finish(Error('scenario remote result receipt timed out')),waitTimeoutMs(testWaitMs(5000)));
    const finish=(error:Error|null,frame?:Result)=>{
     waiting.delete(id);clock.clearTimeout(timer);
     if(error)receipt.reject(error);else receipt.resolve(frame!);
    };
    waiting.set(id,finish);
    try{upload();return await receipt.promise;}
    catch(error){finish(error instanceof Error?error:Error('scenario upload failed'));await receipt.promise.catch(()=>{});throw error;}
    finally{waiting.delete(id);clock.clearTimeout(timer);}
   });
   operations.add(work);
   void work.then(()=>operations.delete(work),()=>operations.delete(work));
   return work;
  },
  async close(){
   closing=true;
   for(const finish of [...waiting.values()])finish(Error('scenario reply owner is closed'));
   await Promise.allSettled([...operations]);
  },
 };
}
