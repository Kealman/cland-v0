// T2: real suite.start frames, in-process hub and Git object adapter; no native children.
// Git startup costs use FakeClock so repository-scale admission needs no wall-clock wait.
import { verificationFixture } from './verification-fixture.ts';
import { mkdirSync, writeFileSync } from 'node:fs';
import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import childProcess from 'node:child_process';
import { syncBuiltinESMExports } from 'node:module';
import { promisify } from 'node:util';
import { EventEmitter } from 'node:events';
import { Writable } from 'node:stream';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { FakeClock } from './fake-clock.ts';
import { stageCase } from './stage-case-fixture.ts';
import { testSetupWaitMs } from './until.ts';
import type { TierManifest } from '../src/suite-shards.ts';
import type { HubStatus, VerificationQueue } from '../src/protocol.ts';
import YAML from 'yaml';

async function fixture(t: TestContext, coldViolation = false, durations = false, owner?: ReturnType<typeof stageCase>) {
  // The owned crew uses stageCase's full native guard, including its positive controls.
  if (!owner) {
    const forbiddenLaunch = () => { throw new Error('native launch forbidden in admission fixture'); };
    const launchGuards = ['exec', 'execSync', 'execFileSync', 'spawn', 'spawnSync', 'fork'] as const;
    const originals = launchGuards.map(key => childProcess[key]);
    for (const key of launchGuards) Object.assign(childProcess, { [key]: forbiddenLaunch });
    Object.defineProperty(forbiddenLaunch, promisify.custom, { value: forbiddenLaunch, configurable: true });
    syncBuiltinESMExports();
    assert.throws(() => childProcess.spawn('positive-control'), /native launch forbidden/); // cland-allow-child-env: positive control calls the installed throwing fake, never a process
    assert.throws(() => promisify(childProcess.exec)('positive-control'), /native launch forbidden/); // cland-allow-child-env: positive control calls the installed throwing custom promisifier, never a process
    t.after(() => { for (const [n, key] of launchGuards.entries()) Object.assign(childProcess, { [key]: originals[n] }); syncBuiltinESMExports(); });
  }
  const clock = new FakeClock();
  const head = 'a'.repeat(40), base = 'b'.repeat(40);
  const repository: TierManifest = JSON.parse(await readFile(new URL('./tiers.json', import.meta.url), 'utf8'));
  const paths = durations ? ['hub/test/case-0000.test.ts', 'hub/test/case-0001.test.ts', 'hub/test/case-0002.test.ts']
    : Object.keys(repository.tests).map((path, n) => `${path.startsWith('web/') ? 'web' : 'hub'}/test/case-${String(n).padStart(4, '0')}.test.ts`);
  const files = new Map(paths.map(path => [path, '// component fixture\n']));
  if (durations) {
    const baseline = JSON.parse(await readFile(new URL('./durations.json', import.meta.url), 'utf8'));
    const names = Object.keys(baseline.tests) as string[];
    const tests: Record<string, number> = {};
    const titles = new Map(paths.map(path => [path, [] as string[]]));
    for (const [n, name] of names.entries()) {
      const path = paths[n % paths.length]!;
      const title = name.slice(name.indexOf('::') + 2);
      titles.get(path)!.push(title);
      tests[`${path}::${title}`] = 0.001;
    }
    // Register the same titles through a dynamic loop: identity lint still
    // visits each source, without a quadratic literal-pattern search per key.
    for (const [path, names] of titles) files.set(path, `for (const title of ${JSON.stringify(names)}) test(title, () => {});\n`);
    files.set('hub/test/durations.json', JSON.stringify({ version: 1, source: { artifacts: [], commit: 'fixture' }, budget: baseline.budget, files: Object.fromEntries(paths.map(path => [path, { seconds: 0.01, tests: titles.get(path)!.length }])), tests, allow: {} }));
  }
  const tiers = Object.values(repository.tests).map(entry => typeof entry === 'string' ? entry : entry.tier);
  files.set('hub/test/tiers.json', JSON.stringify({ version: 1, tests: Object.fromEntries(paths.map((path, n) => [path, durations ? 'T2' : tiers[n]!])) }));
  files.set('hub/test/lint-baseline.json', JSON.stringify({ version: 1, files: Object.fromEntries(paths.map(path => [path, {}])) }));
  const previous = new Map(files);
  const planted = 'hub/test/new-violation.test.ts';
  if (coldViolation) {
    files.set(planted, 'sleep(10);\n');
    files.set('hub/test/tiers.json', JSON.stringify({ version: 1, tests: Object.fromEntries(Object.entries({ ...JSON.parse(files.get('hub/test/tiers.json')!).tests, [planted]: 'T2' }).sort(([a], [b]) => a.localeCompare(b))) }));
  }
  const snapshots = new Map([[head, files], [base, previous]]);
  let dev = base;
  let poll!: () => Promise<void>;
  const logs: Record<string, unknown>[] = [];
  const commands: string[][] = [];
  let heldBatch: { completed: boolean; entered: ReturnType<typeof Promise.withResolvers<void>>; release: ReturnType<typeof Promise.withResolvers<void>> } | undefined;
  // Many manifest paths intentionally share one source blob. Model Git's object
  // deduplication instead of rehashing it for every fake command and duplicate path.
  const oids = new Map<string,string>();
  const oidOf = (text: string) => {
    let oid = oids.get(text);
    if (!oid) { oid = createHash('sha1').update(text).digest('hex'); oids.set(text,oid); }
    return oid;
  };
  const missing = () => Object.assign(new Error('missing Git object'), { code: 128 });
  function execute(args: string[]): string {
    if (args[0] === 'config') throw missing();
    if (args[0] === 'rev-parse') return args[1] === '--show-prefix' ? '' : args[1] === '--show-toplevel' ? root : head;
    if (args[0] === 'branch') return 'dev';
    if (args[0] === 'merge-base') return base;
    if (['fetch', 'diff', 'diff-tree', 'status', 'ls-files', 'read-tree', 'rm'].includes(args[0]!)) return '';
    if (args[0] === 'write-tree') return 'c'.repeat(40);
    if (args[0] === 'show') {
      const [ref, path] = args[1]!.split(':');
      const text = snapshots.get(ref!)?.get(path!);
      if (text === undefined) throw missing();
      return text;
    }
    if (args[0] === 'ls-tree') {
      const snapshot = snapshots.get(args.find(arg => snapshots.has(arg))!)!;
      if (args.includes('--name-only')) return [...snapshot.keys()].join('\0') + '\0';
      return [...snapshot].map(([path, text]) => `100644 blob ${oidOf(text)}\t${path}\0`).join('');
    }
    throw new Error(`unexpected Git command: ${args.join(' ')}`);
  }
  const fakeExec = (file: string, args: string[], options: { encoding?: string }, callback: (error: Error | null, stdout?: string | Buffer, stderr?: string) => void) => {
    assert.equal(file, 'git');
    commands.push(args);
    clock.block(50); // Model process startup under load, independently of host speed.
    const child = new EventEmitter() as childProcess.ChildProcess;
    if (args[0] === 'cat-file') {
      child.stdin = new Writable({ write(chunk, _encoding, done) {
        const blobs = new Map([...snapshots.values()].flatMap(snapshot => [...snapshot.values()].map(text => [oidOf(text), text])));
        const output = Buffer.concat(String(chunk).trim().split('\n').map(oid => {
          const content = Buffer.from(blobs.get(oid)!);
          return Buffer.concat([Buffer.from(`${oid} blob ${content.length}\n`), content, Buffer.from('\n')]);
        }));
        if (heldBatch) {
          const gate = heldBatch; heldBatch = undefined;
          gate.entered.resolve();
          void gate.release.promise.then(() => { callback(null, output, ''); gate.completed = true; });
        } else queueMicrotask(() => callback(null, output, ''));
        done();
      } });
    } else queueMicrotask(() => {
      try { callback(null, execute(args), ''); } catch (error) { callback(error as Error, '', ''); }
    });
    return child;
  };
  // Native execFile's custom promisifier closes over the native function.
  Object.defineProperty(fakeExec, promisify.custom, { value: (file: string, args: string[], options: { encoding?: string }) => new Promise((resolve, reject) => {
    fakeExec(file, args, options, (error, stdout, stderr) => error ? reject(error) : resolve({ stdout, stderr }));
  }) });
  const nativeExec = childProcess.execFile;
  if (owner) owner.patch(childProcess, 'execFile', fakeExec);
  else {
    childProcess.execFile = fakeExec as typeof childProcess.execFile;
    syncBuiltinESMExports();
    t.after(() => { childProcess.execFile = nativeExec; syncBuiltinESMExports(); });
  }
  // Load modules after installing Git I/O: selectPackageSuite captures its
  // promisified execFile at module initialization.
  const { tempProject, projectHub, connectUi, eventually } = await import('./harness.ts');
  const root = await tempProject(owner?.fixtures ?? t);
  owner?.adoptRoot(root); // Capture even a late acquisition before any next step.
  // Bounded fixture writes avoid flooding the native I/O pool with one worker
  // per manifest path before the admission request under test.
  mkdirSync(join(root, 'hub/test'), { recursive: true });
  mkdirSync(join(root, 'web/test'), { recursive: true });
  for (const [path, text] of files) writeFileSync(join(root, path), text);
  const commandConfig = await verificationFixture(root, { typecheck: 'true', testScript: 'true' });
  await mkdir(join(root, '.cland'), { recursive: true });
  await writeFile(join(root, '.cland/config.toml'), `[verification]\n${commandConfig}`);
  const { TestLintWarmer } = await import('../src/test-lint-policy.ts');
  const { suiteCandidate } = await import('../src/hub/suite-candidate.ts');
  const { fixtureEnvironment } = await import('./fixture-environment.ts');
  const trace: Record<string, number[]> = {};
  const candidate = suiteCandidate(fixtureEnvironment(root, process.env), (step, ms) => { (trace[step] ??= []).push(ms); });
  const inspections = new Set<Promise<unknown>>();
  owner?.requireClose(async () => {
    while (inspections.size) await Promise.allSettled([...inspections]);
    assert.equal(inspections.size, 0, 'all candidate computations positively settled before hub close');
  });
  const inspect = candidate.inspect;
  candidate.inspect = (...args) => {
    const work = inspect(...args);
    inspections.add(work);
    void work.then(() => inspections.delete(work), () => inspections.delete(work));
    return work;
  };
  const hub = await projectHub(owner?.fixtures ?? t, root, {}, { clock, durationContext: null, ...(owner ? { lifecycle: owner } : {}),
    candidate,
    lintWarmer: new TestLintWarmer(root, {}, row => logs.push(row), { clock, analyze: async entries => {
      const { testLintFactRecord } = await import('../src/test-lint.ts');
      return { files: entries.length, peakHeapBytes: 0, heapSizeLimitBytes: 0, facts: entries.map(e => testLintFactRecord(e.file, e.text, e.entry)) };
    } }),
    git: async args => args[0] === 'for-each-ref' ? `${dev} refs/heads/dev` : null,
    readBase: async () => 'dev',
    scheduleTips: read => { poll = read; if (!coldViolation) void read(); return { poke() {}, stop() {} }; },
    log: row => logs.push(row),
    compatibility: { holder: async () => null, occupied: async () => true } });
  const ui = await connectUi(owner?.fixtures ?? t, hub.discovery);
  owner?.requireClose(async () => { await hub.verificationSettled(); await hub.stopped; });
  return { root, clock, ui, files, paths, head, logs, eventually, commands, planted, trace,
    holdBatch: () => heldBatch = { completed: false, entered: Promise.withResolvers<void>(), release: Promise.withResolvers<void>() },
    moveDev: async () => { dev = head; await poll(); } };
}

