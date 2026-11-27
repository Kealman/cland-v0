// T3: real Git bundles and receiver fetch prove the exact admitted committed source bytes.
// Lifecycle: scheduler launch and native Git close join before fixture storage removal.
import test from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { suiteUnit } from './suite-unit-fixture.ts';
import { suiteCase } from './suite-case-fixture.ts';
import { fixtureEnvironment } from './fixture-environment.ts';
import { hostCheckCommand, runBundle } from '../src/executor/droplet/run.ts';
import { committedTree } from '../src/verification-tree.ts';
import { serializeTierManifest } from '../src/suite-shards.ts';

for (const change of ['unchanged', 'untracked', 'tracked', 'head after T0', 'head at delivery', 'tracked failure', 'untracked failure', 'tracked failure remote failure', 'unchanged failure', 'tracked interruption', 'unchanged interruption'] as const) test(`item bundle handles ${change} changes after admission`, t => suiteCase(t, async ({ setup, step }) => {
  const unchanged = change.startsWith('unchanged');
  const gateCode = change.includes('interruption') ? 130 : change.includes('failure') ? 1 : 0;
  const expectedRemoteCode = change.includes('remote failure') ? 2 : 0;
  let remoteCode = 0;
  const f = await setup(fixtures => suiteUnit(fixtures, { executor: 'droplet', machineReceiptsOnly: true }));
  const env = fixtureEnvironment(f.root, process.env);
  const git = (...args: string[]) => step('native Git close', async () => (await promisify(execFile)('git', args, { cwd: f.root, env: fixtureEnvironment(f.root, process.env), timeout: 10000 })).stdout.trim());
  await git('init', '-q', '-b', 'candidate');
  await git('config', 'user.name', 'Test'); await git('config', 'user.email', 'test@example.com');
  await step('source files', async () => {
    await writeFile(join(f.root, '.gitignore'), '.cland/\nhub.db*\n');
    await writeFile(join(f.root, 'source'), 'submitted source\n');
  });
  await git('add', '.'); await git('commit', '-qm', 'Submitted candidate');
  const head = await git('rev-parse', 'HEAD');
  const tree = await git('rev-parse', 'HEAD^{tree}');
  f.candidate.head = head;
  f.candidate.tree = await step('candidate identity', () => committedTree(f.root, head, env));
  const mutate = async () => {
    await step('post-admission write', () => writeFile(join(f.root, change.startsWith('untracked') ? 'native-test.log' : 'source'), 'later bytes\n'));
    if (change.startsWith('head')) {
      await git('add', 'source'); await git('commit', '-qm', 'Later commit');
      f.candidate.head = await git('rev-parse', 'HEAD');
    }
    f.candidate.tree = null;
  };
  let gates = 0, bundles = 0;
  f.hostGate(async ref => {
    gates++;
    if (change !== 'head at delivery' && !unchanged) await mutate();
    return { tree: ref.tree ?? null, command: 'true', code: gateCode };
  });
  const transport = f.machine.dependencies.run;
  const deliver = transport.deliver.bind(transport);
  t.mock.method(transport, 'deliver', async (...[lease, ref, committedOnly]: Parameters<typeof deliver>) => {
    if (change === 'head at delivery') await mutate();
    const bundle = join(f.root, '.cland', 'item.bundle');
    await step('bundle close', () => runBundle(ref, bundle, undefined, committedOnly ?? false, env));
    bundles++;
    await git('init', '--bare', '-q', join(f.root, '.cland', 'receiver.git'));
    await git('--git-dir=.cland/receiver.git', 'fetch', bundle, head);
    assert.equal(await git('--git-dir=.cland/receiver.git', 'rev-parse', `${head}^{tree}`), tree);
    assert.equal(await git('--git-dir=.cland/receiver.git', 'show', `${head}:source`), 'submitted source');
    assert.equal(ref.hostGate?.code, gateCode, 'native gate exit is retained');
    assert.equal(ref.hostGate?.tree, unchanged ? ref.tree : null, 'only positively unchanged inputs retain reusable identity');
    assert.equal(ref.tierReceipts?.find(row => row.tier === 'T0')?.tree, ref.hostGate?.tree ?? undefined, 'uncertain inputs supply no submitted-tree tier proof');
    const checkout = join(f.root, '.cland', 'checkout');
    await git('clone', '--no-hardlinks', '.cland/receiver.git', checkout);
    await git('-C', checkout, 'checkout', '--detach', head);
    await step('receiver receipt directory', () => mkdir(join(checkout, '.cland')));
    const check = hostCheckCommand(ref.hostGate, 'true', `printf remote > .cland/checked; exit ${expectedRemoteCode}`, 'printf reused > .cland/checked');
    remoteCode = await step('detached check close', () => promisify(execFile)('/bin/sh', ['-c', check], { cwd: checkout, env: fixtureEnvironment(f.root, process.env), timeout: 10000 }).then(() => 0, error => { assert.equal(typeof error.code, 'number'); return error.code as number; }));
    assert.equal(remoteCode, expectedRemoteCode);
    assert.equal(await step('detached check receipt', () => readFile(join(checkout, '.cland/checked'), 'utf8')), unchanged ? 'reused' : 'remote');
    assert.equal(await git('for-each-ref', '--format=%(refname)', `refs/cland/suites/${ref.id}`), '');
    await deliver(lease, ref, committedOnly);
  });
  const job = await step('item admission', () => f.launch({ item: 'T-1', executor: 'droplet', fresh: true }));
  await step('delivery settled', () => f.suites.settled());
  assert.equal(gates, 1);
  const savedGate = (await step('durable host gate checkpoint', () => f.jobs())).find(saved => saved.id === job.id)!.hostGate;
  assert.equal(savedGate?.code, gateCode, 'native host exit survives independently of final pipeline outcome');
  assert.match(await step('host gate log receipt', () => f.log(job.id)), new RegExp(`tier T0: exit ${gateCode};`));
  if (gateCode !== 0 && (unchanged || change.includes('interruption'))) {
    assert.match(f.status(job.id).outcome?.cause ?? '', new RegExp(`host check failed \\(exit ${gateCode}\\)`));
    assert.equal(bundles, 0);
    assert.equal(f.machine.calls.some(call => call.step === 'start'), false);
  } else if (change.startsWith('head')) {
    const saved = f.status(job.id);
    assert.match(saved.outcome?.cause ?? '', /head moved/);
    assert.equal(bundles, 0);
    assert.equal(f.machine.calls.some(call => call.step === 'start'), false);
  } else {
    assert.equal(f.status(job.id).outcome, null, 'delivery completed without a hidden assertion failure');
    assert.equal(bundles, 1, f.status(job.id).outcome?.cause);
    await step('executor start', () => f.machine.waits.run(f.machine.started(job.id)));
    await step('completion', () => f.finish(job.id, remoteCode));
    assert.equal(f.status(job.id).outcome?.code, expectedRemoteCode);
    assert.equal(f.status(job.id).head, head);
  }
}, { native: true }));

for (const occasion of ['dev-t3', 'soak', 'stage', 'epic', 'release'] as const) test(`${occasion} bundles its captured commit when root dev moves during delivery`, t => suiteCase(t, async ({ setup, step }) => {
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
  if (occasion !== 'dev-t3') await step('integrated submission', () => f.launch({ mode: 'all', occasion, integrated: true, executor: 'droplet', fresh: true }));
  await step('first dispatch', async () => { await f.tick(); await f.suites.settled(); });
  if (occasion === 'dev-t3') await step('periodic dispatch', async () => { await f.tick(); await f.suites.settled(); });
  const job = (await step('durable jobs', () => f.jobs()))[0]!;
  assert.ok(job);
  assert.equal(job.outcome, null, job.outcome?.cause);
  const producers = job.shards ?? [job];
  assert.equal(producers.length, occasion === 'soak' ? 1 : 2);
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
