import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { agentDeliveryStagingPrefix } from '../state-paths.ts';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, randomUUID } from 'node:crypto';
import { runtimePath, agentVersion } from './agent/package.ts';
import type { SshTransport } from '../transport/ssh.ts';
export const AGENT_ENTRY = 'hub/src/host/agent/entry.ts';
export type AgentBundle = { version: string; files: Array<{path:string;sha256:string;bytes:string}> };
const hash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
export { agentVersion } from './agent/package.ts';
/** Runtime delivery consumes the committed projection; no compiler is loaded. */
export async function agentBundle(version:string,root=fileURLToPath(new URL('../../..',import.meta.url))):Promise<AgentBundle> {
  agentVersion(version);
  const closure=JSON.parse(await readFile(join(root,'hub/src/host/agent/closure.json'),'utf8')) as {files:Array<{path:string;sha256:string}>};
  const files:AgentBundle['files']=[];
  for(const file of closure.files){
    if(!runtimePath(file.path))throw new Error('agent closure path');
    const bytes=await readFile(join(root,file.path));
    if(hash(bytes)!==file.sha256)throw new Error('agent closure stale: regenerate host-agent closure');
    files.push({...file,bytes:bytes.toString('base64')});
  }
  return {version,files};
}
const quote=(s:string)=>"'"+s.replaceAll("'","'\\''")+"'";
/** Executed by the host's Node over the pinned master, independent of the old agent. */
export const INSTALL_AGENT = `const runtimePath=${runtimePath.toString()};const agentVersion=${agentVersion.toString()};\n` + String.raw`
const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
(async()=>{
 const [requested,input]=process.argv.slice(1);
 if((await fs.lstat(requested)).isSymbolicLink())throw Error('code root symlink');
 const base=await fs.realpath(requested);
 const bundle=JSON.parse(await fs.readFile(input,'utf8'));
 agentVersion(bundle.version);
 const staging=await fs.mkdtemp(path.join(base,'.stage-'));
 try {
 const manifest={version:bundle.version,files:[]};const seen=new Set();
 for(const f of bundle.files){
  if(typeof f.path!=='string'||!runtimePath(f.path)||seen.has(f.path))throw Error('path');seen.add(f.path);
  const bytes=Buffer.from(f.bytes,'base64');if(crypto.createHash('sha256').update(bytes).digest('hex')!==f.sha256)throw Error('hash');
  const target=path.join(staging,f.path);await fs.mkdir(path.dirname(target),{recursive:true});await fs.writeFile(target,bytes,{flag:'wx',mode:0o600});
  if(crypto.createHash('sha256').update(await fs.readFile(target)).digest('hex')!==f.sha256)throw Error('written hash');
  manifest.files.push({path:f.path,sha256:f.sha256});
 }
 if(!seen.has('hub/src/host/agent/entry.ts'))throw Error('entry');
 await fs.writeFile(path.join(staging,'agent-manifest.json'),JSON.stringify(manifest),{flag:'wx',mode:0o600});
 await (await import(require('node:url').pathToFileURL(path.join(staging,'hub/src/host/agent/package.ts')).href)).verifyAgentPackage(staging,bundle.version);
 const target=path.join(base,bundle.version);
 try {
  await fs.lstat(target);
  await (await import(require('node:url').pathToFileURL(path.join(staging,'hub/src/host/agent/package.ts')).href)).verifyAgentPackage(target,bundle.version);
  const installed=JSON.parse(await fs.readFile(path.join(target,'agent-manifest.json'),'utf8'));
  if(JSON.stringify(installed)!==JSON.stringify(manifest))throw Error('occupied version differs');
  await fs.rm(staging,{recursive:true});
 } catch(error) {if(error.code!=='ENOENT')throw error;await fs.rename(staging,target);}
 } finally {await fs.rm(staging,{recursive:true,force:true});await fs.rm(input,{force:true});}
})().catch(e=>{console.error(e.message);process.exitCode=1;});`;
export async function deliverAgent(o:{transport:Pick<SshTransport,'copyFile'|'execute'>;codeRoot:string;node:string;version:string;bundle?:AgentBundle;signal?:AbortSignal}):Promise<void> {
  o.signal?.throwIfAborted();
  const bundle=o.bundle??await agentBundle(o.version);agentVersion(o.version);
  if(bundle.version!==o.version)throw new Error('bundle version mismatch');
  const scratch=await mkdtemp(agentDeliveryStagingPrefix());
  try {
    const source=join(scratch,'code.json'),destination=join(o.codeRoot,`.delivery-${randomUUID()}.json`);
    await writeFile(source,JSON.stringify(bundle),{mode:0o600});
    o.signal?.throwIfAborted();
    await o.transport.execute(`set -eu\numask 077\nmkdir -p ${quote(o.codeRoot)}\n${quote(o.node)} -e ${quote("if(require('node:fs').lstatSync(process.argv[1]).isSymbolicLink())process.exit(1)")} ${quote(o.codeRoot)}\n`);
    o.signal?.throwIfAborted();
    await o.transport.copyFile(source,destination);
    o.signal?.throwIfAborted();
    await o.transport.execute(`${quote(o.node)} -e ${quote(INSTALL_AGENT)} ${quote(o.codeRoot)} ${quote(destination)}\n`);
    // The supervisor reads this private request and signals its own captured child.
    o.signal?.throwIfAborted();
    await o.transport.execute(`set -eu\numask 077\nprintf '%s' ${quote(o.version)} > ${quote(join(o.codeRoot,'restart.new'))}\nmv ${quote(join(o.codeRoot,'restart.new'))} ${quote(join(o.codeRoot,'restart'))}\n`);
  } finally {await rm(scratch,{recursive:true,force:true});}
}
/** Retention is called only after a matching replacement hello. Unknown image
 * directories are preserved: this owner prunes only its manifested packages. */
