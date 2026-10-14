// User-level names and paths only. Read afresh at each launch and list; never inspect account contents.
import { readFile, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, isAbsolute, join } from 'node:path';
import { parse, TomlError } from 'smol-toml';

export type Account = { name: string; harness: string; path: string | null; variable: string };
export type Accounts = { registry: string; error?: string; accounts: Account[] };
export type AccountSelection = { account: string | null; accountEnv: Record<string, string> | null };
const paths: Record<string, Record<string, string>> = {
  codex: { home: 'CODEX_HOME' },
  'claude-code': { config_dir: 'CLAUDE_CONFIG_DIR' },
  opencode: { data_home: 'XDG_DATA_HOME', db: 'OPENCODE_DB' },
};
const record = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v) && !(v instanceof Date);
const expand = (path: string) => path === '~' ? homedir() : path.startsWith('~/') ? join(homedir(), path.slice(2)) : path;

export async function readAccounts(): Promise<Accounts> {
  const config = process.env.XDG_CONFIG_HOME;
  const registry = join(config && isAbsolute(config) ? config : join(homedir(), '.config'), 'cland', 'accounts.toml');
  try {
    let source: string;
    try { source = await readFile(registry, 'utf8'); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { registry, accounts: [] }; throw error; }
    let root;
    try { root = parse(source); }
    catch (error) {
      // TOML diagnostics include source excerpts. Never return values from a malformed file.
      if (error instanceof TomlError) throw new Error(`invalid TOML at line ${error.line}, column ${error.column}`);
      throw error;
    }
    for (const key of Object.keys(root)) if (key !== 'accounts') throw new Error(`unknown key "${key}"`);
    const entries = root.accounts ?? {};
    if (!record(entries)) throw new Error('accounts must be a table');
    const accounts: Account[] = [];
    const defaults = new Set<string>();
    for (const [name, entry] of Object.entries(entries)) {
      if (!/^[a-z0-9][a-z0-9-]*$/.test(name)) throw new Error(`invalid account name "${name}"`);
      if (!record(entry)) throw new Error(`account "${name}" must be a table`);
      if (typeof entry.harness !== 'string' || !Object.hasOwn(paths, entry.harness)) throw new Error(`account "${name}" needs harness codex, claude-code or opencode`);
      const allowed = paths[entry.harness]!;
      for (const key of Object.keys(entry)) if (key !== 'harness' && !Object.hasOwn(allowed, key)) throw new Error(`account "${name}": unknown key "${key}"`);
      const keys = Object.keys(allowed).filter(key => entry[key] !== undefined);
      if (keys.length > 1) throw new Error(`account "${name}" may have at most one path key`);
      const key = keys[0];
      let path: string | null = null;
      if (key) {
        if (typeof entry[key] !== 'string') throw new Error(`account "${name}": ${key} must be a string`);
        path = expand(entry[key]);
        if (!isAbsolute(path)) throw new Error(`account "${name}": ${key} must be absolute after ~ expansion`);
      } else {
        if (defaults.has(entry.harness)) throw new Error(`two path-less accounts for harness "${entry.harness}"`);
        defaults.add(entry.harness);
      }
      accounts.push({ name, harness: entry.harness, path, variable: key ? allowed[key]! : entry.harness === 'opencode' && process.env.OPENCODE_DB ? 'OPENCODE_DB' : Object.values(allowed)[0]! });
    }
    return { registry, accounts: accounts.sort((a, b) => a.name.localeCompare(b.name)) };
  } catch (error) {
    return { registry, accounts: [], error: `accounts registry ${registry}: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export function namedAccount(registry: Accounts, name: string): Account {
  if (registry.error) throw new Error(registry.error);
  const account = registry.accounts.find(a => a.name === name);
  if (!account) throw new Error(`unknown account "${name}" (accounts: ${registry.accounts.map(a => a.name).join(', ')})`);
  return account;
}

/** Freeze the directory selected by the hub's environment, including a named harness default. */
export async function selectAccount(account: Account, harness: string): Promise<AccountSelection> {
  if (account.harness !== harness) throw new Error(`account "${account.name}" uses ${account.harness}, but launch harness is ${harness}`);
  if (harness === 'claude-code') throw new Error('Claude Code accounts are not supported yet');
  const variable = account.path === null && harness === 'opencode' && process.env.OPENCODE_DB ? 'OPENCODE_DB' : account.variable;
  const path = account.path ?? process.env[variable] ?? (harness === 'codex' ? join(homedir(), '.codex') : join(homedir(), '.local', 'share'));
  const directory = variable === 'OPENCODE_DB' ? dirname(path) : path;
  if (!(await stat(directory).catch(() => null))?.isDirectory()) {
    const login = harness === 'codex' ? 'codex login' : 'opencode auth login';
    throw new Error(`account "${account.name}": directory "${directory}" does not exist; sign in with ${variable}=${shellQuote(path)} ${login}`);
  }
  return { account: account.name, accountEnv: { [variable]: path } };
}

export const shellQuote = (s: string): string => `'${s.replace(/'/g, `'"'"'`)}'`;
export function accountEnvironment(base: NodeJS.ProcessEnv, overlay: Record<string, string> | null | undefined): NodeJS.ProcessEnv {
  const env = { ...base, ...overlay };
  // OPENCODE_DB overrides XDG_DATA_HOME in OpenCode. A data account must not inherit another database.
  if (overlay?.XDG_DATA_HOME !== undefined) delete env.OPENCODE_DB;
  return env;
}
export function accountPrefix(env: Record<string, string> | null | undefined): string {
  return env ? Object.entries(env).map(([key, value]) => `${key}=${shellQuote(value)} `).join('') + (env.XDG_DATA_HOME !== undefined ? 'env -u OPENCODE_DB ' : '') : '';
}
