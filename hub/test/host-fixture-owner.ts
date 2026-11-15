/** Own continuations before acquisition; late hubs join the same close owner. */
export function hostFixtureOwner(parent?: AbortSignal,beforeStop:()=>Promise<void>=async()=>{}) {
 const abort=new AbortController(),pending=new Set<Promise<unknown>>();
 const stops:Array<()=>Promise<void>>=[];
 const stopping=new Map<()=>Promise<void>,Promise<void>>();
 let closing:Promise<void>|undefined,closed=false;
 const signal=parent?AbortSignal.any([parent,abort.signal]):abort.signal;
 const run=<T>(action:(signal:AbortSignal)=>Promise<T>):Promise<T>=>{
  if(closing||signal.aborted)return Promise.reject(new Error('host fixture is closing'));
  const work=Promise.resolve().then(async()=>{
   signal.throwIfAborted();
   const value=await action(signal);
   signal.throwIfAborted();
   return value;
  });
  pending.add(work);
  void work.then(()=>pending.delete(work),()=>pending.delete(work));
  return work;
 };
 const stopOnce=(stop:()=>Promise<void>)=>{
  let work=stopping.get(stop);
  if(!work){work=Promise.resolve().then(stop);stopping.set(stop,work);}
  return work;
 };
 const close=()=>closing??=(async()=>{
  abort.abort(new Error('host fixture is closing'));
  const failures:unknown[]=[];
  try{await beforeStop();}catch(error){failures.push(error);}
  const stopKnown=async()=>{
   for(const stop of [...stops].reverse()){
    try{await stopOnce(stop);}catch(error){failures.push(error);}
   }
  };
  await stopKnown();
  while(pending.size)await Promise.allSettled([...pending]);
  await stopKnown();
  if(failures.length)throw new AggregateError(failures,'host fixture acquisitions did not close');
  closed=true;
 })();
 return {run,close,signal,stops,closed:()=>closed,
  start:<T extends {stop():Promise<void>}>(acquire:()=>Promise<T>,receipt:PromiseLike<void>=Promise.resolve())=>run(async()=>{
   const hub=await acquire();
   const stop=()=>hub.stop();stops.push(stop);
   // A late result stays owned even if its caller never receives it.
   if(signal.aborted){await stopOnce(stop);signal.throwIfAborted();}
   await receipt;
   return hub;
  }),
 };
}
