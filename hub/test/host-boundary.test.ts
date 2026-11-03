// T1: adapter source boundary; in-memory fixtures never execute native operations.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { hostBoundaryFindings, scanHostBoundary } from './host-boundary.ts';

test('Host boundary rejects native process imports with file and use diagnostics', () => {
  for (const source of [
    "import { spawn } from 'node:child_process';",
    "import cp from 'child_process';",
    "import * as cp from 'node:child_process';",
    "import { type ChildProcess, execFile as run } from 'node:child_process';",
  ]) assert.match(hostBoundaryFindings('codex.ts', source).join('\n'), /codex.ts:1:.*child_process/);
  assert.deepEqual(hostBoundaryFindings('launch-files.ts', "import type { ChildProcess } from 'node:child_process';"), []);
});

test('Host boundary rejects every native helper import, including aliases', () => {
  for (const name of ['pidAlive', 'processAlive', 'sameProcess', 'endProcess', 'processIdentityAsync', 'systemProcesses', 'sessionCwdRefusal']) {
    assert.match(hostBoundaryFindings('sessions.ts', `import { ${name} as native } from './native.ts';`).join('\n'), new RegExp(`sessions.ts:1:.*${name} import`));
  }
});

test('Host boundary rejects filesystem metadata imports and namespace calls', () => {
  for (const name of ['stat', 'lstat', 'realpath', 'statSync', 'lstatSync', 'realpathSync']) {
    for (const module of ['node:fs', 'node:fs/promises', 'fs', 'fs/promises']) {
      assert.match(hostBoundaryFindings('new-adapter.ts', `import { ${name} as native } from '${module}';`).join('\n'), new RegExp(`new-adapter.ts:1:.*${name} import`));
    }
    for (const expression of [`files.${name}('.')`, `files['${name}']('.')`, `files.promises.${name}('.')`]) {
      assert.match(hostBoundaryFindings('nested/new.ts', `import * as files from 'node:fs';\n${expression}`).join('\n'), new RegExp(`nested/new.ts:2:.*fs.${name}`));
    }
  }
});

test('Host boundary permits only the two guarded crash self-kills', () => {
  const kill = "process.kill(process.pid, 'SIGKILL');";
  for (const stage of ['launch-reserved', 'stop-recorded']) {
    const source = `class Sessions { #env: any; crash() { if (this.#env.CLAND_TEST_CRASH_AT === '${stage}') ${kill} } }`;
    assert.deepEqual(hostBoundaryFindings('sessions.ts', source), []);
    assert.match(hostBoundaryFindings('codex.ts', source).join('\n'), /process.kill/);
  }
  for (const source of [kill, "process.kill(otherPid, 'SIGKILL');", `if (otherFlag) ${kill}`, `if (this.#env.CLAND_TEST_CRASH_AT === 'other') ${kill}`, "process['kill'](1, 0);"]) {
    assert.match(hostBoundaryFindings('sessions.ts', source).join('\n'), /sessions.ts:1:.*process.kill/);
  }
});

test('Host boundary scopes named hub-file metadata exceptions to their existing calls', () => {
  const declaration = "import { stat } from 'node:fs/promises';\n";
  assert.deepEqual(hostBoundaryFindings('launch-files.ts', declaration + 'const hubFileMeta = (path: string) => stat(path);'), []);
  assert.deepEqual(hostBoundaryFindings('opencode/server.ts', declaration + 'stat(files.log);'), []);
  for (const file of ['launch-files.ts', 'opencode/server.ts']) {
    assert.match(hostBoundaryFindings(file, declaration + 'stat(session.cwd);').join('\n'), /:2: stat call/);
    assert.match(hostBoundaryFindings(file, "import { realpath } from 'node:fs/promises';").join('\n'), /realpath import/);
    assert.match(hostBoundaryFindings(file, "import { spawn } from 'node:child_process';").join('\n'), /child_process/);
  }
});

