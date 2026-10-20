// Shared on-disk doctor fixture: injected machine facts; executable probes live in doctor-cli.
import { ownDirectory } from './process-cleanup.ts';
import { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { chmod, mkdir, mkdtemp, readFile, realpath, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tempProject, type CliResult } from './harness.ts';
import { runDoctor } from '../src/cli/doctor.ts';
import { runUpdate } from '../src/cli/init.ts';
import { provision } from '../src/init/provision.ts';
import { captureCli } from './cli-in-process.ts';

const FAKES = fileURLToPath(new URL('./fakes/', import.meta.url));
const FAKE_GH_DIR = fileURLToPath(new URL('./fixtures/fake-gh', import.meta.url));
export const NVIM_VERSION = (await readFile(new URL('../../nvim/NVIM_VERSION', import.meta.url), 'utf8')).trim();

type Check = { name: string; verdict: 'ok' | 'warn' | 'fail'; detail: string; fix?: string };
type Report = { root: string; version: string; checks: Check[]; summary: { ok: number; warn: number; fail: number } };

export const HARNESS_DIRS = { claude: join(FAKES, 'claude-code'), codex: join(FAKES, 'codex'), opencode: join(FAKES, 'opencode') };

/**
 * The doctor's environment: a PATH of the fakes, a folder holding `node` (the fakes run on it) and the system's
 * /usr/bin:/bin, so no real `claude`, `codex`, `opencode`, `gh` or `nvim` on this machine is ever found.
 */
export async function toolchain(t: TestContext, real = false): Promise<{ env: Record<string, string>; path: (without?: keyof typeof HARNESS_DIRS) => string }> {
  const dir = await realpath(await mkdtemp(join(tmpdir(), 'cland-doctor-')));
  ownDirectory(t, dir);
  const bin = join(dir, 'bin');
  await mkdir(bin);
  await symlink(process.execPath, join(bin, 'node'));
  const nvim = join(dir, 'nvim');
  await writeFile(nvim, `#!/bin/sh\necho "NVIM ${NVIM_VERSION}"\necho "Build type: Release"\n`);
  await chmod(nvim, 0o755);
  const harnessDirs = real ? HARNESS_DIRS : { claude: join(dir, 'fakes/claude-code'), codex: join(dir, 'fakes/codex'), opencode: join(dir, 'fakes/opencode') };
  if (!real) for (const [key, folder] of Object.entries(harnessDirs)) {
    await mkdir(folder, { recursive: true });
    const bin = join(folder, key === 'claude' ? 'claude' : key);
    await writeFile(bin, 'probe placeholder\n');
    await chmod(bin, 0o755);
  }
  const path = (without?: keyof typeof HARNESS_DIRS) =>
    [...Object.entries(harnessDirs).filter(([k]) => k !== without).map(([, d]) => d), FAKE_GH_DIR, bin, '/usr/bin', '/bin'].join(':');
  const env = {
    PATH: path(),
    HOME: join(dir, 'home'),
    XDG_CONFIG_HOME: join(dir, 'config'),
    XDG_DATA_HOME: '',
    CLAND_NVIM: nvim,
    FAKE_CLAUDE_HOME: join(dir, 'claude-home'),
    FAKE_CODEX_HOME: join(dir, 'codex-home'),
    FAKE_OPENCODE_HOME: join(dir, 'opencode-home'),
  };
  return { env, path };
}

export const doctor = (root: string, env: Record<string, string>, ...args: string[]): Promise<CliResult> => doctorWithRemotes(root, env, ['github'], ...args);
const doctorWithRemotes = (root: string, env: Record<string, string>, remotes: string[], ...args: string[]): Promise<CliResult> => captureCli(write => runDoctor(args, root, { CLAND_TEST_ORPHAN_ROOT: root, ...env }, write, probeTools, { remotes: async () => remotes, project: { started: async () => null, territoryProblems: () => null }, findOrphans: async () => [] }));
export const update = (root: string) => captureCli(write => runUpdate([], root, write));

export async function report(root: string, env: Record<string, string>, remotes = ['github']): Promise<{ code: number | null; report: Report }> {
  const r = await doctorWithRemotes(root, env, remotes, '--json');
  try {
    return { code: r.code, report: JSON.parse(r.stdout) as Report };
  } catch {
    throw new Error(`cland doctor --json printed no JSON (${r.code}):\n${r.stdout}\n${r.stderr}`);
  }
}

export const check = (r: Report, name: string): Check => {
  const c = r.checks.find((x) => x.name === name);
  assert.ok(c, `no check named ${name} in ${r.checks.map((x) => x.name).join(', ')}`);
  return c;
};

export const notOk = (r: Report) => r.checks.filter((c) => c.verdict !== 'ok').map((c) => `${c.verdict} ${c.name}: ${c.detail} — ${c.fix ?? ''}`);

export async function initialised(t: TestContext, env: Record<string, string>, openCode = false): Promise<string> {
  const root = await tempProject(t, 'cland-doctor-proj-');
  // This fixture needs provisioned files, not the init command's native territory contract.
  const init = await captureCli(async () => { await provision(root, { territory: false }); return 0; });
  assert.equal(init.code, 0, init.stderr);
  // The healthy fixture uses Codex; OpenCode's safety warnings are exercised separately.
  if (!openCode) {
    const path = join(root, '.cland', 'roles.toml');
    await writeFile(path, (await readFile(path, 'utf8')).replace('harness = "opencode"', 'harness = "codex"'));
  }
  return root;
}


// These are command replies, not harness adapters. The matrix exercises production
// lookup, argument selection, parsing, version/auth policy and rendering without executables.
export const probeCalls: Array<{ bin: string; args: readonly string[]; database?: string }> = [];
export const probeTools: typeof import('../src/doctor/report.ts').run = async (bin, args, env) => {
  probeCalls.push({ bin, args: [...args], ...(env.OPENCODE_DB ? { database: env.OPENCODE_DB } : {}) });
  let stdout = '';
  let code = 0;
  switch (basename(bin)) {
    case 'claude':
      if (args[0] === '--version') stdout = `${env.FAKE_CLAUDE_VERSION ?? '2.1.294'} (Claude Code)`;
      else { assert.deepEqual(args, ['auth', 'status', '--json']); code = env.FAKE_CLAUDE_LOGGED_OUT === '1' ? 1 : 0; stdout = JSON.stringify({ loggedIn: code === 0, authMethod: 'claude.ai' }); }
      break;
    case 'codex':
      if (args[0] === '--version') stdout = 'codex-cli 0.160.0';
      else { assert.deepEqual(args, ['login', 'status']); code = env.FAKE_CODEX_LOGGED_OUT === '1' ? 1 : 0; stdout = code === 0 ? 'Logged in using ChatGPT' : 'Not logged in'; }
      break;
    case 'opencode':
      if (args[0] !== '--version') assert.deepEqual(args, ['auth', 'list', '--standalone', '--format', 'json']);
      stdout = args[0] === '--version' ? `opencode v${env.FAKE_OPENCODE_VERSION ?? '2.0.24'}` : env.FAKE_OPENCODE_NO_AUTH === '1' ? '[]' : '[{"id":"fake","name":"Fake Provider","connections":[{"type":"credential"}]}]';
      break;
    case 'gh':
      if (args[0] === '--version') stdout = 'gh version 2.102.0';
      else { assert.deepEqual(args, ['auth', 'status']); code = env.FAKE_GH_LOGGED_OUT === '1' ? 1 : 0; stdout = code === 0 ? 'Logged in to github.com account test' : 'not logged in'; }
      break;
    case 'stty':
      assert.deepEqual(args, ['-a']);
      code = env.CLAND_TEST_STTY_OUTPUT ? 0 : 1;
      stdout = env.CLAND_TEST_STTY_OUTPUT ? await readFile(env.CLAND_TEST_STTY_OUTPUT, 'utf8') : '';
      break;
    default:
      assert.equal(args[0], '--version', `unexpected probe ${bin}`);
      stdout = /NVIM v[^"\n]+/.exec(await readFile(bin, 'utf8'))?.[0] ?? '';
  }
  return { code, stdout, stderr: '' };
};
