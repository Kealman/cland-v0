import type { SetupStep, SetupLine, SetupOptions } from '../types.ts';
import { setupHub } from '../hub.ts';
import { basename } from 'node:path';
import { parseConfig } from '../../init/config.ts';
import { parseRoles } from '../../roles/config.ts';
import { readHostPools, hostPoolsDocument } from '../../host/pools.ts';
import { HARNESS_ORDER } from './harnesses.ts';
import { Cancelled } from '../prompter.ts';
import { shellQuote } from '../../accounts/registry.ts';
import { missingRolePools } from '../../host/missing-pools.ts';

// docs/spec/v0.4.md, Prices: recorded 2026-10-31, USD without VAT.
const DECLARED_DEFAULT = { size: 's-4vcpu-8gb', hourly: '0.0714', date: '2026-10-31' };
const defaults = readHostPools({ agents: { provider: 'digitalocean' } });
const defaultPool = hostPoolsDocument(defaults).agents as Record<string, unknown>;
const commands = (pool: Record<string, unknown>, roles: string[]) => [
  ...Object.entries(pool).map(([key, value]) => `cland config set hosts.agents.${key} ${String(value)}`),
  ...roles.map(role => `cland role launch ${role} --pool agents`), 'cland hub reload',
].join('; ');
const missingToken = () => [{ name: 'agent hosts', verdict: 'open' as const, detail: 'Store the provider token with cland secret set digitalocean.token and restart the hub', fix: 'cland hub stop; cland hub start' }];

// Each paid operation has its own consent, independent of pool configuration.
async function finishPool(o: SetupOptions, chosen: { role: string; launch: { harness: string; account: string | null } }[], document: Record<string, unknown>): Promise<SetupLine[]> {
  const client = o.hub ?? setupHub(o.root, o.env), lines: SetupLine[] = [];
  let status = await client.hostStatus?.().catch(() => undefined);
  const image = 'cland host prepare agents';
  const paid = document.provider === 'digitalocean';
  const machine = `${document.provider} ${document.size} in ${document.region}`;
  const price = paid && document.size === DECLARED_DEFAULT.size ? `; declared $${DECLARED_DEFAULT.hourly}/h (spec ${DECLARED_DEFAULT.date})` : '';
  const config = parseConfig(await o.machine.read('config.toml') ?? '', basename(o.root), o.env);
  const builder = config.verification.droplet.prepare_size;
  // docs/hub/running.md: c-8 costs $0.25/hour and c-16 $0.50/hour.
  const builderPrice = builder === 'c-8' ? '0.25' : builder === 'c-16' ? '0.50' : null;
  // Interactive setup assumes one human owns config. Admission pinning is T-1858.
  const changedTerms = async (): Promise<string | undefined> => {
    try {
      const latest = parseConfig(await o.machine.read('config.toml') ?? '', basename(o.root), o.env);
      const pool = hostPoolsDocument(latest.hosts).agents as Record<string, unknown> | undefined;
      if (!pool) return 'agents pool changed: removed';
      for (const key of Object.keys(document)) if (JSON.stringify(pool[key]) !== JSON.stringify(document[key])) return `agents ${key} changed: ${String(document[key])} → ${String(pool[key])}`;
      for (const key of ['prepare_size', 'regions', 'image'] as const) if (JSON.stringify(latest.verification.droplet[key]) !== JSON.stringify(config.verification.droplet[key])) return `builder ${key} changed: ${String(config.verification.droplet[key])} → ${String(latest.verification.droplet[key])}`;
      return undefined;
    } catch { return 'paid terms changed or unavailable'; }
  };
  const offer = async (question: string) => {
    if (!o.interactive) return 'open' as const;
    if (o.yes || !await o.prompter.confirm(question, false)) return 'skip' as const;
    return 'yes' as const;
  };
  const current = (await o.machine.image?.('agents', String(document.provider)).catch(() => undefined))?.state === 'current';
  const answer = current ? 'current' : paid && !builderPrice ? 'open' : await offer(`${image}: ${paid ? `paid DigitalOcean build machine ${builder}; declared $${builderPrice}/h` : `build machine ${machine}`}?`);
  if (answer === 'current') lines.push({ name: 'agent hosts image', verdict: 'ok', detail: 'agents: current' });
  else if (answer !== 'yes') lines.push({ name: 'agent hosts image', verdict: answer, detail: image, fix: image });
  else {
    try {
      const change = await changedTerms();
      if (change) { lines.push({ name: 'agent hosts image', verdict: 'open', detail: change, fix: image }); }
      else {
      const result = (await client.preparePool?.('agents'))?.find(row => row.pool === 'agents');
      if (!result || !['prepared', 'current'].includes(result.state)) throw Error('no image receipt');
      lines.push({ name: 'agent hosts image', verdict: 'done', detail: `agents: ${result.state}` });
      }
    } catch { lines.push({ name: 'agent hosts image', verdict: 'open', detail: 'image preparation incomplete', fix: image }); }
  }
  const seen = new Set<string>();
  for (const role of chosen) {
    if (status?.roleLogins?.[role.role] === true) continue;
    const harness = role.launch.harness, account = role.launch.account;
    const key = JSON.stringify([harness, account]);
    if (seen.has(key)) continue;
    seen.add(key);
    const command = `cland login add ${harness} --pool agents${account ? ` --account ${shellQuote(account)}` : ''}`;
    const answer = await offer(`${command}: may boot a ${paid ? 'paid ' : ''}host ${machine}${price}?`);
    if (answer !== 'yes') { lines.push({ name: `agent hosts ${harness} login`, verdict: answer, detail: command, fix: command }); continue; }
    let name: string | undefined;
    try {
      if (!o.machine.addLogin) throw Error('terminal login unavailable');
      const change = await changedTerms();
      if (change) { lines.push({ name: `agent hosts ${harness} login`, verdict: 'open', detail: change, fix: command }); continue; }
      const code = await o.machine.addLogin({ harness: harness as 'codex' | 'claude-code' | 'opencode', pool: 'agents', ...(account ? { account } : {}) }, admitted => { name = admitted; }, o.json ? { stdout: 'stderr' } : undefined);
      const row = name ? await client.login?.(name) : undefined;
      if (code !== 0 || row?.state !== 'ready' || row.harness !== harness || row.kind !== 'disk' || row.provider !== document.provider || row.region !== document.region || account && row.account !== account) throw Error('sign-in incomplete');
      lines.push({ name: `agent hosts ${harness} login`, verdict: 'done', detail: `${name}: ready` });
      status = await client.hostStatus?.().catch(() => undefined);
    } catch {
      // Only the terminal's validated add reply establishes a recovery identity.
      lines.push({ name: `agent hosts ${harness} login`, verdict: 'open', detail: `${name ?? harness}: sign-in incomplete`, fix: name ? `cland login signin ${name}` : command });
    }
  }
  return lines;
}

