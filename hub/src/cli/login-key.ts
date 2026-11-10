import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { projectRoot, layout } from '../project.ts';
import { readProjectConfig } from '../init/config.ts';
import { projectTag } from '../executor/droplet/droplet.ts';
import { writeLoginKey } from '../host/login-keys.ts';
import { prepareSecretWrite, readSecret } from './secret.ts';

export type KeyLoginMetadata = {harness:'opencode';kind:'key';name:string;account:string};

/** Parse-free key path after login.list authorization. Existing rows reserve names; sender receives metadata only. */
export async function runKeyLoginAdd(input: {harness:string;name?:string;account?:string}, send: (metadata:KeyLoginMetadata)=>Promise<unknown>, env: NodeJS.ProcessEnv, existing: readonly {name:string}[], cwd=process.cwd()): Promise<number> {
 if (input.harness !== 'opencode') throw Error('key logins support OpenCode only in 0.4.x; read keys from stdin');
 const root=projectRoot(cwd), l=layout(root);
 prepareSecretWrite(root,true);
 const config=readProjectConfig(join(root,'.cland/config.toml'),root,()=>{},env);
 if (!config) throw Error('cannot read project config');
 const occupied=new Set(existing.map(row=>row.name));
 let name=input.name;
 if(name && occupied.has(name))throw Error('login name must be unique in the project');
 if (!name) { let n=1; while (occupied.has(`opencode-${n}`) || existsSync(join(root,'.cland/auth',`opencode-${n}.key`))) n++; name=`opencode-${n}`; }
 writeLoginKey(root,projectTag(root,config.name),name,await readSecret());
 await send({harness:'opencode',kind:'key',name,account:input.account ?? name});
 process.stdout.write(`added key login ${name}\n`);
 return 0;
}
