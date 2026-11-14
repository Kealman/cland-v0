import type { SetupStep } from '../types.ts';
import { setupHub } from '../hub.ts';
import { basename } from 'node:path';
import { parseConfig } from '../../init/config.ts';
import { parseRoles } from '../../roles/config.ts';
import { readHostPools, hostPoolsDocument } from '../../host/pools.ts';
import { HARNESS_ORDER } from './harnesses.ts';
import { Cancelled } from '../prompter.ts';

// docs/spec/v0.4.md, Prices: recorded 2026-10-31, USD without VAT.
const DECLARED_DEFAULT = { size: 's-4vcpu-8gb', hourly: '0.0714', date: '2026-10-31' };
const defaults = readHostPools({ agents: { provider: 'digitalocean' } });
const defaultPool = hostPoolsDocument(defaults).agents as Record<string, unknown>;
const commands = (pool: Record<string, unknown>, roles: string[]) => [
  ...Object.entries(pool).map(([key, value]) => `cland config set hosts.agents.${key} ${String(value)}`),
  ...roles.map(role => `cland role launch ${role} --pool agents`), 'cland hub reload',
].join('; ');
const missingToken = () => [{ name: 'agent hosts', verdict: 'open' as const, detail: 'Set DIGITALOCEAN_TOKEN in the hub environment and restart the hub', fix: 'cland hub stop; cland hub start' }];

export const hosts: SetupStep = async ({ root, env, machine, hub: injected, interactive, yes, prompter, narrate }) => {
  const name = 'agent hosts';
  let fix = 'cland setup in a terminal';
  try {
    const config = parseConfig(await machine.read('config.toml') ?? '', basename(root), env);
    const pool = config.hosts.pools.agents;
    if (!pool) fix = commands(defaultPool, ['implementer']);
    const roles = parseRoles(await machine.read('roles.toml') ?? '', null, HARNESS_ORDER);
    const placed = [...roles.values()].filter(role => role.launch.pool === 'agents');
    if (pool && !placed.length) fix = commands({}, ['implementer']);
    if (!pool && placed.length) fix = commands(defaultPool, []);
    const client = injected ?? setupHub(root, env);
    const configuredProvider = pool?.provider === 'digitalocean' ? (await client.providers?.('digitalocean'))?.providers.find(p => p.provider === 'digitalocean') : undefined;
    if (pool?.provider === 'digitalocean' && !configuredProvider?.present) return missingToken();
    if (pool && placed.length && await client.running()) {
      const status = await client.hostStatus?.();
      if (placed.every(role => status?.roleLogins?.[role.role] === true)) return [{ name, verdict: 'ok', detail: `agents; roles ${placed.map(r => r.role).join(', ')}; ready logins` }];
    }
    if (yes) return [{ name, verdict: 'skip', detail: 'optional agent hosts; default No' }];
    if (!interactive) return [{ name, verdict: pool ? 'open' : 'skip', detail: `${pool ? 'agent hosts need a terminal' : 'optional agent hosts'}; ${fix}`, fix }];
    if (!await prompter.confirm('Set up agent hosts?', false)) return [{ name, verdict: 'skip', detail: 'agent hosts declined' }];
    const provider = configuredProvider ?? (await client.providers?.('digitalocean'))?.providers.find(p => p.provider === 'digitalocean');
    if (!provider?.present) return missingToken();
    narrate?.(`DigitalOcean token fingerprint ${provider.fingerprint}\n`);
    const chosen: string[] = placed.map(r => r.role);
    if (!chosen.length) for (const role of roles.values()) {
      if (role.role === 'coordinator' || role.role === 'aide') continue;
      if (await prompter.confirm(`Place ${role.role} on agents?`, role.role === 'implementer')) chosen.push(role.role);
    }
    if (!chosen.length) return [{ name, verdict: 'open', detail: 'no roles selected', fix }];
    const document = pool ? hostPoolsDocument(config.hosts).agents as Record<string, unknown> : defaultPool;
    const unplaced = chosen.filter(role => roles.get(role)?.launch.pool !== 'agents');
    fix = pool && !unplaced.length ? 'cland setup in a terminal' : commands(pool ? {} : document, unplaced);
    if (document.size !== DECLARED_DEFAULT.size || document.provider !== 'digitalocean') return [{ name, verdict: 'open', detail: 'no recorded price for this pool; configure manually', fix }];
    if (!pool && !await prompter.confirm(`Create agents: ${document.size}, min_hosts = ${document.min_hosts}, declared $${DECLARED_DEFAULT.hourly}/h (spec, ${DECLARED_DEFAULT.date}); always-on host?`, false)) return [{ name, verdict: 'open', detail: 'pool confirmation declined', fix }];
    if (!client.configure || !client.placeRole || !client.reload) return [{ name, verdict: 'open', detail: 'hub configuration unavailable', fix }];
    if (!pool) for (const [key, value] of Object.entries(document)) await client.configure(`hosts.agents.${key}`, value);
    for (const role of chosen) if (roles.get(role)?.launch.pool !== 'agents') await client.placeRole(role, 'agents');
    await client.reload();
    return [{ name, verdict: 'done', detail: `agents configured; roles ${chosen.join(', ')}; token fingerprint ${provider.fingerprint}` }];
  } catch (error) {
    if (error instanceof Cancelled) throw error;
    return [{ name, verdict: 'open', detail: 'agent hosts could not be configured; check hub and configuration', fix }];
  }
};
