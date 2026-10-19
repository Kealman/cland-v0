// T1: config resolution and durable admission facts use files and semantic executor receipts.
import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tempProject } from './harness.ts';
import { suiteUnit } from './suite-unit-fixture.ts';
import { writeSuiteFixture } from './suite-fixture.ts';
import { parseConfig } from '../src/init/config.ts';
import { verificationCommands, recordedCommands } from '../src/verification-commands.ts';

test('verification resolves each command from the candidate before the hub root', async t => {
  const root = await tempProject(t), candidate = join(root, 'candidate');
  for (const dir of [root, candidate]) await mkdir(join(dir, '.cland'), { recursive: true });
  await writeFile(join(root, '.cland/config.toml'), '[verification]\nprepare="root prepare"\ncheck="root check"\ntest="root test"\n');
  await writeFile(join(candidate, '.cland/config.toml'), '[verification]\ncheck=""\ntest="branch test"\n');
  assert.deepEqual(await verificationCommands(candidate, root), { prepare: 'root prepare', check: 'root check', test: 'branch test' });
  await writeFile(join(candidate, '.cland/config.toml'), '[project]\nname="old branch"\n');
  assert.deepEqual(await verificationCommands(candidate, root), { prepare: 'root prepare', check: 'root check', test: 'root test' });
});

test('verification refuses a project with no configured test', async t => {
  const root = await tempProject(t);
  await assert.rejects(verificationCommands(root, root), /no \[verification\] test for this project; set it: cland config set verification.test '<command>'/);
});


test('submission retains recorded commands through store reopen after config changes', async t => {
  const f = await suiteUnit(t, {}, 'prepare="false"\ncheck="echo check"\ntest="echo test"\n');
  f.hold(true);
  const job = await f.launch();
  await writeFile(join(f.root, '.cland/config.toml'), '[verification]\ncheck="false"\ntest="false"\n');
  await f.reopen();
  f.hold(false);
  await f.tick();
  await f.suites.settled();
  assert.deepEqual(f.delivered.get(job.id)?.commands, { prepare: 'false', check: 'echo check', test: 'echo test' });
  assert.match(await f.log(job.id), /Commands: check echo check · test echo test/);
  await f.finish(job.id);
});


test('this repository names its check and one test command for every mode', async t => {
  const root = fileURLToPath(new URL('../../', import.meta.url));
  const commands = await verificationCommands(root, root);
  assert.deepEqual(commands, { prepare: '', check: 'npm run check', test: 'npm test' });
  const f = await suiteUnit(t);
  await writeFile(join(f.root, '.cland/config.toml'), await readFile(join(root, '.cland/config.toml'), 'utf8'));
  for (const mode of ['auto', 'all', 'hub', 'nvim']) {
    const job = await f.launch({ mode, fresh: true });
    assert.deepEqual(recordedCommands(f.delivered.get(job.id)!), commands, mode);
    await f.finish(job.id);
  }
});

test('a different resolved command cannot reuse the same candidate tree green', async t => {
  const f = await suiteUnit(t);
  const original = await f.launch();
  await f.finish(original.id);
  await writeFile(join(f.root, '.cland/config.toml'), '[verification]\ntest="different suite"\n');
  const next = await f.launch();
  assert.equal(next.cached, undefined);
  await f.finish(next.id);
});

test('other-stack fixture keeps caller shell commands without a package or runner', async t => {
  const root = await tempProject(t, 'cland-other-stack-');
  await writeSuiteFixture(root, '', undefined, { stack: 'other', check: 'sh -n test.sh', test: 'sh test.sh', verification: '' });
  const config = parseConfig(await readFile(join(root, '.cland/config.toml'), 'utf8'), 'fixture');
  assert.equal(config.verification.check, 'sh -n test.sh');
  assert.equal(config.verification.test, 'sh test.sh');
  await assert.rejects(stat(join(root, 'package.json')), { code: 'ENOENT' });
  await assert.rejects(stat(join(root, 'hub/test/run-suite.ts')), { code: 'ENOENT' });
});
