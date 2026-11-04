import { gitProxy } from '../host/git-proxy.ts';
import { hubDiscovery, readDiscovery } from '../project.ts';
import { askHubFrame } from './socket-client.ts';
import { join } from 'node:path';
import { userHome } from '../state-paths.ts';
import { VERSION } from '../version.ts';
import { serveAgent } from '../host/agent/server.ts';
export async function runHost(args: string[], env: NodeJS.ProcessEnv = process.env): Promise<number> {
  if (args[0] === 'git-proxy' && args[1]) { await gitProxy(args[1],process.stdin,process.stdout); return 0; }
  if (args[0] === 'revoke' && args.length === 2) {
    const discovery = readDiscovery(hubDiscovery(process.cwd()));
    if (!discovery) throw new Error('no hub runs for this project — run cland hub start');
    await askHubFrame(discovery, { type: 'host.revoke', host: args[1] }, 3000, env);
    process.stdout.write(`revoked host ${args[1]}\n`);
    return 0;
  }
  if (args.length !== 1 || args[0] !== 'serve') throw new Error('usage: cland host <serve | revoke id | git-proxy socket>');
  const runDir = env.CLAND_HOST_RUN_DIR ?? join(userHome(env), '.cland-host', 'run');
  const secret = env.CLAND_HOST_SECRET;
  if (!secret) throw new Error('CLAND_HOST_SECRET required');
  const ignoreHup = () => {};
  process.on('SIGHUP', ignoreHup);
  try {
    const agent = await serveAgent({ runDir, secret, version: VERSION, env });
    await new Promise<void>((resolve, reject) => {
      let stopping = false;
      const stop = () => { if (stopping) return; stopping = true; void agent.close().then(resolve, reject); };
      process.once('SIGTERM', stop); process.once('SIGINT', stop);
    });
    return 0;
  } finally { process.removeListener('SIGHUP', ignoreHup); }
}
