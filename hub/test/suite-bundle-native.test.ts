// T3: real Git bundles and receiver fetch prove the exact admitted committed source bytes.
// Lifecycle: scheduler launch and native Git close join before fixture storage removal.
import test from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { suiteUnit } from './suite-unit-fixture.ts';
import { suiteCase } from './suite-case-fixture.ts';
import { fixtureEnvironment } from './fixture-environment.ts';
import { runBundle } from '../src/executor/droplet/run.ts';
import { committedTree } from '../src/verification-tree.ts';
import { serializeTierManifest } from '../src/suite-shards.ts';

for (const occasion of ['dev-t3', 'soak'] as const) test(`${occasion} bundles its captured commit when root dev moves during delivery`, t => suiteCase(t, async ({ setup, step }) => {
  const f = await setup(fixtures => suiteUnit(fixtures, { machineReceiptsOnly: true }, occasion === 'dev-t3' ? 'dev_t3_every="1s"\nshards=2' : ''));
  const env = fixtureEnvironment(f.root, process.env);
  const git = (...args: string[]) => step('native Git close receipt', async () => (await promisify(execFile)('git', args, {
    cwd: f.root, env: fixtureEnvironment(f.root, process.env), timeout: 10000,
  })).stdout.trim());
  await git('init', '-q', '-b', 'dev');
  await git('config', 'user.name', 'Test'); await git('config', 'user.email', 'test@example.com');
  await step('candidate files', async () => {
    await writeFile(join(f.root, '.gitignore'), '.cland/\nhub.db*\n');
    await writeFile(join(f.root, 'source'), 'captured source\n');
    if (occasion === 'dev-t3') {
      const tests = { 'hub/test/one.test.ts': 'T3', 'hub/test/two.test.ts': 'T3' } as const;
      for (const path of Object.keys(tests)) await writeFile(join(f.root, path), '');
      await writeFile(join(f.root, 'hub/test/tiers.json'), serializeTierManifest({ version: 1, tests }));
    }
  });
  await git('add', '.'); await git('commit', '-qm', 'Captured candidate');
  const head = await git('rev-parse', 'HEAD');
  f.candidate.head = head;
  f.candidate.tree = await step('captured tree', () => committedTree(f.root, head, env));
  f.candidate.branch = 'dev';
  f.candidate.selection = { mode: 'full', files: [], reason: 'periodic', fetchedDev: head };
  const transport = f.machine.dependencies.run;
  const deliver = transport.deliver.bind(transport);
  const bundles = new Map<string, string>();
  let advanced: Promise<void> | undefined;
  t.mock.method(transport, 'deliver', async (...[lease, ref, committedOnly]: Parameters<typeof transport.deliver>) => {
    await (advanced ??= (async () => {
      await step('advance root source', () => writeFile(join(f.root, 'source'), 'later source\n'));
      await git('add', 'source'); await git('commit', '-qm', 'Root dev advanced during bundling');
      f.candidate.head = await git('rev-parse', 'HEAD');
      f.candidate.tree = await step('later tree', () => committedTree(f.root, f.candidate.head, env));
      await step('dirty root source', () => writeFile(join(f.root, 'source'), 'uncommitted later source\n'));
    })());
    const path = join(f.root, '.cland', `captured-${ref.id}.bundle`);
    await step('bundle native close', () => runBundle(ref, path, undefined, committedOnly ?? false, env));
    bundles.set(ref.id, path);
    await deliver(lease, ref, committedOnly);
  });
  if (occasion === 'soak') await step('soak submission', () => f.launch({ mode: 'all', occasion, integrated: true, executor: 'droplet', fresh: true }));
  await step('first dispatch', async () => { await f.tick(); await f.suites.settled(); });
  if (occasion === 'dev-t3') await step('periodic dispatch', async () => { await f.tick(); await f.suites.settled(); });
  const job = (await step('durable jobs', () => f.jobs()))[0]!;
  assert.ok(job);
  assert.equal(job.outcome, null, job.outcome?.cause);
  const producers = job.shards ?? [job];
  assert.equal(producers.length, occasion === 'dev-t3' ? 2 : 1);
  assert.equal(bundles.size, producers.length, 'every planned producer completed its own bundle');
  await git('init', '--bare', '-q', join(f.root, '.cland', 'receiver.git'));
  for (const producer of producers) {
    const bundle = bundles.get(producer.id);
    assert.ok(bundle, 'completed producer bundle receipt');
    assert.equal(producer.head, head);
    assert.equal(await git('bundle', 'list-heads', bundle), `${head} refs/cland/suites/${producer.id}`);
    assert.equal(await git('for-each-ref', '--format=%(refname)', `refs/cland/suites/${producer.id}`), '', 'producer ref cleanup completed');
    await git('--git-dir=.cland/receiver.git', 'fetch', bundle, head);
    assert.equal(await git('--git-dir=.cland/receiver.git', 'show', `${head}:source`), 'captured source');
    await step('producer execution receipt', () => f.machine.waits.run(f.machine.started(producer.id)));
    f.machine.finish(producer.id);
  }
  assert.notEqual(await git('rev-parse', 'HEAD'), head);
  await step('collect producer completion receipts', async () => { await f.tick(); await f.suites.settled(); });
  await step('parent completion receipt', () => f.machine.waits.run(f.result(job.id)));
  assert.equal(f.status(job.id).outcome?.code, 0);
  assert.equal(f.status(job.id).head, head);
}, { native: true }));
