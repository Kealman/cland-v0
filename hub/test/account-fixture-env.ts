// Every fixture-using worker owns its defaults, including in-process daemons and raw CLI spawns.
// Explicit scratch registries, homes, PATHs and binary overrides still belong to each test.
import { assertTestAdmission } from '../src/test-admission.ts';
import { after } from 'node:test';
import { mkdir, mkdtemp, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ownDirectory } from './process-cleanup.ts';

let initialization: Promise<void> | undefined;
let cleanup: (() => Promise<void>) | undefined;
// Register at worker scope, not inside the first caller's test. A pure importer
// owns no directory, so its callback has no resource work to perform.
after(() => cleanup?.());
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
  cleanup = ownDirectory(undefined, root);
  const config = join(root, 'config');
  const claude = join(root, 'claude');
  const codex = join(root, 'codex');
  const data = join(root, 'opencode');
  for (const path of [join(config, 'cland'), claude, codex, data]) await mkdir(path, { recursive: true });
  process.env.XDG_CONFIG_HOME = config;
  process.env.CLAUDE_CONFIG_DIR = claude;
  process.env.CODEX_HOME = codex;
  process.env.XDG_DATA_HOME = data;
  delete process.env.OPENCODE_DB;
  process.env.FAKE_CLAUDE_HOME = join(root, 'fake-claude');
  process.env.FAKE_CODEX_HOME = join(root, 'fake-codex');
  process.env.FAKE_OPENCODE_HOME = join(root, 'fake-opencode');
  // A launched Implementer can carry real binary overrides; none is a fixture default.
  for (const key of ['CLAND_CLAUDE_BIN', 'CLAND_CODEX_BIN', 'CLAND_OPENCODE_BIN']) delete process.env[key];
  process.env.PATH = accountBinaries().PATH!;
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
