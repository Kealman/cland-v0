// T1: source inventory and planted violations; no native launches.
import test from 'node:test';
import assert from 'node:assert/strict';
import { statePathFindings, scanStatePaths } from './state-paths-lint.ts';

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
