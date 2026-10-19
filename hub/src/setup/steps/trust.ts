import { readFileSync, realpathSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { parse } from 'smol-toml';
import { namedAccount, readAccounts, selectAccount, accountEnvironment } from '../../accounts/registry.ts';
import { parseRoles } from '../../roles/config.ts';
import type { Clock } from '../../hub/clock.ts';
import { claudeConfigFile, claudeTrusted, grantClaudeTrust } from '../trust.ts';
import { grantCodexTrust, type CodexTrustDependencies } from '../codex-trust.ts';
import { HARNESS_ORDER } from './harnesses.ts';
import type { SetupStep } from '../types.ts';

type Dependencies = { clock?: Clock; codex?: CodexTrustDependencies };
const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
function codexTrusted(file: string, keys: readonly string[]): boolean {
  let source: string;
  try { source = readFileSync(file, 'utf8'); }
  catch (err) { if ((err as NodeJS.ErrnoException).code === 'ENOENT') return false; throw err; }
  const projects = parse(source).projects;
  return record(projects) && keys.every(key => record(projects[key]) && projects[key].trust_level === 'trusted');
}

/** One line for every installed harness, including profiles explicitly selected by roles.
 * Only a terminal or --yes authorizes the real per-user configuration writes.
 */
export function createTrustStep(deps: Dependencies = {}): SetupStep {
  return async ({ root, rootSpelling = root, env, machine, interactive, yes }) => {
    const found = await Promise.all(HARNESS_ORDER.map(id => machine.harness(id)));
    const installed = found.filter(h => h.bin !== null);
    if (installed.length === 0) return [{ name: 'trust', verdict: 'skip', detail: 'no installed harnesses' }];
    const home = env.HOME ?? homedir();
    const display = (file: string) => file.startsWith(`${home}/`) ? `~/${file.slice(home.length + 1)}` : file;
    const details: string[] = [], failures: string[] = [], fixes: string[] = [];
    let changed = false, open = false;
    try {
      const real = realpathSync(root);
      const keys = real === rootSpelling ? [rootSpelling] : [rootSpelling, real];
      const profiles = new Map<string, NodeJS.ProcessEnv[]>(installed.map(h => [h.id, [env]]));
      let roles;
      try { roles = parseRoles(readFileSync(join(root, '.cland', 'roles.toml'), 'utf8')); }
      catch (err) { if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err; }
      const names = new Set([...(roles?.values() ?? [])].map(role => role.launch.account).filter(name => name !== null));
      if (names.size) {
        const registry = await readAccounts(env);
        for (const name of names) {
          const account = namedAccount(registry, name);
          for (const role of roles!.values()) {
            if (role.launch.account === name && account.harness !== role.launch.harness) throw new Error(`account ${name} does not use ${role.launch.harness}`);
          }
          if (!installed.some(h => h.id === account.harness) || account.harness === 'opencode') continue;
          const selection = await selectAccount(account, account.harness, env);
          profiles.get(account.harness)!.push(accountEnvironment(env, selection.accountEnv));
        }
      }
      for (const harness of installed) {
        if (harness.id === 'opencode') { details.push('opencode (no trust gate)'); continue; }
        const files = new Set<string>();
        for (const profile of profiles.get(harness.id)!) {
          const claude = harness.id === 'claude-code';
          const file = claude ? claudeConfigFile(profile, home) : join(profile.CODEX_HOME || join(home, '.codex'), 'config.toml');
          if (files.has(file)) continue;
          files.add(file);
          const label = `${harness.id} (${display(file)})`;
          try {
            const trusted = () => claude ? claudeTrusted(file, real) : codexTrusted(file, keys);
            if (!trusted()) {
              if (!interactive && !yes) open = true;
              else {
                if (claude) await grantClaudeTrust(file, real, deps.clock);
                else await grantCodexTrust(harness.bin!, profile, keys, deps.codex);
                if (!trusted()) throw new Error('configuration did not reread as trusted');
                changed = true;
              }
            }
            details.push(label);
          } catch (err) {
            failures.push(`${label}: ${err instanceof Error ? err.message : String(err)}`);
            fixes.push(`open ${claude ? 'claude' : 'codex'} in this project with this profile and accept its own trust dialog`);
          }
        }
      }
    } catch (err) {
      failures.push(`harness trust: ${err instanceof Error ? err.message : String(err)}`);
      fixes.push('check role accounts; open each installed harness in this project and accept its own trust dialog');
    }
    const risk = 'real harness configuration for this path';
    if (failures.length) return [{ name: 'trust', verdict: 'fail', detail: `${failures.join('; ')}; ${risk}`, fix: [...new Set(fixes)].join('; ') }];
    if (open) return [{ name: 'trust', verdict: 'open', detail: `trust needed for ${details.join(', ')}; writes the ${risk}`, fix: 'run: cland setup --yes, or cland setup in a terminal' }];
    return [{ name: 'trust', verdict: changed ? 'done' : 'ok', detail: `trusted for ${details.join(', ')}; ${changed ? 'wrote' : 'checked'} the ${risk}` }];
  };
}

export const trust: SetupStep = createTrustStep();
