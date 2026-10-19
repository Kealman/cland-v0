import { appendFile, mkdir, readFile, readdir, realpath, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { parse } from 'smol-toml';
import { basename, dirname, join, resolve } from 'node:path';
import { readAccounts } from '../../accounts/registry.ts';
import { parseConfig, renderConfig } from '../../init/config.ts';
import { isManagedFile } from '../../init/files.ts';
import { accountIdentity } from '../account-identity.ts';
import { Cancelled } from '../prompter.ts';
import type { SetupStep } from '../types.ts';

export type AccountIdentity = (harness: 'claude-code' | 'codex', bin: string, env: NodeJS.ProcessEnv) => Promise<string | null>;
const canonical = async (path: string): Promise<string> => realpath(path).catch(() => resolve(path));

/** Only explicitly separate, signed-in directories can become machine-wide accounts. */
export function createAccountsStep({ identity = accountIdentity }: { identity?: AccountIdentity } = {}): SetupStep {
  return async ({ root, machine, env, interactive, yes, noAccounts, prompter, narrate }) => {
    if (noAccounts) return [{ name: 'accounts', verdict: 'skip', detail: '--no-accounts' }];
    try {
      const registry = await readAccounts(env);
      if (registry.error) return [{ name: 'accounts', verdict: 'fail', detail: registry.error, fix: 'repair it by hand' }];
      const configText = await machine.read('config.toml');
      const config = parseConfig(configText ?? '', basename(root), env);
      const declined = config.setup.declinedAccounts;
      const home = env.HOME ?? homedir();
      const folders = await readdir(home, { withFileTypes: true });
      const candidates: Array<{ name: string; harness: 'claude-code' | 'codex'; key: string; path: string; who: string }> = [];
      for (const folder of folders.sort((a, b) => a.name.localeCompare(b.name))) {
        const match = /^\.(claude|codex)-([a-z0-9][a-z0-9-]*)$/.exec(folder.name);
        if (!match || (!folder.isDirectory() && !folder.isSymbolicLink())) continue;
        const harness = match[1] === 'claude' ? 'claude-code' : 'codex';
        const variable = harness === 'claude-code' ? 'CLAUDE_CONFIG_DIR' : 'CODEX_HOME';
        const name = folder.name.slice(1), path = join(home, folder.name);
        if (declined.includes(name) || !(await stat(path)).isDirectory()) continue;
        const location = await canonical(path);
        if (location === await canonical(env[variable] || join(home, harness === 'claude-code' ? '.claude' : '.codex')) ||
            location === await canonical(join(home, harness === 'claude-code' ? '.claude' : '.codex'))) continue;
        let registered = false;
        for (const account of registry.accounts) {
          if (account.harness === harness && account.path !== null && location === await canonical(account.path)) registered = true;
        }
        if (registered) continue;
        const { bin } = await machine.harness(harness);
        if (!bin) continue;
        const who = await identity(harness, bin, { ...env, [variable]: path });
        if (who === null) continue;
        if (registry.accounts.some(a => a.name === name)) throw new Error(`account name ${name} is already used; repair it by hand`);
        candidates.push({ name, harness, key: harness === 'claude-code' ? 'config_dir' : 'home', path: `~/${folder.name}`, who });
      }
      const earlier = declined.length ? `declined earlier: ${declined.join(', ')}; add them to accounts.toml by hand to use them` : '';
      if (!candidates.length) return [{ name: 'accounts', verdict: 'ok', detail: earlier || 'no new signed-in profiles' }];
      const names = candidates.map(a => a.name).join(', ');
      if (!interactive) return [{ name: 'accounts', verdict: 'open', detail: `new signed-in profiles: ${names}${earlier ? `; ${earlier}` : ''}`, fix: 'run cland setup in a terminal to choose accounts' }];
      narrate?.(`Accounts are useful for several accounts per harness, or limits. This file is machine-wide: ${registry.registry}\n${candidates.map(a => `${a.name}: ${a.who}`).join('\n')}\n`);
      if (yes || !await prompter.confirm('Write them to ~/.config/cland/accounts.toml?', false)) {
        if (configText === null || !isManagedFile(configText)) throw new Error('config.toml has no managed by cland mark; cannot save setup declines');
        config.setup.declinedAccounts = [...new Set([...declined, ...candidates.map(a => a.name)])];
        await machine.write('config.toml', renderConfig(config), configText);
        return [{ name: 'accounts', verdict: 'skip', detail: `declined: ${names}` }];
      }
      let original = '';
      try { original = await readFile(registry.registry, 'utf8'); }
      catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
      // Recheck before appending: another project's setup may have changed this machine-wide file.
      const fresh = await readAccounts(env);
      if (fresh.error || fresh.accounts.some(a => candidates.some(c => c.name === a.name || (c.harness === a.harness && a.path === join(home, c.path.slice(2)))))) {
        throw new Error('accounts registry changed; run cland setup again');
      }
      const entries = candidates.map(a => `[accounts.${a.name}]\nharness = ${JSON.stringify(a.harness)}\n${a.key} = ${JSON.stringify(a.path)}\n`).join('\n');
      const addition = `${original && !original.endsWith('\n') ? '\n' : ''}\n${entries}`;
      // Inline TOML tables cannot always be extended with table headers. Refuse before touching them.
      try { parse(original + addition); }
      catch { throw new Error('accounts registry cannot be extended; repair it by hand'); }
      await mkdir(dirname(registry.registry), { recursive: true, mode: 0o700 });
      await appendFile(registry.registry, addition, { mode: 0o600 });
      return [{ name: 'accounts', verdict: 'done', detail: `added: ${names}` }];
    } catch (error) {
      if (error instanceof Cancelled) throw error;
      return [{ name: 'accounts', verdict: 'fail', detail: error instanceof Error ? error.message : String(error), fix: 'repair it by hand' }];
    }
  };
}

export const accounts = createAccountsStep();
