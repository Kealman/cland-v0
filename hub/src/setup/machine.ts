import { stat } from 'node:fs/promises';
import { join } from 'node:path';
import { HARNESS_INSTALLATIONS } from '../doctor/harnesses.ts';
import { whichAsync } from '../doctor/report.ts';
import { probeHarness, type HarnessProbe } from '../doctor/toolchain.ts';
import type { HarnessId } from '../doctor/ranges.ts';
import type { SetupMachine } from './types.ts';
import { readText, symlinkNote, symlinkOnPath, writeAtomic } from '../init/files.ts';
import { terminalCommand } from './terminal.ts';

/** Machine effects and facts shared by the setup steps in one run.
 * An action invalidates its cached receipt before the later steps consume it.
 */
export function setupMachine(root: string, env: NodeJS.ProcessEnv): SetupMachine {
  const probes = new Map<HarnessId, Promise<HarnessProbe>>();
  // PATH grows during setup; the shell advice still describes the user's original PATH.
  const shellEnv = { ...env };
  return {
    async projectExists() {
      try { return (await stat(join(root, '.cland'))).isDirectory(); }
      catch { return false; }
    },
    harness(id, fresh = false) {
      if (fresh) probes.delete(id);
      let result = probes.get(id);
      if (!result) { result = probeHarness(id, env); probes.set(id, result); }
      return result;
    },
    onPath: async id => await whichAsync(HARNESS_INSTALLATIONS[id].bin, shellEnv) !== null,
    run: (command, output) => terminalCommand('/bin/sh', ['-c', command], { cwd: root, env, ...output }),
    read: async path => readText(join(root, '.cland', path)),
    async write(path, text, expected) {
      const destination = join(root, '.cland', path);
      const link = symlinkOnPath(root, destination);
      if (link !== null) throw new Error(symlinkNote(link));
      const refused = writeAtomic(root, destination, text, expected);
      if (refused !== null) throw new Error(symlinkNote(refused));
    },
  };
}
