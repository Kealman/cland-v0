import { readFile, writeFile, mkdtemp, rm, readdir } from 'node:fs/promises';
import { agentDeliveryStagingPrefix } from '../state-paths.ts';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, randomUUID } from 'node:crypto';
import { runtimePath, runtimeTreePath, agentVersion } from './agent/package.ts';
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

/** Whole-runtime compatibility begins at v0.4.0, the first host release; its
 * ready flow installs the whole runtime. Earlier dev-only agents are unsupported.
 * Shared handoff owner: successful publication fences redelivery while the
 * supervisor is still replacing its child. Retention follows the matching hello. */
export function agentVersionHandoff(o:{transport:Partial<Pick<SshTransport,'copyFile'|'execute'>>;codeRoot:string;node:string;version:string;bundle?:AgentBundle}) {
  let delivered=false,previousVersion:string|undefined;
  return {
    update:async(previous:string,signal:AbortSignal)=>{
      if(delivered)return;
      if(!o.transport.copyFile||!o.transport.execute)throw new Error('host code delivery unavailable');
      previousVersion??=previous;
      await deliverRuntime({...o,transport:o.transport as Pick<SshTransport,'copyFile'|'execute'>,signal});
      signal.throwIfAborted();
      await o.transport.execute(`set -eu\numask 077\nprintf '%s' ${quote(o.version)} > ${quote(join(o.codeRoot,'restart.new'))}\nmv ${quote(join(o.codeRoot,'restart.new'))} ${quote(join(o.codeRoot,'restart'))}\n`);
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

const digest = (bytes: Uint8Array | string) => createHash('sha256').update(bytes).digest('hex');
/** Only shipped source/assets, never account files or arbitrary source-root files. */
export { runtimeTreePath } from './agent/package.ts';
export async function runtimeBundle(version:string, root=fileURLToPath(new URL('../../..',import.meta.url))):Promise<AgentBundle> {
 agentVersion(version);
 const paths=['package.json','package-lock.json','hub/package.json'];
 async function scan(dir:string):Promise<void> {
  for(const e of await readdir(join(root,dir),{withFileTypes:true})) {
   const p=dir+'/'+e.name;
   if(e.isDirectory() && ((e.name!=='node_modules'&&!e.name.startsWith('.')) || p==='hub/mod/cland/.claude-plugin')) await scan(p);
   else if(e.isFile()&&runtimeTreePath(p)) paths.push(p);
  }
 }
 for(const dir of ['hub/src','hub/bin','hub/mod/cland','shared']) await scan(dir);
 const files:AgentBundle['files']=[];
 for(const path of paths.sort()) {const bytes=await readFile(join(root,path)); files.push({path,sha256:digest(bytes),bytes:bytes.toString('base64')});}
 return {version,files};
}
const helpers=`const runtimeTreePath=${runtimeTreePath.toString()};const agentVersion=${agentVersion.toString()};\n`+String.raw`
const fs=require('node:fs/promises'),p=require('node:path'),c=require('node:crypto');
const hash=b=>c.createHash('sha256').update(b).digest('hex');
async function verify(root,manifest){
 for(const f of manifest.files){const file=p.join(root,f.path);if(!runtimeTreePath(f.path)||await fs.realpath(file)!==file||hash(await fs.readFile(file))!==f.sha256)throw Error('runtime file hash');}
}
`;
const install=helpers+String.raw`
(async()=>{
 const [requested,input,expected]=process.argv.slice(1);
 if((await fs.lstat(requested)).isSymbolicLink())throw Error('code root symlink');
 const base=await fs.realpath(requested);
 const bundle=JSON.parse(await fs.readFile(input,'utf8'));agentVersion(bundle.version);
 const manifest={version:bundle.version,files:bundle.files.map(({path,sha256})=>({path,sha256}))};
 if(hash(JSON.stringify(manifest))!==expected)throw Error('runtime manifest hash');
 const stage=await fs.mkdtemp(p.join(base,'.runtime-stage-'));let link;
 try {
 const seen=new Set();
 for(const f of bundle.files){
  if(!runtimeTreePath(f.path)||seen.has(f.path))throw Error('runtime path');seen.add(f.path);
  const bytes=Buffer.from(f.bytes,'base64');if(hash(bytes)!==f.sha256)throw Error('runtime hash');
  const target=p.join(stage,f.path);await fs.mkdir(p.dirname(target),{recursive:true});await fs.writeFile(target,bytes,{flag:'wx',mode:(f.path.endsWith('.sh')||f.path==='hub/bin/cland')?0o700:0o600});
 }
 for(const required of ['package.json','package-lock.json','hub/package.json','hub/bin/cland.ts','hub/bin/cland-spoke.ts','hub/mod/cland/.claude-plugin/plugin.json'])if(!seen.has(required))throw Error('runtime missing '+required);
 await verify(stage,manifest);
 // Skip root prepare (web build/browser installation). A future runtime dependency
 // with an install script needs an explicit rebuild step, keeping this flag.
 await new Promise((resolve,reject)=>{const child=require('node:child_process').spawn('npm',['ci','-w','hub','--omit=dev','--ignore-scripts'],{cwd:stage,stdio:['ignore','ignore','pipe']});let tail='',failure;child.stderr.on('data',b=>tail=(tail+b).slice(-2000));child.on('error',error=>{failure=error;});child.on('close',(code,signal)=>failure?reject(failure):code===0?resolve():reject(Error('runtime npm ci failed exit='+code+' signal='+signal+' '+tail)));});
 await verify(stage,manifest);
 await fs.writeFile(p.join(stage,'runtime-manifest.json'),JSON.stringify(manifest),{flag:'wx',mode:0o600});
 const generation=p.join(base,'.runtime-'+bundle.version+'-'+expected);
 try{await fs.rename(stage,generation);}catch(e){if(e.code!=='EEXIST'&&e.code!=='ENOTEMPTY')throw e;await verify(generation,manifest);}
 const target=p.join(base,bundle.version);
 try{if(!(await fs.lstat(target)).isSymbolicLink())throw Error('runtime version occupied by directory');}catch(e){if(e.code!=='ENOENT')throw e;}
 link=p.join(base,'.runtime-link-'+require('node:crypto').randomUUID());
 await fs.symlink(p.basename(generation),link);await fs.rename(link,target);
 }finally{if(link)await fs.rm(link,{force:true});await fs.rm(stage,{recursive:true,force:true});await fs.rm(input,{force:true});}
})().catch(e=>{console.error(e.message);process.exitCode=1;});`;
/** An unknown remote operation retains its exact private input for reconciliation. */
export class RuntimeDeliveryIncomplete extends Error {
 readonly remoteInput:string;
 constructor(remoteInput:string,cause:unknown){super('runtime delivery cleanup incomplete: '+remoteInput,{cause});this.name='RuntimeDeliveryIncomplete';this.remoteInput=remoteInput;}
}
/** Ready-step owner: dependencies complete before publication. Old generations
 * remain intact for running readers; this operation never restarts an agent. */
export async function deliverRuntime(o:{transport:Pick<SshTransport,'copyFile'|'execute'>;codeRoot:string;node:string;version:string;bundle?:AgentBundle;signal?:AbortSignal}):Promise<void> {
 agentVersion(o.version);o.signal?.throwIfAborted();
 const bundle=o.bundle??await runtimeBundle(o.version);
 if(bundle.version!==o.version)throw Error('runtime version mismatch');
 const manifest={version:bundle.version,files:bundle.files.map(({path,sha256})=>({path,sha256}))}, expected=digest(JSON.stringify(manifest));
 // A successful probe proves the complete digest; a failed probe attempts a verified install.
 const probe=helpers+String.raw`(async()=>{const [base,version,expected]=process.argv.slice(1);await fs.mkdir(base,{recursive:true});if((await fs.lstat(base)).isSymbolicLink())throw Error('code root symlink');let ready=false;try{const root=await fs.realpath(p.join(base,version));if(p.dirname(root)!==await fs.realpath(base))throw Error('runtime root');const raw=await fs.readFile(p.join(root,'runtime-manifest.json'),'utf8');if(hash(raw)===expected){await verify(root,JSON.parse(raw));ready=true;}}catch{}if(!ready)process.exitCode=1;})().catch(e=>{console.error(e.message);process.exitCode=1;});`;
 try {await o.transport.execute(`${quote(o.node)} -e ${quote(probe)} ${quote(o.codeRoot)} ${quote(o.version)} ${quote(expected)}\n`);
 return;}catch {o.signal?.throwIfAborted();}
 const scratch=await mkdtemp(agentDeliveryStagingPrefix());
 const source=join(scratch,'runtime.json'),destination=join(o.codeRoot,`.runtime-input-${randomUUID()}.json`);
 let copying=false,uploaded=false,installing=false;
 try {
  await writeFile(source,JSON.stringify(bundle),{mode:0o600});o.signal?.throwIfAborted();
  copying=true;await o.transport.copyFile(source,destination);uploaded=true;
  o.signal?.throwIfAborted();installing=true;
  await o.transport.execute(`${quote(o.node)} -e ${quote(install)} ${quote(o.codeRoot)} ${quote(destination)} ${quote(expected)}\n`);
 } catch(error) {
  if(uploaded&&!installing){
   // copyFile's successful completion joins its writer. No installer has been
   // admitted, so only this owner can still use the exact uploaded input.
   try {await o.transport.execute(`${quote(o.node)} -e ${quote("require('node:fs/promises').rm(process.argv[1],{force:true}).catch(e=>{console.error(e.message);process.exitCode=1;})")} ${quote(destination)}\n`);}
   catch(cause){throw new RuntimeDeliveryIncomplete(destination,cause);}
  }else if(copying){
   // A lost copy/install reply is not positive closure; retain the input identity.
   throw new RuntimeDeliveryIncomplete(destination,error);
  }
  throw error;
 } finally {await rm(scratch,{recursive:true,force:true});}
}
