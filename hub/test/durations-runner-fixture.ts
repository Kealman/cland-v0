import type { SuiteSelection } from '../src/suite-selection.ts';
import { fixtureEnvironment } from './fixture-environment.ts';
import { serializeTierManifest } from '../src/suite-shards.ts';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, mkdtemp, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { TestContext } from 'node:test';
import { afterCleanup, ownDirectory, ownProcess } from './process-cleanup.ts';
import { suiteCase } from './suite-case-fixture.ts';

const exec = promisify(execFile);
const runner = fileURLToPath(new URL('./run-suite.ts', import.meta.url));
type CaseScope = Parameters<Parameters<typeof suiteCase>[1]>[0];
export async function fixture(t: TestContext, packageRun: boolean, scope: CaseScope, execute: typeof exec = exec) {
  return scope.setup(async () => {
  const cwd = await mkdtemp(join(tmpdir(), 'cland-duration-runner-'));
  ownDirectory(t, cwd);
  afterCleanup(t, async () => {
    assert.equal(await stat(cwd).catch(error => { if (error.code === 'ENOENT') return null; throw error; }), null,
      'owned fixture root removed after caller and native writers settle');
  });
  await mkdir(join(cwd, 'hub/test'), { recursive: true });
  await mkdir(join(cwd, '.cland/tasks'), { recursive: true });
  await writeFile(join(cwd, '.cland/tasks/E-677-fixture.md'), '---\nid: E-677\nkind: category\ntitle: Allowance owner\nstate: open\n---\n');
  const file = join(cwd, 'hub/test/fixture.test.ts');
  await writeFile(file, `import test from 'node:test';
test('parent', async t => { await t.test('child', () => new Promise(r => setTimeout(r, 100))); });
test('skipped', {skip: 'fixture platform'}, () => {});`);
  if (packageRun) {
    await writeFile(join(cwd, 'hub/test/tiers.json'), serializeTierManifest({ version: 1, tests: { 'hub/test/fixture.test.ts': 'T3', 'nvim/test/scenarios/workbench.test.ts': 'T3' } }));
    await mkdir(join(cwd, 'nvim/test/scenarios'), { recursive: true });
    await writeFile(join(cwd, 'nvim/test/scenarios/workbench.test.ts'), '// empty cross-package smoke fixture\n');
  }
  const start = (loadGate = false, extraSelection: Partial<SuiteSelection> = {}) => scope.step('native runner launch', async () => {
    const abort = new AbortController();
    const selection = { mode: 'hub-only', files: ['hub/test/fixture.test.ts'], reason: 'fixture task selection from hub', loadGate, ...extraSelection };
    const code = packageRun
      ? `import {runPackageSuite} from ${JSON.stringify(runner)}; process.exitCode = await runPackageSuite('auto', [], ${JSON.stringify({ cwd, lockDirs: { hub: join(cwd, 'lock'), nvim: join(cwd, 'nvim-lock') } })});`
      : `import {runSuite} from ${JSON.stringify(runner)}; process.exitCode = await runSuite([['--test', ${JSON.stringify(file)}]], ${JSON.stringify({ cwd, lockDir: join(cwd, 'lock'), selection })});`;
    const execution = execute(process.execPath, ['--input-type=module', '-e', code], { cwd, signal: abort.signal, env: fixtureEnvironment(cwd, process.env, { NODE_TEST_CONTEXT: '', CLAND_TEST_SKIP_LOCK: '0', CLAND_DIAGNOSTIC_FIXTURE: 'private-fixture-value-720\nprivate-fixture-second-line-720', CLAND_DIAGNOSTIC_COLLISION: 'test', CLAND_SUITE_SELECTION: JSON.stringify(selection), XDG_CONFIG_HOME: join(cwd, 'poison'), CLAUDE_CONFIG_DIR: join(cwd, 'poison'), CODEX_HOME: join(cwd, 'poison') }) });
    const closed = new Promise<void>(resolve => execution.child.once('close', () => resolve()));
    const stop = ownProcess(t, execution.child.pid);
    let stopping: Promise<void> | undefined;
    scope.releaseOnClose(() => {
      // Start the captured-owner cleanup before joining the caller that is
      // waiting for completion. Abort alone is not a native close receipt.
      stopping ??= stop();
      void stopping.catch(() => {});
      abort.abort();
    });
    let output = '';
    execution.child.stdout?.on('data', chunk => { output += String(chunk); });
    const result = scope.step('native runner completion', async () => {
      const receipt = await execution.then(
      r => ({ code: 0, output: r.stdout + r.stderr }),
      (e: { code: number; stdout: string; stderr: string }) => ({ code: e.code, output: e.stdout + e.stderr }),
      );
      await closed;
      await stopping;
      return receipt;
    });
    return { child: execution.child, result, output: () => output };
  });
  const run = async (loadGate = false, extraSelection: Partial<SuiteSelection> = {}) => (await start(loadGate, extraSelection)).result;
  const manifest = { version: 1, source: { artifacts: [], commit: 'fixture' }, budget: { testSeconds: 0.05, fileSeconds: 60 }, files: {}, tests: {}, allow: {} };
  const path = join(cwd, 'hub/test/durations.json');
  return { root: cwd, run, start, manifest, path, cwd, file };
  });
}

