// Every fixture-using worker owns its defaults, including in-process daemons and raw CLI spawns.
// Explicit scratch registries, homes, PATHs and binary overrides still belong to each test.
import { assertTestAdmission } from '../src/test-admission.ts';
import { after } from 'node:test';
import { mkdir, mkdtemp, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ownDirectory } from './process-cleanup.ts';
import { drainFixtureWork } from './case-deadlines.ts';
import { fixtureEnvironment } from './fixture-environment.ts';

let initialization: Promise<void> | undefined;
let cleanup: (() => Promise<void>) | undefined;
let fixtureRoot: string;
// Register at worker scope, not inside the first caller's test. A pure importer
// owns no directory, so its callback has no resource work to perform.
after(async () => { await drainFixtureWork(); await cleanup?.(); });
/** Admit and isolate the worker once, before its first fixture allocates resources.
 * Importing helpers performs no fixture or admission I/O. */
export async function ensureAccountFixture(): Promise<void> {
  // Wrap the cached work in a caller-owned promise: node:test attributes an
  // await of the shared promise itself to its first caller's test context.
  return initialization ??= initialize();
}

async function initialize(): Promise<void> {
  // Keep AdmissionTimeout intact so runners classify infrastructure failures.
  await assertTestAdmission();
  const root = await realpath(await mkdtemp(join(tmpdir(), 'cland-account-fixture-')));
  fixtureRoot = root;
  cleanup = ownDirectory(undefined, root);
  const env = fixtureEnvironment(root, process.env);
  for (const key of ['HOME', 'XDG_CONFIG_HOME', 'XDG_DATA_HOME', 'XDG_STATE_HOME', 'XDG_CACHE_HOME', 'CLAUDE_CONFIG_DIR', 'CODEX_HOME', 'CLAND_EXECUTOR_STATE']) await mkdir(env[key]!, { recursive: true });
  await mkdir(join(env.XDG_CONFIG_HOME!, 'cland'), { recursive: true });
  // Direct serveProject and raw CLI fixtures inherit this worker environment.
  // Never let their startup sweep acquire the host ledger or use its provider token.
  // Keep runner/admission controls in the worker itself; child builders strip them.
  for (const key of Object.keys(process.env)) if (!key.startsWith('CLAND_') && !(key in env)) delete process.env[key];
  Object.assign(process.env, env);
  for (const key of ['CLAND_CLAUDE_BIN', 'CLAND_CODEX_BIN', 'CLAND_OPENCODE_BIN']) delete process.env[key];
  process.env.PATH = accountBinaries().PATH!;
}

/** Complete sealed launch environment. Apply extras here, never after this call. */
export async function accountFixtureEnvironment(extra: NodeJS.ProcessEnv = {}): Promise<Record<string, string>> {
  await ensureAccountFixture();
  return fixtureEnvironment(fixtureRoot, process.env, extra);
}

/** One native-binary selection shared by the account contract fixtures. */
export function accountBinaries(): Record<string, string> {
  const directories = ['claude-code', 'codex', 'opencode'].map(name => fileURLToPath(new URL(`./fakes/${name}/`, import.meta.url)));
  return { PATH: directories.join(':') + ':' + (process.env.PATH ?? ''), CLAND_CLAUDE_BIN: join(directories[0]!, 'claude'), CLAND_CODEX_BIN: join(directories[1]!, 'codex'), CLAND_OPENCODE_BIN: join(directories[2]!, 'opencode') };
}

// Lazy imports keep account setup independent of its fixture factories.
export async function accountClaude(t: import('node:test').TestContext) {
  const { fakeClaude } = await import('./harness.ts');
  const fake = await fakeClaude(t);
  return { ...fake, env: { ...fake.env, ...accountBinaries() } };
}
export async function accountCodex(t: import('node:test').TestContext) {
  const { fakeCodex } = await import('./harness.ts');
  const fake = await fakeCodex(t);
  return { ...fake, env: { ...fake.env, ...accountBinaries() } };
}
