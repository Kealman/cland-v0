// T1: command resolution preserves the existing suite's mode and selection rules.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { tempProject } from './harness.ts';
import { writeSuiteFixture } from './suite-fixture.ts';
import { parseConfig } from '../src/init/config.ts';
import { verificationCommands } from '../src/verification-commands.ts';

test('verification resolves the existing npm lines for every request', () => {
  for (const [mode, command] of [
    ['auto', 'npm test'], ['all', 'npm test'],
    ['hub', 'npm test --workspace hub'], ['nvim', 'npm run test:nvim'],
  ] as const) {
    assert.deepEqual(verificationCommands({ mode }), { check: 'npm run typecheck', test: command });
    assert.deepEqual(verificationCommands({ mode, selection: { mode: 'full', files: [], reason: 'full' } }), { check: 'npm run typecheck', test: 'npm test' });
  }
});


test('verification retains the candidate expanded check line', () => {
  assert.deepEqual(verificationCommands({ mode: 'auto' }, 'npm run check'), { check: 'npm run check', test: 'npm test' });
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
