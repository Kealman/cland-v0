// Public CLI/socket tests use tiny package fixtures, never the live project's full-suite queue.
import { packageShards, serializeTierManifest } from '../src/suite-shards.ts';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, stat, rm, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { cland, clandWithEnv, connectUi, eventually, startDaemon, spawnSpoke, tempProject, pidAlive, fakeCodex } from './harness.ts';
import { fixture, type ResultMessage } from './suite-fixture.ts';
import { suiteSummary } from '../src/hub/suites.ts';
import { DatabaseSync } from 'node:sqlite';
import { ownProcess } from './process-cleanup.ts';
import type { Artifact } from '../src/protocol.ts';
import type { VerificationQueue, HubStatus } from '../src/protocol.ts';
import type { ItemSummary, ItemView } from '../src/tracker/tracker.ts';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { defaultConfig, parseConfig, renderConfig } from '../src/init/config.ts';
import { cacheRepository, humanRunnerFixture } from './suite-support.ts';
import { durationFixture, durationOwner } from './duration-fixture.ts';


test('verify card follows branch jobs through finish and cache, updates the UI silently and survives restart', async t => {
  const f = await fixture(t, 'node -e "process.exit(0)"', undefined, undefined, undefined, undefined, undefined, startDaemon);
  const git = await cacheRepository(f);
  const head = await git('rev-parse', 'HEAD');
  const made = await f.ui.request({ size: 'M', type: 'task.create', title: 'Branch card', branch: 'candidate' });
  const item = (made.value as { item: ItemView }).item;
  await f.ui.request({ type: 'subscribe' });
  await f.spoke.call('subscribe', { subject: { item: item.id }, events: ['task'], digest: 'now' });
  const from = f.ui.frames.length;
  const job = await f.launch();
  const report = await eventually('first result', async () => (await f.results())[0]);
  const card = await eventually('branch verify has the log artifact', async () => {
    const list = await f.ui.request({ type: 'task.list' });
    const card = (list.value as { items: ItemSummary[] }).items.find(i => i.id === item.id);
    return card?.verify?.id === job.id && card.verify.artifact ? card : undefined;
  });
  assert.deepEqual(card.verify, { executor: 'local', id: job.id, state: 'finished', result: 'passed', head, finished: card.verify!.finished, artifact: report.artifacts[0]!.id });
  assert.equal(card.verify!.executor, 'local');
  assert.ok(card.verify!.finished);
  const frames = f.ui.frames.slice(from).filter(frame => frame.type === 'task' && (frame.item as ItemSummary)?.id === item.id);
  assert.equal(frames.filter(frame => (frame.item as ItemSummary).verify?.result === 'passed').length, 1, 'one terminal card, including the artifact');
  for (const frame of frames) assert.equal((frame as { events?: unknown }).events, undefined);
  assert.equal(f.spoke.events.filter(n => n.params.content.includes(item.id)).length, 0, 'no item event delivery');
  const detail = await f.ui.request({ type: 'task.view', item: item.id });
  assert.deepEqual((detail.value as { item: ItemView }).item.verify, card.verify);
  assert.equal(JSON.parse((await cland(f.root, 'task', 'view', item.id, '--json')).stdout).item.verify.executor, 'local');
  const cached = await f.launch();
  assert.equal(cached.cached?.run, job.id);
  await eventually('cached card', async () => {
    const list = await f.ui.request({ type: 'task.list' });
    const card = (list.value as { items: ItemSummary[] }).items.find(i => i.id === item.id);
    return card?.verify?.id === cached.id && card.verify.artifact ? card : undefined;
  });
  assert.match((await cland(f.root, 'task', 'view', item.id)).stdout, /verify +.*passed.*cached/);
  assert.equal((await cland(f.root, 'hub', 'stop')).code, 0);
  await startDaemon(t, f.root);
  const after = JSON.parse((await cland(f.root, 'task', 'list', '--json')).stdout).items.find((i: { id: string }) => i.id === item.id);
  assert.equal(after.verify.id, cached.id);
  assert.deepEqual(after.verify.cached, cached.cached);
});

for (const result of ['failed', 'cancelled'] as const) test(`verify card exposes ${result} by item, with queued results left null`, async t => {
  const f = await fixture(t, 'node -e "process.exit(1)"');
  const read = async () => ((await f.ui.request({ type: 'task.list' })).value as { items: ItemSummary[] }).items[0]!;
  assert.equal((await read()).verify, null);
  if (result === 'cancelled') await mkdir(join(f.root, 'suite.lock'));
  const job = await f.launch();
  if (result === 'cancelled') {
    const queued = (await read()).verify!;
    assert.equal(queued.id, job.id);
    assert.equal(queued.state, 'queued');
    assert.equal(queued.result, null);
    assert.equal(queued.finished, null);
    assert.equal(queued.artifact, null);
    assert.equal((await f.ui.request({ type: 'suite.cancel', suite: job.id })).ok, true);
  }
  const card = await eventually(`${result} card with artifact`, async () => {
    const card = await read();
    return card.verify?.result === result && card.verify.artifact ? card : undefined;
  });
  assert.equal(card.verify!.state, 'finished');
  assert.ok(card.verify!.finished);
  assert.equal(card.verify!.id, job.id);
});

