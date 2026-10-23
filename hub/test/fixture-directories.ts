import { mkdir } from 'node:fs/promises';
import { fixtureEnvironment } from './fixture-environment.ts';

/** Provision the pure builder's owned directories at the runner I/O boundary. */
export async function prepareRunnerFixture(root: string): Promise<void> {
  const env = fixtureEnvironment(root, {});
  for (const key of ['HOME', 'XDG_CONFIG_HOME', 'XDG_DATA_HOME', 'XDG_STATE_HOME', 'XDG_CACHE_HOME',
    'CLAUDE_CONFIG_DIR', 'CODEX_HOME', 'FAKE_CLAUDE_HOME', 'FAKE_CODEX_HOME', 'FAKE_OPENCODE_HOME', 'CLAND_EXECUTOR_STATE']) {
    await mkdir(env[key]!, { recursive: true });
  }
}
