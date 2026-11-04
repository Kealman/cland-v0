import { readFile, realpath, lstat } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
export function agentVersion(value:string):string { if(!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(value))throw new Error('invalid agent version');return value; }
export const runtimePath = (path: string) => /^(hub\/src\/host\/agent\/(?:[A-Za-z0-9_-]+\.ts|supervisor\.sh)|shared\/executor-credentials\.ts)$/.test(path);
export async function verifyAgentPackage(root:string,version:string):Promise<void> {
  agentVersion(version);
  if((await lstat(root)).isSymbolicLink())throw new Error('agent version symlink');
  root=await realpath(root);
  const manifest=JSON.parse(await readFile(join(root,'agent-manifest.json'),'utf8'));
  if(manifest.version!==version||!Array.isArray(manifest.files))throw new Error('agent manifest');
  const seen=new Set<string>();
  for(const f of manifest.files) {
    if(typeof f.path!=='string'||!runtimePath(f.path)||seen.has(f.path))throw new Error('agent path');seen.add(f.path);
    const path=join(root,f.path);
    if(await realpath(path)!==path||!(await lstat(path)).isFile()||createHash('sha256').update(await readFile(path)).digest('hex')!==f.sha256)throw new Error('agent hash');
  }
  if(!seen.has('hub/src/host/agent/entry.ts'))throw new Error('agent entry');
}
