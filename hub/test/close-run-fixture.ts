import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fixture } from './remote-fixture.ts';
import { cland, projectHub, startDaemon } from './harness.ts';
import assert from 'node:assert/strict';

export async function integrated(t: Parameters<typeof fixture>[0], config = '', remoteBudget = 2, script?: string, options: { hub?: typeof projectHub | typeof startDaemon; territory?: boolean; env?: Record<string, string> } = {}) {
  const f = await fixture(t, { ...options, ...(script ? { test: script } : {}), config: `remote_budget=${remoteBudget}\nshards=2\nlifetime="15m"\nrun_timeout="5m"\n${config}` });
  await f.git('checkout', 'dev');
  await mkdir(join(f.root, 'hub/test'), { recursive: true });
  for (const file of ['one', 'two']) await writeFile(join(f.root, `hub/test/${file}.test.ts`), "import test from 'node:test'; test('fixture', () => {});\n");
  await writeFile(join(f.root, 'hub/test/shards.json'), JSON.stringify({ version: 1, tests: { 'hub/test/one.test.ts': 'free', 'hub/test/two.test.ts': 'free' } }));
  await writeFile(join(f.root, 'hub/test/durations.json'), JSON.stringify({ version: 1, source: { artifacts: [], commit: 'fixture' }, budget: { testSeconds: 5, fileSeconds: 60 }, files: { 'hub/test/one.test.ts': { seconds: 8, tests: 1 }, 'hub/test/two.test.ts': { seconds: 6, tests: 1 }, 'nvim/test/editor.test.ts': { seconds: 2, tests: 1 } }, tests: {}, allow: {} }));
  await f.git('add', '.'); await f.git('commit', '-qm', 'Integrated files');
  if (options.territory) {
    const pushed = await cland(f.root, 'push');
    assert.equal(pushed.code, 0, pushed.stderr);
  } else await f.git('push', 'origin', 'dev');
  return f;
}

