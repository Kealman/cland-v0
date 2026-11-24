// T3: real Git subprocess contract proves fetch/ref-update completion across linked
// worktrees. An injected Git fake cannot prove shared ref-lock behavior; no hub or provider.
import { fixtureEnvironment, runnerFixtureEnvironment, scratchGitEnvironment } from './fixture-environment.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describeSelection, selectPackageSuite } from '../src/suite-selection.ts';
import { occasionSelection } from '../src/verification-occasion.ts';
import { selectionFailure } from '../src/suite-dev-fetch.ts';
import { suiteCase } from './suite-case-fixture.ts';
import { fixtureCommand, fixtureCommandOutput, FixtureCommandError } from './git-maintenance-fixture.ts';
import { ownDirectory, guardDirectoryRemoval } from './process-cleanup.ts';
import { eventually } from './harness.ts';

const exec = promisify(execFile);

test('dev T3 deciding files exclude dirty tracker edits while task selection retains them', t => suiteCase(t, async scope => {
  const { dir, env, git, base, tracker } = await scope.setup(async fixtures => {
    const dir = await mkdtemp(join(tmpdir(), 'cland-dev-selection-'));
    ownDirectory(fixtures, dir);
    const excludesFile = join(dir, 'empty-excludes');
    await writeFile(excludesFile, '');
    const env = scratchGitEnvironment(dir, fixtureEnvironment(dir, process.env), { excludesFile });
    const git = (...args: string[]) => fixtureCommand(scope.fixtures, dir, 'git', args);
    await git('init', '-q', '-b', 'dev');
    await git('config', 'user.name', 'Selection fixture');
    await git('config', 'user.email', 'selection@example.invalid');
    await mkdir(join(dir, '.cland/tasks'), { recursive: true });
    const tracker = '.cland/tasks/T-1-fixture.md';
    await writeFile(join(dir, tracker), 'base');
    await git('add', '.'); await git('commit', '-qm', 'base');
    const base = await git('rev-parse', 'HEAD');
    await git('init', '-q', '--bare', join(dir, 'origin.git'));
    await git('remote', 'add', 'origin', join(dir, 'origin.git'));
    await git('push', '-q', 'origin', 'dev');
    await writeFile(join(dir, 'committed.md'), 'committed delta');
    await git('add', 'committed.md'); await git('commit', '-qm', 'candidate');
    await writeFile(join(dir, tracker), 'dirty tracker');
    await writeFile(join(dir, 'staged.md'), 'staged'); await git('add', 'staged.md');
    await writeFile(join(dir, 'untracked.md'), 'untracked');
    await writeFile(join(dir, '.gitignore'), 'origin.git/\nempty-excludes\n.fixture*/\n');
    await git('add', '.gitignore');
    return { root: dir, dir, env, git, base, tracker };
  });
  await scope.step('committed dev selection and task control', async () => {
    const integrated = await selectPackageSuite(dir, 'all', env);
    assert.deepEqual(integrated.files, ['committed.md']);
    assert.equal(integrated.mode, 'full');
    assert.equal(integrated.fetchedDev, base);
    const report = describeSelection(occasionSelection(integrated, 'dev-t3'));
    assert.match(report, /deciding files \["committed.md"\]/);
    assert.doesNotMatch(report, /T-1-fixture|staged.md|untracked.md/);
    await git('checkout', '-qb', 't/T-1');
    const task = await selectPackageSuite(dir, 'all', env);
    assert.deepEqual(task.files, [tracker, '.gitignore', 'committed.md', 'staged.md', 'untracked.md']);
  });
}, { native: true }));

