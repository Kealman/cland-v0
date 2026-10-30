// T3: native Git stdio resolves the original lint freeze through moving dev ancestry.
// This contract retains the real commit/merge history; policy admission cases are T2.
import { fixtureEnvironment } from './fixture-environment.ts';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { tempProject } from './harness.ts';
import { serializeTierManifest } from '../src/suite-shards.ts';

test('the first lint baseline keeps its freeze when dev moves debt before publication', async t => {
  const { testLintPolicy, shrinkTestLint, LINT_BASELINE } = await import('../src/test-lint-policy.ts');
  const root = await tempProject(t, 'cland-lint-freeze-history-');
  const git = (...args: string[]) => promisify(execFile)('git', args, { env: fixtureEnvironment(root, process.env), cwd: root }).then(result => result.stdout.trim());
  await git('init', '-qb', 'dev');
  await git('config', 'user.name', 'Lint history fixture');
  await git('config', 'user.email', 'fixture@example.invalid');
  await mkdir(join(root, 'hub/test'), { recursive: true });
  const native = 'hub/test/native.test.ts', component = 'hub/test/component.test.ts';
  const assertion = 'const wrote = Date.now(); assert.ok(Date.now() - wrote < 1000);';
  const nativeSource = '// T3: native watcher latency\n' + assertion;
  await writeFile(join(root, native), nativeSource);
  await writeFile(join(root, 'hub/test/tiers.json'), serializeTierManifest({ version: 1, tests: { [native]: 'T3' } }));
  await git('add', 'hub'); await git('commit', '-qm', 'Native latency debt');
  await git('update-ref', 'refs/remotes/origin/dev', 'HEAD');
  await git('checkout', '-qb', 'candidate');
  const frozen = { version: 1, files: { [native]: { 'wall-clock-assertion': 1 } } };
  await writeFile(join(root, LINT_BASELINE), JSON.stringify(frozen));
  await git('add', 'hub'); await git('commit', '-qm', 'First freeze');
  assert.deepEqual(await testLintPolicy(root), []);
  // An inflated first freeze must not become its own authority.
  await writeFile(join(root, LINT_BASELINE), JSON.stringify({ version: 1, files: { [native]: { 'wall-clock-assertion': 2 } } }));
  await git('commit', '-qam', 'Inflated freeze', '--amend');
  assert.ok((await testLintPolicy(root)).some(f => f.rule === 'lint-baseline' && /baseline grew/.test(f.message)));
  await writeFile(join(root, LINT_BASELINE), JSON.stringify(frozen));
  await git('commit', '-qam', 'First freeze', '--amend');
  await git('checkout', '-q', 'dev');
  await writeFile(join(root, native), '// T3: native watcher lifecycle\n');
  await writeFile(join(root, component), assertion);
  await writeFile(join(root, 'hub/test/tiers.json'), serializeTierManifest({ version: 1, tests: { [native]: 'T3', [component]: 'T2' } }));
  await git('add', 'hub'); await git('commit', '-qm', 'Move latency before freeze is published');
  await git('update-ref', 'refs/remotes/origin/dev', 'HEAD');
  await git('checkout', '-q', 'candidate'); await git('merge', '--no-edit', 'dev');
  // Correct the tiering at the original, already frozen path.
  await writeFile(join(root, native), nativeSource);
  await writeFile(join(root, component), '');
  await shrinkTestLint(root);
  await git('commit', '-qam', 'Restore native latency and shrink');
  assert.deepEqual(await testLintPolicy(root), []);
  assert.deepEqual(await testLintPolicy(root, { tree: 'HEAD', head: 'HEAD', base: 'dev' }), []);
  const grown = JSON.parse(await readFile(join(root, LINT_BASELINE), 'utf8'));
  grown.files[native]['wall-clock-assertion'] = 2;
  await writeFile(join(root, LINT_BASELINE), JSON.stringify(grown));
  assert.ok((await testLintPolicy(root)).some(f => f.rule === 'lint-baseline' && /baseline grew/.test(f.message)));
});

