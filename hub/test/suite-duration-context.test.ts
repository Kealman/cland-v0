// T1: immutable snapshot inspection uses an in-memory Git boundary and planted manifests.
import assert from 'node:assert/strict';
import test from 'node:test';
import { durationBudgetContext, DurationInspectionError } from '../src/suite-duration-context.ts';
import type { DurationManifest } from '../src/suite-durations.ts';

const duration = 'hub/test/durations.json', tier = 'hub/test/tiers.json', file = 'hub/test/one.test.ts';
function snapshot(mode: 'report' | 'enforce' = 'enforce') {
  const manifest: DurationManifest = { version: 1, source: { artifacts: [], commit: 'fixture' }, budget: { mode, testSeconds: 5, fileSeconds: 60 },
    files: { [file]: { seconds: 1, tests: 1 } }, tests: { [`${file}::old`]: 1 }, allow: {} };
  const files: Record<string, string> = {};
  for (const ref of ['head', 'base']) {
    files[`${ref}:${duration}`] = JSON.stringify(manifest);
    files[`${ref}:${tier}`] = JSON.stringify({ version: 1, tests: { [file]: 'T3' } });
    files[`${ref}:${file}`] = "test('old', () => {});";
  }
  files[`head:${file}`] += "test('new', () => {});";
  let fail = '';
  const git = async (...args: string[]) => {
    if (args.join(' ') === fail) throw new Error('planted immutable read failure');
    if (args[0] === 'show') {
      const value = files[args[1]!];
      if (value === undefined) throw new Error('path absent');
      return value;
    }
    if (args[0] === 'ls-tree') {
      const ref = args[args.indexOf('-z') + 1]!, path = args.at(-1)!;
      return files[`${ref}:${path}`] === undefined ? '' : path + '\0';
    }
    if (args[0] === 'diff') return file + '\0';
    throw new Error(`unexpected Git operation: ${args[0]}`);
  };
  return { files, git, fail(command: string) { fail = command; } };
}

test('enforce snapshots reject failed required inspections instead of disabling merge budgets', async () => {
  for (const [command, diagnostic] of [
    [`show head:${duration}`, 'candidate duration manifest'],
    [`show head:${tier}`, 'candidate tier manifest'],
    [`ls-tree -r --name-only -z base -- ${duration}`, 'base duration manifest'],
    [`show base:${duration}`, 'base duration manifest'],
    [`show base:${tier}`, 'base tier manifest'],
    ['diff --name-only -z --no-renames base head', 'candidate/base diff'],
    [`show base:${file}`, `base source ${file}`],
    [`show head:${file}`, `candidate source ${file}`],
  ]) {
    const f = snapshot();
    f.fail(command!);
    await assert.rejects(durationBudgetContext('/in-memory', { head: 'head', base: 'base', git: f.git }),
      error => error instanceof DurationInspectionError && error.message === `duration inspection failed: ${diagnostic}`, command);
  }
});

test('confirmed absent historical manifests remain distinct from failed immutable reads', async () => {
  for (const path of [duration, tier]) {
    const f = snapshot();
    delete f.files[`base:${path}`];
    const context = await durationBudgetContext('/in-memory', { head: 'head', base: 'base', git: f.git });
    assert.ok(context);
    assert.equal(context.base, undefined);
    assert.equal(context.candidateSources, undefined);
  }
  const f = snapshot();
  delete f.files[`head:${duration}`];
  assert.equal(await durationBudgetContext('/in-memory', { head: 'head', base: 'base', git: f.git }), null);
});

test('report mode keeps inspection failures unavailable without exposing partial facts', async () => {
  const f = snapshot('report');
  f.fail(`show head:${file}`);
  const context = await durationBudgetContext('/in-memory', { head: 'head', base: 'base', git: f.git });
  assert.ok(context);
  assert.equal(context.base, undefined);
  assert.equal(context.candidateSources, undefined);
});

test('enforce mode rejects failed new-source estimates after the base snapshot is built', async () => {
  const f = snapshot(), added = 'hub/test/added.test.ts';
  f.files[`head:${tier}`] = JSON.stringify({ version: 1, tests: { [file]: 'T3', [added]: 'T3' } });
  f.files[`head:${added}`] = "test('added', () => {});";
  f.fail(`show head:${added}`);
  await assert.rejects(durationBudgetContext('/in-memory', { head: 'head', base: 'base', git: f.git }),
    error => error instanceof DurationInspectionError && error.message === `duration inspection failed: candidate source ${added}`);
});

test('duration inspection retains exact delimited test paths', async () => {
  const f = snapshot();
  const paths = [' hub/test/leading.test.ts', 'hub/test/trailing.test.ts ', 'hub/test/line\nbreak.test.ts'];
  for (const ref of ['head', 'base']) {
    f.files[`${ref}:${tier}`] = JSON.stringify({ version: 1, tests: Object.fromEntries(paths.map(path => [path, 'T3'])) });
    for (const path of paths) f.files[`${ref}:${path}`] = ref === 'base' ? "test('old', () => {});" : "test('new', () => {});";
  }
  const git = async (...args: string[]) => args[0] === 'diff' ? paths.join('\0') + '\0' : f.git(...args);
  const context = await durationBudgetContext('/in-memory', { head: 'head', base: 'base', git });
  for (const path of paths) {
    assert.deepEqual(context?.base?.sources?.[path], { patterns: ['^old$'], dynamic: false });
    assert.deepEqual(context?.candidateSources?.[path], { patterns: ['^new$'], dynamic: false });
  }
});
