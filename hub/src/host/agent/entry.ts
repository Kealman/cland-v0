// Native runtime asset edge consumed by the generated closure.
import './restart.ts';
import { observeProcesses } from './native.ts';
import { checkpoint } from './storage.ts';
export const supervisorSource = new URL('./supervisor.sh',import.meta.url);
import { verifyAgentPackage, readAgentManifest } from './package.ts';
import { fileURLToPath } from 'node:url';
import { serveAgent } from './server.ts';
const manifest = await readAgentManifest(fileURLToPath(new URL('../../../../',import.meta.url)));
if(process.argv[2]==='--verify') {await verifyAgentPackage(fileURLToPath(new URL('../../../../',import.meta.url)).replace(/\/$/,''),process.argv[3]!);process.exit(0);}
const secret = process.env.CLAND_HOST_SECRET, runDir = process.env.CLAND_HOST_RUN_DIR;
if (!secret || !runDir) throw new Error('host agent environment required');
process.on('SIGHUP', () => {});
let agent:Awaited<ReturnType<typeof serveAgent>>|undefined;
let readyWork:Promise<void>=Promise.resolve(),shutdown:Promise<void>|undefined,stopRequested=false;
const stop=()=>{
  stopRequested=true;
  if(!agent||shutdown)return;
  shutdown=readyWork.catch(()=>{}).then(()=>agent!.close());
  void shutdown.then(()=>process.exit(0),error=>{console.error(error);process.exitCode=1;});
};
process.once('SIGTERM',stop);process.once('SIGINT',stop);
agent=await serveAgent({secret,runDir,version:manifest.version,checkpointCodeDir:fileURLToPath(new URL('../../../../../',import.meta.url))});
readyWork=(async()=>{
  const birth=(await observeProcesses([process.pid],process.env)).get(process.pid)?.identity;
  if(!birth)throw new Error('agent readiness birth unavailable');
  await checkpoint(fileURLToPath(new URL('../../../../../applied.json',import.meta.url)),{version:manifest.version,pid:process.pid,identity:birth});
})();
if(stopRequested)stop();
try{await readyWork;}catch(error){await (shutdown??agent.close());throw error;}