for (const consumer of ['duration identities', 'test lint'] as const) {
  test(`installed verify refuses ${consumer} cleanly when TypeScript is pruned`, async t => {
    const { cp, symlink, realpath } = await import('node:fs/promises');
    const { createRequire } = await import('node:module');
    const { admissionExchange } = await import('./admission-exchange.ts');
    const { pathToFileURL } = await import('node:url');
    const root = await tempProject(t, 'cland-pruned-verify-');
    const installed = join(root, 'installed');
    await mkdir(join(installed, 'hub'), { recursive: true });
    for (const path of ['hub/src', 'hub/bin', 'shared']) await cp(new URL(`../../${path}`, import.meta.url), join(installed, path), { recursive: true });
    await writeFile(join(installed, 'package.json'), '{"type":"module"}');
    // Link only runtime packages: compiler lookup must not reach this checkout.
    const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
    assert.equal(pkg.devDependencies.typescript, '5.9.3');
    assert.equal(pkg.dependencies.typescript, undefined);
    for (const name of Object.keys(pkg.dependencies)) {
      const { dirname } = await import('node:path');
      const target = join(installed, 'node_modules', name);
      await mkdir(dirname(target), { recursive: true });
      await symlink(await realpath(new URL(`../../node_modules/${name}`, import.meta.url)), target);
    }
    const installedRequire = createRequire(join(installed, 'hub/src/test-lint.ts'));
    assert.throws(() => installedRequire.resolve('typescript'), { code: 'MODULE_NOT_FOUND' });
    const { suiteCandidate } = await import(pathToFileURL(join(installed, 'hub/src/hub/suite-candidate.ts')).href);
    const project = join(root, 'project');
    await mkdir(join(project, 'hub/test'), { recursive: true });
    await mkdir(join(project, '.cland'), { recursive: true });
    const file = 'hub/test/example.test.ts';
    await writeFile(join(project, file), "import test from 'node:test'; test('example', () => {});\n");
    await writeFile(join(project, 'package.json'), '{"scripts":{"test":"node --test"}}');
    await writeFile(join(project, 'hub/test/tiers.json'), JSON.stringify({ version: 1, tests: { [file]: 'T1' } }));
    if (consumer === 'duration identities') await writeFile(join(project, 'hub/test/durations.json'), JSON.stringify({
      version: 1, source: { artifacts: [], commit: 'fixture' }, budget: { testSeconds: 5, fileSeconds: 60 },
      files: {}, tests: { [`${file}::example`]: 0.01 }, allow: {},
    }));
    const env = fixtureEnvironment(root, process.env);
    const git = (...args: string[]) => promisify(execFile)('git', ['-c', 'gc.auto=0', ...args], { cwd: project, env: fixtureEnvironment(root, process.env), timeout: 15_000 });
    await git('init', '-qb', 'dev'); await git('add', '.'); await git('commit', '-qm', 'fixture');
    // Sealed transport: the real installed admission implementation judges suite.start.
    // No scheduler, test runner or live project hub is involved.
    let inspected = false;
    const exchange = admissionExchange(t, root, async () => {
      inspected = true;
      return suiteCandidate(env).inspect(project, 'auto', 1);
    });
    await exchange.listen();
    await writeFile(join(project, '.cland/hub.json'), JSON.stringify({ socket: exchange.socket, port: 0, secret: 'fixture', pid: process.pid, version: 'fixture' }));
    const result = await exchange.run(join(installed, 'hub/bin/cland.ts'), project);
    assert.equal(inspected, true);
    assert.equal(result.code, 1);
    assert.equal(result.stdout, '');
    const check = consumer === 'duration identities' ? 'duration source identities' : 'test lint';
    assert.equal(result.stderr, `cland: verify-tiers: TypeScript compiler unavailable; ${check} unknown; use a source installation with development dependencies for this check\n`);
    assert.equal(result.stderr.trim().split('\n').length, 1);
    assert.doesNotMatch(result.stderr, /Require stack|ERR_MODULE_NOT_FOUND|Cannot find package|\n\s+at /);
  });
}

for (const setup of ['omitted', 'aborted', 'held inspection'] as const) {
  test(`installed admission cleanup owns ${setup} setup`, async t => {
    const { admissionExchange } = await import('./admission-exchange.ts');
    const root = await tempProject(t, 'cland-admission-owner-');
    if (setup === 'held inspection') {
      const control = await heldObservation(t, root);
      await control.run(receipt => receipt);
      assert.equal(control.finished(), true);
      return;
    }
    const exchange = admissionExchange(t, root, async () => {});
    if (setup === 'aborted') {
      const setup = assert.rejects(exchange.listen(), /closed/);
      await exchange.dispose();
      await setup;
    }
    await exchange.dispose();
    assert.equal(exchange.drained(), true);
  });
}

