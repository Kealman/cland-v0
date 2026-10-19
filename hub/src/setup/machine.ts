import { stat } from 'node:fs/promises';
import { join } from 'node:path';
import { HARNESS_INSTALLATIONS } from '../doctor/harnesses.ts';
import { whichAsync } from '../doctor/report.ts';
import { probeHarness, type HarnessProbe } from '../doctor/toolchain.ts';
import type { HarnessId } from '../doctor/ranges.ts';
import type { SetupMachine } from './types.ts';

/** Read-only machine facts, shared by the harness and login report in one run.
 * Rechecking after an action can create a fresh machine to avoid stale probe receipts.
 */
export function setupMachine(root: string, env: NodeJS.ProcessEnv): SetupMachine {
  const probes = new Map<HarnessId, Promise<HarnessProbe>>();
  return {
    async projectExists() {
      try { return (await stat(join(root, '.cland'))).isDirectory(); }
      catch { return false; }
    },
    harness(id) {
      let result = probes.get(id);
      if (!result) { result = probeHarness(id, env); probes.set(id, result); }
      return result;
    },
    onPath: async id => await whichAsync(HARNESS_INSTALLATIONS[id].bin, env) !== null,
  };
}
