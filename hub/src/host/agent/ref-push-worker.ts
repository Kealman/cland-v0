import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { run, nativeCommandIncomplete } from './command.ts';
import { checkpoint } from './storage.ts';
import { remoteRedactor } from './redact.ts';
const [runDir,id,cwd,argv]=process.argv.slice(2) as [string,string,string,string];
const birth=JSON.parse(await readFile(join(runDir,'launches',id,'birth.json'),'utf8')) as {launchId:string;pid:number;identity:string};
if(birth.launchId!==id||birth.pid!==process.pid)throw new Error('push producer admission mismatch');
const args=JSON.parse(argv) as string[];
const result=await run('git',args,process.env,30000,false,undefined,'utf8',cwd);
const redact=remoteRedactor();
// Only command-close facts and bounded redacted diagnostics leave this producer.
await checkpoint(join(runDir,'ref-push',id+'.json'),{
  launchId:id,pid:birth.pid,identity:birth.identity,complete:!nativeCommandIncomplete(result),
  head:args.at(-1)?.split(':')[0],
  result:{code:result.code,stdout:'',stderr:redact.text(result.stderr).slice(-4096),...(result.error?{error:redact.text(result.error).slice(-4096)}:{})},
});
