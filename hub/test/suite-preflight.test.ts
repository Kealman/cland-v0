// T3: native Git commits prove local verify refusal before any hub connection.
import test from 'node:test';
import assert from 'node:assert/strict';
import { commandIn } from './init-machine.ts';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tempProject } from './harness.ts';
import { fixtureEnvironment } from './fixture-environment.ts';
import { verificationFixture } from './verification-fixture.ts';
import { runSuiteCommand } from '../src/cli/suite.ts';

for (const scenario of ['unsorted', 'missing header', 'displaced header', 'stale duration', 'tier process'] as const) {
  test(`verify locally refuses ${scenario} before connecting to a hub`, async t => {
    const root = await tempProject(t, 'verify-preflight-');
    const env = fixtureEnvironment(root, process.env);
    const git = async (...args: string[]) => {
      const result = await commandIn({ root, home: env.HOME!, env: fixtureEnvironment(root, process.env, {}), context: t }, root, 'git', ['-c', 'gc.auto=0', ...args]);
      assert.equal(result.code, 0, result.stderr);
    };
    await verificationFixture(root);
    await git('init', '-qb', 'dev'); await git('add', '.'); await git('commit', '-qm', 'baseline');
    const file = 'hub/test/a.test.ts';
    await writeFile(join(root, file), scenario === 'displaced header' ? "import test from 'node:test';\n// T3: native child\n" : scenario === 'tier process' ? "import { spawn } from 'node:child_process';\nspawn('node');\n" : '// no lifecycle\n');
    const tests = scenario === 'unsorted' ? { 'hub/test/z.test.ts': 'T3', [file]: 'T3' } : { [file]: scenario === 'tier process' ? 'T2' : 'T3' };
    if (scenario === 'unsorted') await writeFile(join(root, 'hub/test/z.test.ts'), '// T3: native child\n');
    await writeFile(join(root, 'hub/test/tiers.json'), JSON.stringify({ version: 1, tests }, null, 2));
    if (scenario === 'stale duration') await writeFile(join(root, 'hub/test/durations.json'), JSON.stringify({ version: 1, source: { artifacts: [], commit: 'base' }, budget: { testSeconds: 5, fileSeconds: 60 }, tests: { 'hub/test/renamed.test.ts::old': 1 }, files: {}, allow: {} }, null, 2));
    const cause = scenario === 'unsorted' ? /not sorted/ : scenario === 'stale duration' ? /renamed.test.ts/ : scenario === 'tier process' ? /tier-process/ : /t3-lifecycle/;
    for (const args of [[], ['--dry-run']]) {
      await assert.rejects(runSuiteCommand(args, root, { env }), error => {
        assert.match(String(error), cause);
        assert.match(String(error), /hub\/test\/[^\s:]+(?:\.json|\.ts):\d+/);
        if (scenario === 'unsorted') assert.match(String(error), /hub\/test\/tiers.json:5/);
        if (scenario === 'stale duration') assert.match(String(error), /hub\/test\/durations.json:12/);
        return true;
      });
    }
  });
}

test('verify preflight keeps report-only findings nonblocking and checks committed sources', async t => {
  const root = await tempProject(t, 'verify-preflight-control-');
  const env = fixtureEnvironment(root, process.env);
  const git = async (...args: string[]) => {
      const result = await commandIn({ root, home: env.HOME!, env: fixtureEnvironment(root, process.env, {}), context: t }, root, 'git', ['-c', 'gc.auto=0', ...args]);
      assert.equal(result.code, 0, result.stderr);
    };
  await verificationFixture(root);
  const file = 'hub/test/a.test.ts';
  await writeFile(join(root, file), '// T3: native timeout\n');
  await writeFile(join(root, 'hub/test/tiers.json'), JSON.stringify({ version: 1, tests: { [file]: 'T3' } }));
  await git('init', '-qb', 'dev'); await git('add', '.'); await git('commit', '-qm', 'baseline');
  // An existing lifecycle header lost on the committed candidate still refuses
  // even if the dirty executing worktree has already restored it.
  await git('checkout', '-qb', 'task');
  await writeFile(join(root, file), "import test from 'node:test';\n// T3: native timeout\n");
  await git('add', '.'); await git('commit', '-qm', 'displaced header');
  await writeFile(join(root, file), '// T3: native timeout\n');
  await assert.rejects(runSuiteCommand([], root, { env }), /a.test.ts:1 \[t3-lifecycle\]/);
  await git('reset', '--hard', 'dev');
  // skip-reason is diagnostic only, and must reach discovery rather than refuse.
  await writeFile(join(root, file), "// T3: native timeout\nimport test from 'node:test';\ntest.skip('diagnostic', () => {});\n");
  await assert.rejects(runSuiteCommand([], root, { env }), /no hub runs/);
});


for (const scenario of ['unsorted', 'stale duration'] as const) {
  test(`verify retains committed ${scenario} location after disk repair`, async t => {
    const root = await tempProject(t, 'verify-committed-location-');
    const env = fixtureEnvironment(root, process.env);
    const git = async (...args: string[]) => {
      const result = await commandIn({ root, home: env.HOME!, env: fixtureEnvironment(root, process.env, {}), context: t }, root, 'git', ['-c', 'gc.auto=0', ...args]);
      assert.equal(result.code, 0, result.stderr);
    };
    await verificationFixture(root);
    await git('init', '-qb', 'dev'); await git('add', '.'); await git('commit', '-qm', 'baseline');
    await git('checkout', '-qb', 'task');
    for (const file of ['a', 'z']) await writeFile(join(root, `hub/test/${file}.test.ts`), '// T3: native timeout\n');
    const tiers = join(root, 'hub/test/tiers.json');
    await writeFile(tiers, JSON.stringify({ version: 1, tests: { 'hub/test/z.test.ts': 'T3', 'hub/test/a.test.ts': 'T3' } }, null, 2));
    if (scenario === 'stale duration') {
      await writeFile(tiers, JSON.stringify({ version: 1, tests: { 'hub/test/a.test.ts': 'T3', 'hub/test/z.test.ts': 'T3' } }, null, 2));
      await writeFile(join(root, 'hub/test/durations.json'), JSON.stringify({ version: 1, source: { artifacts: [], commit: 'base' }, budget: { testSeconds: 5, fileSeconds: 60 }, tests: { 'hub/test/renamed.test.ts::old': 1 }, files: {}, allow: {} }, null, 2));
    }
    await git('add', '.'); await git('commit', '-qm', 'invalid committed manifest');
    await writeFile(tiers, JSON.stringify({ version: 1, tests: { 'hub/test/a.test.ts': 'T3', 'hub/test/z.test.ts': 'T3' } }, null, 2));
    if (scenario === 'stale duration') await writeFile(join(root, 'hub/test/durations.json'), '{}');
    await assert.rejects(runSuiteCommand([], root, { env }), error => {
      assert.match(String(error), scenario === 'unsorted' ? /tiers.json:5/ : /durations.json:12/);
      assert.match(String(error), /HEAD [0-9a-f]{40}/);
      return true;
    });
  });
}
