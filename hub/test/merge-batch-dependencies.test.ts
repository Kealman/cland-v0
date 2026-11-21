// T3: native Git checkout and removal must preserve the shared dependency install.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, realpath, readFile, lstat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { fixtureEnvironment } from './fixture-environment.ts';
import { ownDirectory, beforeDirectories, guardDirectoryRemoval, fenceFixtureCleanup, drainFixtureCleanup } from './process-cleanup.ts';
import { caseDeadlines } from './case-deadlines.ts';
import { stageCase } from './stage-case-fixture.ts';
import { territoryGitAsync } from '../src/territory.ts';
import { checkoutMergeBatch, removeMergeBatch } from '../src/hub/merge-batch-territory.ts';
import { DevT3Probes } from '../src/hub/dev-t3-probe.ts';
import { suiteUnit } from './suite-unit-fixture.ts';
import { committedTreeOrThrow } from '../src/verification-tree.ts';
import { enqueuePreflight, type EnqueueCandidate } from '../src/hub/enqueue-preflight-native.ts';
import { checkedEnqueue, EnqueueCancellations, EnqueueNativeIncomplete } from '../src/hub/enqueue-preflight.ts';
import { suiteCommand, type SuiteCommandClosed } from '../src/suite-command.ts';
import { beginCandidateCommand } from '../src/batch-candidate-ownership.ts';
import type { MergeQueueEntry } from '../src/protocol.ts';

