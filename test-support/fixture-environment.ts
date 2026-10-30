import { FIXTURE_OWNED_ROOT } from '../shared/fixture-roots.ts';
// Pure environment boundary shared by worker fixtures, child launches and manual probes.
import { isAbsolute, join, relative, resolve } from 'node:path';
import { withoutExecutorCredentials } from '../shared/executor-credentials.ts';

const credential = (key: string) => /^(DIGITALOCEAN_|DO_|OPENAI_|ANTHROPIC_|AWS_|AZURE_|GOOGLE_|GEMINI_|GITHUB_|GH_TOKEN$)/.test(key)
  || /^(SSH_|NPM_CONFIG_|YARN_|PNPM_|BUN_|CLOUDSDK_|GCM_|KRB5|GPG_AGENT_INFO$|GNUPGHOME$|KUBECONFIG$|DOCKER_CONFIG$|NETRC$|CURL_HOME$|BASH_ENV$|ENV$|ZDOTDIR$)/i.test(key)
  || !/^(CLAND_|FAKE_)/.test(key) && /(?:API_KEY|TOKEN|SECRET_ACCESS_KEY|CREDENTIALS|AUTH_JSON)$/.test(key);

/** root is disposable and owned by the caller. Explicit profile/fake paths in
 * extra must also be scratch-owned. HOME and Git configuration cannot be overlaid.
 * Default to a synthetic Git identity; never inherit a machine's identity. */
export function fixtureEnvironment(root: string, base: NodeJS.ProcessEnv, extra: NodeJS.ProcessEnv = {}): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(base)) {
    if (value !== undefined && !credential(key) && !/^(CLAND_|GIT_|EMAIL$|XDG_|CLAUDE_|CODEX_|OPENCODE_|FAKE_)/.test(key)) env[key] = value;
  }
  Object.assign(env, {
    XDG_CONFIG_HOME: join(root, 'config'), XDG_DATA_HOME: join(root, 'opencode'),
    XDG_STATE_HOME: join(root, 'state'), XDG_CACHE_HOME: join(root, 'cache'),
    CLAND_EXECUTOR_STATE: join(root, 'executor-state'),
    GIT_AUTHOR_NAME: 'Fixture Test', GIT_AUTHOR_EMAIL: 'fixture@example.test',
    GIT_COMMITTER_NAME: 'Fixture Test', GIT_COMMITTER_EMAIL: 'fixture@example.test',
    CLAUDE_CONFIG_DIR: join(root, 'claude'), CODEX_HOME: join(root, 'codex'),
    FAKE_CLAUDE_HOME: join(root, 'fake-claude'), FAKE_CODEX_HOME: join(root, 'fake-codex'), FAKE_OPENCODE_HOME: join(root, 'fake-opencode'),
  }, extra);
  // Filter after the last overlay, including inline Git config and account keys.
  // Explicit fixture Git identities are harmless and needed by init contracts.
  for (const key of Object.keys(env)) {
    if (credential(key)
      || /^(CLAUDE_|CODEX_|OPENCODE_)/.test(key) && !['CLAUDE_CONFIG_DIR', 'CODEX_HOME'].includes(key)
      || key.startsWith('GIT_') && !/^GIT_(AUTHOR|COMMITTER)_(NAME|EMAIL|DATE)$/.test(key)) delete env[key];
    else if (env[key] === undefined) delete env[key];
  }
  // Missing messenger roots trigger fixed client configuration errors; speech
  // uses loopback port zero. Never leave undefined production defaults.
  for (const key of ['CLAND_DISCORD_API_ROOT', 'CLAND_TELEGRAM_API_ROOT', 'CLAND_ELEVENLABS_API_ROOT']) {
    // Speech is constructed even without a configured key. Its sentinel must
    // permit construction, then fail locally if transcription is attempted.
    const sentinel = key === 'CLAND_ELEVENLABS_API_ROOT' ? 'http://127.0.0.1:0' : 'fixture-loopback-root-required';
    const value = env[key];
    if (value === undefined) { env[key] = sentinel; continue; }
    if (value === sentinel) continue; // A re-sealed child.
    try {
      const url = new URL(value);
      if (/^http:\/\/(?:127\.0\.0\.1|\[::1\]):[0-9]+(?:\/|$)/.test(value)
        && url.protocol === 'http:' && ['127.0.0.1', '[::1]'].includes(url.hostname)
        && url.port && url.port !== '0' && !url.username && !url.password && !url.search && !url.hash) continue;
    } catch { /* Never include caller input in the error. */ }
    throw new Error(`fixture ${key} requires an explicit loopback HTTP API root`);
  }
  return withoutExecutorCredentials({ ...env, [FIXTURE_OWNED_ROOT]: resolve(root), HOME: join(root, 'home'), GIT_CONFIG_GLOBAL: join(root, 'home', '.gitconfig'), GIT_CONFIG_NOSYSTEM: '1' });
}

/** Deliberate product path inputs, distinct from inherited environment extras. */
export type ScratchAccountPaths = { home?: string; openCodeDatabase?: string };

export function scratchAccountEnvironment(root: string, env: NodeJS.ProcessEnv, paths: ScratchAccountPaths): NodeJS.ProcessEnv {
  const extra: NodeJS.ProcessEnv = {};
  for (const [key, path] of [['HOME', paths.home], ['OPENCODE_DB', paths.openCodeDatabase]] as const) {
    if (path === undefined) continue;
    const within = relative(resolve(root), resolve(path));
    if (!isAbsolute(path) || within === '..' || within.startsWith('../') || isAbsolute(within)) throw new Error(`scratch account path must belong to the disposable project: ${key}`);
    extra[key] = path;
  }
  return withoutExecutorCredentials({ ...env, ...extra });
}

/** Fresh runner children retain execution/admission controls, never inherited profiles. */
export function runnerFixtureEnvironment(root: string, base: NodeJS.ProcessEnv): Record<string, string> {
  const controls: NodeJS.ProcessEnv = {};
  for (const key of Object.keys(base)) {
    if (/^CLAND_(?:SUITE_|TEST_|LOAD_GATE_|COVERAGE_)/.test(key) || /^CLAND_(?:HUB_(?:FILE|URL|SECRET)|SESSION_(?:NAME|ID)|LAUNCH_TOKEN|ROLE)$/.test(key)) controls[key] = base[key];
  }
  return fixtureEnvironment(root, base, controls);
}

/** Only this scratch-owned Git setting may bypass the ordinary config filter. */
export type ScratchGitConfig = { excludesFile: string };

export function scratchGitEnvironment(root: string, env: NodeJS.ProcessEnv, config: ScratchGitConfig): NodeJS.ProcessEnv {
  const within = relative(resolve(root), resolve(config.excludesFile));
  if (!isAbsolute(config.excludesFile) || within === '..' || within.startsWith('../') || isAbsolute(within)) throw new Error('scratch Git config must belong to the disposable project: excludesFile');
  return withoutExecutorCredentials({ ...env, GIT_CONFIG_COUNT: '1', GIT_CONFIG_KEY_0: 'core.excludesFile', GIT_CONFIG_VALUE_0: config.excludesFile });
}
