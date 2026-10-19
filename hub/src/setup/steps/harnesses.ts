import { HARNESS_INSTALLATIONS } from '../../doctor/harnesses.ts';
import type { HarnessId } from '../../doctor/ranges.ts';
import type { SetupStep } from '../types.ts';

export const HARNESS_ORDER: readonly HarnessId[] = ['claude-code', 'codex', 'opencode'];
// Official user-level installers; shown here, never executed by detection.
export const INSTALLERS: Readonly<Record<HarnessId, string>> = {
  'claude-code': 'curl -fsSL https://claude.ai/install.sh | bash',
  codex: 'npm install -g @openai/codex',
  opencode: 'curl -fsSL https://opencode.ai/v2/install | bash',
};

export const harnesses: SetupStep = async ({ machine, env }) => {
  const found = await Promise.all(HARNESS_ORDER.map(id => machine.harness(id)));
  const anyInstalled = found.some(h => h.bin !== null);
  return Promise.all(found.map(async h => {
    if (!h.bin) return { name: h.id, verdict: anyInstalled ? 'skip' : 'open', detail: 'not installed', fix: `run: ${INSTALLERS[h.id]}` };
    const check = h.checks[0]!;
    const outsidePath = !env[HARNESS_INSTALLATIONS[h.id].override] && !await machine.onPath(h.id);
    return { ...check, verdict: check.verdict === 'ok' ? 'ok' : 'fail', detail: `${check.detail}${outsidePath ? '; not on your PATH yet: open a new shell' : ''}` };
  }));
};
