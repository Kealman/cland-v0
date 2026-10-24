import { ownDirectory, ownProcess } from '../../hub/test/process-cleanup.ts';
// The launcher's resolver run as a script prints the binary's path, also from a checkout whose path holds
// characters a file URL escapes (a space, `#`, `%`).
import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFile, mkdir, mkdtemp, readdir, readFile, realpath, rm, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { assetName, NVIM_DIR, NVIM_VERSION } from '../bin/nvim-path.ts';
import { fixtureEnvironment } from '../../test-support/fixture-environment.ts';
import { ensureFixtureAdmission } from './fixture.ts';

test('nvim-path.ts prints the binary from a path with a space, # and %', async (t) => {
  await ensureFixtureAdmission();
  const base = await mkdtemp(join(tmpdir(), 'cland-path-'));
  ownDirectory(t, base);
  const nvimDir = join(base, 'a b#c%20d', 'nvim');
  await mkdir(join(nvimDir, 'bin'), { recursive: true });
  for (const f of ['NVIM_VERSION', 'NVIM_SHA256SUMS']) await copyFile(join(NVIM_DIR, f), join(nvimDir, f));
  await copyFile(join(NVIM_DIR, 'bin', 'nvim-path.ts'), join(nvimDir, 'bin', 'nvim-path.ts'));
  // CLAND_NVIM names the binary: any existing file will do, nothing is downloaded
  const fake = join(nvimDir, 'NVIM_VERSION');
  const out = spawnSync(process.execPath, [join(nvimDir, 'bin', 'nvim-path.ts')], { cwd: base, env: fixtureEnvironment(base, process.env, { CLAND_NVIM: fake }), encoding: 'utf8' });
  assert.equal(out.status, 0, out.stderr);
  assert.equal(out.stdout, `${fake}\n`);
});

/** A release tarball of our own, served from a file: URL, with its digest; `resolve()` runs the resolver as a script. */
async function fakeRelease(t: TestContext, extra: Record<string, string> = {}) {
  await ensureFixtureAdmission();
  const base = await mkdtemp(join(tmpdir(), 'cland-nvim-race-'));
  ownDirectory(t, base);
  const asset = assetName();
  if (!asset) return null;
  const unpacked = asset.replace(/\.tar\.gz$/, '');
  const src = join(base, 'src');
  await mkdir(join(src, unpacked, 'bin'), { recursive: true });
  await writeFile(join(src, unpacked, 'bin', 'nvim'), '#!/bin/sh\necho fake\n', { mode: 0o755 });
  const tarball = join(base, asset);
  const tar = spawnSync('tar', ['-czf', tarball, '-C', src, unpacked], { cwd: base, env: fixtureEnvironment(base, process.env) });
  assert.equal(tar.status, 0, String(tar.stderr));
  const sha = createHash('sha256').update(await readFile(tarball)).digest('hex');
  const cache = join(base, 'cache');
  const env = fixtureEnvironment(base, process.env, {
    CLAND_NVIM: '',
    CLAND_NVIM_CACHE_DIR: cache,
    CLAND_NVIM_DOWNLOAD_URL: pathToFileURL(tarball).href,
    CLAND_NVIM_DOWNLOAD_SHA256: sha,
    // the download holds still before it writes, so two resolvers overlap
    CLAND_TEST_NVIM_DOWNLOAD_PAUSE_MS: '500',
    ...extra,
  });
  const resolve = () =>
    new Promise<{ code: number | null; stdout: string; stderr: string }>((done) => {
      const child = spawn(process.execPath, [join(NVIM_DIR, 'bin', 'nvim-path.ts')], { cwd: base, env });
      ownProcess(t, child.pid);
      // a resolver stuck on a lock never ends on its own (it waits up to ten minutes): fail the test instead
      const timer = setTimeout(() => child.kill('SIGKILL'), 20_000);
      let stdout = '';
      let stderr = '';
      child.stdout.on('data', (c: Buffer) => (stdout += c.toString()));
      child.stderr.on('data', (c: Buffer) => (stderr += c.toString()));
      child.on('close', (code) => {
        clearTimeout(timer);
        done({ code, stdout, stderr });
      });
    });
  const dir = join(cache, NVIM_VERSION);
  return { base, dir, unpacked, expected: join(dir, unpacked, 'bin', 'nvim'), resolve };
}

test('two resolvers starting on an empty cache at once: one downloads, the other waits for it, both print the same binary', async (t) => {
  const r = await fakeRelease(t);
  if (!r) return t.skip('no pinned build for this platform');
  const [a, b] = await Promise.all([r.resolve(), r.resolve()]);
  assert.equal(a.code, 0, a.stderr);
  assert.equal(b.code, 0, b.stderr);
  assert.equal(a.stdout, `${r.expected}\n`);
  assert.equal(b.stdout, `${r.expected}\n`);
  assert.equal(`${a.stderr}${b.stderr}`.match(/downloading /g)?.length, 1, `one download:\n${a.stderr}\n${b.stderr}`);
  // nothing half-done is left beside the release
  assert.deepEqual((await readdir(r.dir)).sort(), [r.unpacked]);
});

