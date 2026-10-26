// T2: four real CLI launches prove entry-point wiring; the full table is T1.
import './cover-quiet.ts';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { test } from 'node:test';
import { VERSION } from '../src/version.ts';
import { frozenUsage, sealedHelpProject } from './cli-usage-fixture.ts';
import { clandCliLaunch } from './tier-cli.ts';
import { fixtureEnvironment } from './fixture-environment.ts';

const execCli = promisify(execFile);
const entry = fileURLToPath(new URL('../bin/cland.ts', import.meta.url));

test('cland --help retains its pre-refactor output byte for byte', async t => {
  const fixture = sealedHelpProject(t);
  const before = fixture.snapshot();
  const actual = await clandCliLaunch(() => execCli(process.execPath, [entry, '--help'], {
    cwd: fixture.project, env: fixtureEnvironment(fixture.root, process.env), timeout: 5000,
  }));
  const exports: Record<string, string> = frozenUsage();
  const expected = readFileSync(new URL('./fixtures/cli-usage/help.txt', import.meta.url), 'utf8')
    .replace('<VERSION>', VERSION).replace(/<([A-Z_]+_USAGE)>/g, (_, name: string) => {
      assert.ok(Object.hasOwn(exports, name), `known frozen help block: ${name}`);
      return exports[name]!;
    });
  // execFile resolves only after the real child has exited successfully.
  assert.equal(actual.stdout, expected);
  assert.equal(actual.stderr, '');
  assert.deepEqual(fixture.snapshot(), before);
});

test('cland task criterion --help exits 0 with criterion usage without a hub or project changes', async t => {
  const fixture = sealedHelpProject(t);
  const before = fixture.snapshot();
  const actual = await clandCliLaunch(() => execCli(process.execPath, [entry, 'task', 'criterion', '--help'], {
    cwd: fixture.project, env: fixtureEnvironment(fixture.root, process.env), timeout: 5000,
  }));
  assert.match(actual.stdout, /^  task criterion <id> <done\|verify\|fail\|edit\|remove> <C-n>/);
  assert.match(actual.stdout, /^  task criterion <id> add <text>$/m);
  assert.match(actual.stdout, /^  task criterion <id> normalize /m);
  assert.doesNotMatch(actual.stdout, /^  task (?!criterion )/m);
  assert.equal(actual.stderr, '');
  assert.deepEqual(fixture.snapshot(), before);
});

for (const [command, flag, block] of [
  ['remote', '--help', 'REMOTE_USAGE'],
  ['hub', '--help', 'HUB_USAGE'],
  ['session', '-h', 'SESSION_USAGE'],
] as const) test(`cland ${command} ${flag} exits 0 without a hub or project changes`, async t => {
  const fixture = sealedHelpProject(t);
  const before = fixture.snapshot();
  const actual = await clandCliLaunch(() => execCli(process.execPath, [entry, command, flag], {
    cwd: fixture.project, env: fixtureEnvironment(fixture.root, process.env), timeout: 5000,
  }));
  assert.equal(actual.stdout, frozenUsage()[block]);
  assert.equal(actual.stderr, '');
  assert.deepEqual(fixture.snapshot(), before);
});
