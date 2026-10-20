// Init's scratch machine: no host HOME, Git configuration or identity reaches its subprocesses.
import { withoutExecutorCredentials } from '../../shared/executor-credentials.ts';
import { fixtureEnvironment } from './fixture-environment.ts';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readdir, readFile, readlink, realpath, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import type { TestContext } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type { CliResult } from './harness.ts';
import { beforeDirectories, ownDirectory, ownProcess } from './process-cleanup.ts';
import { clandCliLaunch } from './tier-cli.ts';

export type InitMachine = { root: string; home: string; env: NodeJS.ProcessEnv; context: TestContext };
export type SpendEntry = { project: string; lease: string; run: string; size: string; reservation: number; cost: number | null; created: string; deadline: string; released?: string };
export type SpendLedger = { version: 1; entries: SpendEntry[]; projects?: string[] };

export async function scratchMachine(t: TestContext, { identity }: { identity: boolean }): Promise<InitMachine> {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'cland-init-machine-')));
  ownDirectory(t, root);
  const home = join(root, 'home');
  const env: NodeJS.ProcessEnv = fixtureEnvironment(root, process.env);
  // Preserve the product default XDG ledger and legacy migration contracts.
  delete env.CLAND_EXECUTOR_STATE;
  // This seam tests absent/configured Git identity rather than worker defaults.
  for (const key of ['GIT_AUTHOR_NAME', 'GIT_AUTHOR_EMAIL', 'GIT_COMMITTER_NAME', 'GIT_COMMITTER_EMAIL']) delete env[key];
  Object.assign(env, {
    HOME: home,
    XDG_CONFIG_HOME: join(home, '.config'),
    XDG_DATA_HOME: join(home, '.local', 'share'),
    XDG_STATE_HOME: join(home, '.local', 'state'),
    XDG_CACHE_HOME: join(home, '.cache'),
    GIT_CONFIG_GLOBAL: join(home, '.gitconfig'),
    GIT_CONFIG_NOSYSTEM: '1',
    DIGITALOCEAN_TOKEN: '',
    CLAUDE_CONFIG_DIR: join(home, '.claude'),
    CODEX_HOME: join(home, '.codex'),
  });
  for (const dir of [home, env.XDG_CONFIG_HOME!, env.XDG_DATA_HOME!, env.XDG_STATE_HOME!, env.XDG_CACHE_HOME!, env.CLAUDE_CONFIG_DIR!, env.CODEX_HOME!]) await mkdir(dir, { recursive: true });
  await writeFile(env.GIT_CONFIG_GLOBAL!, `[commit]\n\tgpgsign = false\n${identity ? '[user]\n\tname = Init Test\n\temail = init@example.test\n' : ''}`);
  return { root, home, env, context: t };
}

/** Owned machine paths and deliberately unset profiles are product inputs.
 * Synthetic native-account tests may add fake auth inputs separately. */
export function machineEnvironment(machine: InitMachine): NodeJS.ProcessEnv {
  return withoutExecutorCredentials(machine.env);
}

/** Run a scratch command owned through cancellation, process reaping and close/result drainage. */
export function commandIn(machine: InitMachine, cwd: string, command: string, args: string[]): Promise<CliResult> {
  const result = Promise.withResolvers<CliResult>();
  // cland-allow-child-env: scratchMachine seals inherited input; machineEnvironment preserves owned HOME/unset profiles and native synthetic account inputs
  const child = execFile(command, args, { cwd, env: machineEnvironment(machine), signal: machine.context.signal, encoding: 'utf8', timeout: 30_000 }, (error, stdout, stderr) => {
    if (error && typeof error.code !== 'number') result.reject(error);
    else result.resolve({ code: error ? error.code as number : 0, stdout, stderr });
  });
  const closed = new Promise<void>(resolve => child.once('close', () => resolve()));
  const stop = ownProcess(machine.context, child.pid);
  // Register before returning: cancellation can tear down a test without awaiting its body.
  beforeDirectories(machine.context, async () => {
    await stop(); // The shared owner bounds exit/reaping, including descendants.
    const deadline = AbortSignal.timeout(5000);
    const expired = Promise.withResolvers<never>();
    const timeout = () => expired.reject(new Error('scratch command did not close and settle after stop'));
    deadline.addEventListener('abort', timeout, { once: true });
    try { await Promise.race([Promise.allSettled([closed, result.promise]), expired.promise]); }
    finally { deadline.removeEventListener('abort', timeout); }
  });
  // Rejections still reach the caller; observe them here if cancellation abandons its await.
  void result.promise.catch(() => {});
  return result.promise;
}

/** Like clandWithEnv, accepts the complete CLI arguments, e.g. 'init', '--json' or 'update'. */
export function initIn(machine: InitMachine, folder: string, ...args: string[]): Promise<CliResult> {
  return clandCliLaunch(() => commandIn(machine, folder, process.execPath, [fileURLToPath(new URL('../bin/cland.ts', import.meta.url)), ...args]));
}

export function gitIn(machine: InitMachine, folder: string, ...args: string[]): Promise<CliResult> {
  return commandIn(machine, folder, 'git', args);
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