for (const outcome of ['failure', 'cancellation'] as const) test(`selector fixture keeps native close and guarded removal receipts after ${outcome}`, t => suiteCase(t, async scope => {
  const abort = new AbortController();
  scope.releaseOnClose(() => abort.abort());
  let removalAllowed = false;
  const f = await scope.setup(async fixtures => {
    const root = await mkdtemp(join(tmpdir(), 'cland-selector-close-'));
    ownDirectory(fixtures, root);
    const commandRoot = join(root, 'command');
    await mkdir(commandRoot);
    const remove = ownDirectory(undefined, commandRoot);
    fixtures.after(remove);
    guardDirectoryRemoval(commandRoot, async () => {
      if (!removalAllowed) throw new Error('controlled removal receipt withheld');
    });
    await writeFile(join(commandRoot, 'writer.cjs'), outcome === 'failure'
      ? "require('node:fs').writeFileSync('ready', 'ready'); process.exit(7);"
      : "require('node:fs').writeFileSync('ready', 'ready'); setInterval(() => {}, 1000);");
    return { root, commandRoot, remove };
  });
  await scope.step('native failure or cancellation close receipt', async () => {
    const ready = eventually('native writer ready file', async () => readFile(join(f.commandRoot, 'ready'), 'utf8').catch(() => undefined));
    const running = fixtureCommandOutput(scope.fixtures, f.commandRoot, process.execPath, ['writer.cjs'], undefined, { signal: abort.signal });
    const rejected = assert.rejects(running, error => {
      assert.ok(error instanceof FixtureCommandError);
      assert.ok(error.writers.some(writer => writer.kind === 'close'), 'producer records native close');
      assert.ok(error.writers.every(writer => writer.kind === 'close' || writer.kind === 'reaped'));
      if (outcome === 'failure') assert.equal(error.code, 7);
      else {
        assert.equal(abort.signal.aborted, true);
        assert.equal(error.nativeFailure, false, 'cancellation retains its producing-owner outcome');
      }
      return true;
    });
    void rejected.catch(() => {});
    assert.equal(await ready, 'ready');
    if (outcome === 'cancellation') abort.abort();
    await rejected;
  });
  await scope.step('independent guarded removal refusal and release', async () => {
    await assert.rejects(f.remove(), /controlled removal receipt withheld/);
    assert.equal(await readFile(join(f.commandRoot, 'ready'), 'utf8'), 'ready');
    removalAllowed = true;
    await f.remove();
    await assert.rejects(stat(f.commandRoot), { code: 'ENOENT' });
  });
}, { native: true }));

