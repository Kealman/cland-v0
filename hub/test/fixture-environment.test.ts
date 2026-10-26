// T1: pure child-environment construction, no processes or machine state.
import test from 'node:test';
import assert from 'node:assert/strict';
import { fixtureEnvironment, scratchAccountEnvironment, runnerFixtureEnvironment, scratchGitEnvironment } from './fixture-environment.ts';
import { syntheticProviderEnvironment, type SyntheticProvider } from './synthetic-provider.ts';
import type { Provider } from '../src/executor/droplet/dependencies.ts';

test('shared fixture environments seal poisoned parent and overlay credentials and Git config', () => {
  // As in setup-machine's poisoned-HOME self-test, every poison is synthetic.
  const poison = Object.fromEntries([
    'HOME', 'XDG_CONFIG_HOME', 'XDG_DATA_HOME', 'XDG_STATE_HOME', 'XDG_CACHE_HOME',
    'GIT_CONFIG_GLOBAL', 'GIT_CONFIG_SYSTEM', 'GIT_CONFIG_COUNT', 'GIT_CONFIG_KEY_0', 'GIT_CONFIG_VALUE_0', 'GIT_CONFIG_PARAMETERS', 'GIT_DIR', 'GIT_WORK_TREE', 'GIT_COMMON_DIR', 'GIT_INDEX_FILE', 'GIT_OBJECT_DIRECTORY', 'GIT_ALTERNATE_OBJECT_DIRECTORIES', 'GIT_CEILING_DIRECTORIES', 'GIT_DISCOVERY_ACROSS_FILESYSTEM', 'GIT_NAMESPACE', 'GIT_SHALLOW_FILE', 'GIT_TEMPLATE_DIR',
    'DIGITALOCEAN_TOKEN', 'CLAND_TELEGRAM_TOKEN', 'CLAND_DISCORD_TOKEN', 'ELEVENLABS_API_KEY', 'XAI_API_KEY', 'OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'ANTHROPIC_AUTH_TOKEN', 'CLAUDE_CODE_OAUTH_TOKEN', 'OPENCODE_AUTH_JSON',
    'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'GOOGLE_APPLICATION_CREDENTIALS', 'GEMINI_API_KEY', 'GITHUB_TOKEN', 'GH_TOKEN',
    'SSH_AUTH_SOCK', 'SSH_AGENT_PID', 'SSH_ASKPASS', 'NPM_CONFIG_USERCONFIG', 'npm_config_userconfig', 'NPM_CONFIG_GLOBALCONFIG', 'NPM_TOKEN', 'NODE_AUTH_TOKEN',
    'YARN_RC_FILENAME', 'PNPM_HOME', 'BASH_ENV', 'ENV', 'ZDOTDIR', 'KRB5CCNAME', 'GNUPGHOME',
    'CODEX_HOME', 'CLAUDE_CONFIG_DIR', 'OPENCODE_DB', 'CLAND_EXECUTOR_STATE',
    'GIT_AUTHOR_NAME', 'GIT_AUTHOR_EMAIL', 'GIT_COMMITTER_NAME', 'GIT_COMMITTER_EMAIL',
  ].map(key => [key, 'poison']));
  const overlay = { ...poison };
  // Explicit scratch profile overrides are supported, as native account tests need them.
  const identity = {
    GIT_AUTHOR_NAME: 'Fixture Test', GIT_AUTHOR_EMAIL: 'fixture@example.test',
    GIT_COMMITTER_NAME: 'Fixture Test', GIT_COMMITTER_EMAIL: 'fixture@example.test',
  };
  for (const key of ['XDG_CONFIG_HOME', 'XDG_DATA_HOME', 'XDG_STATE_HOME', 'XDG_CACHE_HOME', 'CODEX_HOME', 'CLAUDE_CONFIG_DIR', 'CLAND_EXECUTOR_STATE', ...Object.keys(identity)]) delete overlay[key];
  const before = { ...poison };
  for (const extra of [{}, overlay]) {
    const env = fixtureEnvironment('/scratch', { ...poison, PATH: '/test-bin', NODE_V8_COVERAGE: '/coverage' }, extra);
    for (const [key, expected] of Object.entries({
      HOME: '/scratch/home', GIT_CONFIG_GLOBAL: '/scratch/home/.gitconfig', GIT_CONFIG_NOSYSTEM: '1',
      XDG_CONFIG_HOME: '/scratch/config', XDG_DATA_HOME: '/scratch/opencode', XDG_STATE_HOME: '/scratch/state', XDG_CACHE_HOME: '/scratch/cache',
      CODEX_HOME: '/scratch/codex', CLAUDE_CONFIG_DIR: '/scratch/claude', CLAND_EXECUTOR_STATE: '/scratch/executor-state',
      PATH: '/test-bin', NODE_V8_COVERAGE: '/coverage',
      ...identity,
    })) assert.ok(env[key] === expected, key);
    for (const key of Object.keys(poison)) {
      if (!['HOME', 'XDG_CONFIG_HOME', 'XDG_DATA_HOME', 'XDG_STATE_HOME', 'XDG_CACHE_HOME', 'GIT_CONFIG_GLOBAL', 'CODEX_HOME', 'CLAUDE_CONFIG_DIR', 'CLAND_EXECUTOR_STATE', ...Object.keys(identity)].includes(key)) assert.ok(!(key in env), key);
    }
  }
  assert.ok(Object.keys(poison).every(key => poison[key] === before[key]), 'parent is unchanged');
});

