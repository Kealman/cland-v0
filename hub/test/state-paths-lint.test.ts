// T1: source inventory and planted violations; no native launches.
import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { statePathFindings, scanStatePaths } from './state-paths-lint.ts';

test('state inventory bounds parsing to candidate sources without losing unnamed paths', () => {
  const parsed: string[] = [];
  const parse: typeof ts.createSourceFile = (...args) => {
    parsed.push(args[0]);
    return ts.createSourceFile(...args);
  };
  for (let index = 0; index < 100; index++) {
    assert.deepEqual(statePathFindings(`unrelated-${index}.ts`, 'export const count = 1;', parse), []);
  }
  assert.deepEqual(parsed, []);
  assert.deepEqual(statePathFindings('future.ts', "join(env.HOME, 'unnamed')", parse),
    ['future.ts:1: HOME access: env.HOME']);
  assert.deepEqual(parsed, ['future.ts']);
  assert.ok(statePathFindings('escaped.ts', String.raw`const path = '\x2ftmp/unnamed';`, parse).length);
  assert.deepEqual(parsed, ['future.ts', 'escaped.ts']);
});

test('state inventory discovers unnamed paths in files unreachable from registered sources', async t => {
  const root = await mkdtemp(join(tmpdir(), 'state-inventory-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, 'detached'));
  await writeFile(join(root, 'state-paths.ts'), 'export const named = true;');
  await writeFile(join(root, 'entry.ts'), 'export const entry = true;');
  await writeFile(join(root, 'detached/escape.ts'), "const state = join(env.HOME, 'unnamed');");
  await writeFile(join(root, 'detached/escape.sh'), 'mkdir "$HOME/unnamed"');
  assert.deepEqual((await scanStatePaths(pathToFileURL(root + '/'))).sort(), [
    'detached/escape.sh:1: unregistered shell runtime path/command: mkdir "$HOME/unnamed"',
    'detached/escape.ts:1: HOME access: env.HOME',
  ]);
});

test('state inventory candidate filter preserves path and command literals including escapes', () => {
  for (const source of [
    "const path = '/tmp/unnamed';",
    "const path = 'Library/LaunchAgents';",
    "spawn('open', []);",
    "spawn('caffeinate', []);",
    String.raw`const path = '\x2f\x74\x6d\x70/unnamed';`,
    String.raw`spawn('\u006f\u0070\u0065\u006e', []);`,
    'const path = `/tmp/${name}`;',
  ]) {
    let parses = 0;
    const parse: typeof ts.createSourceFile = (...args) => {
      parses++;
      return ts.createSourceFile(...args);
    };
    assert.ok(statePathFindings('unregistered.ts', source, parse).length, source);
    assert.equal(parses, 1, source);
  }
});

test('state inventory rejects newly introduced home and temporary paths', () => {
  for (const source of ["homedir()", "import { homedir as home } from 'node:os'; home()", "os.homedir()", "join(env.HOME, 'escape')", "join(env['HOME'], 'escape')", "tmpdir()", "os.tmpdir()", "'/tmp/escape'"]) {
    assert.ok(statePathFindings('future.ts', source).length, source);
  }
  assert.ok(statePathFindings('future.sh', 'cd /tmp/escape').length);
  assert.ok(statePathFindings('project.ts', "join(tmpdir(), 'new-escape')").length);
});
test('state inventory requires a macOS platform guard on native paths and commands', () => {
  for (const value of ['Library/LaunchAgents', 'caffeinate', 'open']) {
    assert.ok(statePathFindings('future.ts', `spawn('${value}', []);`).length);
    assert.deepEqual(statePathFindings('future.ts', `if (process.platform === 'darwin') spawn('${value}', []);`), []);
    assert.ok(statePathFindings('future.ts', `if (process.platform === 'linux') spawn('${value}', []);`).length);
    assert.ok(statePathFindings('future.ts', `if (process.platform === 'darwin') {} else spawn('${value}', []);`).length);
  }
});
test('state inventory follows shell HOME, launcher aliases, command variables and split Library paths', () => {
  for (const source of ['mkdir "$HOME/escape"', 'mkdir "${HOME}/escape"', 'mkdir ~/escape']) {
    assert.ok(statePathFindings('future.sh', source).length, source);
  }
  for (const source of [
    'const command="open"; spawn(command, []);',
    'const command="open"; const alias=command; spawn(alias, []);',
    "import { execFile as launch } from 'node:child_process'; launch('caffeinate', []);",
    "import * as cp from 'node:child_process'; cp.execFile('open', []);",
    'join(home, "Library", "Caches");',
    "const command = '/usr/bin/open'; spawn(command, []);",
    "exec('open https://example.test');",
  ]) assert.ok(statePathFindings('future.ts', source).length, source);
  assert.deepEqual(statePathFindings('future.ts', 'const command="open"; if(process.platform === "darwin") spawn(command, []);'), []);
  assert.deepEqual(statePathFindings('future.ts', 'const command=process.platform === "darwin" ? "open" : "xdg-open"; spawn(command, []);'), []);
});
test('per-host short socket exceptions accept only their registered expressions', () => {
  assert.deepEqual(statePathFindings('host/records.ts', "const candidates = [join(tmpdir(), name), join('/tmp', name)];"), []);
  for (const source of ["join(tmpdir(), 'unregistered')", "join('/tmp', 'unregistered')"]) {
    assert.ok(statePathFindings('host/records.ts', source).length, source);
  }
});
test('Codex temp-root registration accepts only the local versus host expression', () => {
  assert.deepEqual(statePathFindings('adapters/codex.ts', "const temp = machine.name === 'local' ? tmpdir() : '/tmp';"), []);
  for (const source of ["const temp = machine.name !== 'local' ? tmpdir() : '/tmp';", "join('/tmp', 'unregistered')", "real(tmpdir(), resumed, machine)"]) {
    assert.ok(statePathFindings('adapters/codex.ts', source).length, source);
  }
});

test('hub source conforms to the named state path inventory', async () => {
  assert.deepEqual(await scanStatePaths(new URL('../src/', import.meta.url)), []);
});

test('doctor startup HOME registration accepts only its captured lookup context', () => {
  assert.deepEqual(statePathFindings('doctor/shell-credentials.ts', 'const home = env.HOME;'), []);
  for (const source of ["join(env.HOME, 'unregistered')", 'const other = env.HOME;', "const home = env['HOME'];"]) {
    assert.ok(statePathFindings('doctor/shell-credentials.ts', source).length, source);
  }
  assert.ok(statePathFindings('future.ts', 'const home = env.HOME;').length);
});
