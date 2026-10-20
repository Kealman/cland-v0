// T3: native Git stdio resolves the original lint freeze through moving dev ancestry.
// This contract retains the real commit/merge history; policy admission cases are T2.
import { fixtureEnvironment } from './fixture-environment.ts';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { tempProject } from './harness.ts';
import { serializeTierManifest } from '../src/suite-shards.ts';

test('the first lint baseline keeps its freeze when dev moves debt before publication', async t => {
  const { testLintPolicy, shrinkTestLint, LINT_BASELINE } = await import('../src/test-lint-policy.ts');
  const root = await tempProject(t, 'cland-lint-freeze-history-');
  const git = (...args: string[]) => promisify(execFile)('git', args, { env: fixtureEnvironment(root, process.env), cwd: root }).then(result => result.stdout.trim());
  await git('init', '-qb', 'dev');
  await git('config', 'user.name', 'Lint history fixture');
  await git('config', 'user.email', 'fixture@example.invalid');
  await mkdir(join(root, 'hub/test'), { recursive: true });
  const native = 'hub/test/native.test.ts', component = 'hub/test/component.test.ts';
  const assertion = 'const wrote = Date.now(); assert.ok(Date.now() - wrote < 1000);';
  const nativeSource = '// T3: native watcher latency\n' + assertion;
  await writeFile(join(root, native), nativeSource);
  await writeFile(join(root, 'hub/test/tiers.json'), serializeTierManifest({ version: 1, tests: { [native]: 'T3' } }));
  await git('add', 'hub'); await git('commit', '-qm', 'Native latency debt');
  await git('update-ref', 'refs/remotes/origin/dev', 'HEAD');
  await git('checkout', '-qb', 'candidate');
  const frozen = { version: 1, files: { [native]: { 'wall-clock-assertion': 1 } } };
  await writeFile(join(root, LINT_BASELINE), JSON.stringify(frozen));
  await git('add', 'hub'); await git('commit', '-qm', 'First freeze');
  assert.deepEqual(await testLintPolicy(root), []);
  // An inflated first freeze must not become its own authority.
  await writeFile(join(root, LINT_BASELINE), JSON.stringify({ version: 1, files: { [native]: { 'wall-clock-assertion': 2 } } }));
  await git('commit', '-qam', 'Inflated freeze', '--amend');
  assert.ok((await testLintPolicy(root)).some(f => f.rule === 'lint-baseline' && /baseline grew/.test(f.message)));
  await writeFile(join(root, LINT_BASELINE), JSON.stringify(frozen));
  await git('commit', '-qam', 'First freeze', '--amend');
  await git('checkout', '-q', 'dev');
  await writeFile(join(root, native), '// T3: native watcher lifecycle\n');
  await writeFile(join(root, component), assertion);
  await writeFile(join(root, 'hub/test/tiers.json'), serializeTierManifest({ version: 1, tests: { [native]: 'T3', [component]: 'T2' } }));
  await git('add', 'hub'); await git('commit', '-qm', 'Move latency before freeze is published');
  await git('update-ref', 'refs/remotes/origin/dev', 'HEAD');
  await git('checkout', '-q', 'candidate'); await git('merge', '--no-edit', 'dev');
  // Correct the tiering at the original, already frozen path.
  await writeFile(join(root, native), nativeSource);
  await writeFile(join(root, component), '');
  await shrinkTestLint(root);
  await git('commit', '-qam', 'Restore native latency and shrink');
  assert.deepEqual(await testLintPolicy(root), []);
  assert.deepEqual(await testLintPolicy(root, { tree: 'HEAD', head: 'HEAD', base: 'dev' }), []);
  const grown = JSON.parse(await readFile(join(root, LINT_BASELINE), 'utf8'));
  grown.files[native]['wall-clock-assertion'] = 2;
  await writeFile(join(root, LINT_BASELINE), JSON.stringify(grown));
  assert.ok((await testLintPolicy(root)).some(f => f.rule === 'lint-baseline' && /baseline grew/.test(f.message)));
});
