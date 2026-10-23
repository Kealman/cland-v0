// T2: the executable's offline lint dispatch and exit codes are the subject; no hub starts.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { CLI_ENTRY, tempProject, type CliResult } from './harness.ts';
import { clandCliLaunch } from './tier-cli.ts';
import { withoutExecutorCredentials } from '../../shared/executor-credentials.ts';

function lintCli(root: string, ...args: string[]): Promise<CliResult> {
  const home = join(root, 'home');
  const env = withoutExecutorCredentials({ PATH: '/usr/bin:/bin', HOME: home,
    XDG_CONFIG_HOME: join(home, 'config'), XDG_DATA_HOME: join(home, 'data'),
    XDG_STATE_HOME: join(home, 'state'), XDG_CACHE_HOME: join(home, 'cache'),
    GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_SYSTEM: '/dev/null' });
  return new Promise((resolve, reject) => {
    // cland-allow-child-env: offline CLI subject uses a literal PATH/scratch HOME/XDG environment and null Git configs without inherited credentials
    clandCliLaunch(() => execFile(process.execPath, [CLI_ENTRY, 'qa', ...args], { cwd: root, env, encoding: 'utf8', timeout: 10_000 }, (error, stdout, stderr) => {
      if (error && typeof error.code !== 'number') reject(error);
      else resolve({ code: error ? error.code as number : 0, stdout, stderr });
    }));
  });
}

test('qa lint exits nonzero with file and line findings before any QA run', async t => {
  const root = await tempProject(t);
  await writeFile(join(root, 'brief.md'), '| id | command | expected |\n| --- | --- | --- |\n| M1 | `cland no-such-command hello` | topic |\n');
  const bad = await lintCli(root, 'lint', 'brief.md');
  assert.equal(bad.code, 1, bad.stderr);
  assert.match(bad.stderr, /^brief\.md:3: unknown subcommand no-such-command: cland no-such-command hello\n$/);
  await writeFile(join(root, 'brief.md'), '| id | surface | command | expected |\n| --- | --- | --- | --- |\n| M1 | hub-api | `cland task view T-957 --json` | item |\n| WEB-001 | real-browser | Open the local workbench page through computer use, capture a screenshot and close its tab | screenshot |\n');
  const good = await lintCli(root, 'lint', 'brief.md');
  assert.equal(good.code, 0, good.stderr);
  assert.match(good.stdout, /qa lint passes at the build/);
});

test('qa lint help and read errors do not need a running hub', async t => {
  const root = await tempProject(t);
  for (const flags of [['--help'], ['lint', '--help']]) {
    const help = await lintCli(root, ...flags);
    assert.equal(help.code, 0, help.stderr);
    assert.match(help.stdout, /qa lint <brief>/);
  }
  for (const args of [[], ['lint'], ['lint', 'missing.md'], ['lint', 'a', 'b']]) {
    const result = await lintCli(root, ...args);
    assert.equal(result.code, 2, result.stderr);
    assert.doesNotMatch(result.stderr, /no hub/);
  }
});
