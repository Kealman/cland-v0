import { createHash, randomUUID } from 'node:crypto';
import { dirname, join } from 'node:path';
import type { Host, HostLaunchLayout } from './host.ts';
const quote = (value:string) => "'"+value.replaceAll("'","'\\''")+"'";
import { HOST_ORIGIN } from './agent/protocol.ts';
export { HOST_ORIGIN } from './agent/protocol.ts';
export function hostCloneRoot(runDirectory:string,project:string):string { return join(dirname(runDirectory),'work',createHash('sha256').update(project).digest('hex').slice(0,12)); }
/** Called by task preparation after the carrier is up; never invokes an installer. */
export async function ensureHostClone(o:{host:Host;root:string;layout:HostLaunchLayout;signal?:AbortSignal;bundle:(destination:string)=>Promise<void>}):Promise<void> {
 const command=async(args:string[],cwd=dirname(o.root))=>{const r=await o.host.run({command:'git',args:['-c','gc.auto=0',...args],cwd,env:{},timeoutMs:120000,...(o.signal?{signal:o.signal}:{})});if(r.error||r.code!==0)throw new Error(`host clone Git operation failed: exit ${r.code}; ${r.error ?? r.stderr.slice(-2000)}`);};
 const proxy=join(o.layout.runDirectory,'git-proxy');
 const invocation=[quote(o.layout.node),quote(o.layout.cli),'host git-proxy',quote(join(o.layout.runDirectory,'git.sock'))].join(' ');
 const temporary=proxy+'.'+randomUUID();
 await o.host.writeFile(temporary,Buffer.from(`#!/bin/sh\nexec ${invocation} \"$@\"\n`),{mode:0o700});
 const published=await o.host.run({command:'mv',args:['--',temporary,proxy],cwd:'/',env:{}});
 if(published.error||published.code!==0)throw new Error('host proxy publication failed');
 if(await o.host.fileType(join(o.root,'.git'))==='missing') {
  const r=await o.host.run({command:'mkdir',args:['-p',dirname(o.root)],cwd:'/',env:{},...(o.signal?{signal:o.signal}:{})});if(r.error||r.code!==0)throw new Error('host clone parent unavailable');
  try {await command(['-c',`core.gitProxy=${proxy}`,'clone','--no-checkout','--',HOST_ORIGIN,o.root]);}
  catch (error) {
   o.signal?.throwIfAborted();
   const bundle=join(o.layout.runDirectory,`clone-${randomUUID()}.bundle`);
   await o.bundle(bundle).catch(cause=>{throw new Error(`${String(error)}; ${String(cause)}`);});
   try {await command(['clone','--no-checkout','--',bundle,o.root]);}
   finally {await o.host.removePath(bundle);}
   await command(['remote','set-url','origin',HOST_ORIGIN],o.root);
  }
 }
 await command(['config','core.gitProxy',proxy],o.root);
 await command(['remote','set-url','origin',HOST_ORIGIN],o.root);
 // Walk-up discovery uses the same immutable bytes as explicit launch discovery.
 if(await o.host.fileType(join(o.root,'.cland'))==='missing') await o.host.makeDirectory(join(o.root,'.cland'),0o700);
 const trees=join(o.root,'.cland/worktrees');
 if(await o.host.fileType(trees)==='missing')await o.host.makeDirectory(trees,0o700);
 const bytes=await o.host.readFile(o.layout.discoveryFile);
 const file=join(o.root,'.cland/hub.json');
 if(await o.host.fileType(file)==='missing')await o.host.writeFile(file,bytes,{mode:0o600});
 else if(!Buffer.from(await o.host.readFile(file)).equals(Buffer.from(bytes)))throw new Error('host clone discovery differs');
}
