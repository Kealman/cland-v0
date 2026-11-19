// T2: the executable's offline lint dispatch and exit codes are the subject; no hub starts.
import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { CLI_ENTRY, tempProject, type CliResult } from './harness.ts';
import { clandCliLaunch } from './tier-cli.ts';
import { fixtureEnvironment } from './fixture-environment.ts';
import { fixtureWork } from './fixture-work.ts';
import { ownProcess } from './process-cleanup.ts';
import { within } from '../src/executor/droplet/deadline.ts';
import { testSetupWaitMs, testWaitMs } from './until.ts';
import { withCleanupAsync } from '../src/cleanup.ts';

type Owned = Parameters<Parameters<ReturnType<typeof fixtureWork>['run']>[0]>[0];

/** Keep the original sequence admitted through setup, native close and writes. */
async function lintFixture(t: TestContext, body: (owned: Owned, root: string) => Promise<void>) {
  const owner = fixtureWork(t);
  const ready = Promise.withResolvers<void>();
  const running = owner.run(async owned => {
    const root = await owned.root(() => tempProject(t));
    ready.resolve();
    await body(owned, root);
  });
  void running.catch(ready.reject);
  await withCleanupAsync(async () => {
    await within(ready.promise, testSetupWaitMs(), undefined, () => new Error('lint fixture setup incomplete'));
    await within(running, testWaitMs(15_000), undefined, () => new Error('lint CLI behaviour incomplete'));
  }, () => owner.dispose());
}

async function lintCli(owned: Owned, root: string, ...args: string[]): Promise<CliResult> {
  const invocation = await owned.acquire(async () => {
    const result = Promise.withResolvers<CliResult>();
    void result.promise.catch(() => {});
    const closed = Promise.withResolvers<void>();
    const child = clandCliLaunch(() => execFile(process.execPath, [CLI_ENTRY, 'qa', ...args], {
      cwd: root, env: fixtureEnvironment(root, process.env), encoding: 'utf8',
      timeout: 10_000, signal: owned.signal, killSignal: 'SIGKILL',
    }, (error, stdout, stderr) => {
      if (error && typeof error.code !== 'number') result.reject(error);
      else result.resolve({ code: error ? error.code as number : 0, stdout, stderr });
    }));
    child.once('close', () => closed.resolve());
    const stop = ownProcess(undefined, child.pid);
    return { result: result.promise, closed: closed.promise, stop };
  }, async invocation => {
    await invocation.stop();
    await within(invocation.closed, testWaitMs(5000), undefined, () => new Error('lint CLI close incomplete; root retained'));
    await Promise.allSettled([invocation.result]);
  });
  return owned.step(async () => {
    const result = await invocation.result;
    await invocation.closed;
    return result;
  });
}

test('qa lint exits nonzero with file and line findings before any QA run', async t => {
  await lintFixture(t, async (owned, root) => {
    await owned.step(() => writeFile(join(root, 'brief.md'), '| id | command | expected |\n| --- | --- | --- |\n| M1 | `cland no-such-command hello` | topic |\n'));
    const bad = await lintCli(owned, root, 'lint', 'brief.md');
    assert.equal(bad.code, 1, bad.stderr);
    assert.match(bad.stderr, /^brief\.md:3: unknown subcommand no-such-command: cland no-such-command hello\n$/);
    await owned.step(() => writeFile(join(root, 'brief.md'), '| id | surface | command | expected |\n| --- | --- | --- | --- |\n| M1 | hub-api | `cland task view T-957 --json` | item |\n| WEB-001 | real-browser | Open the local workbench page through computer use, capture a screenshot and close its tab | screenshot |\n'));
    const good = await lintCli(owned, root, 'lint', 'brief.md');
    assert.equal(good.code, 0, good.stderr);
    assert.match(good.stdout, /qa lint passes at the build/);
  });
});

test('qa lint help and read errors do not need a running hub', async t => {
  await lintFixture(t, async (owned, root) => {
    for (const flags of [['--help'], ['lint', '--help']]) {
      const help = await lintCli(owned, root, ...flags);
      assert.equal(help.code, 0, help.stderr);
      assert.match(help.stdout, /qa lint <brief>/);
    }
    for (const args of [[], ['lint'], ['lint', 'missing.md'], ['lint', 'a', 'b']]) {
      const result = await lintCli(owned, root, ...args);
      assert.equal(result.code, 2, result.stderr);
      assert.doesNotMatch(result.stderr, /no hub/);
    }
  });
});

test('run-copy advice reports file and line without changing lint exit status', async t => {
  await lintFixture(t, async (owned, root) => {
    const source = 'Reuse the QA kit from the previous run.\nOpen web/dist/index.html.\nps -Ao pid=,command=\nconst expected = { exact: false };\nspawn(bin, args, { env: process.env });';
    await owned.step(() => writeFile(join(root, 'brief.md'), source));
    const advice = await lintCli(owned, root, 'lint', 'brief.md');
    assert.equal(advice.code, 0, advice.stderr);
    for (const [line, kind] of [[1, 'kit-pin'], [2, 'build'], [3, 'census-filter'], [4, 'exact-list'], [5, 'seal']] as const) {
      assert.ok(advice.stderr.includes(`brief.md:${line}: report-only ${kind}:`), advice.stderr);
    }
    assert.match(advice.stdout, /qa lint passes at the build/);
    await owned.step(() => writeFile(join(root, 'brief.md'), source + '\n| command | expected |\n| --- | --- |\n| `cland no-such-command` | refused |'));
    const invalid = await lintCli(owned, root, 'lint', 'brief.md');
    assert.equal(invalid.code, 1, invalid.stderr);
    assert.match(invalid.stderr, /unknown subcommand/);
    assert.match(invalid.stderr, /report-only kit-pin/);
  });
});
