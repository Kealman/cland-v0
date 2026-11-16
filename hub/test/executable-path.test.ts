// T3: compare POSIX execFile PATH selection with the shared executable resolver;
// the native process boundary is the subject. Only scratch fake tools and /bin/sh run.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { chmod, mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathFixture } from './executable-path-fixture.ts';
import { fixtureEnvironment } from './fixture-environment.ts';
import { which, whichAsync } from '../src/doctor/report.ts';
import { setupMachine } from '../src/setup/machine.ts';
import { clandCommand } from '../src/setup/handover.ts';
import { harnessInstallation } from '../src/doctor/harnesses.ts';
import { ownedMaintenanceRunner } from '../src/git-maintenance-owner.ts';

const exec = promisify(execFile);

test('executable lookup matches native absolute empty relative and unset PATH selection', async t => {
  await pathFixture(t, 'cland-executable-path-').run(async (root, step) => {
    const bin = join(root, 'bin');
    await step(() => mkdir(bin));
    for (const file of ['gh', 'bin/gh', 'sh']) {
      await step(() => writeFile(join(root, file), '#!/bin/sh\nprintf "%s\\n" "$0"\n'));
      await step(() => chmod(join(root, file), 0o755));
    }
    for (const PATH of [bin, '', ':empty-bin', 'bin', undefined]) {
      const env = fixtureEnvironment(root, process.env, { PATH });
      if (PATH === undefined) delete env.PATH;
      const command = PATH === undefined ? 'sh' : 'gh';
      const args = PATH === undefined ? ['-c', 'printf "system-default\\n"'] : [];
      const found = which(command, env, root);
      const result = await step(() => exec(command, args, { cwd: root, env: fixtureEnvironment(root, env), timeout: 3000, maxBuffer: 4096 }));
      t.diagnostic(JSON.stringify({ command, args, cwd: root, PATH: PATH ?? '(unset)', stdout: result.stdout, stderr: result.stderr, completion: 'exit 0; execFile callback after close' }));
      assert.equal(await step(() => whichAsync(command, env, root)), found);
      if (PATH === undefined) {
        assert.ok(found === '/usr/bin/sh' || found === '/bin/sh', `POSIX default selects a system sh: ${found}`);
        assert.equal(result.stdout, 'system-default\n', 'unset PATH does not select the planted cwd sh');
      } else assert.equal(found, resolve(root, result.stdout.trim()));
    }
  });
});

test('absolute PATH remains compatible with doctor setup maintenance and OpenCode prerequisite callers', async t => {
  await pathFixture(t, 'cland-executable-consumers-').run(async (root, step) => {
    const bin = join(root, 'bin');
    await step(() => mkdir(bin));
    await step(() => mkdir(join(root, '.git')));
    await step(() => mkdir(join(root, '.cland')));
    for (const name of ['codex', 'opencode', 'cland', 'git']) {
      await step(() => writeFile(join(bin, name), '#!/bin/sh\nprintf "fixture-tool\\n"\n'));
      await step(() => chmod(join(bin, name), 0o755));
    }
    const env = fixtureEnvironment(root, process.env, { PATH: `${bin}:/usr/bin:/bin`, CLAND_CODEX_BIN: '', CLAND_OPENCODE_BIN: '' });
    assert.deepEqual(await step(() => harnessInstallation('codex', env)), { bin: join(bin, 'codex') }, 'doctor installation');
    assert.equal(await step(() => setupMachine(root, env).onPath('codex')), true, 'setup machine');
    assert.deepEqual(clandCommand(env, join(bin, 'cland')), { command: 'cland', note: null }, 'setup handover');
    assert.equal(which('opencode', env), join(bin, 'opencode'), 'OpenCode prerequisite with absolute PATH');
    const result = await step(() => ownedMaintenanceRunner(root, root, join(root, '.git'))('git', ['--version'], env));
    t.diagnostic(JSON.stringify({ consumer: 'git-maintenance', command: 'git', args: ['--version'], cwd: root, result }));
    assert.equal(result.code, 0, JSON.stringify(result));
    assert.equal(result.stdout, 'fixture-tool\n');
    assert.equal(result.error, undefined);
  });
});