test('three concurrent admissions share repository-sized duration tokenization', async t => {
  const owner = stageCase(t);
  await owner.wait('complete crew callback', () => owner.run(async step => {
    const f = await step(() => owner.wait('crew fixture acquisition', () => fixture(t, false, true, owner), testSetupWaitMs()));
    const parses = new Map<string, number>();
    const parse = YAML.parseDocument;
    owner.patch(YAML, 'parseDocument', (source: string, ...options: unknown[]) => {
      if (source === f.files.get('hub/test/durations.json')) parses.set(source, (parses.get(source) ?? 0) + 1);
      return Reflect.apply(parse, YAML, [source, ...options]);
    });
    const start = performance.now();
    const replies = await step(() => Promise.all(Array.from({ length: 3 }, (_, n) => owner.wait(`crew request ${n + 1} completed`, () => f.ui.request({ type: 'suite.start', mode: 'auto', cwd: f.root, dryRun: true }, 90000), 90000))));
    const elapsed = performance.now() - start;
    for (const reply of replies) assert.equal(reply.ok, true, reply.error);
    t.diagnostic(`three fake-only admissions, repository-sized duration identities: ${elapsed.toFixed(1)} ms wall; provider and tree bundle excluded`);
    t.diagnostic(`overlapping concurrent phase wall ms: ${JSON.stringify(f.trace)}`);
    assert.deepEqual([...parses.values()], [1], 'the exact duration manifest is tokenized once across all three admissions');
  }), testSetupWaitMs() + 90000);
});

