// T2: lint policy reads isolated Git objects through an in-process Git adapter; no native children.
import test from 'node:test';
import { treeSources } from '../src/git-tree-sources.ts';
import { caseDeadlines } from './case-deadlines.ts';
import { beforeDirectories, guardDirectoryRemoval } from './process-cleanup.ts';
import assert from 'node:assert/strict';
import childProcess from 'node:child_process';
import { syncBuiltinESMExports } from 'node:module';
import { promisify } from 'node:util';
import { Writable } from 'node:stream';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { requireMergeTestLint } from '../src/merge-test-lint.ts';
import { MergeBatches, BatchRefusal, type BatchBoundary } from '../src/hub/merge-batches.ts';
import type { MergeQueueEntry } from '../src/protocol.ts';
import { prepareMergeBatch, type BatchRepository } from '../src/hub/merge-batch-territory.ts';
import { MergeError, MergeLintReadError } from '../src/merge.ts';
import { suiteUnit } from './suite-unit-fixture.ts';
import { LINT_BASELINE, testLintPolicy } from '../src/test-lint-policy.ts';

const file = 'hub/test/debt.test.ts';
const tiers = 'hub/test/tiers.json';
const baseline = (count: number) => JSON.stringify({ version: 1, files: { [file]: { 'wall-clock-assertion': count } } });
const oid = (text: string) => createHash('sha1').update(text).digest('hex');

