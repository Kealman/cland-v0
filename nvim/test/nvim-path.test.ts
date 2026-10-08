// The launcher's resolver run as a script prints the binary's path, also from a checkout whose path holds
// characters a file URL escapes (a space, `#`, `%`).
import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFile, mkdir, mkdtemp, readdir, readFile, rm, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { assetName, NVIM_DIR, NVIM_VERSION } from '../bin/nvim-path.ts';

test('nvim-path.ts prints the binary from a path with a space, # and %', async (t) => {
  const base = await mkdtemp(join(tmpdir(), 'cland-path-'));
  t.after(() => rm(base, { recursive: true, force: true }));
  const nvimDir = join(base, 'a b#c%20d', 'nvim');
  await mkdir(join(nvimDir, 'bin'), { recursive: true });
  for (const f of ['NVIM_VERSION', 'NVIM_SHA256SUMS']) await copyFile(join(NVIM_DIR, f), join(nvimDir, f));
  await copyFile(join(NVIM_DIR, 'bin', 'nvim-path.ts'), join(nvimDir, 'bin', 'nvim-path.ts'));
  // CLAND_NVIM names the binary: any existing file will do, nothing is downloaded
  const fake = join(nvimDir, 'NVIM_VERSION');
  const out = spawnSync(process.execPath, [join(nvimDir, 'bin', 'nvim-path.ts')], { env: { ...process.env, CLAND_NVIM: fake }, encoding: 'utf8' });
  assert.equal(out.status, 0, out.stderr);
  assert.equal(out.stdout, `${fake}\n`);
});

/** A release tarball of our own, served from a file: URL, with its digest; `resolve()` runs the resolver as a script. */
async function fakeRelease(t: TestContext, extra: Record<string, string> = {}) {
  const base = await mkdtemp(join(tmpdir(), 'cland-nvim-race-'));
  t.after(() => rm(base, { recursive: true, force: true }));
  const asset = assetName();
  if (!asset) return null;
  const unpacked = asset.replace(/\.tar\.gz$/, '');
  const src = join(base, 'src');
  await mkdir(join(src, unpacked, 'bin'), { recursive: true });
  await writeFile(join(src, unpacked, 'bin', 'nvim'), '#!/bin/sh\necho fake\n', { mode: 0o755 });
  const tarball = join(base, asset);
  const tar = spawnSync('tar', ['-czf', tarball, '-C', src, unpacked]);
  assert.equal(tar.status, 0, String(tar.stderr));
  const sha = createHash('sha256').update(await readFile(tarball)).digest('hex');
  const cache = join(base, 'cache');
  const env = {
    ...process.env,
    CLAND_NVIM: '',
    CLAND_NVIM_CACHE_DIR: cache,
    CLAND_NVIM_DOWNLOAD_URL: pathToFileURL(tarball).href,
    CLAND_NVIM_DOWNLOAD_SHA256: sha,
    // the download holds still before it writes, so two resolvers overlap
    CLAND_TEST_NVIM_DOWNLOAD_PAUSE_MS: '500',
    ...extra,
  };
  const resolve = () =>
    new Promise<{ code: number | null; stdout: string; stderr: string }>((done) => {
      const child = spawn(process.execPath, [join(NVIM_DIR, 'bin', 'nvim-path.ts')], { env });
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
  return { dir, unpacked, expected: join(dir, unpacked, 'bin', 'nvim'), resolve };
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
