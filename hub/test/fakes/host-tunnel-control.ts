#!/usr/bin/env node
// Test-only control: no PID from disk is ever signal authority.
import { readFile, writeFile, unlink, realpath } from 'node:fs/promises';
import { join, isAbsolute } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseConfig } from '../../src/init/config.ts';
import { Store } from '../../src/hub/store.ts';
import { hostDirectory } from '../../../shared/fake-host-directory.ts';
import { readFakeMachine } from '../../src/host/agent/fake-volume-contents.ts';
import { controlRequest, hostOwner, sameOwner, type MasterReceipt } from './fake-ssh-common.ts';
export async function tunnelControl(root:string,id:string,action:string,env:NodeJS.ProcessEnv=process.env):Promise<void> {
 if(!isAbsolute(root)||!env.CLAND_FAKE_HOST_ROOT||await realpath(env.CLAND_FAKE_HOST_ROOT)!==await realpath(root))throw Error('requires owned fake host root');
 if(action!=='down'&&action!=='up')throw Error('action must be down or up');
 const config=parseConfig(await readFile(join(root,'.cland/config.toml'),'utf8'),'scratch',env);
 const store=new Store(join(root,'.cland/hub.db'));
 const row=store.hosts.provisions.get(id);store.close();
 if(!row?.machine||row.provider!=='fake')throw Error('requires owned fake host');
 if(config.hosts.pools[row.pool]?.provider!=='fake')throw Error('requires fake-provider pool');
 const canonicalRoot=await realpath(root);
 const storage=join(canonicalRoot,'.fixture-sockets');
 const directory=hostDirectory(root,row.machine.address);
 if(await realpath(storage)!==storage||await realpath(directory)!==join(storage,row.machine.address))throw Error('fake host is outside owned storage');
 const machine=await readFakeMachine(directory,row.machine);
 if(await realpath(machine.project)!==canonicalRoot||machine.pool!==row.pool)throw Error('fake machine project or pool mismatch');
 const owner=await hostOwner(directory);
 const marker=join(directory,'tunnel-down');
 if(action==='up'){await unlink(marker);return;}
 const receipt=JSON.parse(await readFile(join(directory,'master-control'),'utf8')) as MasterReceipt;
 if(!sameOwner(receipt.owner,owner)||!receipt.token)throw Error('fake master owner mismatch');
 await writeFile(marker,'QA tunnel outage',{flag:'wx',mode:0o600});
 await controlRequest(receipt.control,{operation:'kill-master',forwards:[],owner,token:receipt.token});
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{const [root,id,action]=process.argv.slice(2);if(!root||!id||!action)throw Error('usage: host-tunnel-control.ts <scratch-root> <host-id> down|up');await tunnelControl(root,id,action);}
 catch(error){console.error((error as Error).message);process.exitCode=1;}
}
