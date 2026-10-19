// T1: copy-set planning over source text; no processes, sockets or real time.
import assert from 'node:assert/strict';
import test from 'node:test';
import { sourceFixtureFiles } from './source-fixture.ts';

test('fixture copies the whole import closure of its entries plus non-import assets', async () => {
  const sources: Record<string, string> = {
    'hub/test/harness.ts': `
import { entry } from '../src/entry.ts';
import type { Options } from '../../shared/options.ts';
export * from './barrel.ts';
const lazy = () => import('./lazy.mjs');
const legacy = () => require('./legacy.cjs');
// import './comment.ts';
const text = "import './string.ts'";
`,
    'hub/src/entry.ts': "import '../../test-support/admission.ts'; import 'external-package';",
    'shared/options.ts': 'export type Options = {};',
    'hub/test/barrel.ts': "export { entry } from '../src/entry.ts';",
    'hub/test/lazy.mjs': "import './nested';",
    'hub/test/nested/index.ts': "import '../harness.ts';",
    'hub/test/legacy.cjs': "require('./leaf.cjs');",
    'hub/test/leaf.cjs': '',
    'test-support/admission.ts': '',
    'hub/src/unrelated.ts': "import './absent.ts';",
  };
  assert.deepEqual(await sourceFixtureFiles(async file => sources[file], ['hub/test/harness.ts'], ['package.json', 'hub/test/fakes/codex/codex']), [
    'hub/src/entry.ts', 'hub/test/barrel.ts', 'hub/test/fakes/codex/codex', 'hub/test/harness.ts',
    'hub/test/lazy.mjs', 'hub/test/leaf.cjs', 'hub/test/legacy.cjs', 'hub/test/nested/index.ts',
    'package.json', 'shared/options.ts', 'test-support/admission.ts',
  ]);
});

test('fixture refuses an incomplete local import closure', async () => {
  const read = async (file: string) => file === 'harness.ts' ? "import './missing.ts';" : undefined;
  await assert.rejects(sourceFixtureFiles(read, ['harness.ts'], []), /fixture import missing: harness.ts -> .\/missing.ts/);
  await assert.rejects(sourceFixtureFiles(read, ['absent.ts'], []), /fixture source missing: absent.ts/);
  await assert.rejects(sourceFixtureFiles(async () => "import '../outside.ts';", ['entry.ts'], []), /escapes source root/);
});
