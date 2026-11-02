import { join } from 'node:path';
import { userHome } from '../state-paths.ts';
import { VERSION } from '../version.ts';
import { serveAgent } from '../host/agent/server.ts';
export async function runHost(args: string[], env: NodeJS.ProcessEnv = process.env): Promise<number> {
  if (args.length !== 1 || args[0] !== 'serve') throw new Error('usage: cland host serve');
  const runDir = env.CLAND_HOST_RUN_DIR ?? join(userHome(env), '.cland-host', 'run');
  const secret = env.CLAND_HOST_SECRET;
  if (!secret) throw new Error('CLAND_HOST_SECRET required');
  const agent = await serveAgent({ runDir, secret, version: VERSION, env });
  await new Promise<void>((resolve, reject) => {
    let stopping = false;
    const stop = () => { if (stopping) return; stopping = true; void agent.close().then(resolve, reject); };
    process.once('SIGTERM', stop); process.once('SIGINT', stop);
  });
  return 0;
}