export async function retainAgentVersions(o:{transport:Pick<SshTransport,'execute'>;codeRoot:string;node:string;version:string;previous:string}):Promise<void> {
  agentVersion(o.version);
  const script=String.raw`const fs=require('node:fs/promises'),p=require('node:path');(async()=>{const [requested,current,previous]=process.argv.slice(1);if((await fs.lstat(requested)).isSymbolicLink())throw Error('code root');const base=await fs.realpath(requested);for(const e of await fs.readdir(base,{withFileTypes:true})){if(!e.isDirectory()||e.name===current||e.name===previous||!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(e.name))continue;const root=p.join(base,e.name);try{const m=JSON.parse(await fs.readFile(p.join(root,'agent-manifest.json'),'utf8'));if(m.version!==e.name)continue;}catch{continue;}await fs.rm(root,{recursive:true});}})().catch(()=>{process.exitCode=1;});`;
  await o.transport.execute(`${quote(o.node)} -e ${quote(script)} ${quote(o.codeRoot)} ${quote(o.version)} ${quote(o.previous)}\n`);
}

/** Shared handoff owner: successful publication fences redelivery while the
 * supervisor is still replacing its child. Retention follows the matching hello. */
export function agentVersionHandoff(o:{transport:Partial<Pick<SshTransport,'copyFile'|'execute'>>;codeRoot:string;node:string;version:string;bundle?:AgentBundle}) {
  let delivered=false,previousVersion:string|undefined;
  return {
    update:async(previous:string,signal:AbortSignal)=>{
      if(delivered)return;
      if(!o.transport.copyFile||!o.transport.execute)throw new Error('host code delivery unavailable');
      previousVersion??=previous;
      await deliverAgent({...o,transport:o.transport as Pick<SshTransport,'copyFile'|'execute'>,signal});
      delivered=true;
    },
    ready:async()=>{
      if(previousVersion&&o.transport.execute){
        delivered=true;
        await retainAgentVersions({...o,transport:o.transport as Pick<SshTransport,'execute'>,previous:previousVersion});
        previousVersion=undefined;
      }
    },
  };
}
