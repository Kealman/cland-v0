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
import { serializeTierManifest, type TierManifest } from '../src/suite-shards.ts';
import type { HubStatus, VerificationQueue } from '../src/protocol.ts';

async function fixture(t: TestContext, coldViolation = false) {
  const clock = new FakeClock();
  const head = 'a'.repeat(40), base = 'b'.repeat(40);
  const repository: TierManifest = JSON.parse(await readFile(new URL('./tiers.json', import.meta.url), 'utf8'));
  const paths = Object.keys(repository.tests).map((path, n) => `${path.startsWith('web/') ? 'web' : 'hub'}/test/case-${String(n).padStart(4, '0')}.test.ts`);
  const files = new Map(paths.map(path => [path, '// component fixture\n']));
  const tiers = Object.values(repository.tests).map(entry => typeof entry === 'string' ? entry : entry.tier);
  files.set('hub/test/tiers.json', serializeTierManifest({ version: 1, tests: Object.fromEntries(paths.map((path, n) => [path, tiers[n]!])) }));
  files.set('hub/test/lint-baseline.json', JSON.stringify({ version: 1, files: Object.fromEntries(paths.map(path => [path, {}])) }));
  const previous = new Map(files);
  const planted = 'hub/test/new-violation.test.ts';
  if (coldViolation) {
    files.set(planted, 'sleep(10);\n');
    files.set('hub/test/tiers.json', serializeTierManifest({ version: 1, tests: { ...JSON.parse(files.get('hub/test/tiers.json')!).tests, [planted]: 'T2' } }));
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
    if (args[0] === 'rev-parse') return args[1] === '--show-prefix' ? '' : head;
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
  childProcess.execFile = fakeExec as typeof childProcess.execFile;
  syncBuiltinESMExports();
  t.after(() => { childProcess.execFile = nativeExec; syncBuiltinESMExports(); });
  // Load modules after installing Git I/O: selectPackageSuite captures its
  // promisified execFile at module initialization.
  const { tempProject, projectHub, connectUi, eventually } = await import('./harness.ts');
  const root = await tempProject(t);
  // Bounded fixture writes avoid flooding the native I/O pool with one worker
  // per manifest path before the admission request under test.
  mkdirSync(join(root, 'hub/test'), { recursive: true });
  mkdirSync(join(root, 'web/test'), { recursive: true });
  for (const [path, text] of files) writeFileSync(join(root, path), text);
  const commandConfig = await verificationFixture(root, { typecheck: 'true', testScript: 'true' });
  await mkdir(join(root, '.cland'), { recursive: true });
  await writeFile(join(root, '.cland/config.toml'), `[verification]\n${commandConfig}`);
  const { TestLintWarmer } = await import('../src/test-lint-policy.ts');
  const hub = await projectHub(t, root, {}, { clock, durationContext: null,
    lintWarmer: new TestLintWarmer(root, {}, row => logs.push(row)),
    git: async args => args[0] === 'for-each-ref' ? `${dev} refs/heads/dev` : null,
    readBase: async () => 'dev',
    scheduleTips: read => { poll = read; if (!coldViolation) void read(); return { poke() {}, stop() {} }; },
    log: row => logs.push(row),
    compatibility: { holder: async () => null, occupied: async () => true } });
  const ui = await connectUi(t, hub.discovery);
  return { root, clock, ui, files, paths, head, logs, eventually, commands, planted,
    holdBatch: () => heldBatch = { completed: false, entered: Promise.withResolvers<void>(), release: Promise.withResolvers<void>() },
    moveDev: async () => { dev = head; await poll(); } };
}

test('cold suite.start refuses a new violating file inside the three-second admission budget', async t => {
  const f = await fixture(t, true);
  const started = f.clock.now().getTime();
  const reply = await f.ui.request({ type: 'suite.start', mode: 'auto', cwd: f.root, dryRun: true });
  assert.equal(reply.ok, false);
  assert.equal((reply as { code?: string }).code, 'verify-test-lint');
  assert.deepEqual((reply as { files?: string[] }).files, [f.planted]);
  assert.equal(reply.error, `verify-test-lint: ${f.planted}:1 [wall-clock-wait] wall-clock-wait count 1 exceeds frozen allowance 0`);
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
    await f.eventually('startup dev facts warmed', () => f.logs.find(row => row.event === 'test-lint-warmed'));
    const gate = f.holdBatch();
    await f.moveDev();
    await gate.entered.promise;
    try { assert.equal((await f.ui.request({ type: 'hub.status', history: true })).ok, true, 'foreground requests answer while background warming is held'); }
    finally { gate.release.resolve(); }
    await f.eventually('released Git batch completed', () => gate.completed ? true : undefined);
    await f.eventually('new dev facts warmed', () => f.logs.find(row => row.event === 'test-lint-warmed' && row.head === f.head));
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
    let finding: string | undefined;
    for (const where of ['committed', 'dirty'] as const) {
      if (where === 'committed') f.files.set(path, 'sleep(10);\n');
      else { f.files.set(path, original); await writeFile(join(f.root, path), 'sleep(10);\n'); }
      for (const dryRun of [false, true]) {
        const refusal = await f.ui.request({ type: 'suite.start', mode: 'auto', cwd: f.root, executor: 'droplet', report: 'agents', to: [], dryRun });
        assert.equal(refusal.ok, false, JSON.stringify(refusal));
        assert.equal((refusal as { code?: string }).code, 'verify-test-lint');
        assert.deepEqual((refusal as { files?: string[] }).files, [path]);
        assert.equal(refusal.error, `verify-test-lint: ${path}:1 [wall-clock-wait] wall-clock-wait count 1 exceeds frozen allowance 0`);
        finding ??= refusal.error;
        assert.equal(refusal.error, finding, 'dry and real submissions return the same finding for disk and immutable sources');
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
