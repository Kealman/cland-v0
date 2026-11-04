import { pathToFileURL } from 'node:url';
import { gitProxy } from './agent/git-proxy.ts';
export { gitProxy } from './agent/git-proxy.ts';
// Preserve the original executable entry as well as its import contract.
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const path=process.argv[2];
  if(!path){process.stderr.write('cland git-proxy: socket required\n');process.exitCode=1;}
  else await gitProxy(path,process.stdin,process.stdout).catch(()=>{process.stderr.write('cland git-proxy: connection failed\n');process.exitCode=1;});
}
