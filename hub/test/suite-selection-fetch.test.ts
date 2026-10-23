// T3: real Git subprocess contract proves fetch/ref-update completion across linked
// worktrees. An injected Git fake cannot prove shared ref-lock behavior; no hub or provider.
import { runnerFixtureEnvironment } from './fixture-environment.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { selectPackageSuite } from '../src/suite-selection.ts';
import { selectionFailure } from '../src/suite-dev-fetch.ts';

const exec = promisify(execFile);
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
