import { pollerDeadline } from './fakes/finish-poller.ts';
import { beforeDirectories, cleanupProcesses, fixtureProcessCensus } from './process-cleanup.ts';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fixture } from './suite-fixture.ts';
import { cacheRepository } from './suite-support.ts';
import { eventually } from './harness.ts';
import type { HubStatus } from '../src/protocol.ts';

const barrier = `import { existsSync, writeFileSync, appendFileSync } from 'node:fs';
${pollerDeadline()}
writeFileSync('.cland/entered', '');
while (!existsSync('.cland/finish')) await new Promise(r => setTimeout(r, 10));
appendFileSync('executions', 'run\\n'); writeFileSync('.cland/completed', '');`;

for (const phase of ['queued', 'running'] as const) {
  for (const path of ['.cland/tasks/note.md', '.cland/RULES.md']) {
    test(`integrated ${phase} run covers a new head after committing ${path}`, async t => {
      const f = await fixture(t, 'node barrier.mjs');
      beforeDirectories(t, async () => {
        await cleanupProcesses(f.root, [], undefined, undefined, []);
        assert.deepEqual(fixtureProcessCensus(f.root), [], 'local candidate left live writers');
      });
      await writeFile(join(f.root, 'barrier.mjs'), barrier);
      const git = await cacheRepository(f);
      await git('checkout', 'dev');
      assert.equal((await f.ui.request({ type: 'role.set', session: 'impl', role: 'coordinator' })).ok, true);
      const head = await git('rev-parse', 'HEAD');
      const lock = join(f.root, 'suite.lock');
      if (phase === 'queued') await mkdir(lock);
      const run = await f.launch();
      if (phase === 'queued') assert.equal(run.pid, null);
      else await eventually('worker entered package test', () => stat(join(f.root, '.cland/entered')).then(() => true, () => undefined));

      await writeFile(join(f.root, path), 'administrative change\n');
      await git('add', '-f', path);
      await git('commit', '-m', 'administrative change');
      const advanced = await git('rev-parse', 'HEAD');
      assert.notEqual(advanced, head);
      if (phase === 'queued') await rm(lock, { recursive: true });
      await writeFile(join(f.root, '.cland/finish'), '');
      if (phase === 'running') await eventually('worker completed package test', () => stat(join(f.root, '.cland/completed')).then(() => true, () => undefined));
      const result = await eventually('integrated result', async () => (await f.results()).find(m => m.id === `suite:${run.id}`));
      assert.match(result.text, /auto exit 0/, result.text);
      const status = (await f.ui.request({ type: 'hub.status', history: true })).value as HubStatus;
      const job = status.suites!.find(job => job.id === run.id)!;
      assert.equal(job.integrated, true);
      assert.equal(job.head, head, 'retain the submitted head as provenance');
      assert.equal(job.cover?.status, 'green');

      const reused = await f.launch();
      assert.equal(reused.cached?.run, run.id, 'the completed run covers the advanced head');
      const cached = await eventually('advanced-head cache result', async () => (await f.results()).find(m => m.id === `suite:${reused.id}`));
      assert.ok(cached.text.includes(`head ${advanced}`), cached.text);
      assert.equal(await readFile(join(f.root, 'executions'), 'utf8'), 'run\n');
    });
  }
}

test('integrated running run rejects a source commit after package completion', async t => {
  const f = await fixture(t, 'node barrier.mjs');
  beforeDirectories(t, async () => {
    await cleanupProcesses(f.root, [], undefined, undefined, []);
    assert.deepEqual(fixtureProcessCensus(f.root), [], 'local candidate left live writers');
  });
  await writeFile(join(f.root, 'barrier.mjs'), barrier);
  const git = await cacheRepository(f);
  await git('checkout', 'dev');
  assert.equal((await f.ui.request({ type: 'role.set', session: 'impl', role: 'coordinator' })).ok, true);
  const run = await f.launch();
  await eventually('worker entered package test', () => stat(join(f.root, '.cland/entered')).then(() => true, () => undefined));
  await writeFile(join(f.root, 'source'), 'changed suite input\n');
  await git('add', 'source');
  await git('commit', '-m', 'source change');
  await writeFile(join(f.root, '.cland/finish'), '');
  await eventually('worker completed package test', () => stat(join(f.root, '.cland/completed')).then(() => true, () => undefined));
  const result = await eventually('source change result', async () => (await f.results()).find(m => m.id === `suite:${run.id}`));
  assert.match(result.text, /exit 1; cancelled: candidate tree changed/, result.text);
  const status = (await f.ui.request({ type: 'hub.status', history: true })).value as HubStatus;
  assert.equal(status.suites!.find(job => job.id === run.id)!.cover?.cause, 'cancel-head');
});
