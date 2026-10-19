// Init fixtures own their Git identity; no host config or product identity fallback is needed.
export const INIT_GIT_IDENTITY = {
  GIT_AUTHOR_NAME: 'Init Fixture',
  GIT_AUTHOR_EMAIL: 'init-fixture@example.test',
  GIT_COMMITTER_NAME: 'Init Fixture',
  GIT_COMMITTER_EMAIL: 'init-fixture@example.test',
};

/** Scope the identity around in-process init, restoring the worker environment afterwards. */
export async function withInitGitIdentity<T>(run: () => T | Promise<T>): Promise<T> {
  const before = Object.keys(INIT_GIT_IDENTITY).map(key => [key, process.env[key]] as const);
  Object.assign(process.env, INIT_GIT_IDENTITY);
  try { return await run(); }
  finally {
    for (const [key, value] of before) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}
