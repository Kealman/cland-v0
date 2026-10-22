// T1: the recorder's refresh selection reads an in-memory source graph.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { frameConsumers } from './nvim-frame-consumers.ts';

test('full refresh includes a helper-only fixture consumer', async () => {
  const sources: Record<string, string> = {
    'nvim/test/soak.test.ts': "import { client } from './helper.ts'; client();",
    'nvim/test/helper.ts': "export { client } from './launch.ts';",
    'nvim/test/component.test.ts': "import './stub-hub.ts';",
    'nvim/test/launch.ts': "const stub = new URL('./stub-hub.ts', import.meta.url); export function client() {}",
  };
  assert.deepEqual(await frameConsumers(['nvim/test/soak.test.ts', 'nvim/test/component.test.ts'], async file => sources[file]), ['nvim/test/component.test.ts', 'nvim/test/soak.test.ts']);
});

test('full refresh ignores comment mentions of the stub filename', async () => {
  const sources: Record<string, string> = {
    'nvim/test/comment.test.ts': "// import './stub-hub.ts';\n/* new URL('./stub-hub.ts', import.meta.url) */",
    'nvim/test/string.test.ts': 'const note = "stub-hub.ts";',
    'nvim/test/unrelated.test.ts': "import './other-stub-hub.ts';",
  };
  assert.deepEqual(await frameConsumers(Object.keys(sources), async file => sources[file]), []);
});

test('full refresh follows lazy imports through a cyclic helper graph', async () => {
  const sources: Record<string, string> = {
    'nvim/test/first.test.ts': "import './helper.ts';",
    'nvim/test/second.test.ts': "import './cycle.ts';",
    'nvim/test/helper.ts': "import './cycle.ts'; export const stub = () => import('./stub-hub.ts');",
    'nvim/test/cycle.ts': "export * from './helper.ts';",
  };
  assert.deepEqual(await frameConsumers(['nvim/test/second.test.ts', 'nvim/test/first.test.ts'], async file => sources[file]),
    ['nvim/test/first.test.ts', 'nvim/test/second.test.ts']);
});

test('full refresh excludes native clients sharing the launcher and type-only stub consumers', async () => {
  const sources: Record<string, string> = {
    'nvim/test/artifact-browser.test.ts': "import './harness.ts';",
    'nvim/test/harness.ts': "import './client.ts';",
    'nvim/test/client.ts': "const allowed = command === new URL('./stub-hub.ts', import.meta.url).href;",
    'nvim/test/types.test.ts': "import type { Scenario } from './stub-hub.ts';",
    'nvim/test/component.test.ts': "import './stub-client.ts'; const stub = new URL('./stub-hub.ts', import.meta.url);",
    'nvim/test/stub-client.ts': "export * from './client.ts';",
    'nvim/test/no-capture.test.ts': "import './stub-client.ts';",
  };
  assert.deepEqual(await frameConsumers(Object.keys(sources).filter(file => file.endsWith('.test.ts')), async file => sources[file]), ['nvim/test/component.test.ts']);
});
