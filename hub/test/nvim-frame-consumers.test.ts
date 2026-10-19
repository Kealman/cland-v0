// T1: the recorder's refresh selection reads an in-memory source graph.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { frameConsumers } from './nvim-frame-consumers.ts';

test('full refresh includes a helper-only fixture consumer', async () => {
  const sources: Record<string, string> = {
    'nvim/test/soak.test.ts': "import { client } from './helper.ts'; client();",
    'nvim/test/helper.ts': "export { client } from './launch.ts';",
    'nvim/test/launch.ts': "const stub = new URL('./stub-hub.ts', import.meta.url); export function client() {}",
  };
  assert.deepEqual(await frameConsumers(['nvim/test/soak.test.ts'], {
    'nvim/test/soak.test.ts': 'T4',
    'nvim/test/component.test.ts': 'T2',
    'hub/test/component.test.ts': 'T2',
  }, async file => sources[file]), ['nvim/test/component.test.ts', 'nvim/test/soak.test.ts']);
});

test('full refresh ignores comment mentions of the stub filename', async () => {
  const sources: Record<string, string> = {
    'nvim/test/comment.test.ts': "// import './stub-hub.ts';\n/* new URL('./stub-hub.ts', import.meta.url) */",
    'nvim/test/string.test.ts': 'const note = "stub-hub.ts";',
    'nvim/test/unrelated.test.ts': "import './other-stub-hub.ts';",
  };
  assert.deepEqual(await frameConsumers(Object.keys(sources), {}, async file => sources[file]), []);
});

test('full refresh follows lazy imports through a cyclic helper graph', async () => {
  const sources: Record<string, string> = {
    'nvim/test/first.test.ts': "import './helper.ts';",
    'nvim/test/second.test.ts': "import './cycle.ts';",
    'nvim/test/helper.ts': "import './cycle.ts'; export const stub = () => import('./stub-hub.ts');",
    'nvim/test/cycle.ts': "export * from './helper.ts';",
  };
  assert.deepEqual(await frameConsumers(['nvim/test/second.test.ts', 'nvim/test/first.test.ts'], {}, async file => sources[file]),
    ['nvim/test/first.test.ts', 'nvim/test/second.test.ts']);
});