test('lint preserves the dev freeze with stale or missing origin/dev while refusing growth', async t => {
  const releases: Array<() => void> = [];
  const owner = caseDeadlines(t, { releaseOnClose: () => { for (const release of releases) release(); }, ownership: { beforeDirectories, guardDirectoryRemoval } });
  return owner.run(async step => {
    const root = await step(() => mkdtemp(join(tmpdir(), 'cland-lint-policy-')));
    owner.adoptRoot(root);
    owner.fixtures.after(() => rm(root, { recursive: true, force: true }));
    await step(() => mkdir(join(root, 'hub/test'), { recursive: true }));
    // The dev freeze records debt added since the stale pre-freeze commit.
    const before = new Map([[tiers, JSON.stringify({ version: 1, tests: { [file]: 'T2' } })], [file, '']]);
    const frozen = new Map(before).set(file, 'assert.ok(Date.now() - started < 1000);').set(LINT_BASELINE, baseline(1));
    const candidate = new Map(frozen);
    const commits = new Map([['before', before], ['frozen', frozen], ['candidate', candidate]]);
    const refs = new Map([['refs/heads/dev', 'frozen'], ['dev', 'frozen'], ['origin/dev', 'before'], ['HEAD', 'candidate']]);
    const resolve = (ref: string) => refs.get(ref) ?? ref;
    const missing = () => Object.assign(new Error('missing Git object'), { code: 128 });
    let historyFault: 'log' | 'rev-list' | undefined, historyFailures = 0, historyAttempts = 0;
    let rootParent = false, noIntroduction = false;
    const execute = (args: string[]): string => {
      if (args[0] === historyFault) { historyAttempts++; if (historyFailures-- > 0) throw Object.assign(new Error(`Git ${historyFault} unavailable`), { code: 128 }); }
      if (args[0] === 'merge-base') {
        const base = resolve(args[1]!);
        if (!commits.has(base)) throw missing();
        return base;
      }
      if (args[0] === 'rev-list') return args.at(-1) === 'frozen' && !rootParent ? 'frozen before' : args.at(-1)!;
      if (args[0] === 'rev-parse') return args[1] === 'frozen^' ? 'before' : resolve(args[1]!);
      if (args[0] === 'log') return noIntroduction ? '' : 'frozen';
      if (args[0] === 'show') {
        const colon = args[1]!.indexOf(':');
        const text = commits.get(resolve(args[1]!.slice(0, colon)))?.get(args[1]!.slice(colon + 1));
        if (text === undefined) throw missing();
        return text;
      }
      if (args[0] === 'ls-tree') return [...commits.get(resolve(args.at(-1)!))!].map(([path, text]) => `100644 blob ${oid(text)}\t${path}\0`).join('');
      throw new Error(`unexpected Git command: ${args.join(' ')}`);
    };
    let readFailures = 0, failedReads = 0;
    let inputFailure = false;
    const inputDone = Promise.withResolvers<void>(), inputEvents: string[] = [];
    let readGroup: { hold: boolean; failures: number; entered: ReturnType<typeof Promise.withResolvers<void>>; release: ReturnType<typeof Promise.withResolvers<void>>; events: string[] } | undefined;
    const fakeExec = (_command: string, args: string[], _options: unknown, callback: (error: Error | null, stdout?: string | Buffer, stderr?: string) => void) => {
      assert.equal(_command, 'git');
      if (args[0] === 'ls-tree' && readGroup) {
        const group = readGroup;
        if (args.at(-1) === 'candidate') {
          group.events.push('attempt');
          if (group.failures-- > 0) { queueMicrotask(() => callback(Object.assign(new Error('Git tree unavailable'), { code: 1 }))); return {}; }
        } else if (args.at(-1) === 'frozen' && group.hold) {
          group.hold = false; group.entered.resolve();
          void group.release.promise.then(() => { group.events.push('sibling-complete'); callback(null, execute(args), ''); });
          return {};
        }
      }
      if (args[0] === 'cat-file') return { stdin: new Writable({ write(chunk, _encoding, done) {
        if (inputFailure) {
          inputFailure = false; inputEvents.push('stdin-error');
          this.emit('error', new Error('synthetic Git input failure'));
          setImmediate(() => { inputEvents.push('native-complete'); callback(null, Buffer.alloc(0), ''); inputDone.resolve(); });
          done(); return;
        }
        if (args[0] === 'cat-file' && readFailures > 0) {
          readFailures--; failedReads++;
          queueMicrotask(() => callback(Object.assign(new Error('Command failed: git cat-file --batch'), { code: 1 })));
          done(); return;
        }
        const blobs = new Map([...commits.values()].flatMap(snapshot => [...snapshot.values()].map(text => [oid(text), text])));
        const output = Buffer.concat(String(chunk).trim().split('\n').map(hash => {
          const content = Buffer.from(blobs.get(hash)!);
          return Buffer.concat([Buffer.from(`${hash} blob ${content.length}\n`), content, Buffer.from('\n')]);
        }));
        queueMicrotask(() => callback(null, output, ''));
        done();
      } }) };
      queueMicrotask(() => {
        try { callback(null, execute(args), ''); } catch (error) { callback(error as Error); }
      });
      return {};
    };
    Object.defineProperty(fakeExec, promisify.custom, { value: (command: string, args: string[], options: unknown) => new Promise((resolve, reject) => {
      fakeExec(command, args, options, (error, stdout, stderr) => error ? reject(error) : resolve({ stdout, stderr }));
    }) });
    const nativeExec = childProcess.execFile;
    childProcess.execFile = fakeExec as typeof childProcess.execFile;
    syncBuiltinESMExports();
    owner.fixtures.after(() => { childProcess.execFile = nativeExec; syncBuiltinESMExports(); });

    inputFailure = true;
    const inputResult = owner.wait('owned Git input error', () => treeSources(root, 'candidate', [file])).then(
      () => { throw new Error('input failure must reject'); },
      error => { inputEvents.push('rejected'); return String(error); });
    await step(() => owner.wait('synthetic Git completion receipt', () => inputDone.promise));
    assert.match(await step(() => inputResult), /synthetic Git input failure/);
    assert.deepEqual(inputEvents, ['stdin-error', 'native-complete', 'rejected']);

    for (const persistent of [false, true]) {
      const group = readGroup = { hold: true, failures: persistent ? 100 : 1, entered: Promise.withResolvers<void>(), release: Promise.withResolvers<void>(), events: [] };
      // Register release before admitting the held attempt, including failed setup.
      releases.push(() => group.release.resolve());
      const pending = owner.wait('owned lint read group', () => requireMergeTestLint(root, { tree: 'candidate', head: 'candidate', base: 'frozen' }));
      // Retain an observer immediately, including the persistent rejection path.
      const result = pending.then(() => ({ ok: true, error: '' }), error => ({ ok: false, error: String(error) }));
      try {
        await owner.wait('held sibling admitted', () => group.entered.promise);
        // Model the sibling's native completion in the next I/O turn. No clock
        // delay or latency claim: the final ordered receipt proves drainage.
        await step(() => new Promise<void>(resolve => setImmediate(() => { group.release.resolve(); resolve(); })));
      } finally { group.release.resolve(); }
      const outcome = await step(() => owner.wait('joined lint attempt', () => result));
      assert.equal(outcome.ok, !persistent);
      if (persistent) assert.match(outcome.error, /after 3 attempts.*Git tree unavailable/);
      assert.deepEqual(group.events, ['attempt', 'sibling-complete', 'attempt', 'attempt']);
      readGroup = undefined;
    }
    before.set(file, frozen.get(file)!);
    for (const command of ['log', 'rev-list'] as const) for (const persistent of [false, true]) {
      historyFault = command; historyFailures = persistent ? 100 : 1; historyAttempts = 0;
      const work = () => requireMergeTestLint(root, { tree: 'candidate', head: 'candidate', base: 'before' });
      if (persistent) await step(() => assert.rejects(work, new RegExp(`after 3 attempts.*Git ${command} unavailable`)));
      else await step(work);
      assert.equal(historyAttempts, persistent ? 3 : 2, 'history errors enter bounded read recovery');
    }
    historyFault = undefined;
    rootParent = true;
    await step(() => requireMergeTestLint(root, { tree: 'candidate', head: 'candidate', base: 'before' }));
    rootParent = false; noIntroduction = true;
    candidate.set(LINT_BASELINE, baseline(0)); candidate.set(file, '');
    await step(() => requireMergeTestLint(root, { tree: 'candidate', head: 'candidate', base: 'before' }));
    before.set(file, '');
    noIntroduction = false; candidate.set(LINT_BASELINE, baseline(1)); candidate.set(file, frozen.get(file)!);

    // Real lint and fake Git feed the durable batch controller; the executor is in process.
    for (const mode of ['transient', 'persistent', 'finding', 'prepare-infrastructure', 'prepare-finding'] as const) {
      const f = await step(async () => { const f = await suiteUnit(owner.fixtures, { executor: 'droplet' }); owner.adoptRoot(f.root); return f; });
      const entries: MergeQueueEntry[] = [1, 2].map(n => ({ item: `T-${n}`, branch: `t/${n}`, head: `${n}`.repeat(40), verdictBase: 'dev', enqueued: f.clock.now().toISOString(), by: { id: 'coord', name: 'coord', role: 'coordinator' } }));
      const landed: string[] = [], dropped: string[] = [];
      let lint = false;
      const boundary: BatchBoundary = {
        entries: () => entries, isLanded: e => landed.includes(e.item), cleanup: async () => {},
        checkout: async c => { f.candidate.head = c.head; f.candidate.tree = c.tree; },
        rebuildReason: async () => null, report: () => {}, notice: () => {},
        build: async () => ({ base: 'frozen', head: 'candidate', tree: 'candidate', cwd: f.root, budgetLines: [] }),
        land: async e => {
          if (lint && (mode !== 'finding' || e.item === 'T-1')) {
            try { await requireMergeTestLint(root, { tree: 'candidate', head: 'candidate', base: 'frozen' }); }
            catch (error) { if (error instanceof MergeError && error.code === 'merge-test-lint') throw new BatchRefusal(e, error.message); throw error; }
          }
          landed.push(e.item); entries.splice(entries.findIndex(entry => entry.item === e.item && entry.head === e.head), 1);
        },
        drop: e => { dropped.push(e.item); entries.splice(entries.findIndex(entry => entry.item === e.item && entry.head === e.head), 1); },
      };
      let runner = new MergeBatches(f.store, f.suites, f.clock, boundary, () => ({ queue: true, batch: 2, batchWaitMs: 0 }));
      owner.fixtures.after(() => runner.close());
      candidate.set(LINT_BASELINE, baseline(mode === 'finding' ? 2 : 1));
      await step(() => runner.tick()); const run = f.suites.status()[0]!;
      await step(() => f.machine.waits.run(f.machine.started(run.id))); await step(() => f.finish(run.id));
      let preparationBlocked = true;
      if (mode.startsWith('prepare-')) {
        const repository: BatchRepository = {
          git: async args => {
            if (args[0] === 'rev-parse') return args[1] === '--is-bare-repository' ? 'false' : args[1] === 'refs/heads/dev' ? 'frozen' : entries.find(e => `refs/heads/${e.branch}` === args[1])!.head;
            if (args[0] === 'merge-tree') return 'candidate\0';
            if (args[0] === 'commit-tree') return 'candidate';
            throw new Error(`unexpected Git command ${args}`);
          },
          facts: async () => {
            if (preparationBlocked) throw mode === 'prepare-finding' ? new MergeError('merge-test-lint', 'baseline grew') : new MergeLintReadError('Git preparation unavailable after 3 attempts');
            return { context: null, workers: 1 };
          },
          identity: async () => 'candidate', checkout: boundary.checkout, remove: boundary.cleanup,
        };
        boundary.build = (id, members, base) => prepareMergeBatch(f.root, id, members, {}, repository, base);
      }
      lint = true; readFailures = mode === 'persistent' ? 100 : mode === 'transient' ? 1 : 0; failedReads = 0;
      await step(() => runner.tick());
      if (mode === 'persistent') {
        assert.ok(failedReads >= 3 && failedReads <= 6, 'three attempts, each with at most two concurrent snapshot reads');
        assert.match(runner.snapshot()?.failed ?? '', /after 3 attempts/);
        assert.match(runner.snapshot()?.failed ?? '', /git cat-file --batch/);
        assert.equal(runner.snapshot()?.run, run.id);
        assert.deepEqual(dropped, []); assert.deepEqual(landed, []);
        readFailures = 0; await step(() => runner.tick());
      }
      if (mode === 'prepare-infrastructure') {
        assert.deepEqual(dropped, []); assert.deepEqual(landed, []);
        assert.equal(runner.snapshot()?.run, run.id);
        assert.match(runner.snapshot()?.failed ?? '', /Git preparation unavailable/);
        await step(() => runner.close()); await step(() => f.reopen());
        runner = new MergeBatches(f.store, f.suites, f.clock, boundary, () => ({ queue: true, batch: 2, batchWaitMs: 0 }));
        await step(() => runner.tick());
        assert.equal(runner.snapshot()?.run, run.id); assert.deepEqual(dropped, []);
        preparationBlocked = false; await step(() => runner.tick());
      }
      if (mode === 'finding') {
        const next = f.suites.status().at(-1)!;
        assert.notEqual(next.id, run.id, 'genuine finding rebuilds the remainder');
        await step(() => f.machine.waits.run(f.machine.started(next.id))); await step(() => f.finish(next.id));
        await step(() => runner.tick());
        assert.deepEqual(dropped, ['T-1']); assert.deepEqual(landed, ['T-2']);
      } else if (mode === 'prepare-finding') assert.deepEqual(dropped, ['T-1', 'T-2']);
      else {
        assert.deepEqual(landed, ['T-1', 'T-2']); assert.deepEqual(dropped, []);
        assert.equal(f.suites.status().length, 1, 'green suite is never repeated');
        if (mode === 'transient') assert.equal(failedReads, 1);
      }
      await step(() => runner.close());
    }
    candidate.set(LINT_BASELINE, baseline(1));

    for (const remote of ['stale', 'missing', 'only remote']) {
      if (remote === 'missing') refs.delete('origin/dev');
      if (remote === 'only remote') {
        refs.delete('refs/heads/dev'); refs.delete('dev');
        refs.set('origin/dev', 'frozen');
      }
      candidate.set(LINT_BASELINE, baseline(1));
      for (const [path, text] of candidate) await step(() => writeFile(join(root, path), text));
      assert.deepEqual(await step(() => testLintPolicy(root)), [], `${remote}: unchanged disk freeze`);
      assert.deepEqual(await step(() => testLintPolicy(root, { tree: 'HEAD', head: 'HEAD' })), [], `${remote}: unchanged committed freeze`);
      candidate.set(LINT_BASELINE, baseline(2));
      await step(() => writeFile(join(root, LINT_BASELINE), baseline(2)));
      for (const options of [{}, { tree: 'HEAD', head: 'HEAD' }]) {
        const findings = await step(() => testLintPolicy(root, options));
        assert.ok(findings.some(f => f.rule === 'lint-baseline' && f.message === `baseline grew: ${file} [wall-clock-assertion]`), `${remote}: refuses growth ${JSON.stringify(findings)}`);
      }
    }
  });
});