test('cold suite.start refuses a new violating file inside the three-second admission budget', async t => {
  const f = await fixture(t, true);
  const started = f.clock.now().getTime();
  const reply = await f.ui.request({ type: 'suite.start', mode: 'auto', cwd: f.root, dryRun: true });
  assert.equal(reply.ok, false);
  assert.equal((reply as { code?: string }).code, 'verify-test-lint', reply.error);
  assert.deepEqual((reply as { files?: string[] }).files, [f.planted]);
  assert.equal(reply.error, `verify-test-lint: ${f.planted}:1 [wall-clock-wait] wall-clock-wait count 1 exceeds frozen allowance 0\nsource: HEAD ${f.head}`);
  const elapsed = f.clock.now().getTime() - started;
  t.diagnostic(`${elapsed} ms modeled admission; ${f.commands.filter(args => args[0] === 'show').length} git show calls`);
  assert.ok(elapsed < 3000, `${elapsed} ms cold refusal exceeds the 3 s budget`);
  const queue = (await f.ui.request({ type: 'suite.queue' })).value as VerificationQueue;
  assert.deepEqual(queue.waiters, []);
  assert.deepEqual(queue.remote, []);
  assert.equal(queue.holder, null);
});

test('suite.start admission over a repository-sized manifest', async t => {
  const f = await fixture(t);
  await t.test('replies with five seconds of margin inside the CLI deadline', async t => {
    const started = f.clock.now().getTime();
    const reply = await f.ui.request({ type: 'suite.start', mode: 'auto', cwd: f.root, dryRun: true }, 15000);
    assert.equal(reply.ok, true, reply.error);
    const lines = (reply.value as { lines: string[] }).lines;
    assert.ok(lines.includes('reachability diagnostics: `cland verify --dry-run --diagnostics`'));
    assert.ok(!lines.some(line => line.startsWith('test lint reachable:')));
    const elapsed = f.clock.now().getTime() - started;
    t.diagnostic(`${f.paths.length} manifest files: ${elapsed} ms modeled admission`);
    assert.ok(elapsed < 10000, `${elapsed} ms admission leaves less than five seconds before the 15 s CLI deadline`);
  });
  await t.test('warms dev facts after startup and each observed dev move', async () => {
    await f.clock.advance(1000);
    await f.eventually('startup dev facts warmed', () => f.logs.find(row => row.event === 'test-lint-warmed'));
    const gate = f.holdBatch();
    await f.moveDev();
    await f.clock.advance(1000);
    await gate.entered.promise;
    try { assert.equal((await f.ui.request({ type: 'hub.status', history: true })).ok, true, 'foreground requests answer while background warming is held'); }
    finally { gate.release.resolve(); }
    await f.eventually('released Git batch completed', () => gate.completed ? true : undefined);
    await f.eventually('new dev facts warmed', () => f.logs.find(row => row.event === 'test-lint-warmed' && row.head === f.head));
  });
  await t.test('warmer shutdown cancels and joins its active analysis before returning', async t => {
    const owner = stageCase(t, { native: true });
    let warmer: import('../src/test-lint-policy.ts').TestLintWarmer | undefined;
    const result = Promise.withResolvers<import('../src/test-lint-worker-runner.ts').LintWarmReceipt>();
    const closed = Promise.withResolvers<import('../src/test-lint-worker-runner.ts').LintExit>();
    void result.promise.catch(() => {});
    let admitted = false;
    let stopped = false, settled = false;
    const release = () => {
      closed.resolve({ code: null, signal: 'SIGTERM' });
      result.reject(new Error('fixture analysis released'));
    };
    owner.releaseOnClose(release);
    owner.requireClose(async () => {
      if (warmer) await owner.wait('warmer positive close before shared root cleanup', () => warmer!.close(), testSetupWaitMs());
    });
    owner.adoptRoot(f.root);
    await owner.wait('whole warmer shutdown callback', () => owner.run(async step => {
      const { TestLintWarmer } = await step(() => owner.wait('warmer module setup', () => import('../src/test-lint-policy.ts'), testSetupWaitMs()));
      warmer = new TestLintWarmer(f.root, {}, () => {}, { clock: f.clock, start: () => {
        admitted = true;
        return { ready: Promise.resolve(123), result: result.promise, closed: closed.promise, close: () => { stopped = true; return closed.promise; } };
      } });
      warmer.request(f.head);
      await step(() => owner.wait('fake analysis source preparation and admission', async () => {
        await f.clock.advance(1000);
        await f.eventually('fake analysis admitted before shutdown', () => admitted ? true : undefined);
      }, testSetupWaitMs()));
      const closing = warmer.close().then(() => { settled = true; });
      assert.equal(stopped, true); assert.equal(settled, false);
      release();
      await step(() => owner.wait('warmer shutdown native-owner join', () => closing, testSetupWaitMs()));
      assert.equal(settled, true);
    }), testSetupWaitMs() * 4);
  });
  await t.test('CLI opt-in diagnostics survive the normal deadline and retain reachability', async () => {
    const { runSuiteCommand } = await import('../src/cli/suite.ts');
    const previous = process.env.CLAND_HUB_FILE;
    process.env.CLAND_HUB_FILE = join(f.root, '.cland/hub.json');
    const gate = f.holdBatch();
    let output = '', settled = false;
    try {
      await assert.rejects(runSuiteCommand(['--diagnostics'], f.root), /--diagnostics requires --dry-run/);
      const request = runSuiteCommand(['--dry-run', '--diagnostics'], f.root, { clock: f.clock, env: {}, out: text => { output += text; } });
      void request.then(() => { settled = true; }, () => { settled = true; });
      await gate.entered.promise;
      await f.clock.advance(15001);
      assert.equal(settled, false, 'opt-in diagnostics have their own longer request deadline');
      gate.release.resolve();
      await f.eventually('diagnostic Git batch completed', () => gate.completed ? true : undefined);
      assert.equal(await request, 0);
      assert.match(output, /test lint reachable:/);
      assert.doesNotMatch(output, /reachability diagnostics:/);
    } finally {
      gate.release.resolve();
      if (previous === undefined) delete process.env.CLAND_HUB_FILE;
      else process.env.CLAND_HUB_FILE = previous;
    }
  });
  await t.test('refuses committed or dirty violations before queue or droplet reservations', async () => {
    const path = f.paths[0]!;
    const original = f.files.get(path)!;
    const before = (await f.ui.request({ type: 'hub.status', history: true })).value as HubStatus;
    let stableCause: string | undefined;
    for (const where of ['committed', 'dirty'] as const) {
      let finding: string | undefined;
      if (where === 'committed') f.files.set(path, 'sleep(10);\n');
      else { f.files.set(path, original); await writeFile(join(f.root, path), 'sleep(10);\n'); }
      for (const dryRun of [false, true]) {
        const refusal = await f.ui.request({ type: 'suite.start', mode: 'auto', cwd: f.root, executor: 'droplet', report: 'agents', to: [], dryRun });
        assert.equal(refusal.ok, false, JSON.stringify(refusal));
        assert.equal((refusal as { code?: string }).code, 'verify-test-lint');
        assert.deepEqual((refusal as { files?: string[] }).files, [path]);
        assert.equal(refusal.error, `verify-test-lint: ${path}:1 [wall-clock-wait] wall-clock-wait count 1 exceeds frozen allowance 0\nsource: ${where === 'committed' ? `HEAD ${f.head}` : 'worktree'}`);
        const cause = refusal.error!.split('\n')[0]!;
        stableCause ??= cause;
        assert.equal(cause, stableCause, 'HEAD and worktree retain the identical refusal cause');
        finding ??= refusal.error;
        assert.equal(refusal.error, finding, 'dry and real submissions return identical cause and provenance for each source');
        const queue = (await f.ui.request({ type: 'suite.queue' })).value as VerificationQueue;
        assert.deepEqual(queue.waiters, []);
        assert.deepEqual(queue.remote, []);
        assert.equal(queue.holder, null);
        assert.deepEqual(((await f.ui.request({ type: 'hub.status', history: true })).value as HubStatus).suites, before.suites);
        assert.deepEqual(await readdir(join(f.root, '.cland/run/suites')).catch(() => []), []);
        assert.deepEqual(await readdir(join(f.root, '.cland/run/executor/leases')).catch(() => []), []);
      }
    }
  });
});