async function fixture(t: import('node:test').TestContext) {
  const dir = await mkdtemp(join(tmpdir(), 'cland-selection-fetch-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  // No inherited provider credentials or user Git configuration enter this fixture.
  const env = { PATH: process.env.PATH, HOME: dir, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null' };
  const root = join(dir, 'work');
  const git = async (cwd: string, ...args: string[]) => (await exec('git', args, { cwd, env: runnerFixtureEnvironment(cwd, env) })).stdout.trim();
  await git(dir, 'init', '-q', '-b', 'dev', root);
  await git(root, 'config', 'user.name', 'Selection fixture');
  await git(root, 'config', 'user.email', 'selection@example.invalid');
  await writeFile(join(root, 'README.md'), 'base');
  await git(root, 'add', '.'); await git(root, 'commit', '-qm', 'base');
  await git(dir, 'init', '-q', '--bare', join(dir, 'origin.git'));
  await git(root, 'remote', 'add', 'origin', join(dir, 'origin.git'));
  await git(root, 'push', '-q', 'origin', 'dev');
  const base = await git(root, 'rev-parse', 'HEAD');
  await git(root, 'checkout', '-qb', 't/T-fixture');
  await writeFile(join(root, 'README.md'), 'candidate');
  await git(root, 'commit', '-qam', 'candidate');
  return { dir, root, env, git, base };
}

test('ten concurrent linked-worktree admissions share one fetch and capture the dev commit', async t => {
  const f = await fixture(t);
  const roots: string[] = [];
  for (let i = 0; i < 10; i++) {
    const root = join(f.dir, `work-${i}`);
    await f.git(f.root, 'worktree', 'add', '-q', '--detach', root, 'HEAD');
    await writeFile(join(root, `change-${i}.md`), 'own worktree change');
    roots.push(root);
  }
  const trace = join(f.dir, 'git-trace.jsonl');
  const selections = await Promise.all(roots.map(root => selectPackageSuite(root, 'auto', { ...f.env, GIT_TRACE2_EVENT: trace })));
  const events = (await readFile(trace, 'utf8')).trim().split('\n').map(line => JSON.parse(line));
  assert.equal(events.filter(event => event.event === 'start' && event.argv?.[1] === 'fetch').length, 1);
  const diffs = events.filter(event => event.event === 'start' && event.argv?.[1] === 'diff' && event.argv.some((arg: string) => arg.endsWith('...HEAD')));
  assert.equal(diffs.length, 10);
  assert.ok(diffs.every(event => event.argv.includes(`${f.base}...HEAD`)), 'each admission diffs the captured commit');
  for (const [i, selection] of selections.entries()) {
    assert.equal(selection.mode, 'hub-only');
    assert.equal(selection.fetchedDev, f.base);
    assert.deepEqual(selection.files, ['README.md', `change-${i}.md`]);
    assert.doesNotMatch(selection.reason, /unavailable/);
  }
});

test('failed fetch uses the last known dev only with a candidate merge base', async t => {
  const f = await fixture(t);
  await f.git(f.root, 'remote', 'remove', 'origin');
  await f.git(f.root, 'update-ref', 'refs/remotes/origin/dev', f.base);
  const selection = await selectPackageSuite(f.root, 'auto', f.env);
  assert.equal(selection.mode, 'hub-only');
  assert.deepEqual(selection.files, ['README.md']);
  assert.equal(selection.fetchedDev, undefined, 'last known dev is not fresh-fetch proof for integrated runs');
  assert.match(selection.fallback!, /selection fallback: last known origin\/dev.*fetch unavailable: fatal:/);
  assert.match(selection.fallback!, /does not appear to be a git repository/);
  // An unrelated known dev must not become a trusted diff base.
  await f.git(f.root, 'checkout', '--orphan', 'unrelated');
  await f.git(f.root, 'commit', '-qm', 'unrelated history');
  const full = await selectPackageSuite(f.root, 'auto', f.env);
  assert.equal(full.mode, 'full');
  assert.match(full.fallback!, /selection fallback: full;.*no usable origin\/dev merge base/);
});

test('failed fetch with no known dev remains full and carries its cause', async t => {
  const f = await fixture(t);
  await f.git(f.root, 'remote', 'remove', 'origin');
  const selection = await selectPackageSuite(f.root, 'auto', f.env);
  assert.equal(selection.mode, 'full');
  assert.match(selection.fallback!, /fetch unavailable: fatal: 'origin' does not appear to be a git repository/);
  assert.equal(selection.fetchedDev, undefined);
  await f.git(f.root, 'remote', 'add', 'origin', join(f.dir, 'origin.git'));
  const recovered = await selectPackageSuite(f.root, 'auto', f.env);
  assert.equal(recovered.fetchedDev, f.base);
  assert.equal(recovered.fallback, undefined, 'a failed shared fetch is evicted for the next admission');
});

// T1: redaction is a pure receipt transformation, with planted secrets only.
test('selection failure retains bounded stderr with secrets and URLs redacted', () => {
  const text = selectionFailure({ stderr: 'fatal: lock failed\nhttps://user:secret@example.invalid/repo token sentinel-do\u001b\n' + 'x'.repeat(500) }, { DIGITALOCEAN_TOKEN: 'sentinel-do', PASSWORD: 'secret' });
  assert.match(text, /^fatal: lock failed \[redacted URL\] token \[redacted\]/);
  assert.doesNotMatch(text, /secret|sentinel-do|user:|[\n\u001b]/);
  assert.equal(text.length, 300);
});
