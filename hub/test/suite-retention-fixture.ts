import type { TestContext } from 'node:test';
import fs from 'node:fs/promises';
import { realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import { guardedLeaseCase } from './executor-lease-fixture.ts';
import { afterCleanup, guardDirectoryRemoval, ownDirectory } from './process-cleanup.ts';
import { suiteUnit } from './suite-unit-fixture.ts';

/** Retention cases transfer root removal to this owner. Resource callbacks may
 * fail independently; neither an empty pending set nor rejection settles them. */
type Repair = {finishCleanup:()=>Promise<void>; releaseSeams:()=>void; removeOwnedRoot:(root:string)=>Promise<void>};
export function retentionCase(t: TestContext, releaseOnClose?: () => void, options: {timeoutMs?:number; onIncomplete?:(error:unknown,repair:Repair)=>Promise<void>} = {}) {
  type Close = { run: () => Promise<void>; closed: boolean };
  const closers: Close[] = [];
  const roots = new Map<string, () => Promise<void>>();
  const aliases = new Set<string>();
  let rootsClosed=false, originalJoined=false, deferring=false, repairComplete=true;
  const resourcesClosed=()=>closers.every(close=>close.closed);
  const scope=guardedLeaseCase(t,releaseOnClose,{...(options.timeoutMs===undefined?{}:{timeoutMs:options.timeoutMs}),deferRestore:true,canRestore:()=>originalJoined&&resourcesClosed()&&rootsClosed&&repairComplete});
  let cleanupError:unknown;
  const adoptRoot=(root:string)=>{
    const canonical=realpathSync(root);
    aliases.add(resolve(root));aliases.add(canonical);
    if(roots.has(canonical))return;
    roots.set(canonical,ownDirectory(undefined,canonical));
    guardDirectoryRemoval(canonical,()=>{
      if(!deferring&&(!originalJoined||!resourcesClosed()))throw new Error('resource closure unconfirmed; retention root kept');
    });
  };
  const cleanup=(run:()=>Promise<void>)=>{closers.push({run,closed:false});};
  const settleResources=async()=>{
    const failures:unknown[]=[];
    deferring=true;
    try {
      for(const close of [...closers].reverse()) {
        if(close.closed)continue;
        try {await close.run();close.closed=true;} catch(error){failures.push(error);}
      }
    } finally {deferring=false;}
    if(failures.length)throw new AggregateError(failures,'retention resources unconfirmed; roots and guards retained');
  };
  const fixtures=new Proxy(scope.fixtures,{
    get(target,key){
      if(key==='after')return (fn:Parameters<TestContext['after']>[0])=>cleanup(()=>new Promise<void>((resolve,reject)=>{
        const done=(error?:unknown)=>error?reject(error):resolve();
        const result=fn?.(target,done);
        if(!fn||fn.length<2)void Promise.resolve(result).then(()=>resolve(),reject);
      }));
      const value=Reflect.get(target,key,target);
      return typeof value==='function'?value.bind(target):value;
    },
  });
  // caseDeadlines invokes this only after original callback/acquisitions join.
  const finishCleanup=async()=>{
    if(!originalJoined)throw new Error('original callback has not joined; root retained');
    await settleResources();
    const failures:unknown[]=[];
    for(const close of roots.values())try{await close();}catch(error){failures.push(error);}
    if(failures.length)throw new AggregateError(failures,'retention root removal incomplete; guards retained');
    rootsClosed=true;
  };
  scope.fixtures.after(async()=>{
    originalJoined=true;
    try {await finishCleanup();}
    catch(error){cleanupError=error;if(!options.onIncomplete)throw error;}
  });
  const unit=(options:Parameters<typeof suiteUnit>[1]={})=>suiteUnit(fixtures,{...options,onRoot:adoptRoot});
  const removeOwnedRoot=(root:string)=>{
      const close=roots.get(realpathSync(root));
      if(!close)throw new Error('root not owned by retention fixture');
      return close();
  };
  afterCleanup(t,async()=>{
    if(cleanupError&&options.onIncomplete){
      repairComplete=false;
      await options.onIncomplete(cleanupError,{finishCleanup,releaseSeams:scope.releaseSeams,removeOwnedRoot});
      repairComplete=true;
    }
    scope.releaseSeams();
  });
  return {...scope,fixtures,adoptRoot,unit,cleanup,settleResources,removeOwnedRoot,
    run:(body:Parameters<typeof scope.run>[0])=>scope.run(async step=>{
      const remove=fs.rm;
      scope.patch(fs,'rm',async(...args:Parameters<typeof remove>)=>{
        if(typeof args[0]==='string'&&aliases.has(resolve(args[0]))) {
          if(deferring)return; // This owner, not the producer, now owns native root removal.
          if(!originalJoined||!resourcesClosed())throw new Error('resource closure unconfirmed; retention root kept');
        }
        return Reflect.apply(remove,fs,args);
      });
      await body(step);
    }),
  };
}
