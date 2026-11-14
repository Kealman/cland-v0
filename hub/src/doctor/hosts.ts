import { basename, join } from 'node:path';
import { inspectPoolImage } from '../host/provider/pool-image.ts';
import { readText } from '../init/files.ts';
import { defaultConfig, parseConfig } from '../init/config.ts';
import { hubDiscovery, readDiscovery, pidAlive } from '../project.ts';
import { askHubFrame } from '../cli/socket-client.ts';
import type { providerTokens } from '../host/provider-tokens.ts';
import type { hostStatus } from '../host/status.ts';
import type { Login } from '../host/logins.ts';
import { fail, ok, warn, type Check } from './report.ts';

/** Local metadata only. Provider credentials remain in the running hub. */
export async function checkHosts(root: string, env: NodeJS.ProcessEnv): Promise<Check[]> {
  let config;
  try { const text = readText(join(root, '.cland/config.toml')); config = text === null ? defaultConfig(basename(root)) : parseConfig(text, basename(root), env); }
  catch { return [fail('hosts config', 'cannot read host pools', 'repair .cland/config.toml')]; }
  if (!Object.keys(config.hosts.pools).length) return [ok('hosts', 'no host pool')];
  const discovery = readDiscovery(hubDiscovery(root, env));
  const live = discovery && (discovery.remote || pidAlive(discovery.pid));
  const out: Check[] = [];
  for (const [pool, settings] of Object.entries(config.hosts.pools).sort(([a], [b]) => a.localeCompare(b))) {
    const name = `host ${pool} image`, fix = `cland host prepare ${pool}`;
    const image = await inspectPoolImage(root, env, pool, settings.provider);
    out.push(image.state === 'current' ? ok(name, 'current') : warn(name, image.state === 'stale' ? `stale: ${image.changed!.join(', ')}` : image.state === 'unavailable' ? 'image key unavailable' : 'absent', fix));
  }
  for (const provider of [...new Set(Object.values(config.hosts.pools).map(p => p.provider))].sort()) {
    const name = `host ${provider} token`;
    if (!live) { out.push(warn(name, 'hub not running', 'cland hub start')); continue; }
    try {
      const result = await askHubFrame(discovery, { type: 'host.providers' }, 3000, env) as ReturnType<typeof providerTokens>;
      const row = result.providers.find(p => p.provider === provider);
      out.push(!row ? warn(name, 'provider status unavailable', 'cland hub stop && cland hub start') : !row.tokenNeeded ? ok(name, 'not required') : row.present
        ? ok(name, `present (${row.fingerprint})`) : warn(name, 'absent', "set DIGITALOCEAN_TOKEN in the hub's environment, then cland hub stop && cland hub start"));
    } catch { out.push(warn(name, 'provider status unavailable', 'cland hub stop && cland hub start')); }
  }
  if (!live) for (const name of ['host logins', 'host reachability', 'host spend']) out.push(warn(name, 'hub not running', 'cland hub start'));
  else {
    try {
      const logins = await askHubFrame(discovery, { type: 'login.list' }, 3000, env) as Login[];
      for (const login of logins) if (login.state === 'signed-out') out.push(warn(`host login ${login.name}`, 'signed-out', `cland login signin ${login.name}`));
    } catch { out.push(warn('host logins', 'login status unavailable', 'cland hub stop && cland hub start')); }
    try {
      const status = await askHubFrame(discovery, { type: 'host.status' }, 3000, env) as Awaited<ReturnType<typeof hostStatus>>;
      let today: number | null = 0;
      for (const pool of status.pools) {
        if (Object.hasOwn(config.hosts.pools, pool.name) && !pool.freeLogins) out.push(warn(`host ${pool.name} logins`, 'free login count unavailable', 'cland hub stop && cland hub start'));
        for (const [harness, free] of Object.entries(Object.hasOwn(config.hosts.pools, pool.name) ? pool.freeLogins ?? {} : {})) {
          const name = `host ${pool.name} ${harness} logins`;
          out.push(free === 0 ? warn(name, '0 free', `cland login add ${harness} --pool ${pool.name}`) : ok(name, `${free} free`));
        }
        for (const host of pool.hosts) {
          const name = `host ${host.id} reachability`;
          out.push(host.state === 'ready' && !host.outageSince ? ok(name, 'ready') : warn(name,
            `${host.state}; outage since ${host.outageSince ?? 'unknown'}`, `cland host ${host.state === 'unreachable' || host.outageSince ? 'destroy' : 'stop'} ${host.id}`));
        }
        today = today === null || pool.spend.today === null ? null : today + pool.spend.today;
      }
      const cap = config.hosts.dailySpendUsd;
      const detail = `${today === null ? 'unknown' : '$' + today.toFixed(4)} today / $${cap.toFixed(4)} daily cap`;
      out.push(today === null || today >= cap * 0.8 ? warn('host spend', detail, `cland config set hosts.daily_spend_usd ${Math.max(cap + 1, today === null ? 1 : Math.ceil(today / 0.8) + 1)}`) : ok('host spend', detail));
    } catch { out.push(warn('host status', 'host status unavailable', 'cland hub stop && cland hub start')); }
  }
  return out;
}