test('Host boundary rejects dynamic native imports and ignores type-only or textual mentions', () => {
  for (const source of ["const cp = await import('node:child_process');", "const fs = require('node:fs');"]) {
    assert.match(hostBoundaryFindings('codex.ts', source).join('\n'), /dynamic value import/);
  }
  assert.deepEqual(hostBoundaryFindings('codex.ts', `
    import { type ChildProcess } from 'node:child_process';
    import type { stat } from 'node:fs';
    // process.kill(1); import { spawn } from 'node:child_process';
    const message = 'process.kill(1)';
    host.spawn(command); host.realpath(cwd); host.statDirectory(cwd);
  `), []);
});

test('Host boundary scans the current adapters recursively', async () => {
  assert.deepEqual(await scanHostBoundary(new URL('../src/adapters/', import.meta.url)), []);
});

test('Host boundary discovers a planted bypass in a new nested adapter', async () => {
  const root = await mkdtemp(join(tmpdir(), 'cland-host-boundary-'));
  try {
    await mkdir(join(root, 'nested'));
    await writeFile(join(root, 'nested', 'future.ts'), "import { spawn } from 'node:child_process';");
    await writeFile(join(root, 'native.test.ts'), "process.kill(1, 0);");
    assert.match((await scanHostBoundary(pathToFileURL(root + '/'))).join('\n'), /nested\/future.ts:1:.*child_process/);
    await writeFile(join(root, 'nested', 'future.ts'), 'host.spawn(command);');
    assert.deepEqual(await scanHostBoundary(pathToFileURL(root + '/')), []);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('Host boundary follows the named fs promises namespace', () => {
  assert.match(hostBoundaryFindings('codex.ts', "import { promises as disk } from 'node:fs';\ndisk.stat(cwd);").join('\n'), /codex.ts:2:.*fs.stat/);
});

test('Host boundary permits harmless clock namespaces and rejects native helper namespaces', () => {
  assert.deepEqual(hostBoundaryFindings('sessions.ts', "import * as time from '../shared/clock.ts';"), []);
  for (const module of ['./processes.ts', '../process-identity.ts', '../hub/lock.ts', './session-cwd.ts']) {
    assert.match(hostBoundaryFindings('codex.ts', `import * as native from '${module}'; native.sameProcess(row);`).join('\n'), /native helper namespace access/);
  }
});

test('Host boundary catches helper namespace accesses from actual exporters and reexports', () => {
  for (const [module, name] of [
    ['../system-processes.ts', 'endProcess'], ['../system-processes.ts', 'systemProcesses'],
    ['../project.ts', 'pidAlive'], ['../process-identity.ts', 'processIdentityAsync'],
    ['./processes.ts', 'processAlive'], ['./processes.ts', 'sameProcess'],
    ['./session-cwd.ts', 'sessionCwdRefusal'], ['../hub/lock.ts', 'sameProcess'],
    ['./future-reexport.ts', 'endProcess'],
  ]) {
    for (const access of [`native.${name}`, `native['${name}']`]) {
      assert.match(hostBoundaryFindings('codex.ts', `import * as native from '${module}';\n${access}(row);`).join('\n'), new RegExp(`codex.ts:.*${name}`));
    }
  }
});

 test('Host boundary rejects session file mutation imports and namespaces', () => {
  for (const file of ['claude-code.ts', 'codex.ts', 'opencode/server.ts'])
    for (const name of ['writeFile', 'mkdir', 'rm', 'chmod'])
      for (const module of ['node:fs', 'node:fs/promises']) {
        assert.match(hostBoundaryFindings(file, `import { ${name} as disk } from '${module}';`).join('\n'), new RegExp(`${name} import`));
        assert.match(hostBoundaryFindings(file, `import * as fs from '${module}'; fs.${name}(path);`).join('\n'), new RegExp(`fs.${name}`));
      }
 });
