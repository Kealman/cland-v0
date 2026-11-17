import { writeFile } from 'node:fs/promises';
import { sshBinaries } from './ssh-binaries.ts';
import type { ProvisionRecord } from './provision-records.ts';
export type ProvisionCommand=(binary:string,args:string[],env:NodeJS.ProcessEnv,input?:string,timeoutMs?:number,signal?:AbortSignal)=>Promise<void>;
/** Only the persisted identity and captured address authorize provisioning SSH.
 * The provider owns its test transport membership and remote layout. */
export async function provisionSsh(record:ProvisionRecord,knownPath:string,env:NodeJS.ProcessEnv,command:ProvisionCommand) {
 if(!record.machine||!record.ssh)throw Error('provider SSH identity unavailable');
 const identity=record.ssh,destination=`${record.ssh.user??'agent'}@${record.machine.address}`;
 await writeFile(knownPath,identity.knownHosts,{mode:0o600});
 const base=['-F','/dev/null','-i',identity.clientKeyPath,...['BatchMode=yes','StrictHostKeyChecking=yes','GlobalKnownHostsFile=/dev/null','KnownHostsCommand=none','VerifyHostKeyDNS=no','UpdateHostKeys=no',`UserKnownHostsFile="${knownPath}"`].flatMap(v=>['-o',v])];
 const transportEnv=identity.environment?{...env,...identity.environment}:env;
 const {ssh,scp}=sshBinaries(transportEnv);
 return {
  probe:(timeoutMs:number,signal?:AbortSignal)=>command(ssh,[...base,destination,'sh','-s'],transportEnv,'true\n',timeoutMs,signal),
  execute:(script:string)=>command(ssh,[...base,destination,'sh','-s'],transportEnv,script,120000),
  copyFile:(source:string,target:string)=>command(scp,[...base,source,`${destination}:${target}`],transportEnv),
 };
}
