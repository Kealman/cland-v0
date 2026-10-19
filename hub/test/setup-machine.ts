// Setup's scratch machine: a real cland init, fake vendor binaries and no host accounts or tool PATH.
import { constants } from 'node:fs';
import { access, chmod, mkdir, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import { delimiter, dirname, join, resolve } from 'node:path';
import type { TestContext } from 'node:test';
import { fileURLToPath } from 'node:url';
import { shellQuote } from '../src/accounts/registry.ts';
import { initializedProject, scratchMachine, type InitMachine } from './init-machine.ts';
import { loginMarker, setFakeLogin, type FakeIdentity, type SetupHarness } from './fakes/setup-profile.ts';

export type SetupMachine = InitMachine & { project: string; bin: string };
export type FakeCall = { harness: SetupHarness | 'curl'; args: string[]; pid: number; profile?: string; method?: string; params?: unknown };
const binaries = { 'claude-code': 'claude', codex: 'codex', opencode: 'opencode' };
const sources = { 'claude-code': 'claude-code/fake-claude.ts', codex: 'codex/fake-codex.ts', opencode: 'opencode/fake-opencode.ts' };

async function hostTool(name: string): Promise<string> {
  for (const folder of (process.env.PATH ?? '').split(delimiter)) {
    if (!folder) continue;
    const path = join(folder, name);
    try { await access(path, constants.X_OK); return await realpath(path); }
    catch (error) { if (!['ENOENT', 'EACCES', 'ENOTDIR'].includes((error as NodeJS.ErrnoException).code ?? '')) throw error; }
  }
  throw new Error(`setup machine needs host tool ${name}`);
}

export async function setupMachine(t: TestContext, { installed = ['claude-code', 'codex', 'opencode'] }: { installed?: SetupHarness[] } = {}): Promise<SetupMachine> {
  const base = await scratchMachine(t, { identity: true });
  // Do not inherit NODE_OPTIONS, shell startup files, account overrides, provider tokens or fake controls.
  const env: NodeJS.ProcessEnv = Object.fromEntries(Object.entries(base.env).filter(([key]) =>
    ['HOME', 'XDG_CONFIG_HOME', 'XDG_DATA_HOME', 'XDG_STATE_HOME', 'XDG_CACHE_HOME', 'GIT_CONFIG_GLOBAL', 'GIT_CONFIG_NOSYSTEM', 'CLAUDE_CONFIG_DIR', 'CODEX_HOME'].includes(key)));
  const bin = join(base.home, 'bin');
  const installers = join(base.home, 'fake-installers');
  const temporary = join(base.home, 'tmp');
  for (const folder of [bin, installers, temporary]) await mkdir(folder);
  for (const tool of ['git', 'bash', 'sh', 'env', 'dirname', 'cp', 'mkdir', 'chmod', 'script', 'ps', 'pgrep']) await symlink(await hostTool(tool), join(bin, tool));
  await symlink(process.execPath, join(bin, 'node'));
  Object.assign(env, {
    PATH: bin, SHELL: join(bin, 'bash'), TMPDIR: temporary, DIGITALOCEAN_TOKEN: '',
    OPENCODE_DB: join(env.XDG_DATA_HOME!, 'cland', 'opencode.db'),
    FAKE_HARNESS_PROFILES: '1', FAKE_HARNESS_CALL_LOG: join(base.home, 'calls.jsonl'), FAKE_INSTALLER_DIR: installers,
    FAKE_CLAUDE_HOME: join(base.home, 'fake-claude'), FAKE_CODEX_HOME: join(base.home, 'fake-codex'), FAKE_OPENCODE_HOME: join(base.home, 'fake-opencode'),
  });
  await writeFile(env.FAKE_HARNESS_CALL_LOG!, '');
  for (const harness of ['claude-code', 'codex', 'opencode'] as const) {
    await writeExecutable(join(installers, binaries[harness]), wrapper(sources[harness]));
  }
  await writeExecutable(join(bin, 'curl'), wrapper('curl.ts'));
  // Install before init: its real role-template detection sees exactly this fake machine.
  const machine: SetupMachine = { ...base, env, bin, project: '' };
  for (const harness of installed) await installFake(machine, harness);
  machine.project = (await initializedProject(machine)).root;
  return machine;
}

function wrapper(source: string): string {
  return `#!/bin/sh\nexec ${shellQuote(process.execPath)} ${shellQuote(fileURLToPath(new URL(`./fakes/${source}`, import.meta.url)))} "$@"\n`;
}
async function writeExecutable(path: string, content: string): Promise<void> {
  await writeFile(path, content);
  await chmod(path, 0o755);
}

/** Installer-only binaries deliberately remain off PATH, as on a newly installed machine. */
export async function installFake(machine: SetupMachine, harness: SetupHarness, location: 'path' | 'installer' = 'path'): Promise<string> {
  const folder = location === 'path' ? machine.bin : join(machine.home, harness === 'opencode' ? '.opencode/bin' : '.local/bin');
  await mkdir(folder, { recursive: true });
  const path = join(folder, binaries[harness]);
  await writeExecutable(path, wrapper(sources[harness]));
  return path;
}

/** Profile paths belong to the scratch HOME, including explicit OpenCode database paths. */
export function profileEnvironment(machine: SetupMachine, harness: SetupHarness, path: string): NodeJS.ProcessEnv {
  const profile = resolve(path);
  if (!profile.startsWith(machine.home + '/')) throw new Error('fake profile must be inside the scratch HOME');
  return { ...machine.env, [{ 'claude-code': 'CLAUDE_CONFIG_DIR', codex: 'CODEX_HOME', opencode: 'OPENCODE_DB' }[harness]]: profile };
}
export async function signIn(machine: SetupMachine, harness: SetupHarness, signedIn = true, identity: Partial<FakeIdentity> = {}): Promise<void> {
  setFakeLogin(harness, signedIn, machine.env, identity);
}
export async function loginFails(machine: SetupMachine, harness: SetupHarness, fails: boolean): Promise<void> {
  const path = `${loginMarker(harness, machine.env)}.login-fails`;
  if (!fails) { await rm(path, { force: true }); return; }
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, 'exit zero without signing in\n');
}
export async function calls(machine: SetupMachine): Promise<FakeCall[]> {
  return (await readFile(machine.env.FAKE_HARNESS_CALL_LOG!, 'utf8')).trim().split('\n').filter(Boolean).map(line => JSON.parse(line) as FakeCall);
}
