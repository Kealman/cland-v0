// Read-only requirements shared by doctor and setup; never create a role file or inspect login secrets.
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { namedAccount, readAccounts } from '../accounts/registry.ts';
import { parseRoles } from './config.ts';

const readRoles = async (root: string): Promise<string | null> => {
  try { return await readFile(join(root, '.cland', 'roles.toml'), 'utf8'); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null; throw error; }
};

/** Missing projects/role files require no particular harness. Omitted roles use the shipped defaults. */
export async function harnessesInUse(root: string, env: NodeJS.ProcessEnv, readers: {
  roles?: typeof readRoles;
  accounts?: typeof readAccounts;
} = {}): Promise<string[]> {
  const text = await (readers.roles ?? readRoles)(root);
  if (text === null) return [];
  const roles = parseRoles(text);
  const used = new Set<string>();
  const registry = [...roles.values()].some(role => role.launch.account) ? await (readers.accounts ?? readAccounts)(env) : null;
  for (const { launch } of roles.values()) {
    used.add(launch.harness);
    if (launch.account && registry) used.add(namedAccount(registry, launch.account).harness);
  }
  return [...used].sort();
}
