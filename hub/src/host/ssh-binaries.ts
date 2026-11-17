import { readFileSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';

export const EXECUTOR_TRANSPORT_MARKER = '.cland-executor-transport-fixture';

/** The fake provider writes this receipt only in its disposable machine root. */
function executorFixture(env: NodeJS.ProcessEnv): boolean {
  const root = env.CLAND_TEST_FAKE_MACHINE_ROOT;
  if (env.CLAND_TEST_EXECUTOR_TRANSPORT !== '1' || !root || !isAbsolute(root)) return false;
  try { return readFileSync(join(root, EXECUTOR_TRANSPORT_MARKER), 'utf8') === root; }
  catch { return false; }
}

/** Overrides require the fake-host controls or a marked executor fixture root. */
export function sshBinaries(env: NodeJS.ProcessEnv): { ssh: string; scp: string } {
  const fake = Boolean(env.CLAND_FAKE_HOSTS && env.CLAND_FAKE_HOST_ROOT) || executorFixture(env);
  return { ssh: fake && env.CLAND_SSH_BIN || 'ssh', scp: fake && env.CLAND_SCP_BIN || 'scp' };
}
