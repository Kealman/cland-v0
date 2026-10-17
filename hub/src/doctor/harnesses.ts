// Harness installation metadata shared by doctor and the hub's model probes.
// Keep this independent of the Neovim toolchain: ordinary hub startup needs no Neovim modules.
import { fail, whichAsync, type Check } from './report.ts';
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

/** Shared installation diagnosis; does not run the harness or check the rest of the toolchain. */
export async function harnessInstallation(id: HarnessId, env: NodeJS.ProcessEnv): Promise<{ bin: string | null; missing?: Check }> {
  const h = HARNESS_INSTALLATIONS[id];
  const bin = await whichAsync(env[h.override] || h.bin, env);
  if (bin) return { bin };
  const where = env[h.override] ? `${h.override} names ${env[h.override]}, which is not an executable` : `\`${h.bin}\` is not on the PATH`;
  const fix = env[h.override] ? `point ${h.override} at the ${h.bin} executable, or unset it` : `${h.install}, or set ${h.override} to its path`;
  return { bin: null, missing: fail(h.id, `not installed: ${where}`, fix) };
}
