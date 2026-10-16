// Init's scratch machine: no host HOME, Git configuration or identity reaches its subprocesses.
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readdir, readFile, readlink, realpath, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import type { TestContext } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type { CliResult } from './harness.ts';
import { ownDirectory } from './process-cleanup.ts';

export type InitMachine = { root: string; home: string; env: NodeJS.ProcessEnv };
export type SpendEntry = { project: string; lease: string; run: string; size: string; reservation: number; cost: number | null; created: string; deadline: string; released?: string };
export type SpendLedger = { version: 1; entries: SpendEntry[]; projects?: string[] };

export async function scratchMachine(t: TestContext, { identity }: { identity: boolean }): Promise<InitMachine> {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'cland-init-machine-')));
  ownDirectory(t, root);
  const home = join(root, 'home');
  const env: NodeJS.ProcessEnv = {};
  for (const [key, value] of Object.entries(process.env)) {
    // Clear all Git overrides, including injected config, worktrees, templates and identities.
    if (!/^(CLAND_|GIT_|EMAIL$)/.test(key)) env[key] = value;
  }
  Object.assign(env, {
    HOME: home,
    XDG_CONFIG_HOME: join(home, '.config'),
    XDG_DATA_HOME: join(home, '.local', 'share'),
    XDG_STATE_HOME: join(home, '.local', 'state'),
    XDG_CACHE_HOME: join(home, '.cache'),
    GIT_CONFIG_GLOBAL: join(home, '.gitconfig'),
    GIT_CONFIG_NOSYSTEM: '1',
  });
  for (const dir of [home, env.XDG_CONFIG_HOME!, env.XDG_DATA_HOME!, env.XDG_STATE_HOME!, env.XDG_CACHE_HOME!]) await mkdir(dir, { recursive: true });
  await writeFile(env.GIT_CONFIG_GLOBAL!, `[commit]\n\tgpgsign = false\n${identity ? '[user]\n\tname = Init Test\n\temail = init@example.test\n' : ''}`);
  return { root, home, env };
}

function run(machine: InitMachine, cwd: string, command: string, args: string[]): Promise<CliResult> {
  return new Promise((resolve, reject) => {
    execFile(command, args, { cwd, env: machine.env, encoding: 'utf8', timeout: 30_000 }, (error, stdout, stderr) => {
      if (error && typeof error.code !== 'number') reject(error);
      else resolve({ code: error ? error.code as number : 0, stdout, stderr });
    });
  });
}

/** Like clandWithEnv, accepts the complete CLI arguments, e.g. 'init', '--json' or 'update'. */
export function initIn(machine: InitMachine, folder: string, ...args: string[]): Promise<CliResult> {
  return run(machine, folder, process.execPath, [fileURLToPath(new URL('../bin/cland.ts', import.meta.url)), ...args]);
}

export function gitIn(machine: InitMachine, folder: string, ...args: string[]): Promise<CliResult> {
  return run(machine, folder, 'git', args);
}

async function git(machine: InitMachine, folder: string, ...args: string[]): Promise<void> {
  const result = await gitIn(machine, folder, ...args);
  if (result.code !== 0) throw new Error(`scratch Git failed: ${result.stderr}`);
}

export const emptyFolder = (machine: InitMachine): Promise<string> => mkdtemp(join(machine.home, 'empty-'));

export async function filesFolder(machine: InitMachine): Promise<string> {
  const folder = await emptyFolder(machine);
  await writeFile(join(folder, 'README.md'), '# The human\'s project\n');
  await mkdir(join(folder, 'src'));
  await writeFile(join(folder, 'src', 'index.js'), 'console.log("hello");\n');
  return folder;
}

export async function unbornRepo(machine: InitMachine, { staged = false }: { staged?: boolean } = {}): Promise<string> {
  const folder = await emptyFolder(machine);
  await git(machine, folder, 'init', '-q', '-b', 'main');
  if (staged) {
    await writeFile(join(folder, 'staged.txt'), 'the human\'s staged file\n');
    await git(machine, folder, 'add', 'staged.txt');
  }
  return folder;
}

// Builders need a commit even on a machine without an identity. This identity is command-local.
async function seedCommit(machine: InitMachine, folder: string): Promise<void> {
  await writeFile(join(folder, 'README.md'), '# Seed\n');
  await git(machine, folder, 'add', 'README.md');
  await git(machine, folder, '-c', 'user.name=Fixture Seed', '-c', 'user.email=seed@example.test', '-c', 'core.hooksPath=/dev/null', 'commit', '-qm', 'Seed');
}

async function cloneFromMaster(machine: InitMachine, shallow: boolean): Promise<{ upstream: string; clone: string }> {
  const seed = await emptyFolder(machine);
  await git(machine, seed, 'init', '-q', '-b', 'master');
  await seedCommit(machine, seed);
  const upstream = await emptyFolder(machine);
  await git(machine, machine.home, 'clone', '-q', '--bare', seed, upstream);
  const clone = await emptyFolder(machine);
  await git(machine, machine.home, 'clone', '-q', ...(shallow ? ['--depth', '1'] : []), pathToFileURL(upstream).href, clone);
  return { upstream, clone };
}

export const masterClone = (machine: InitMachine): Promise<{ upstream: string; clone: string }> => cloneFromMaster(machine, false);
export const shallowClone = (machine: InitMachine): Promise<{ upstream: string; clone: string }> => cloneFromMaster(machine, true);

export async function initializedProject(machine: InitMachine): Promise<{ root: string; subfolder: string }> {
  const root = await unbornRepo(machine);
  await seedCommit(machine, root);
  const result = await initIn(machine, root, 'init', root, '--json');
  if (result.code !== 0) throw new Error(`scratch init failed: ${result.stderr}`);
  const subfolder = join(root, 'subfolder');
  await mkdir(subfolder);
  return { root, subfolder };
}

export async function legacyLedger(machine: InitMachine, entries: SpendEntry[]): Promise<void> {
  const path = join(machine.home, '.cland', 'executor', 'spend.json');
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify({ version: 1, entries }));
}

export async function ledger(machine: InitMachine): Promise<SpendLedger> {
  return JSON.parse(await readFile(join(machine.env.XDG_STATE_HOME!, 'cland', 'spend.json'), 'utf8')) as SpendLedger;
}

/** Relative paths; directories are included, and symlinks are recorded without following them.
 * `except` names one relative or absolute subtree, never a similarly named sibling. */
export async function snapshot(dir: string, { except }: { except?: string } = {}): Promise<Record<string, string>> {
  const result = new Map<string, string>();
  const excluded = except === undefined ? undefined : resolve(dir, except);
  async function visit(folder: string, prefix: string): Promise<void> {
    for (const entry of (await readdir(folder, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
      const path = join(folder, entry.name);
      if (resolve(path) === excluded) continue;
      const key = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isSymbolicLink()) result.set(key, `link:${await readlink(path)}`);
      else if (entry.isDirectory()) { result.set(key, 'directory'); await visit(path, key); }
      else result.set(key, createHash('sha256').update(await readFile(path)).digest('hex'));
    }
  }
  if (resolve(dir) !== excluded) await visit(dir, '');
  return Object.fromEntries(result);
}
