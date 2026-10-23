// Manual runtime qualification check: intentionally fails on affected Node versions.
// node hub/test/compile-cache-check.ts [shared|isolated|disabled] [rounds]
import { runnerFixtureEnvironment } from './fixture-environment.ts';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';

const mode = process.argv[2] ?? 'shared';
const rounds = Number(process.argv[3] ?? 5);
if (!['shared', 'isolated', 'disabled'].includes(mode) || !Number.isSafeInteger(rounds) || rounds < 1) {
  throw new Error('usage: node hub/test/compile-cache-check.ts [shared|isolated|disabled] [positive rounds]');
}
const core = new URL('../src/hub/core.ts', import.meta.url).href;
const script = `import { HubCore } from ${JSON.stringify(core)};
import { getCompileCacheDir } from 'node:module';
new HubCore();
console.log(JSON.stringify({ version: process.version, cached: Boolean(getCompileCacheDir()), constructed: true }));`;
const root = mkdtempSync(join(tmpdir(), 'cland-compile-cache-check-'));
let failures = 0;
try {
  for (let round = 1; round <= rounds; round++) {
    for (let load = 1; load <= 3; load++) {
      const env = { ...process.env };
      // Qualify the default runtime, independently of the caller's cache/flags.
      delete env.NODE_OPTIONS;
      delete env.NODE_TEST_CONTEXT;
      delete env.NODE_DISABLE_COMPILE_CACHE;
      delete env.NODE_COMPILE_CACHE_PORTABLE;
      delete env.NODE_COMPILE_CACHE_READONLY;
      env.NODE_COMPILE_CACHE = join(root, `${round}-${mode === 'isolated' ? load : 'shared'}`);
      if (mode === 'disabled') env.NODE_DISABLE_COMPILE_CACHE = '1';
      const started = performance.now();
      const result = spawnSync(process.execPath, ['--input-type=module', '-e', script], {
        cwd: fileURLToPath(new URL('../../', import.meta.url)), env: runnerFixtureEnvironment(root, env), encoding: 'utf8', timeout: 30_000,
      });
      const passed = result.status === 0 && result.signal === null
        && result.stdout.trim() === JSON.stringify({ version: process.version, cached: mode !== 'disabled', constructed: true });
      if (!passed) failures++;
      console.log(JSON.stringify({ version: process.version, platform: process.platform, arch: process.arch,
        mode, round, load, ms: Math.round((performance.now() - started) * 1000) / 1000,
        passed, status: result.status, signal: result.signal,
        ...(passed ? {} : { stdout: result.stdout, stderr: result.stderr, error: result.error?.message }),
      }));
    }
  }
} finally {
  rmSync(root, { recursive: true, force: true });
}
process.exitCode = failures === 0 ? 0 : 1;
