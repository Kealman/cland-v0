import { lstat, opendir, mkdir } from 'node:fs/promises';
import { SUITE_RETENTION_BATCH_SIZE } from './suite-retention-policy.ts';
import type { Dir } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { checkpoint } from './host/agent/storage.ts';
import { suiteRunPinned } from './suite-reference-pins.ts';
import { retireSuiteRun, retireSuiteRuns } from './suite-raw-coverage.ts';
import { readSuiteInventory, InventoryBoundError, type RetirementInventory } from './suite-retirement-inventory.ts';
export type { RetirementInventory } from './suite-retirement-inventory.ts';

/** Cursor is held only by the shared serving-owner pass and closed on shutdown.
 * Admission requires an explicit indexed absence, not an absent JS property. */
export class UnindexedSuiteRetention {
  #directory:Dir|undefined;
  #report:{mode:'report'|'live';scanned:number;wouldRetire:number;removed:number;reasons:Record<string,number>}={mode:'report',scanned:0,wouldRetire:0,removed:0,reasons:{}};
  readonly root:string;
  constructor(root:string) {this.root=root;}
  snapshot(){return {...this.#report,reasons:{...this.#report.reasons}};}
  async close():Promise<void> {const directory=this.#directory;this.#directory=undefined;await directory?.close();}
  async sweep(options:{absent:(id:string)=>boolean; referenced:(id:string)=>boolean; now:number; minimumAgeMs:number; remove:boolean; stopped:()=>boolean; limit:number; emit:(id:string,removed:boolean,error?:unknown)=>void}):Promise<void> {
    this.#report={mode:options.remove?'live':'report',scanned:0,wouldRetire:0,removed:0,reasons:{}};
    const classify=(reason:string)=>{this.#report.reasons[reason]=(this.#report.reasons[reason]??0)+1;};
    const suites=join(this.root,'.cland/run/suites');
    for(const path of [join(this.root,'.cland'),join(this.root,'.cland/run'),suites]) {
      const info=await lstat(path).catch(error=>{if(error.code==='ENOENT')return null;throw error;});
      if(!info)return;
      if(!info.isDirectory()||info.isSymbolicLink())throw new Error('refusing linked suite discovery root');
    }
    this.#directory??=await opendir(suites,{bufferSize:32});
    const inventory=join(this.root,'.cland/artifacts',`suite-retention-${randomUUID()}.json`);
    const runs:RetirementInventory[]=[];
    let batch:Array<{id:string;artifacts:string[];eligible:()=>boolean;inventory:RetirementInventory}>=[];
    const flush=async()=>{
      if(!batch.length)return;
      const admitted=batch;batch=[];
      await mkdir(join(this.root,'.cland/artifacts'),{recursive:true});
      const artifactRoot=await lstat(join(this.root,'.cland/artifacts'));
      if(!artifactRoot.isDirectory()||artifactRoot.isSymbolicLink())throw new Error('refusing linked retirement inventory root');
      if(Buffer.byteLength(JSON.stringify({version:1,event:'suite-retirement-inventory',runs}))>2*1024*1024)throw new Error('retirement inventory exceeds 2 MiB');
      await checkpoint(inventory,{version:1,event:'suite-retirement-inventory',runs});
      if(options.remove) {
        const result=await retireSuiteRuns(this.root,admitted);
        for(const row of admitted){const outcome=result.get(row.id),removed=outcome?.removed===true;if(removed){classify('eligible');this.#report.wouldRetire++;this.#report.removed++;}else classify('unknown');options.emit(row.id,removed,outcome?.error??outcome?.cleanupError);}
      } else for(const row of admitted){const approved=await retireSuiteRun(this.root,row.id,row.artifacts,row.eligible,{inventory:row.inventory});if(approved){classify('eligible');this.#report.wouldRetire++;}else classify('unknown');options.emit(row.id,false);}
    };
    for(let examined=0;examined<options.limit&&!options.stopped();examined++) {
      if(examined%SUITE_RETENTION_BATCH_SIZE===0){await flush();await new Promise<void>(resolve=>setImmediate(resolve));}
      const entry=await this.#directory.read();
      if(!entry){await this.close();break;}
      this.#report.scanned++;
      const id=entry.name;
      if(!entry.isDirectory()||!/^[A-Za-z0-9_-]+$/.test(id)){classify('ignored');continue;}
      try {
        const eligible=()=>!options.stopped()&&options.absent(id)===true&&!options.referenced(id);
        if(options.absent(id)!==true){classify('indexed');continue;}
        if(options.referenced(id)){classify('reference');continue;}
        if(await suiteRunPinned(this.root,id)){classify('pin');continue;}
        const pointer=await lstat(join(this.root,'.cland/run/coverage-maps',`${id}.json`)).catch(error=>{if(error.code==='ENOENT')return null;throw error;});
        if(pointer){classify('pointer');continue;}
        const path=join(suites,id),info=await lstat(path);
        if(!info.isDirectory()||info.isSymbolicLink()){classify('unknown');continue;}
        if(options.now-info.mtimeMs<options.minimumAgeMs){classify('age-floor');continue;}
        const counts=await readSuiteInventory(path);
        if(counts.device!==info.dev||counts.inode!==info.ino||counts.mtimeMs!==info.mtimeMs){classify('unknown');continue;}
        if(options.now-counts.newestMtimeMs<options.minimumAgeMs){classify('age-floor');continue;}
        const row:RetirementInventory={id,...counts,indexAbsent:true,referenced:false,pinned:false,pointer:false};
        runs.push(row);
        batch.push({id,artifacts:[inventory],eligible,inventory:row});
      } catch(error) {classify(error instanceof InventoryBoundError?'inventory-bound':'unknown');options.emit(id,false,error);}
    }
    await flush();
  }
}
