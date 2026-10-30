import { mkdir } from 'node:fs/promises';
import { fixtureEnvironment } from './fixture-environment.ts';
// Init fixtures own their Git identity; no host config or product identity fallback is needed.
export const INIT_GIT_IDENTITY = {
  GIT_AUTHOR_NAME: 'Init Fixture',
  GIT_AUTHOR_EMAIL: 'init-fixture@example.test',
  GIT_COMMITTER_NAME: 'Init Fixture',
  GIT_COMMITTER_EMAIL: 'init-fixture@example.test',
};

/** Scope a sealed disposable environment and identity around in-process init, restoring the worker environment afterwards. */
export async function withInitGitIdentity<T>(root: string, run: () => T | Promise<T>, extra: NodeJS.ProcessEnv = {}): Promise<T> {
  const before = { ...process.env };
  const sealed = fixtureEnvironment(root, process.env, { ...INIT_GIT_IDENTITY, ...extra });
  for (const key of ['HOME', 'XDG_CONFIG_HOME', 'XDG_DATA_HOME', 'XDG_STATE_HOME', 'XDG_CACHE_HOME']) await mkdir(sealed[key]!, { recursive: true });
  for (const key of Object.keys(process.env)) delete process.env[key];
  Object.assign(process.env, sealed);
  try { return await run(); }
  finally {
    for (const key of Object.keys(process.env)) delete process.env[key];
    Object.assign(process.env, before);
  }
}