test('installed CLI operation deadline retains missing native close until repaired', async t => {
  const { admissionExchange } = await import('./admission-exchange.ts');
  const { FakeClock } = await import('./fake-clock.ts');
  const { default: cp } = await import('node:child_process');
  const { default: events } = await import('node:events');
  const { syncBuiltinESMExports } = await import('node:module');
  const { stat } = await import('node:fs/promises');
  const root = await tempProject(t, 'cland-admission-no-close-');
  const clock = new FakeClock();
  const child = new events.EventEmitter();
  let nativeClose = false;
  child.once('close', () => { nativeClose = true; });
  t.mock.method(cp, 'execFile', (_bin: string, _args: string[], _options: unknown, callback: (error: null, stdout: string, stderr: string) => void) => {
    queueMicrotask(() => callback(null, '', 'bounded diagnostic tail'));
    return child;
  });
  syncBuiltinESMExports();
  const exchange = admissionExchange(t, root, async () => {}, { clock });
  const operation = exchange.run('sealed-fake-cli', root).then(value => ({ value, error: undefined }), error => ({ value: undefined, error }));
  try {
    await clock.advance(35_000);
    assert.equal(exchange.signal.aborted, true, 'operation deadline must start owned cancellation without caller disposal');
    await clock.advance(45_000);
    const result = await operation;
    assert.match(String(result.error), /incomplete admission exchange.*native=0\/none.*bounded diagnostic tail/);
    assert.equal(exchange.drained(), false);
    assert.equal((await stat(root)).isDirectory(), true, 'missing close retains storage');
    assert.equal(nativeClose, false);
  } finally {
    child.emit('close', 0, null);
    await operation;
    await exchange.dispose();
    t.mock.restoreAll(); syncBuiltinESMExports();
  }
  assert.equal(nativeClose, true);
  assert.equal(exchange.drained(), true);
});

async function heldObservation(t: import('node:test').TestContext, root: string) {
  const { admissionExchange } = await import('./admission-exchange.ts');
  const { createConnection } = await import('node:net');
  const { within } = await import('../src/executor/droplet/deadline.ts');
  const entered = Promise.withResolvers<void>(), release = Promise.withResolvers<void>();
  let finished = false;
  const { onCleanup, guardDirectoryRemoval } = await import('./process-cleanup.ts');
  let exchange: ReturnType<typeof admissionExchange> | undefined;
  let client: import('node:net').Socket | undefined;
  let nativeClose = Promise.resolve();
  const cleanup = async () => {
    release.resolve();
    client?.destroy();
    await within(nativeClose, 5000);
    await exchange?.dispose();
  };
  // The control's release/client owner precedes the exchange's drain registration.
  onCleanup(t, cleanup);
  guardDirectoryRemoval(root, cleanup);
  exchange = admissionExchange(t, root, async () => {
    entered.resolve();
    await release.promise;
    finished = true;
  });
  return {
    cleanup, finished: () => finished,
    async run(observe: (receipt: Promise<void>) => Promise<void>) {
      try {
        await exchange!.listen();
        client = createConnection(exchange!.socket);
        nativeClose = new Promise<void>(resolve => client!.once('close', () => resolve()));
        client.on('error', () => {});
        client.write('{"type":"suite.start","id":"held"}\n');
        await observe(within(entered.promise, 5000));
        const draining = exchange!.dispose();
        await within(nativeClose, 5000);
        release.resolve();
        await draining;
      } finally { await cleanup(); }
    },
  };
}

test('held admission releases and joins after early observation failure', async t => {
  const root = await tempProject(t, 'cland-early-');
  const control = await heldObservation(t, root);
  try {
    await assert.rejects(control.run(async receipt => {
      await receipt;
      throw new Error('setup observation deliberately aborted before close');
    }), /deliberately aborted/);
    assert.equal(control.finished(), true, 'observation failure must join the gated inspection before returning');
  } finally { await control.cleanup(); }
  assert.equal(control.finished(), true);
});