export const hosts: SetupStep = async options => {
  const { root, env, machine, hub: injected, interactive, yes, prompter, narrate } = options;
  const name = 'agent hosts';
  let fix = 'cland setup in a terminal';
  try {
    const config = parseConfig(await machine.read('config.toml') ?? '', basename(root), env);
    const pool = config.hosts.pools.agents;
    if (!pool) fix = commands(defaultPool, ['implementer']);
    const roles = parseRoles(await machine.read('roles.toml') ?? '', null, HARNESS_ORDER);
    const missing = missingRolePools(config.hosts, roles);
    if (missing.length) return missing.map(({ detail, fix }) => ({ name, verdict: 'open', detail, fix }));
    const placed = [...roles.values()].filter(role => role.launch.pool === 'agents');
    if (pool && !placed.length) fix = commands({}, ['implementer']);
    const client = injected ?? setupHub(root, env);
    const configuredProvider = pool?.provider === 'digitalocean' ? (await client.providers?.('digitalocean').catch(() => undefined))?.providers.find(p => p.provider === 'digitalocean') : undefined;
    if (pool?.provider === 'digitalocean' && !configuredProvider?.present) return [...missingToken(), ...(!interactive ? await finishPool(options, placed, hostPoolsDocument(config.hosts).agents as Record<string, unknown>) : [])];
    if (pool && placed.length && await client.running().catch(() => null)) {
      const status = await client.hostStatus?.().catch(() => undefined);
      if (placed.every(role => status?.roleLogins?.[role.role] === true) && (await machine.image?.('agents', pool.provider).catch(() => undefined))?.state === 'current') return [{ name, verdict: 'ok', detail: `agents; current image; roles ${placed.map(r => r.role).join(', ')}; ready logins` }];
    }
    if (pool && placed.length) return [{ name, verdict: interactive ? 'ok' : 'open', detail: `agents; roles ${placed.map(r => r.role).join(', ')}`, fix }, ...await finishPool(options, placed, hostPoolsDocument(config.hosts).agents as Record<string, unknown>)];
    if (pool && !interactive) return [{ name, verdict: 'open', detail: 'agent hosts need role placement', fix }, ...await finishPool(options, placed, hostPoolsDocument(config.hosts).agents as Record<string, unknown>)];
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
    return [{ name, verdict: 'done', detail: `agents configured; roles ${chosen.join(', ')}; token fingerprint ${provider.fingerprint}` }, ...await finishPool(options, chosen.map(role => roles.get(role)!), document)];
  } catch (error) {
    if (error instanceof Cancelled) throw error;
    return [{ name, verdict: 'open', detail: 'agent hosts could not be configured; check hub and configuration', fix }];
  }
};