test('verify refuses every unclassified hub test before reserving a queue slot, then admits classifications', async t => {
  const f = await fixture(t, 'node -e "process.exit(0)"');
  await mkdir(join(f.root, 'hub/test'), { recursive: true });
  await mkdir(join(f.root, 'hub/src'), { recursive: true });
  await writeFile(join(f.root, 'hub/test/new.test.ts'), 'setTimeout(() => {}, 1);\n');
  await writeFile(join(f.root, 'hub/src/new.test.ts'), '// another test\n');
  await writeFile(join(f.root, 'hub/test/tiers.json'), serializeTierManifest({ version: 1, tests: {} }));
  // A hand holder makes an incorrectly admitted request remain observable in the queue.
  await mkdir(join(f.root, 'suite.lock'));
  const before = await f.ui.request({ type: 'hub.status' });
  const failed = await f.ui.request({ type: 'suite.start', mode: 'auto', cwd: f.root, report: f.topic, to: ['rev', 'impl'] });
  assert.equal(failed.ok, false, JSON.stringify(failed));
  assert.equal((failed as { code?: string }).code, 'verify-tiers');
  assert.deepEqual((failed as { files?: string[] }).files, ['hub/src/new.test.ts', 'hub/test/new.test.ts']);
  assert.ok(failed.error!.includes('"hub/src/new.test.ts": "T3",'));
  assert.ok(failed.error!.includes('"hub/test/new.test.ts": "T3",'));
  const status = await f.ui.request({ type: 'hub.status' });
  assert.deepEqual((status.value as HubStatus).suites, (before.value as HubStatus).suites, 'refusal creates no durable suite');
  const queue = await f.ui.request({ type: 'suite.queue' });
  assert.deepEqual((queue.value as VerificationQueue).waiters, []);
  const cli = await clandWithEnv(f.root, f.env, 'verify', 'auto', '--report', f.topic, '--to', 'rev', '--json');
  assert.notEqual(cli.code, 0);
  assert.match(cli.stderr, /verify-tiers.*unclassified tests/s);
  assert.equal((await f.results()).length, 0, 'refusal publishes no suite result');
  // Admission table: reuse the same request fixture for the refusal family.
  const manifest = join(f.root, 'hub/test/tiers.json');
  for (const [tests, message, files] of [
    [{ 'hub/src/new.test.ts': 'T3', 'hub/test/new.test.ts': 'T3', 'hub/test/zz.test.ts': 'T3' }, /missing test/, ['hub/test/zz.test.ts']],
    [{ 'hub/src/new.test.ts': 'T0', 'hub/test/new.test.ts': 'T3' }, /invalid tier/, ['hub/src/new.test.ts']],
    [{ 'hub/src/new.test.ts': { tier: 'T3', scenario: '' }, 'hub/test/new.test.ts': 'T3' }, /invalid tier/, ['hub/src/new.test.ts']],
    [{ 'hub/test/new.test.ts': 'T3', 'hub/src/new.test.ts': 'T3' }, /not sorted by path/, ['hub/src/new.test.ts']],
  ] as const) {
    // Deliberately bypass the sorted writer to plant malformed input.
    await writeFile(manifest, JSON.stringify({ version: 1, tests }));
    const refusal = await f.ui.request({ type: 'suite.start', mode: 'auto', cwd: f.root, report: f.topic, to: ['rev', 'impl'] });
    assert.equal(refusal.ok, false);
    assert.equal((refusal as { code?: string }).code, 'verify-tiers');
    assert.match(refusal.error!, message);
    assert.deepEqual((refusal as { files?: string[] }).files, [...files]);
    assert.deepEqual(((await f.ui.request({ type: 'hub.status' })).value as HubStatus).suites, (before.value as HubStatus).suites);
    assert.deepEqual(((await f.ui.request({ type: 'suite.queue' })).value as VerificationQueue).waiters, []);
  }
  await writeFile(join(f.root, 'hub/test/tiers.json'), serializeTierManifest({ version: 1, tests: {
    'hub/src/new.test.ts': 'T1', 'hub/test/new.test.ts': 'T1',
  } }));
  const resource = await f.ui.request({ type: 'suite.start', mode: 'auto', cwd: f.root, report: f.topic, to: ['rev', 'impl'] });
  assert.equal(resource.ok, false);
  assert.match(resource.error!, /T1 test touches machine resources/);
  await writeFile(join(f.root, 'hub/test/tiers.json'), serializeTierManifest({ version: 1, tests: {
    'hub/src/new.test.ts': 'T3', 'hub/test/new.test.ts': 'T3',
  } }));
  const lifecycle = await f.ui.request({ type: 'suite.start', mode: 'auto', cwd: f.root, report: f.topic, to: ['rev', 'impl'] });
  assert.equal(lifecycle.ok, false);
  assert.equal((lifecycle as { code?: string }).code, 'verify-test-lint');
  assert.match(lifecycle.error!, /hub\/src\/new.test.ts:1 \[t3-lifecycle\]/);
  const dry = await f.ui.request({ type: 'suite.start', mode: 'auto', cwd: f.root, report: f.topic, to: ['rev', 'impl'], dryRun: true });
  assert.equal(dry.ok, false);
  assert.equal(dry.error, lifecycle.error, 'dry run returns identical policy refusal lines');
  assert.deepEqual(((await f.ui.request({ type: 'suite.queue' })).value as VerificationQueue).waiters, []);
  await writeFile(join(f.root, 'hub/src/new.test.ts'), '// T3: native process startup\n');
  await writeFile(join(f.root, 'hub/test/new.test.ts'), '// T3: native timeout expiry\nsetTimeout(() => {}, 1); // lint-allow-wall-clock: observes native timer expiry\n');
  const job = await f.launch();
  assert.equal(job.pid, null);
  assert.equal(job.position, 1, 'refused requests consume no queue position');
  await rm(join(f.root, 'suite.lock'), { recursive: true });
  const result = await eventually('classified suite passed', async () => (await f.results())[0]);
  assert.match(result.text, /auto exit 0/);
  // Transition C4: an immutable pre-migration head, including an unsorted legacy map.
  // Neovim was not classified in that format and must remain admissible.
  await rm(manifest);
  await mkdir(join(f.root, 'nvim/test'), { recursive: true });
  await writeFile(join(f.root, 'nvim/test/legacy.test.ts'), '');
  await writeFile(join(f.root, 'hub/test/shards.json'), JSON.stringify({ version: 1, tests: {
    'hub/test/new.test.ts': 'machine', 'hub/src/new.test.ts': 'free',
  } }));
  const git = await cacheRepository(f);
  assert.deepEqual(await packageShards(f.root, 'full', undefined, undefined, { workers: 3 }), [
    { name: 'hub free', resource: 'free', workers: 1, targets: ['hub/src/new.test.ts'] },
    { name: 'hub machine', resource: 'machine', workers: 3, targets: ['hub/test/new.test.ts'] },
    { name: 'Neovim', resource: 'machine', workers: 3, targets: ['nvim/test/**/*.test.ts'] },
  ]);
  const legacy = await f.launch();
  const legacyResult = await eventually('legacy-only candidate result', async () => (await f.results()).find(message => message.id === `suite:${legacy.id}`));
  assert.match(legacyResult.text, /exit 0/);
  // Duration admission uses the candidate's history after dev retires a legacy key.
  const durations = join(f.root, 'hub/test/durations.json');
  const baseline = durationFixture();
  await writeFile(join(f.root, '.cland/tasks/E-677-fixture.md'), durationOwner);
  await writeFile(durations, JSON.stringify(baseline.manifest));
  await git('add', 'hub'); await git('commit', '-m', 'migrated duration baseline');
  await git('branch', '-f', 'dev', 'HEAD');
  await writeFile(join(f.root, 'branch.txt'), 'unrelated work');
  await git('add', 'branch.txt'); await git('commit', '-m', 'branch work');
  await git('checkout', 'dev');
  const retired = structuredClone(baseline.manifest);
  delete retired.allow[baseline.legacyKey];
  await writeFile(durations, JSON.stringify(retired));
  await git('commit', '-am', 'dev retires legacy allowance');
  await git('push', 'origin', 'dev');
  await git('checkout', 'candidate');
  await mkdir(join(f.root, 'suite.lock'));
  const admitted = await f.ui.request({ type: 'suite.start', mode: 'auto', cwd: f.root, report: f.topic, to: ['rev', 'impl'] });
  assert.equal(admitted.ok, true, JSON.stringify(admitted));
  const queued = (await f.ui.request({ type: 'suite.queue' })).value as VerificationQueue;
  assert.equal(queued.waiters.length, 1, 'untouched legacy allowance admits the branch');
  assert.equal((await f.ui.request({ type: 'suite.cancel', suite: queued.waiters[0]!.id })).ok, true);
  for (const key of ['hub/test/new.test.ts::new', baseline.expiringKey]) {
    const invalid = structuredClone(baseline.manifest);
    invalid.allow[key] = baseline.legacy;
    await writeFile(durations, JSON.stringify(invalid));
    await git('commit', '-am', 'plant invalid legacy allowance');
    const refusal = await f.ui.request({ type: 'suite.start', mode: 'auto', cwd: f.root, report: f.topic, to: ['rev', 'impl'] });
    assert.equal(refusal.ok, false, JSON.stringify(refusal));
    assert.equal((refusal as { code?: string }).code, 'verify-tiers');
    assert.ok(refusal.error!.includes(`new duration allowance cannot be legacy: ${key}`));
    assert.deepEqual(((await f.ui.request({ type: 'suite.queue' })).value as VerificationQueue).waiters, [], 'refused legacy entries reserve no slot');
  }
});

