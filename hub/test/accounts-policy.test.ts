// T1: passive source policy; no sockets, harnesses or time.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
// T1 unit: source-text policy assertions, with no harness processes or provider requests.
test('hub source has no provider endpoint or credential-store access', async () => {
  const { readdir } = await import('node:fs/promises');
  const root = new URL('../src/', import.meta.url);
  const forbidden = ['api.anthropic.com', 'oauth/usage', 'chatgpt.com', 'wham/usage', 'opencode.ai', 'auth.json', '.credentials.json', 'opencode.db', 'security find-generic-password'];
  // Exact authorized literals only: a provider target elsewhere (including any new call site) fails.
  const allowedTargets = [
    { name: 'OpenCode schema metadata', file: '/adapters/opencode.ts', literal: "$schema: 'https://opencode.ai/config.json',", reason: 'editor metadata; no request is made' },
    { name: 'OpenCode installation guidance', file: '/doctor/harnesses.ts', literal: "install: 'install OpenCode v2 (https://opencode.ai/v2/install)',", reason: 'human-facing doctor text; no request is made' },
    { name: 'OpenCode setup installer', file: '/setup/steps/harnesses.ts', literal: "opencode: 'curl -fsSL https://opencode.ai/v2/install | bash',", reason: 'official user-level installer, run only after an interactive yes or explicit --install; no credentials or account usage endpoint' },
    { name: 'Codex setup installer', file: '/setup/steps/harnesses.ts', literal: "codex: 'curl -fsSL https://chatgpt.com/codex/install.sh | CODEX_NON_INTERACTIVE=1 sh',", reason: 'official user-level installer, run only after an interactive yes or explicit --install; no credentials or account usage endpoint' },
    { name: 'OpenCode unsupported-major remedy', file: '/doctor/toolchain.ts', literal: '`install OpenCode ${formatVersion(range.min)} (https://opencode.ai/v2/install)`', reason: 'human-facing doctor text; no request is made' },
    { name: 'OpenCode selected database path', file: '/accounts/registry.ts', literal: "export const openCodeDatabase = (env: NodeJS.ProcessEnv) => env.OPENCODE_DB || join(dataHome(env), 'opencode', 'opencode.db');", reason: 'pure saved/default database path selection for launch and doctor; no database contents are read' },
    { name: 'cland OpenCode database path', file: '/accounts/registry.ts', literal: "export const clandOpenCodeDatabase = (env: NodeJS.ProcessEnv) => join(dataHome(env), 'cland', 'opencode', 'opencode.db');", reason: 'pure isolated database path construction; no database contents are read' },
    { name: 'E-271 DigitalOcean client', file: '/executor/droplet/api.ts', literal: 'https://api.digitalocean.com/v2', reason: 'authorized executor lifecycle calls, not harness-account limits' },
  ];
  const scan = async (dir: URL): Promise<void> => {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const path = new URL(entry.name + (entry.isDirectory() ? '/' : ''), dir);
      if (entry.isDirectory()) await scan(path);
      else if (entry.name.endsWith('.ts')) {
        let text = await readFile(path, 'utf8');
        for (const allowed of allowedTargets) if (path.pathname.endsWith(allowed.file)) text = text.replace(allowed.literal, '');
        for (const needle of forbidden) assert.ok(!text.includes(needle), `${path.pathname} contains ${needle}`);
      }
    }
  };
  await scan(root);
});


test('account migrations contain no literal timer waits or elapsed-time assertions', async () => {
  for (const name of ['account-poller', 'account-limited', 'account-limits', 'accounts', 'claude-code-accounts']) {
    const source = await readFile(new URL(`./${name}.test.ts`, import.meta.url), 'utf8');
    assert.doesNotMatch(source, /\b(?:sleep|pause|delay)\s*\(|\bsetTimeout\s*\([^;\n]*,\s*\d/, name);
    assert.doesNotMatch(source, /assert\.[^\n;]*\bDate\.now\s*\(|assert\.[^\n;]*Number\([^\n;]*\.at\)[^\n;]*-/, name);
  }
});
