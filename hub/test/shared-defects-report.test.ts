// Public verify/report seam, with tiny failed packages and real receipt excerpts.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fixture, type ResultMessage } from './suite-fixture.ts';
import { cacheRepository } from './suite-support.ts';
import { eventually } from './harness.ts';

test('only distinct task branches raise one shared-defect notice with both logs and dev file history', async t => {
  const f = await fixture(t, 'node red.mjs');
  await writeFile(join(f.root, 'red.mjs'), "import {readFileSync} from 'node:fs'; console.log(readFileSync('.cland/receipt', 'utf8')); process.exitCode = 1;\n");
  await mkdir(join(f.root, 'hub/test'), { recursive: true });
  await writeFile(join(f.root, 'hub/test/verification-workers.test.ts'), '// dev test\n');
  const git = await cacheRepository(f);
  const dev = await git('rev-parse', 'HEAD');
  // File changes on a task branch must not replace the common dev provenance.
  await writeFile(join(f.root, 'hub/test/verification-workers.test.ts'), '// branch test edit\n');
  await git('add', '.'); await git('commit', '-m', 'task edit');
  await writeFile(join(f.root, '.cland/receipt'), await readFile(new URL('./fixtures/shared-defects/A-3637.log', import.meta.url), 'utf8'));
  assert.equal((await f.ui.request({ type: 'role.set', session: 'coord', role: 'coordinator' })).ok, true);
  const notices = async () => {
    const history = await f.ui.request({ type: 'topic.history', topic: 'agents' });
    return (history.value as { messages: Array<ResultMessage & { kind: string; detail?: Record<string, unknown> }> }).messages.filter(m => m.kind === 'shared-defect');
  };
  const run = async () => {
    const job = await f.launch();
    const result = await eventually('failed task result', async () => (await f.results()).find(m => m.id === `suite:${job.id}`));
    assert.match(result.text, /exit 1/);
    return { job, result };
  };
  const first = await run();
  const retry = await run();
  assert.deepEqual(await notices(), [], 'one branch cannot establish a shared defect');
  await git('checkout', '-b', 'second-task');
  await writeFile(join(f.root, '.cland/receipt'), await readFile(new URL('./fixtures/shared-defects/A-3657.log', import.meta.url), 'utf8'));
  const second = await run();
  const found = await notices();
  assert.equal(found.length, 1);
  const notice = found[0]!;
  assert.deepEqual(notice.to, ['coord']);
  assert.ok(notice.text.includes(first.job.id));
  assert.ok(notice.text.includes(second.job.id));
  assert.ok(!notice.text.includes(retry.job.id), 'the first receipt supplies the original evidence');
  for (const run of [first, second]) {
    assert.ok(notice.text.includes(run.result.artifacts[0]!.id));
    assert.ok(notice.text.includes(run.result.artifacts[0]!.path));
  }
  assert.ok(notice.text.includes(`test file last changed ${dev}`));
  assert.match(notice.text, /hub\/test\/verification-workers.test.ts::verify persists overrides/);
  await git('checkout', '-b', 'third-task');
  await writeFile(join(f.root, '.cland/receipt'), await readFile(new URL('./fixtures/shared-defects/A-3637.log', import.meta.url), 'utf8'));
  await run();
  assert.equal((await notices()).length, 1, 'additional branches do not duplicate the candidate');
});
