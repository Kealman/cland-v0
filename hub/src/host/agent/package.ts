import { readFile, realpath, lstat } from 'node:fs/promises';
import { join, dirname, basename } from 'node:path';
import { createHash } from 'node:crypto';
export function agentVersion(value:string):string { if(!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(value))throw new Error('invalid agent version');return value; }
/** Exact shared leaves and the sole agent module allowed to import each one. */
export function sharedAgentLeafOwner(path:string):string|null {
  switch(path) {
    case 'shared/executor-credentials.ts':return 'hub/src/host/agent/command-environment.ts';
    case 'shared/clock.ts':return 'hub/src/host/agent/clock.ts';
    case 'shared/fake-layout.ts':return 'hub/src/host/agent/fake-layout.ts';
    default:return null;
  }
}
export const runtimePath = (path:string) => /^hub\/src\/host\/agent\/(?:[A-Za-z0-9_-]+\.ts|supervisor\.sh)$/.test(path)||sharedAgentLeafOwner(path)!==null;
/** Shared leaves have Node-only closure, including no relative edge back to agents. */
export function agentSourceImportAllowed(importer:string,target:string):boolean {
  if(target.startsWith('node:'))return true;
  if(sharedAgentLeafOwner(importer)!==null)return false;
  return importer.startsWith('hub/src/host/agent/')&&(target.startsWith('hub/src/host/agent/')||sharedAgentLeafOwner(target)===importer);
}
/** Whole runtime source policy is shared by installer and package verification. */
export function runtimeTreePath(p:string):boolean {
 return !p.split('/').some(s=>s==='..'||s==='.'||s==='') && /^(?:hub\/bin\/cland|package(?:-lock)?\.json|hub\/package\.json|(?:hub\/(?:src|bin|mod\/cland)|shared)\/[A-Za-z0-9_./-]+\.(?:ts|js|json|sh|md))$/.test(p);
}
export async function readAgentManifest(root:string) {
 try{return JSON.parse(await readFile(join(root,'runtime-manifest.json'),'utf8'));}
 catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
 return JSON.parse(await readFile(join(root,'agent-manifest.json'),'utf8'));
}
/** Returns the canonical tree actually verified; selection must keep this identity. */
export async function verifyAgentPackage(root:string,version:string):Promise<string> {
  agentVersion(version);
  const resolved=await realpath(root);
  if((await lstat(root)).isSymbolicLink() && (dirname(resolved)!==await realpath(dirname(root)) || !basename(resolved).startsWith('.runtime-'+version+'-')))throw new Error('agent version symlink');
  root=resolved;
  const manifest=await readAgentManifest(root);
  let whole=false;
  try{await lstat(join(root,'runtime-manifest.json'));whole=true;}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
  if(manifest.version!==version||!Array.isArray(manifest.files))throw new Error('agent manifest');
  const seen=new Set<string>();
  for(const f of manifest.files) {
    if(typeof f.path!=='string'||!(whole?runtimeTreePath(f.path):runtimePath(f.path))||seen.has(f.path))throw new Error('agent path');seen.add(f.path);
    const path=join(root,f.path);
    if(await realpath(path)!==path||!(await lstat(path)).isFile()||createHash('sha256').update(await readFile(path)).digest('hex')!==f.sha256)throw new Error('agent hash');
  }
  if(!seen.has('hub/src/host/agent/entry.ts'))throw new Error('agent entry');
  return root;
}