for (const outcome of ['success', 'failure', 'cancel', 'incomplete', 'stray write', 'rejected assertion'] as const) test(`npm enqueue preflight preserves guarded cleanup on ${outcome}`, async t => {
  fenceFixtureCleanup(t);
  const scope = stageCase(t, { native: true });
  const close = Promise.withResolvers<SuiteCommandClosed>();
  let commandEnv: NodeJS.ProcessEnv = {}, receipt: SuiteCommandClosed | undefined, retained: EnqueueNativeIncomplete | undefined;
  let releasing = false, retainedJoined = false, fixtureRoot: string | undefined;
  // Register release and positive-close ownership before any root or child can
  // be admitted. A receipt arriving after release must release the hold too.
  scope.releaseOnClose(() => { releasing = true; if (receipt) close.resolve(receipt); });
  scope.requireClose(async () => { await retained?.settled; retainedJoined = true; });
  const body = scope.run(async step => {
    const root = await step(() => scope.wait('npm fixture setup', async () => {
      const root = await mkdtemp(join(tmpdir(), 'cland-enqueue-npm-'));
      fixtureRoot = root;
      ownDirectory(scope.fixtures, root, { beforeRemove: async () => {
        if (retained) assert.equal(retainedJoined, true, 'metadata continuation joins before root removal');
      } });
      scope.adoptRoot(root);
      await writeFile(join(root, '.gitignore'), 'node_modules\n.cland\n');
      await writeFile(join(root, 'package.json'), JSON.stringify({ scripts: { check: 'node check.cjs' } }));
      await writeFile(join(root, 'check.cjs'), `const fs = require('fs'); for (const key of ['HOME','XDG_CONFIG_HOME','XDG_CACHE_HOME','XDG_DATA_HOME','XDG_STATE_HOME']) { fs.mkdirSync(process.env[key], {recursive:true}); fs.writeFileSync(require('path').join(process.env[key], 'sentinel'), 'owned'); } ${outcome === 'stray write' ? "fs.writeFileSync('stray', 'must refuse');" : ''} process.exit(${outcome === 'failure' ? 1 : 0});`);
      await writeFile(join(root, 'package-lock.json'), JSON.stringify({ packages: {} }));
      await mkdir(join(root, 'node_modules'), { recursive: true });
      await writeFile(join(root, 'node_modules/.package-lock.json'), JSON.stringify({ packages: {} }));
      return root;
    }));
    const env = fixtureEnvironment(root, process.env);
    const git = (cwd: string, args: string[]) => territoryGitAsync(cwd, args, false, undefined, env);
    await step(() => scope.wait('npm repository setup', async () => {
      await git(root, ['init', '-b', 'dev']); await git(root, ['add', '.']); await git(root, ['commit', '-qm', 'npm fixture']);
    }));
    const { head, tree } = await step(() => scope.wait('npm candidate identity setup', async () => {
      const head = await git(root, ['rev-parse', 'HEAD']);
      return { head, tree: await committedTreeOrThrow(root, head, env) };
    }));
    const candidate = { base: head, head, tree, cwd: join(root, '.cland/run/merge-batches/npm'), budgetLines: [] };
    const member: MergeQueueEntry = { item: 'T-1', branch: 't/1', head, verdictBase: 'dev', enqueued: '', by: { id: 'fixture', name: 'fixture', role: 'coordinator' } };
    const cancellations = new EnqueueCancellations();
    const validate = cancellations.capture('T-1');
    let checked: EnqueueCandidate;
    const backend = enqueuePreflight(root, async () => ({ member, base: head }), env, {
      prepareMergeBatch: async () => candidate, checkoutMergeBatch: async (root, value, env) => { checked = value as EnqueueCandidate; await checkoutMergeBatch(root, value, env); }, removeMergeBatch, committedTreeOrThrow,
      verificationCommands: async () => ({ check: 'npm run check', test: '', prepare: '' }), beginCandidateCommand, forward: () => {},
      suiteCommand: async (...args) => {
        commandEnv = args[2]!;
        const result = await suiteCommand(...args);
        assert.equal(result.closure?.state, 'closed');
        receipt = result.closure as SuiteCommandClosed;
        if (releasing) close.resolve(receipt);
        if (outcome === 'cancel') cancellations.cancel('T-1');
        if (outcome === 'incomplete' || outcome === 'rejected assertion') return { ...result, closure: { ...receipt, state: 'incomplete', reason: 'native-tree-unverified', whenClosed: close.promise } };
        return result;
      },
    });
    await step(() => scope.wait('real npm preflight and removal', async () => {
      const run = () => checkedEnqueue(backend, async () => { validate(); return 'queued'; });
      if (outcome === 'success') assert.equal(await run(), 'queued');
      else if (outcome === 'incomplete' || outcome === 'rejected assertion') {
        try { await run(); assert.fail('incomplete closure cannot enqueue'); }
        catch (error) { assert.ok(error instanceof EnqueueNativeIncomplete); retained = error; }
        assert.equal(await git(candidate.cwd, ['status', '--porcelain']), '');
        await assert.rejects(() => backend.remove(checked), /command closure unconfirmed/);
        assert.equal(await readFile(join(commandEnv.HOME!, 'sentinel'), 'utf8'), 'owned');
        if (outcome === 'rejected assertion') assert.fail('controlled assertion before native closure release');
        close.resolve(receipt!); await retained.settled;
      } else await assert.rejects(run, outcome === 'failure' ? /exit 1/ : outcome === 'cancel' ? /cancelled during preflight/ : /modified or untracked files/);
    }));
    if (outcome === 'stray write') {
      assert.equal(await readFile(join(candidate.cwd, 'stray'), 'utf8'), 'must refuse');
      return; // Fixture owner removes the disposable repository after all writers closed.
    }
    await step(() => scope.wait('candidate and account removal receipts', async () => {
      await assert.rejects(lstat(candidate.cwd), { code: 'ENOENT' });
      for (const key of ['HOME', 'XDG_CONFIG_HOME', 'XDG_CACHE_HOME', 'XDG_DATA_HOME', 'XDG_STATE_HOME']) await assert.rejects(lstat(commandEnv[key]!), { code: 'ENOENT' });
    }));
  });
  if (outcome === 'rejected assertion') {
    await assert.rejects(body, /controlled assertion before native closure release/);
    // close() supplies its own cleanup deadline; enrolling this drain as a
    // pending body observation would make the owner attempt to join itself.
    await drainFixtureCleanup(t);
    assert.ok(retained);
    assert.equal(retainedJoined, true);
    await scope.wait('rejected assertion root removal receipt', () => assert.rejects(lstat(fixtureRoot!), { code: 'ENOENT' }));
  } else await body;
});