test('an empty download lock (its writer died before the pid) is stale after a grace: the resolver takes it over', async (t) => {
  const r = await fakeRelease(t);
  if (!r) return t.skip('no pinned build for this platform');
  await mkdir(r.dir, { recursive: true });
  const lock = join(r.dir, '.download.lock');
  await writeFile(lock, '');
  const old = new Date(Date.now() - 60_000);
  await utimes(lock, old, old);
  const out = await r.resolve();
  assert.equal(out.code, 0, out.stderr);
  assert.equal(out.stdout, `${r.expected}\n`);
  assert.deepEqual((await readdir(r.dir)).sort(), [r.unpacked]);
});

test("two resolvers that both find a dead holder's lock: one breaks it, neither removes the lock the other then holds", async (t) => {
  // each holds still between finding the lock stale and removing it, so both decide before either acts
  const r = await fakeRelease(t, { CLAND_TEST_NVIM_BREAK_PAUSE_MS: '400' });
  if (!r) return t.skip('no pinned build for this platform');
  await mkdir(r.dir, { recursive: true });
  const dead = spawnSync(process.execPath, ['-e', ''], { cwd: r.base, env: fixtureEnvironment(r.base, process.env) }).pid as number;
  await writeFile(join(r.dir, '.download.lock'), `${dead}\n`);
  const [a, b] = await Promise.all([r.resolve(), r.resolve()]);
  assert.equal(a.code, 0, a.stderr);
  assert.equal(b.code, 0, b.stderr);
  assert.equal(a.stdout, `${r.expected}\n`);
  assert.equal(b.stdout, `${r.expected}\n`);
  assert.equal(`${a.stderr}${b.stderr}`.match(/downloading /g)?.length, 1, `one download:\n${a.stderr}\n${b.stderr}`);
  assert.deepEqual((await readdir(r.dir)).sort(), [r.unpacked]);
});

// T-48: a session in a worktree runs the suite with the network closed, so it cannot download a Neovim of its own.
test('a linked worktree with no Neovim of its own uses the one cached in the main worktree, and downloads nothing', async (t) => {
  await ensureFixtureAdmission();
  const asset = assetName();
  if (!asset) return t.skip('no pinned build for this platform');
  const base = await realpath(await mkdtemp(join(tmpdir(), 'cland-path-wt-')));
  ownDirectory(t, base);
  const main = join(base, 'main');
  const worktree = join(main, '.cland', 'worktrees', 'T-1');
  for (const root of [main, worktree]) {
    await mkdir(join(root, 'nvim', 'bin'), { recursive: true });
    for (const f of ['NVIM_VERSION', 'NVIM_SHA256SUMS']) await copyFile(join(NVIM_DIR, f), join(root, 'nvim', f));
    await copyFile(join(NVIM_DIR, 'bin', 'nvim-path.ts'), join(root, 'nvim', 'bin', 'nvim-path.ts'));
  }
  await mkdir(join(main, '.git', 'worktrees', 'T-1'), { recursive: true });
  await writeFile(join(worktree, '.git'), `gitdir: ${join(main, '.git', 'worktrees', 'T-1')}\n`);
  const cached = join(main, '.cache', 'nvim', NVIM_VERSION, asset.replace(/\.tar\.gz$/, ''), 'bin', 'nvim');
  await mkdir(join(cached, '..'), { recursive: true });
  await writeFile(cached, '#!/bin/sh\necho fake\n', { mode: 0o755 });
  // a download would fail at once: the release is nowhere
  const env = fixtureEnvironment(base, process.env, { CLAND_NVIM: '', CLAND_NVIM_CACHE_DIR: '', CLAND_NVIM_DOWNLOAD_URL: pathToFileURL(join(base, 'no-such-release.tar.gz')).href, CLAND_NVIM_DOWNLOAD_SHA256: '0'.repeat(64) });
  const run = (root: string) => spawnSync(process.execPath, [join(root, 'nvim', 'bin', 'nvim-path.ts')], { cwd: root, env, encoding: 'utf8' });

  const out = run(worktree);
  assert.equal(out.status, 0, out.stderr);
  assert.equal(out.stdout, `${cached}\n`);
  assert.deepEqual(await readdir(worktree), ['.git', 'nvim'], 'nothing was cached in the worktree');

  // its own cache wins once it has one; the main worktree looks nowhere else
  const own = join(worktree, '.cache', 'nvim', NVIM_VERSION, asset.replace(/\.tar\.gz$/, ''), 'bin', 'nvim');
  await mkdir(join(own, '..'), { recursive: true });
  await writeFile(own, '#!/bin/sh\necho own\n', { mode: 0o755 });
  assert.equal(run(worktree).stdout, `${own}\n`);
  await rm(join(main, '.cache'), { recursive: true });
  assert.notEqual(run(main).status, 0, 'the main worktree has nothing to fall back on');
});