test('deliberate account paths stay under the disposable project without opening credential overlays', () => {
  const base = fixtureEnvironment('/scratch', { HOME: '/poison' });
  const env = scratchAccountEnvironment('/scratch/project', base, { home: '/scratch/project', openCodeDatabase: '/scratch/project/inherited.db' });
  assert.ok(env.HOME === '/scratch/project', 'HOME');
  assert.ok(env.OPENCODE_DB === '/scratch/project/inherited.db', 'OPENCODE_DB');
  assert.ok(env.GIT_CONFIG_GLOBAL === base.GIT_CONFIG_GLOBAL, 'Git config remains isolated');
  assert.ok(base.HOME === '/scratch/home' && !('OPENCODE_DB' in base), 'sealed parent unchanged');
  for (const path of ['/host', '../host', '/scratch/project/../../host', '/scratch/project-sibling']) {
    assert.throws(() => scratchAccountEnvironment('/scratch/project', base, { home: path }), /disposable project: HOME/);
    assert.throws(() => scratchAccountEnvironment('/scratch/project', base, { openCodeDatabase: path }), /disposable project: OPENCODE_DB/);
  }
});

test('synthetic provider credentials require a sentinel and an isolated transport', () => {
  const base = fixtureEnvironment('/scratch', { DIGITALOCEAN_TOKEN: 'poison' });
  const token = 'cland-test-provider';
  const endpoint = 'http://127.0.0.1:12345';
  const api = {} as Provider; // Transport identity only; this pure test never invokes it.
  assert.ok(syntheticProviderEnvironment(base, { token, endpoint }).DIGITALOCEAN_TOKEN === token, 'loopback sentinel');
  assert.ok(syntheticProviderEnvironment(base, { token, api }, api).DIGITALOCEAN_TOKEN === token, 'injected API sentinel');
  assert.ok(!('DIGITALOCEAN_TOKEN' in base), 'sealed parent remains unchanged');
  for (const endpoint of ['https://api.digitalocean.com', 'http://localhost:12345', 'http://127.0.0.1', 'http://user:pass@127.0.0.1:12345', 'invalid']) {
    assert.throws(() => syntheticProviderEnvironment(base, { token, endpoint }), /loopback HTTP endpoint/);
  }
  assert.throws(() => syntheticProviderEnvironment(base, { token: 'poison' as SyntheticProvider['token'], endpoint }), /sentinel token/);
  assert.throws(() => syntheticProviderEnvironment(base, { token, api }), /injected fake API/);
  assert.throws(() => syntheticProviderEnvironment(base, { token, api }, {} as Provider), /injected fake API/);
});