for (const kind of ['batch', 'periodic probe'] as const) test(`${kind} checkout shares dependencies and removal preserves the root install`, t => {
  const scope = caseDeadlines(t, { ownership: { beforeDirectories, guardDirectoryRemoval } });
  return scope.run(async step => {
  const { root, env, candidate, packages } = await step(() => scope.wait('native fixture setup', async () => {
  const root = await mkdtemp(join(tmpdir(), 'cland-batch-deps-'));
  ownDirectory(scope.fixtures, root);
  scope.adoptRoot(root);
  const env = fixtureEnvironment(root, process.env);
  const git = (args: string[]) => territoryGitAsync(root, args, false, undefined, env);
  const packages = { 'node_modules/@modelcontextprotocol/sdk': { version: '1.0.0' }, 'node_modules/playwright-core': { version: '1.0.0' } };
  await writeFile(join(root, 'package.json'), '{}');
  await writeFile(join(root, 'package-lock.json'), JSON.stringify({ packages }));
  await writeFile(join(root, '.gitignore'), 'node_modules\n.cland\n');
  for (const path of Object.keys(packages)) {
    await mkdir(join(root, path), { recursive: true });
    await writeFile(join(root, path, 'package.json'), JSON.stringify({ version: '1.0.0', main: 'index.js' }));
    await writeFile(join(root, path, 'index.js'), 'module.exports = "dependency sentinel";');
  }
  await writeFile(join(root, 'node_modules/.package-lock.json'), JSON.stringify({ packages }));
  await mkdir(join(root, '.cland/tasks'), { recursive: true });
  await writeFile(join(root, '.cland/tasks/T-1.md'), 'fixture task');
  await writeFile(join(root, '.cland/RULES.md'), 'fixture rules');
  await git(['init', '-b', 'dev']); await git(['add', '.']);
  await git(['add', '-f', '.cland/tasks/T-1.md', '.cland/RULES.md']);
  await git(['commit', '-qm', 'fixture']);
  const head = await git(['rev-parse', 'HEAD']);
  const tree = await committedTreeOrThrow(root, head, env);
  assert.notEqual(tree, await git(['rev-parse', 'HEAD^{tree}']));
  const candidate = { base: head, head, tree, cwd: join(root, '.cland/run/merge-batches', 'dev-t3-fixture'), budgetLines: [] };
  return { root, env, candidate, packages };
  }));
  const f = kind === 'periodic probe' ? await step(() => scope.wait('probe owner setup', () => suiteUnit(scope.fixtures))) : null;
  const repository = f ? new DevT3Probes(f.store, f.suites, root, env).repository : null;
  const checkout = () => repository ? repository.checkout(candidate) : checkoutMergeBatch(root, candidate, env);
  await step(() => scope.wait('native candidate checkout', checkout));
  assert.equal((await step(() => scope.wait('dependency symlink receipt', () => lstat(join(candidate.cwd, 'node_modules'))))).isSymbolicLink(), true);
  for (const path of Object.keys(packages)) {
    const actual = await step(() => scope.wait('candidate dependency receipt', () => realpath(join(candidate.cwd, path))));
    const expected = await step(() => scope.wait('root dependency receipt', () => realpath(join(root, path))));
    assert.equal(actual, expected);
  }
  assert.equal(createRequire(join(candidate.cwd, 'web/test/fixture.js'))('playwright-core'), 'dependency sentinel');
  await step(() => scope.wait('persisted checkout ownership', checkout));
  await step(() => scope.wait('guarded candidate removal', () => repository ? repository.remove(candidate) : removeMergeBatch(root, candidate, env)));
  for (const path of Object.keys(packages)) assert.match(await step(() => scope.wait('root dependency sentinel', () => readFile(join(root, path, 'index.js'), 'utf8'))), /dependency sentinel/);
  await step(() => scope.wait('candidate removal receipt', () => assert.rejects(lstat(candidate.cwd), { code: 'ENOENT' })));
  });
});
