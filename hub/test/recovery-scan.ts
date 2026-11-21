import assert from 'node:assert/strict';
import {mkdir, readFile, readdir, rename, writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import type {TestContext} from 'node:test';
import {caseDeadlines} from './case-deadlines.ts';
import {beforeDirectories, guardDirectoryRemoval} from './process-cleanup.ts';
import {testWaitMs} from './until.ts';

/** Enroll the complete caller before acquisition; retain roots until the held
 * writer has a separate successful close receipt, even if its first close fails. */
export function recoveryScanOwner(t:TestContext, controls:{
  releaseOnClose?:()=>void;
  beforeRead?:(path:string)=>Promise<void>;
  afterWriterJoin?:()=>Promise<void>;
}={}) {
 const releaseRename=Promise.withResolvers<void>();
 let writer:Promise<void>|undefined,writerClosed=false;
 const scope=caseDeadlines(t,{timeoutMs:testWaitMs(),ownership:{beforeDirectories,guardDirectoryRemoval},releaseOnClose:()=>{
   releaseRename.resolve();controls.releaseOnClose?.();
 }});
 const closeWriter=async()=>{
   releaseRename.resolve();
   if(writerClosed||!writer)return;
   await writer;await controls.afterWriterJoin?.();writerClosed=true;
 };
 return {scope,closeWriter,
   writerClosed:()=>writerClosed,
   adoptRoot(root:string){
     scope.adoptRoot(root);
     guardDirectoryRemoval(root,async()=>{if(writer&&!writerClosed)throw new Error('scan writer close unconfirmed; root retained');});
   },
   async scan(roots:readonly string[],credential:string){
     const writerRoot=join(roots[0]!,'scan-writer');
     const temporary=join(writerRoot,'processes.json.new-held'),destination=join(writerRoot,'processes.json');
     await scope.wait('scan writer setup',async()=>{
       await mkdir(writerRoot);await writeFile(destination,'old');await writeFile(temporary,'replacement');
     });
     // The release and retention guards exist before this writer starts.
     writer=(async()=>{await releaseRename.promise;await rename(temporary,destination);})();
     void writer.catch(()=>{});
     let renamedAfterListing=false;
     const scan=async(root:string):Promise<void>=>{for(const entry of await readdir(root,{withFileTypes:true})){
       const path=join(root,entry.name);
       if(entry.isDirectory())await scan(path);
       else if(entry.isFile()){
         await controls.beforeRead?.(path);
         if(path===temporary){releaseRename.resolve();await writer;renamedAfterListing=true;}
         const contents=await readFile(path).catch(error=>{if(error.code==='ENOENT')return null;throw error;});
         if(contents!==null)assert.equal(contents.includes(credential),false,'recovered cleanup leaves no credential copy');
       }
     }};
     let primary:unknown;let failed=false;
     try{await scope.wait('credential scan action',async()=>{for(const root of roots)await scan(root);});}
     catch(error){primary=error;failed=true;}
     try{await scope.wait('scan writer close receipt',closeWriter);}
     catch(secondary){if(failed)throw new AggregateError([primary,secondary],'credential scan failed; writer drainage also failed',{cause:primary});throw secondary;}
     if(failed)throw primary;
     assert.equal(renamedAfterListing,true,'scan observed the temporary entry before the writer renamed it');
     assert.equal(await readFile(destination,'utf8'),'replacement','writer completed its atomic replacement');
   },
 };
}
