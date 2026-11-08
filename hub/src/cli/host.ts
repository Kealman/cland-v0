import { HOST_SETTLEMENT_MS, hostRevocationLines, type HostSettlement } from '../host/settle.ts';
import { hostAttachPlan, terminalEnvironment } from '../host/attach.ts';
import { gitProxy } from '../host/git-proxy.ts';
import { hubDiscovery, readDiscovery } from '../project.ts';
import { askHubFrame } from './socket-client.ts';
import { join } from 'node:path';
import { userHome } from '../state-paths.ts';
import { VERSION } from '../version.ts';
import { serveAgent } from '../host/agent/server.ts';
export async function runHost(args: string[], env: NodeJS.ProcessEnv = process.env): Promise<number> {
  if (args[0] === 'attach' && args.length === 2) {
    const run = env.CLAND_HOST_RUN_DIR ?? join(userHome(env), '.cland-host', 'run');
    const plan = await hostAttachPlan(run, args[1]!, env);
    if (!process.execve) throw new Error('native execve unavailable');
    process.chdir(plan.cwd);
    process.execve('/bin/sh', ['/bin/sh', ...plan.args], terminalEnvironment(env));
    throw new Error('attach exec returned');
  }
  if (args[0] === 'git-proxy' && args[1]) { await gitProxy(args[1],process.stdin,process.stdout); return 0; }
  if (args[0] === 'status' && (args.length === 1 || args.length === 2 && args[1] === '--json')) {
    const discovery = readDiscovery(hubDiscovery(process.cwd()));
    if (!discovery) throw new Error('no hub runs for this project — run cland hub start');
    const value = await askHubFrame(discovery, { type: 'host.status' }, 30000, env) as Awaited<ReturnType<typeof import('../host/status.ts').hostStatus>>;
    if (args.includes('--json')) process.stdout.write(JSON.stringify(value, null, 2) + '\n');
    else for (const pool of value.pools) {
      process.stdout.write(`${pool.name}: ${pool.hostCount} hosts · slots ${pool.slotsUsed}/${pool.slotsTotal}${pool.slotsPromised?' · promised '+pool.slotsPromised:''} · today ${pool.spend.today===null?'unknown':'$'+pool.spend.today.toFixed(4)} · month ${pool.spend.month===null?'unknown':'$'+pool.spend.month.toFixed(4)}\n`);
      for (const host of pool.hosts) process.stdout.write(`  ${host.id} ${host.size} ${host.region} ${host.state} · uptime ${host.uptime ?? 'unknown'}s · sessions ${host.sessions.join(', ') || 'none'} · $${host.priceHourly ?? 'unknown'}/hour\n`);
    }
    return 0;
  }
  if (args[0] === 'create' && args.length <= 2 || args[0] === 'list' && (args.length === 1 || args.length === 2 && args[1] === '--json')) {
    const discovery = readDiscovery(hubDiscovery(process.cwd()));
    if (!discovery) throw new Error('no hub runs for this project — run cland hub start');
    const value = await askHubFrame(discovery, { type: args[0] === 'create' ? 'host.create' : 'host.list', ...(args[0] === 'create' && args[1] ? { pool: args[1] } : {}) }, 600000, env);
    process.stdout.write(JSON.stringify(value, null, 2) + '\n');
    return args[0] === 'create' && (value as {state?:string}).state === 'failed' ? 1 : 0;
  }
  if (args[0] === 'prepare' && args.length <= 2) {
    const discovery = readDiscovery(hubDiscovery(process.cwd()));
    if (!discovery) throw new Error('no hub runs for this project — run cland hub start');
    const results = await askHubFrame(discovery, { type: 'host.prepare', ...(args[1] ? { pool: args[1] } : {}) }, 1200000, env) as { pool: string; state: string; changed: string[] }[];
    for (const result of results) process.stdout.write(`${result.pool}: ${result.state}; changed: ${result.changed.join(', ') || 'none'}\n`);
    return 0;
  }
  if ((args[0] === 'destroy' || args[0] === 'stop') && args.length === 2) {
    const discovery = readDiscovery(hubDiscovery(process.cwd()));
    if (!discovery) throw new Error('no hub runs for this project — run cland hub start');
    const value = await askHubFrame(discovery, { type: args[0] === 'stop' ? 'host.stop' : 'host.destroy', host: args[1] }, 600000, env) as {state?:string};
    process.stdout.write(JSON.stringify(value, null, 2) + '\n');
    return value.state === 'destroyed' ? 0 : 1;
  }
  if (args[0] === 'revoke' && args.length === 2) {
    const discovery = readDiscovery(hubDiscovery(process.cwd()));
    if (!discovery) throw new Error('no hub runs for this project — run cland hub start');
    const reply = await askHubFrame(discovery, { type: 'host.revoke', host: args[1] }, HOST_SETTLEMENT_MS + 3000, env) as {cleanup?:HostSettlement};
    process.stdout.write(`revoked host ${args[1]}\n`);
    for (const line of hostRevocationLines(reply)) process.stdout.write(line + '\n');
    return 0;
  }
  if (args.length !== 1 || args[0] !== 'serve') throw new Error('usage: cland host <status [--json] | stop id | create [pool] | list [--json] | destroy id | prepare [pool] | serve | attach session | revoke id | git-proxy socket>');
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