test('runner child environments retain execution controls without inherited profile paths', () => {
  const root = '/scratch/phase';
  const base = Object.fromEntries(['HOME', 'XDG_CONFIG_HOME', 'XDG_DATA_HOME', 'XDG_STATE_HOME', 'XDG_CACHE_HOME',
    'CLAUDE_CONFIG_DIR', 'CODEX_HOME', 'FAKE_CLAUDE_HOME', 'FAKE_CODEX_HOME', 'FAKE_OPENCODE_HOME',
    'CLAND_EXECUTOR_STATE', 'GIT_CONFIG_GLOBAL', 'DIGITALOCEAN_TOKEN', 'OPENAI_API_KEY'].map(key => [key, '/poison']));
  Object.assign(base, { CLAND_SUITE_LEASE: 'fixture-lease', CLAND_TEST_TIMING_RECEIPTS: '1',
    CLAND_SESSION_NAME: 'fixture-session', CLAND_LAUNCH_TOKEN: 'fixture-session-credential', CLAND_LOAD_GATE_START: '/scratch/phase/start', CLAND_HUB_FILE: '/scratch/project/hub.json', PATH: '/test-bin', TMPDIR: root });
  const env = runnerFixtureEnvironment(root, base);
  for (const [key, suffix] of Object.entries({ HOME: 'home', XDG_CONFIG_HOME: 'config', XDG_DATA_HOME: 'opencode',
    XDG_STATE_HOME: 'state', XDG_CACHE_HOME: 'cache', CLAUDE_CONFIG_DIR: 'claude', CODEX_HOME: 'codex',
    FAKE_CLAUDE_HOME: 'fake-claude', FAKE_CODEX_HOME: 'fake-codex', FAKE_OPENCODE_HOME: 'fake-opencode', CLAND_EXECUTOR_STATE: 'executor-state' })) {
    assert.ok(env[key] === `${root}/${suffix}`, key);
  }
  for (const key of ['CLAND_SESSION_NAME', 'CLAND_LAUNCH_TOKEN', 'CLAND_SUITE_LEASE', 'CLAND_TEST_TIMING_RECEIPTS', 'CLAND_LOAD_GATE_START', 'CLAND_HUB_FILE', 'PATH', 'TMPDIR']) assert.ok(env[key] === base[key], key);
  for (const key of ['DIGITALOCEAN_TOKEN', 'OPENAI_API_KEY']) assert.ok(!Object.hasOwn(env, key), key);
  assert.ok(base.XDG_CONFIG_HOME === '/poison', 'parent unchanged');
});

test('deliberate Git excludes stay under the disposable project without opening config overlays', () => {
  const base = fixtureEnvironment('/scratch', { GIT_CONFIG_COUNT: '1', GIT_CONFIG_KEY_0: 'credential.helper', GIT_CONFIG_VALUE_0: 'poison' });
  const env = scratchGitEnvironment('/scratch/project', base, { excludesFile: '/scratch/project/excludes' });
  assert.equal(env.GIT_CONFIG_COUNT, '1');
  assert.equal(env.GIT_CONFIG_KEY_0, 'core.excludesFile');
  assert.equal(env.GIT_CONFIG_VALUE_0, '/scratch/project/excludes');
  assert.equal(env.GIT_CONFIG_GLOBAL, '/scratch/home/.gitconfig');
  assert.equal(env.GIT_COMMITTER_EMAIL, 'fixture@example.test');
  assert.ok(!('GIT_CONFIG_COUNT' in base), 'sealed parent unchanged');
  for (const excludesFile of ['/host', '../host', '/scratch/project/../../host', '/scratch/project-sibling']) {
    assert.throws(() => scratchGitEnvironment('/scratch/project', base, { excludesFile }), /disposable project: excludesFile/);
  }
});