for (const capture of ['before change', 'after change'] as const) test(`verify classifies the submitted head without a queue slot when HEAD is captured ${capture}`, async t => {
  const bin = await tempProject(t, 'cland-suite-shard-head-');
  const realGit = (await promisify(execFile)('which', ['git'])).stdout.trim();
  await writeFile(join(bin, 'git'), `#!${process.execPath}
import { existsSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { setTimeout as pause } from 'node:timers/promises';
const args = process.argv.slice(2);
if (args.join(' ') === 'rev-parse HEAD' && existsSync('hold-head')) {
  const captured = ${JSON.stringify(capture)} === 'before change' ? spawnSync(${JSON.stringify(realGit)}, args, { encoding: 'utf8' }) : null;
  writeFileSync('head-held', 'held');
  while (!existsSync('release-head')) await pause(25);
  const result = captured ?? spawnSync(${JSON.stringify(realGit)}, args, { encoding: 'utf8' });
  process.stdout.write(result.stdout); process.stderr.write(result.stderr); process.exitCode = result.status ?? 1;
} else process.exitCode = spawnSync(${JSON.stringify(realGit)}, args, { stdio: 'inherit' }).status ?? 1;
`, { mode: 0o700 });
  const f = await fixture(t, 'node -e "process.exit(0)"', undefined, '', { PATH: `${bin}:${process.env.PATH ?? ''}` });
  const git = (...args: string[]) => promisify(execFile)(realGit, args, { cwd: f.root });
  await git('init', '-b', 'dev');
  await git('config', 'user.name', 'Shard head test'); await git('config', 'user.email', 'shards@example.invalid');
  await writeFile(join(f.root, '.gitignore'), '.cland/\nsuite.lock*\nhold-head\nhead-held\nrelease-head\n');
  await mkdir(join(f.root, 'hub/test'), { recursive: true });
  await writeFile(join(f.root, 'hub/test/tiers.json'), serializeTierManifest({ version: 1, tests: {} }));
  await git('add', '.'); await git('commit', '-m', 'Classified baseline');
  await mkdir(join(f.root, 'suite.lock'));
  await writeFile(join(f.root, 'hold-head'), 'hold');
  const pending = f.ui.request({ type: 'suite.start', mode: 'auto', cwd: f.root, report: f.topic, to: ['rev', 'impl'] });
  await eventually('head capture held', () => stat(join(f.root, 'head-held')).then(() => true, () => undefined));
  await writeFile(join(f.root, 'hub/test/advanced.test.ts'), '// unclassified new head\n');
  await git('add', 'hub'); await git('commit', '-m', 'Advance to unclassified head');
  // The worktree is now classified, so immutable-head lint / the final HEAD fence must decide.
  await writeFile(join(f.root, 'hub/test/tiers.json'), serializeTierManifest({ version: 1, tests: { 'hub/test/advanced.test.ts': 'T1' } }));
  await writeFile(join(f.root, 'release-head'), 'release');
  const failed = await pending;
  assert.equal(failed.ok, false, JSON.stringify(failed));
  assert.match(failed.error!, capture === 'before change' ? /head changed during submission/ : /verify-tiers.*advanced\.test\.ts/s);
  const status = await f.ui.request({ type: 'hub.status' });
  assert.deepEqual((status.value as HubStatus).suites, [], 'head change cannot reserve a suite');
  const queue = await f.ui.request({ type: 'suite.queue' });
  assert.deepEqual((queue.value as VerificationQueue).waiters, []);
});

// T3: native Git ancestry proves a freeze survives dev moving before publication.
test('the first lint baseline keeps its freeze when dev moves debt before publication', async t => {
  const { testLintPolicy, shrinkTestLint, LINT_BASELINE } = await import('../src/test-lint-policy.ts');
  const root = await tempProject(t, 'cland-lint-freeze-history-');
  const git = (...args: string[]) => promisify(execFile)('git', args, { cwd: root }).then(result => result.stdout.trim());
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
