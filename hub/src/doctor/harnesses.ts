// Harness installation metadata shared by doctor and the hub's model probes.
// Keep this independent of the Neovim toolchain: ordinary hub startup needs no Neovim modules.
import { join } from 'node:path';
import { fail, which, whichAsync, type Check } from './report.ts';
import type { HarnessId } from './ranges.ts';

export type HarnessInstallation = { id: HarnessId; bin: string; override: string; install: string };
export const HARNESS_INSTALLATIONS: Readonly<Record<HarnessId, HarnessInstallation>> = {
  'claude-code': {
    id: 'claude-code', bin: 'claude', override: 'CLAND_CLAUDE_BIN',
    install: 'install Claude Code (https://docs.claude.com/en/docs/claude-code)',
  },
  codex: {
    id: 'codex', bin: 'codex', override: 'CLAND_CODEX_BIN',
    install: 'install Codex (npm install -g @openai/codex)',
  },
  opencode: {
    id: 'opencode', bin: 'opencode', override: 'CLAND_OPENCODE_BIN',
    install: 'install OpenCode v2 (https://opencode.ai/v2/install)',
  },
};

/** An explicit override is authoritative; installer folders supplement PATH without probing a process. */
function candidates(h: HarnessInstallation, env: NodeJS.ProcessEnv): string[] {
  if (env[h.override]) return [env[h.override]!];
  return [h.bin, ...(env.HOME ? [join(env.HOME, '.local/bin', h.bin), join(env.HOME, '.opencode/bin', h.bin)] : [])];
}

/** A native adapter launches the same executable discovery selected, even outside PATH.
 * Keep an explicit invalid override intact so launch reports the human's selected command.
 */
export function harnessBinary(id: HarnessId, env: NodeJS.ProcessEnv): string {
  const h = HARNESS_INSTALLATIONS[id];
  if (env[h.override]) return env[h.override]!;
  // Keep PATH launches and attach commands portable; resolve only an installer-folder fallback.
  if (which(h.bin, env)) return h.bin;
  return findHarness(id, env) || h.bin;
}

function findHarness(id: HarnessId, env: NodeJS.ProcessEnv): string | null {
  for (const candidate of candidates(HARNESS_INSTALLATIONS[id], env)) {
    const bin = which(candidate, env);
    if (bin) return bin;
  }
  return null;
}

/** Synchronous provisioning uses the same executable lookup as doctor's asynchronous diagnosis. */
export function installedHarnesses(env: NodeJS.ProcessEnv): HarnessId[] {
  return (Object.keys(HARNESS_INSTALLATIONS) as HarnessId[]).filter(id => findHarness(id, env) !== null);
}

/** Shared installation diagnosis; does not run the harness or check the rest of the toolchain. */
export async function harnessInstallation(id: HarnessId, env: NodeJS.ProcessEnv): Promise<{ bin: string | null; missing?: Check }> {
  const h = HARNESS_INSTALLATIONS[id];
  for (const candidate of candidates(h, env)) {
    const bin = await whichAsync(candidate, env);
    if (bin) return { bin };
  }
  const where = env[h.override] ? `${h.override} names ${env[h.override]}, which is not an executable` : `\`${h.bin}\` is not on the PATH or in its installer folders`;
  const fix = env[h.override] ? `point ${h.override} at the ${h.bin} executable, or unset it` : `${h.install}, or set ${h.override} to its path`;
  return { bin: null, missing: fail(h.id, `not installed: ${where}`, fix) };
}

/** Asynchronous startup lookup, sharing doctor's override and installer-folder rules. */
export async function installedHarnessesAsync(env: NodeJS.ProcessEnv): Promise<HarnessId[]> {
  const ids = Object.keys(HARNESS_INSTALLATIONS) as HarnessId[];
  const found = await Promise.all(ids.map(async id => ({ id, bin: (await harnessInstallation(id, env)).bin })));
  return found.filter(h => h.bin !== null).map(h => h.id);
}
